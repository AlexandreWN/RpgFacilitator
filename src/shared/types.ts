export type Valor = number | string | boolean;
export type Item = Record<string, Valor>;
export type Valores = Record<string, Valor | Item[]>;

export type TipoCampo = 'numero' | 'texto' | 'dados' | 'marcador' | 'calculado';
export type FormatoLista = 'cartoes' | 'linhas' | 'tabela';
export type EstiloTexto = 'titulo' | 'nota';

export type OpMat = '+' | '-' | '*' | '/' | '%' | 'min' | 'max';
export type FuncMat = 'piso' | 'teto' | 'arred' | 'abs';
export type OpCmp = '==' | '!=' | '<' | '<=' | '>' | '>=';
/** Como o crítico é aplicado: rolando os dados N vezes mais ou multiplicando o total. */
export type ModoCritico = 'dados' | 'total';

/** Expressões (blocos que devolvem um valor). */
export type Expr =
  | { k: 'num'; v: number }
  | { k: 'txt'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'campo'; id: string }
  | { k: 'item'; id: string }
  | { k: 'var'; nome: string }
  | { k: 'mat'; op: OpMat; a: Expr; b: Expr }
  | { k: 'func'; f: FuncMat; a: Expr }
  | { k: 'cmp'; op: OpCmp; a: Expr; b: Expr }
  | { k: 'logico'; op: 'e' | 'ou'; a: Expr; b: Expr }
  | { k: 'nao'; a: Expr }
  | { k: 'juntar'; a: Expr; b: Expr }
  | { k: 'rolar'; dados: Expr }
  | { k: 'natural' }
  | { k: 'critico'; margem: Expr }
  | { k: 'rolarDano'; dados: Expr; margem: Expr; mult: Expr; modo: ModoCritico };

/** Comandos (blocos empilháveis dentro de uma ação). */
export type Stmt =
  | { k: 'definir'; nome: string; valor: Expr }
  | { k: 'se'; cond: Expr; entao: Stmt[]; senao: Stmt[] }
  | { k: 'log'; texto: string; valor?: Expr }
  | { k: 'alterar'; alvo: 'campo' | 'item'; id: string; valor: Expr };

/** Posição e tamanho na grade, em células. */
export interface Pos {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CampoDef {
  id: string;
  tipo: TipoCampo;
  rotulo: string;
  padrao?: Valor;
  /** Só para campos calculados: expressão de texto, ex.: piso((FOR-10)/2). */
  formula?: string;
}

export interface ListaDef {
  id: string;
  rotulo: string;
  /** Como os itens aparecem na ficha. */
  formato: FormatoLista;
  /** Colunas da grade interna de um item. */
  colunas: number;
  /** Layout de um item: o mesmo desenho se repete para todos. */
  item: NoLayout[];
  /** Itens que todo personagem novo já recebe (ex.: a lista de perícias). */
  itensPadrao?: Item[];
}

/** Um elemento posicionado na ficha. */
export type NoLayout =
  | { tipo: 'campo'; pos: Pos; campo: CampoDef }
  | { tipo: 'acao'; pos: Pos; acaoId: string }
  | { tipo: 'texto'; pos: Pos; texto: string; estilo: EstiloTexto }
  | { tipo: 'painel'; pos: Pos; titulo: string; colunas: number; filhos: NoLayout[] }
  | { tipo: 'lista'; pos: Pos; lista: ListaDef };

export interface AcaoDef {
  id: string;
  rotulo: string;
  /** id da lista quando a ação é de um item; ausente quando é global. */
  escopo?: string;
  /** Comandos compilados a partir dos blocos. */
  corpo: Stmt[];
  /** Serialização do workspace Blockly desta ação (fonte da verdade para edição). */
  workspace?: unknown;
}

export interface TemplateDef {
  /** Colunas da grade principal da ficha. */
  colunas: number;
  layout: NoLayout[];
  acoes: AcaoDef[];
}

export interface TemplateArquivo {
  formato: 'rpg-template';
  versao: 2;
  id: string;
  nome: string;
  definicao: TemplateDef;
}

export interface PersonagemArquivo {
  formato: 'rpg-personagem';
  versao: 1;
  id: string;
  nome: string;
  template: string;
  valores: Valores;
}

export interface BlocoArquivo {
  formato: 'rpg-bloco';
  versao: 1;
  id: string;
  nome: string;
  bloco: Record<string, unknown>;
}

export interface ResumoArquivo {
  id: string;
  nome: string;
  template?: string;
  modificado: string;
  erro?: string;
}
