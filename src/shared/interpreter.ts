import { avaliarFormula, rngPadrao, rolarExpressao, type Rng } from './dice';
import type { AcaoDef, CampoDef, Expr, Item, ListaDef, NoLayout, Stmt, TemplateDef, Valor, Valores } from './types';

export class ErroExecucao extends Error {}

const LIMITE_PASSOS = 10_000;

export interface EntradaLog {
  texto: string;
  valor?: Valor;
  /** Rolagens feitas desde a última linha do log. */
  detalhes: string[];
  critico?: boolean;
}

export interface ResultadoAcao {
  linhas: EntradaLog[];
  /** Valores do personagem após a ação (iguais aos originais se houve erro). */
  valores: Valores;
  critico: boolean;
  erro?: string;
}

export interface ContextoItem {
  listaId?: string;
  indice?: number;
}

/** Campos posicionados na ficha (entra em painéis, não entra em listas). */
export function camposEm(nos: NoLayout[]): CampoDef[] {
  const campos: CampoDef[] = [];
  for (const no of nos) {
    if (no.tipo === 'campo') campos.push(no.campo);
    else if (no.tipo === 'painel') campos.push(...camposEm(no.filhos));
  }
  return campos;
}

export function camposDoPersonagem(def: TemplateDef): CampoDef[] {
  return camposEm(def.layout);
}

export function camposDaLista(lista: ListaDef): CampoDef[] {
  return camposEm(lista.item);
}

export function listasEm(nos: NoLayout[]): ListaDef[] {
  const listas: ListaDef[] = [];
  for (const no of nos) {
    if (no.tipo === 'lista') listas.push(no.lista);
    else if (no.tipo === 'painel') listas.push(...listasEm(no.filhos));
  }
  return listas;
}

export function listasDoTemplate(def: TemplateDef): ListaDef[] {
  return listasEm(def.layout);
}

export function acharAcao(def: TemplateDef, id: string): AcaoDef | undefined {
  return def.acoes.find((a) => a.id === id);
}

export function valorPadraoCampo(campo: CampoDef): Valor {
  if (campo.padrao !== undefined) return campo.padrao;
  if (campo.tipo === 'numero') return 0;
  if (campo.tipo === 'marcador') return false;
  return '';
}

export function itemPadrao(lista: ListaDef): Item {
  const item: Item = {};
  for (const c of camposDaLista(lista)) if (c.tipo !== 'calculado') item[c.id] = valorPadraoCampo(c);
  return item;
}

/** Preenche com o valor padrão tudo que o template define e o personagem ainda não tem. */
export function completarValores(def: TemplateDef, valores: Valores = {}): Valores {
  const r: Valores = { ...valores };
  for (const c of camposDoPersonagem(def)) {
    if (c.tipo !== 'calculado' && (r[c.id] === undefined || Array.isArray(r[c.id]))) r[c.id] = valorPadraoCampo(c);
  }
  for (const l of listasDoTemplate(def)) {
    const atual = r[l.id];
    const padrao = itemPadrao(l);
    r[l.id] = Array.isArray(atual) ? atual.map((it) => ({ ...padrao, ...it })) : [];
  }
  return r;
}

export function paraNumero(v: Valor): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v.trim() === '' ? NaN : Number(v.replace(',', '.'));
}

export function paraBooleano(v: Valor): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = v.trim().toLowerCase();
  return s !== '' && s !== '0' && s !== 'false' && s !== 'falso' && s !== 'não' && s !== 'nao';
}

