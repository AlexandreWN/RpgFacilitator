export type Rng = () => number;

/** Número aleatório em [0, 1) usando o gerador criptográfico (browser e Node). */
export const rngPadrao: Rng = () => {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 4294967296;
};

export class ErroDados extends Error {}

export interface GrupoDados {
  quantidade: number;
  faces: number;
  resultados: number[];
}

export interface ResultadoRolagem {
  expressao: string;
  total: number;
  /** Ex.: "2d6[3, 5] + FOR_MOD(3)" */
  detalhe: string;
  grupos: GrupoDados[];
  /** Primeiro resultado do primeiro d20 rolado na expressão. */
  naturalD20?: number;
}

export interface OpcoesRolagem {
  rng?: Rng;
  /** Multiplica a quantidade de dados de cada termo (usado no crítico). */
  multiplicarDados?: number;
  /** Resolve identificadores (ex.: FOR_MOD) para números. */
  resolver?: (id: string) => number;
  /** Proíbe dados na expressão (usado em campos calculados). */
  semDados?: boolean;
}

const MAX_DADOS = 1000;
const MAX_FACES = 1_000_000;

/** Funções aceitas nas expressões: piso(x), min(a, b)… */
const FUNCOES: Record<string, { args: number; calc: (a: number[]) => number }> = {
  piso: { args: 1, calc: ([a]) => Math.floor(a) },
  teto: { args: 1, calc: ([a]) => Math.ceil(a) },
  arred: { args: 1, calc: ([a]) => Math.round(a) },
  abs: { args: 1, calc: ([a]) => Math.abs(a) },
  min: { args: 2, calc: ([a, b]) => Math.min(a, b) },
  max: { args: 2, calc: ([a, b]) => Math.max(a, b) },
};

export const NOMES_FUNCOES = Object.keys(FUNCOES);

type Token =
  | { t: 'num'; v: number }
  | { t: 'dado'; q: number; f: number }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string };

const RE_ESPACO = /\s+/y;
const RE_DADO = /(\d*)[dD](\d+|%)(?![A-Za-z0-9_])/y;
const RE_NUM = /\d+(?:[.,]\d+)?/y;
const RE_ID = /[A-Za-z_À-ÿ][A-Za-z0-9_À-ÿ]*/y;

function tokenizar(expressao: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const casar = (re: RegExp) => {
    re.lastIndex = i;
    const m = re.exec(expressao);
    if (m) i = re.lastIndex;
    return m;
  };
  while (i < expressao.length) {
    if (casar(RE_ESPACO)) continue;
    let m = casar(RE_DADO);
    if (m) {
      tokens.push({ t: 'dado', q: m[1] === '' ? 1 : Number(m[1]), f: m[2] === '%' ? 100 : Number(m[2]) });
      continue;
    }
    m = casar(RE_NUM);
    if (m) {
      tokens.push({ t: 'num', v: Number(m[0].replace(',', '.')) });
      continue;
    }
    m = casar(RE_ID);
    if (m) {
      tokens.push({ t: 'id', v: m[0] });
      continue;
    }
    const c = expressao[i];
    if ('+-*/(),'.includes(c)) tokens.push({ t: 'op', v: c });
    else if (c === '×') tokens.push({ t: 'op', v: '*' });
    else if (c === '÷') tokens.push({ t: 'op', v: '/' });
    else throw new ErroDados(`Caractere inválido "${c}" em "${expressao}"`);
    i++;
  }
  return tokens;
}

interface Parte {
  valor: number;
  texto: string;
}

/**
 * Rola uma expressão como "2d6+3", "1d20 + FOR_MOD" ou "piso((FOR-10)/2)".
 * Divisão arredonda para baixo.
 */
