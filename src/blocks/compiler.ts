/**
 * Converte a serialização JSON do workspace de uma ação em comandos executáveis.
 * Funciona só com JSON (sem Blockly carregado), então roda no Node e nos testes.
 */
import type { CampoDef, Expr, FuncMat, ModoCritico, OpCmp, OpMat, Stmt } from '../shared/types';

interface BlocoJson {
  type: string;
  x?: number;
  y?: number;
  enabled?: boolean;
  disabledReasons?: string[];
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: BlocoJson; shadow?: BlocoJson }>;
  next?: { block?: BlocoJson; shadow?: BlocoJson };
}

export interface ContextoCompilacao {
  /** Campos da ficha do personagem; quando informado, referências inválidas viram avisos. */
  campos?: CampoDef[];
  /** Campos do item, quando a ação pertence a uma lista. */
  camposItem?: CampoDef[];
}

export interface ResultadoCompilacao {
  corpo: Stmt[];
  avisos: string[];
}

const ID_VALIDO = /^[A-Za-z_][A-Za-z0-9_]*$/;
const OPS_MAT: OpMat[] = ['+', '-', '*', '/', '%', 'min', 'max'];
const FUNCS: FuncMat[] = ['piso', 'teto', 'arred', 'abs'];
const OPS_CMP: OpCmp[] = ['==', '!=', '<', '<=', '>', '>='];

function desativado(b: BlocoJson): boolean {
  return b.enabled === false || (b.disabledReasons?.length ?? 0) > 0;
}

function* cadeia(inicio: BlocoJson | undefined): Generator<BlocoJson> {
  for (let b = inicio; b; b = b.next?.block) if (!desativado(b)) yield b;
}

function entrada(b: BlocoJson, nome: string): BlocoJson | undefined {
  const i = b.inputs?.[nome];
  const filho = i?.block ?? i?.shadow;
  return filho && !desativado(filho) ? filho : undefined;
}

function texto(b: BlocoJson, nome: string): string {
  return String(b.fields?.[nome] ?? '').trim();
}

function opcao<T extends string>(valor: unknown, validas: readonly T[], padrao: T): T {
  return validas.includes(valor as T) ? (valor as T) : padrao;
}

class Compilador {
  private avisos = new Set<string>();

  constructor(private contexto: ContextoCompilacao) {}