export function formatarValor(v: Valor | undefined): string {
  if (v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  return v;
}

function numeroObrigatorio(v: Valor, contexto: string): number {
  const n = paraNumero(v);
  if (!Number.isFinite(n)) throw new ErroExecucao(`${contexto}: "${formatarValor(v)}" não é um número`);
  return n;
}

class Execucao {
  vars = new Map<string, Valor>();
  linhas: EntradaLog[] = [];
  pendentes: string[] = [];
  critico = false;
  private criticoPendente = false;
  private ultimoNatural: number | undefined;
  private passos = 0;
  private calculando = new Set<string>();
  private campos: Map<string, CampoDef>;
  private camposItem: Map<string, CampoDef>;

  constructor(
    def: TemplateDef,
    public valores: Valores,
    private lista: ListaDef | undefined,
    private item: Item | undefined,
    private rng: Rng,
  ) {
    this.campos = new Map(camposDoPersonagem(def).map((c) => [c.id, c]));
    this.camposItem = new Map(lista ? camposDaLista(lista).map((c) => [c.id, c]) : []);
  }

  private passo() {
    if (++this.passos > LIMITE_PASSOS) throw new ErroExecucao('Limite de passos excedido');
  }

  calcularCampo(campo: CampoDef, escopo: 'campo' | 'item' = 'campo'): Valor {
    const chave = `${escopo}:${campo.id}`;
    if (this.calculando.has(chave)) throw new ErroExecucao(`O campo calculado "${campo.id}" depende de si mesmo`);
    this.calculando.add(chave);
    try {
      const formula = (campo.formula ?? '').trim();
      return formula ? avaliarFormula(formula, this.resolverIdentificador) : 0;
    } finally {
      this.calculando.delete(chave);
    }
  }

  lerCampo(id: string): Valor {
    const campo = this.campos.get(id);
    if (!campo) throw new ErroExecucao(`O campo "${id}" não existe na ficha`);
    if (campo.tipo === 'calculado') return this.calcularCampo(campo);
    const v = this.valores[id];
    return v === undefined || Array.isArray(v) ? valorPadraoCampo(campo) : v;
  }

  lerItem(id: string): Valor {
    if (!this.lista || !this.item) throw new ErroExecucao(`"item atual . ${id}" só funciona em ações dentro de uma lista`);
    const campo = this.camposItem.get(id);
    if (!campo) throw new ErroExecucao(`A lista "${this.lista.rotulo}" não tem o campo "${id}"`);
    if (campo.tipo === 'calculado') return this.calcularCampo(campo, 'item');
    return this.item[id] ?? valorPadraoCampo(campo);
  }

  /** Identificadores dentro de fórmulas e dados: campo do item → variável → campo do personagem. */
  private resolverIdentificador = (id: string): number => {
    let v: Valor;
    if (this.camposItem.has(id)) v = this.lerItem(id);
    else if (this.vars.has(id)) v = this.vars.get(id)!;
    else v = this.lerCampo(id);
    return numeroObrigatorio(v, id);
  };

  private rolar(dados: Valor, multiplicarDados = 1, sufixo = ''): number {
    if (typeof dados === 'number') return dados;
    if (typeof dados === 'boolean') throw new ErroExecucao('Não é possível rolar um valor sim/não');
    const texto = dados.trim();
    if (texto === '') return 0;
    const r = rolarExpressao(texto, { rng: this.rng, multiplicarDados, resolver: this.resolverIdentificador });
    if (r.naturalD20 !== undefined) this.ultimoNatural = r.naturalD20;
    this.pendentes.push(`${texto} → ${r.detalhe} = ${r.total}${sufixo}`);
    return r.total;
  }

  private ehCritico(margem: Valor): boolean {
    const m = paraNumero(margem);
    const critico = this.ultimoNatural !== undefined && Number.isFinite(m) && this.ultimoNatural >= m;
    if (critico) {
      this.critico = true;
      this.criticoPendente = true;
    }
    return critico;
  }

  avaliar(e: Expr): Valor {
    this.passo();
    switch (e.k) {
      case 'num':
      case 'txt':
      case 'bool':
        return e.v;
      case 'campo':
        return this.lerCampo(e.id);
      case 'item':
        return this.lerItem(e.id);
      case 'var':
        if (!this.vars.has(e.nome)) throw new ErroExecucao(`A variável "${e.nome}" ainda não foi definida`);
        return this.vars.get(e.nome)!;
      case 'mat': {
        const a = numeroObrigatorio(this.avaliar(e.a), 'Conta');
        const b = numeroObrigatorio(this.avaliar(e.b), 'Conta');
        switch (e.op) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/':
            if (b === 0) throw new ErroExecucao('Divisão por zero');
            return a / b;
          case '%':
            if (b === 0) throw new ErroExecucao('Divisão por zero');
            return a % b;
          case 'min': return Math.min(a, b);
          case 'max': return Math.max(a, b);
        }
        break;
      }
      case 'func': {
        const a = numeroObrigatorio(this.avaliar(e.a), 'Função');
        switch (e.f) {
          case 'piso': return Math.floor(a);
          case 'teto': return Math.ceil(a);
          case 'arred': return Math.round(a);
          case 'abs': return Math.abs(a);
        }
        break;
      }
      case 'cmp': {
        const a = this.avaliar(e.a);
        const b = this.avaliar(e.b);
        const na = paraNumero(a);
        const nb = paraNumero(b);
        const numerico = Number.isFinite(na) && Number.isFinite(nb);
        switch (e.op) {
          case '==': return numerico ? na === nb : formatarValor(a) === formatarValor(b);
          case '!=': return numerico ? na !== nb : formatarValor(a) !== formatarValor(b);
          case '<': return numerico ? na < nb : formatarValor(a) < formatarValor(b);
          case '<=': return numerico ? na <= nb : formatarValor(a) <= formatarValor(b);
          case '>': return numerico ? na > nb : formatarValor(a) > formatarValor(b);
          case '>=': return numerico ? na >= nb : formatarValor(a) >= formatarValor(b);
        }
        break;
      }
      case 'logico':
        return e.op === 'e'
          ? paraBooleano(this.avaliar(e.a)) && paraBooleano(this.avaliar(e.b))
          : paraBooleano(this.avaliar(e.a)) || paraBooleano(this.avaliar(e.b));
      case 'nao':
        return !paraBooleano(this.avaliar(e.a));
      case 'juntar':
        return formatarValor(this.avaliar(e.a)) + formatarValor(this.avaliar(e.b));
      case 'rolar':
        return this.rolar(this.avaliar(e.dados));
      case 'natural':
        if (this.ultimoNatural === undefined) throw new ErroExecucao('Nenhum d20 foi rolado ainda nesta ação');
        return this.ultimoNatural;
      case 'critico':
        return this.ehCritico(this.avaliar(e.margem));
      case 'rolarDano': {
        const dados = this.avaliar(e.dados);
        const critico = this.ehCritico(this.avaliar(e.margem));
        if (!critico) return this.rolar(dados);
        const multValor = paraNumero(this.avaliar(e.mult));
        const mult = Number.isFinite(multValor) && multValor >= 1 ? multValor : 1;
        if (e.modo === 'dados') return this.rolar(dados, mult, ` (CRÍTICO: dados ×${mult})`);
        const base = this.rolar(dados);
        const total = base * mult;
        this.pendentes.push(`CRÍTICO: ${base} × ${mult} = ${total}`);
        return total;
      }
    }
    throw new ErroExecucao('Bloco desconhecido');
  }

  executar(comandos: Stmt[]) {
    for (const s of comandos) {
      this.passo();
      switch (s.k) {
        case 'definir':
          this.vars.set(s.nome, this.avaliar(s.valor));
          break;
        case 'se':
          this.executar(paraBooleano(this.avaliar(s.cond)) ? s.entao : s.senao);
          break;
        case 'log': {
          const valor = s.valor ? this.avaliar(s.valor) : undefined;
          this.linhas.push({ texto: s.texto, valor, detalhes: this.pendentes.splice(0), critico: this.criticoPendente || undefined });
          this.criticoPendente = false;
          break;
        }
        case 'alterar': {
          const valor = this.avaliar(s.valor);
          if (s.alvo === 'item') {
            if (!this.lista || !this.item) throw new ErroExecucao('"alterar campo do item" só funciona em ações dentro de uma lista');
            const campo = this.camposItem.get(s.id);
            if (!campo || campo.tipo === 'calculado') throw new ErroExecucao(`Não é possível alterar "${s.id}" no item`);
            this.item[s.id] = valor;
          } else {
            const campo = this.campos.get(s.id);
            if (!campo || campo.tipo === 'calculado') throw new ErroExecucao(`Não é possível alterar o campo "${s.id}"`);
            this.valores[s.id] = valor;
          }
          break;
        }
      }
    }
  }
}