export function rolarExpressao(expressao: string, opcoes: OpcoesRolagem = {}): ResultadoRolagem {
  const tokens = tokenizar(expressao);
  if (tokens.length === 0) throw new ErroDados('Expressão vazia');
  const rng = opcoes.rng ?? rngPadrao;
  const mult = Math.max(1, Math.floor(opcoes.multiplicarDados ?? 1));
  const grupos: GrupoDados[] = [];
  let naturalD20: number | undefined;
  let pos = 0;

  const ehOp = (...ops: string[]) => {
    const tk = tokens[pos];
    return tk?.t === 'op' && ops.includes(tk.v) ? tk.v : null;
  };

  const expr = (): Parte => {
    let esq = termo();
    for (let op = ehOp('+', '-'); op; op = ehOp('+', '-')) {
      pos++;
      const dir = termo();
      esq = { valor: op === '+' ? esq.valor + dir.valor : esq.valor - dir.valor, texto: `${esq.texto} ${op} ${dir.texto}` };
    }
    return esq;
  };

  const termo = (): Parte => {
    let esq = fator();
    for (let op = ehOp('*', '/'); op; op = ehOp('*', '/')) {
      pos++;
      const dir = fator();
      if (op === '/' && dir.valor === 0) throw new ErroDados(`Divisão por zero em "${expressao}"`);
      esq = {
        valor: op === '*' ? esq.valor * dir.valor : Math.floor(esq.valor / dir.valor),
        texto: `${esq.texto} ${op === '*' ? '×' : '÷'} ${dir.texto}`,
      };
    }
    return esq;
  };

  const fator = (): Parte => {
    const tk = tokens[pos++];
    if (!tk) throw new ErroDados(`Expressão incompleta: "${expressao}"`);
    switch (tk.t) {
      case 'num':
        return { valor: tk.v, texto: String(tk.v) };
      case 'id': {
        const funcao = FUNCOES[tk.v.toLowerCase()];
        if (funcao && ehOp('(')) {
          pos++;
          const args: Parte[] = [expr()];
          while (ehOp(',')) {
            pos++;
            args.push(expr());
          }
          if (!ehOp(')')) throw new ErroDados(`Faltou fechar o parêntese de ${tk.v} em "${expressao}"`);
          pos++;
          if (args.length !== funcao.args) {
            throw new ErroDados(`${tk.v} espera ${funcao.args} valor(es), recebeu ${args.length}`);
          }
          return { valor: funcao.calc(args.map((a) => a.valor)), texto: `${tk.v}(${args.map((a) => a.texto).join(', ')})` };
        }
        if (funcao) throw new ErroDados(`Faltou "(" depois de ${tk.v} em "${expressao}"`);
        if (!opcoes.resolver) throw new ErroDados(`"${tk.v}" não é permitido nesta expressão`);
        const v = opcoes.resolver(tk.v);
        return { valor: v, texto: `${tk.v}(${v})` };
      }
      case 'dado': {
        if (opcoes.semDados) throw new ErroDados(`Não dá para usar dados aqui (${tk.q || ''}d${tk.f})`);
        const q = tk.q * mult;
        if (q < 1 || q > MAX_DADOS) throw new ErroDados(`Quantidade de dados inválida (${q}) em "${expressao}"`);
        if (tk.f < 1 || tk.f > MAX_FACES) throw new ErroDados(`Número de faces inválido (${tk.f}) em "${expressao}"`);
        const resultados = Array.from({ length: q }, () => Math.floor(rng() * tk.f) + 1);
        grupos.push({ quantidade: q, faces: tk.f, resultados });
        if (tk.f === 20 && naturalD20 === undefined) naturalD20 = resultados[0];
        return { valor: resultados.reduce((s, r) => s + r, 0), texto: `${q}d${tk.f}[${resultados.join(', ')}]` };
      }
      case 'op':
        if (tk.v === '-') {
          const f = fator();
          return { valor: -f.valor, texto: `-${f.texto}` };
        }
        if (tk.v === '(') {
          const e = expr();
          if (!ehOp(')')) throw new ErroDados(`Faltou fechar parênteses em "${expressao}"`);
          pos++;
          return { valor: e.valor, texto: `(${e.texto})` };
        }
        throw new ErroDados(`Símbolo inesperado "${tk.v}" em "${expressao}"`);
    }
  };

  const resultado = expr();
  if (pos < tokens.length) throw new ErroDados(`Símbolo inesperado em "${expressao}"`);
  return { expressao, total: resultado.valor, detalhe: resultado.texto, grupos, naturalD20 };
}

/** Avalia a fórmula de um campo calculado: mesma sintaxe, mas sem dados. */
export function avaliarFormula(expressao: string, resolver: (id: string) => number): number {
  return rolarExpressao(expressao, { resolver, semDados: true }).total;
}