  compilar(workspace: unknown): ResultadoCompilacao {
    const topo = ((workspace as { blocks?: { blocks?: BlocoJson[] } } | null)?.blocks?.blocks ?? []).slice();
    topo.sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));
    const corpo = topo.flatMap((inicio) => this.comandos(inicio));
    return { corpo, avisos: [...this.avisos] };
  }

  private aviso(msg: string) {
    this.avisos.add(msg);
  }

  private conferirCampo(id: string) {
    const { campos } = this.contexto;
    if (!campos) return;
    if (!campos.some((c) => c.id === id)) this.aviso(`O campo "${id}" não existe mais na ficha`);
  }

  private conferirCampoItem(id: string) {
    const { camposItem } = this.contexto;
    if (!camposItem) return;
    if (camposItem.length === 0) this.aviso(`"item atual . ${id}": esta ação não pertence a uma lista`);
    else if (!camposItem.some((c) => c.id === id)) this.aviso(`O item da lista não tem o campo "${id}"`);
  }

  private comandos(inicio: BlocoJson | undefined): Stmt[] {
    const lista: Stmt[] = [];
    for (const b of cadeia(inicio)) {
      switch (b.type) {
        case 'rpg_definir_var': {
          const nome = texto(b, 'NOME');
          if (!ID_VALIDO.test(nome)) this.aviso(`Nome de variável inválido: "${nome}"`);
          lista.push({ k: 'definir', nome, valor: this.expr(b, 'VALOR', `definir variável "${nome}"`) });
          break;
        }
        case 'rpg_se':
          lista.push({
            k: 'se',
            cond: this.expr(b, 'COND', 'se'),
            entao: this.comandos(entrada(b, 'ENTAO')),
            senao: this.comandos(entrada(b, 'SENAO')),
          });
          break;
        case 'rpg_log': {
          const valor = entrada(b, 'VALOR');
          lista.push({ k: 'log', texto: texto(b, 'TEXTO'), valor: valor ? this.valor(valor) : undefined });
          break;
        }
        case 'rpg_alterar_campo': {
          const id = texto(b, 'ID');
          this.conferirCampo(id);
          lista.push({ k: 'alterar', alvo: 'campo', id, valor: this.expr(b, 'VALOR', `alterar campo "${id}"`) });
          break;
        }
        case 'rpg_alterar_item': {
          const id = texto(b, 'ID');
          this.conferirCampoItem(id);
          lista.push({ k: 'alterar', alvo: 'item', id, valor: this.expr(b, 'VALOR', `alterar campo do item "${id}"`) });
          break;
        }
        default:
          this.aviso(`O bloco "${b.type}" não é um comando (foi ignorado)`);
      }
    }
    return lista;
  }

  private expr(b: BlocoJson, nome: string, contexto: string): Expr {
    const filho = entrada(b, nome);
    if (!filho) {
      this.aviso(`Falta encaixar um valor em ${contexto}`);
      return { k: 'num', v: 0 };
    }
    return this.valor(filho);
  }

  private valor(b: BlocoJson): Expr {
    switch (b.type) {
      case 'rpg_numero': {
        const n = Number(b.fields?.NUM ?? 0);
        return { k: 'num', v: Number.isFinite(n) ? n : 0 };
      }
      case 'rpg_texto':
        return { k: 'txt', v: String(b.fields?.TXT ?? '') };
      case 'rpg_bool':
        return { k: 'bool', v: b.fields?.BOOL === 'true' };
      case 'rpg_campo_valor': {
        const id = texto(b, 'ID');
        this.conferirCampo(id);
        return { k: 'campo', id };
      }
      case 'rpg_item_valor': {
        const id = texto(b, 'ID');
        this.conferirCampoItem(id);
        return { k: 'item', id };
      }
      case 'rpg_var':
        return { k: 'var', nome: texto(b, 'NOME') };
      case 'rpg_mat':
        return {
          k: 'mat',
          op: opcao(b.fields?.OP, OPS_MAT, '+'),
          a: this.expr(b, 'A', 'uma conta'),
          b: this.expr(b, 'B', 'uma conta'),
        };
      case 'rpg_func':
        return { k: 'func', f: opcao(b.fields?.F, FUNCS, 'piso'), a: this.expr(b, 'A', 'uma função') };
      case 'rpg_cmp':
        return {
          k: 'cmp',
          op: opcao(b.fields?.OP, OPS_CMP, '=='),
          a: this.expr(b, 'A', 'uma comparação'),
          b: this.expr(b, 'B', 'uma comparação'),
        };
      case 'rpg_logico':
        return {
          k: 'logico',
          op: b.fields?.OP === 'ou' ? 'ou' : 'e',
          a: this.expr(b, 'A', '"e/ou"'),
          b: this.expr(b, 'B', '"e/ou"'),
        };
      case 'rpg_nao':
        return { k: 'nao', a: this.expr(b, 'A', '"não"') };
      case 'rpg_juntar':
        return { k: 'juntar', a: this.expr(b, 'A', '"juntar"'), b: this.expr(b, 'B', '"juntar"') };
      case 'rpg_rolar':
        return { k: 'rolar', dados: this.expr(b, 'DADOS', '"rolar"') };
      case 'rpg_natural':
        return { k: 'natural' };
      case 'rpg_critico':
        return { k: 'critico', margem: this.expr(b, 'MARGEM', '"é crítico?"') };
      case 'rpg_rolar_dano':
        return {
          k: 'rolarDano',
          dados: this.expr(b, 'DADOS', '"rolar dano" (dados)'),
          margem: this.expr(b, 'MARGEM', '"rolar dano" (margem de crítico)'),
          mult: this.expr(b, 'MULT', '"rolar dano" (multiplicador)'),
          modo: opcao<ModoCritico>(b.fields?.MODO, ['dados', 'total'], 'dados'),
        };
      default:
        this.aviso(`O bloco "${b.type}" não pode ser usado como valor`);
        return { k: 'num', v: 0 };
    }
  }
}

export function compilarAcao(workspace: unknown, contexto: ContextoCompilacao = {}): ResultadoCompilacao {
  return new Compilador(contexto).compilar(workspace);
}

/** Remove ids e coordenadas de um bloco serializado (para reutilizar como bloco personalizado). */
export function limparIds<T>(estado: T): T {
  if (Array.isArray(estado)) return estado.map(limparIds) as T;
  if (!estado || typeof estado !== 'object') return estado;
  const copia: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(estado)) {
    if (chave === 'id' || chave === 'x' || chave === 'y') continue;
    copia[chave] = limparIds(valor);
  }
  return copia as T;
}