function localizarItem(def: TemplateDef, valores: Valores, ctx: ContextoItem): { lista?: ListaDef; item?: Item } {
  if (ctx.listaId === undefined) return {};
  const lista = listasDoTemplate(def).find((l) => l.id === ctx.listaId);
  const arr = valores[ctx.listaId];
  const item = Array.isArray(arr) ? arr[ctx.indice ?? -1] : undefined;
  if (!lista || !item) throw new ErroExecucao(`Item não encontrado na lista "${ctx.listaId}"`);
  return { lista, item };
}

export function executarAcao(
  def: TemplateDef,
  acao: AcaoDef,
  valores: Valores,
  ctx: ContextoItem & { rng?: Rng } = {},
): ResultadoAcao {
  const copia = structuredClone(valores);
  let execucao: Execucao | undefined;
  try {
    const { lista, item } = localizarItem(def, copia, ctx);
    execucao = new Execucao(def, copia, lista, item, ctx.rng ?? rngPadrao);
    execucao.executar(acao.corpo);
  } catch (e) {
    const linhas = execucao?.linhas ?? [];
    if (execucao?.pendentes.length) linhas.push({ texto: 'Rolagens', detalhes: execucao.pendentes });
    return { linhas, valores, critico: execucao?.critico ?? false, erro: e instanceof Error ? e.message : String(e) };
  }
  if (execucao.pendentes.length) execucao.linhas.push({ texto: 'Rolagens', detalhes: execucao.pendentes });
  return { linhas: execucao.linhas, valores: copia, critico: execucao.critico };
}

/** Valor de um campo calculado já formatado para exibição (não lança erro). */
export function avaliarCalculado(def: TemplateDef, valores: Valores, campo: CampoDef, ctx: ContextoItem = {}): string {
  try {
    const { lista, item } = localizarItem(def, valores, ctx);
    const execucao = new Execucao(def, valores, lista, item, rngPadrao);
    return formatarValor(execucao.calcularCampo(campo, ctx.listaId === undefined ? 'campo' : 'item'));
  } catch (e) {
    return `⚠ ${e instanceof Error ? e.message : String(e)}`;
  }
}
