/**
 * Atalhos para montar workspaces Blockly em código (usados pelos geradores de template).
 * O formato é o mesmo que o editor salva, então dá para abrir e editar tudo depois.
 */
export type Bloco = {
  type: string;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block: Bloco }>;
  next?: { block: Bloco };
};

export function bloco(type: string, fields: Record<string, unknown> = {}, inputs: Record<string, Bloco | undefined> = {}): Bloco {
  const b: Bloco = { type };
  if (Object.keys(fields).length) b.fields = fields;
  const entradas = Object.entries(inputs).filter((e): e is [string, Bloco] => e[1] !== undefined);
  if (entradas.length) b.inputs = Object.fromEntries(entradas.map(([nome, filho]) => [nome, { block: filho }]));
  return b;
}

export function empilhar(...blocos: Bloco[]): Bloco {
  for (let i = 0; i < blocos.length - 1; i++) blocos[i].next = { block: blocos[i + 1] };
  return blocos[0];
}

export function workspace(...comandos: Bloco[]) {
  return { blocks: { languageVersion: 0, blocks: [{ ...empilhar(...comandos), x: 40, y: 40 }] } };
}

// valores
export const num = (v: number) => bloco('rpg_numero', { NUM: v });
export const txt = (v: string) => bloco('rpg_texto', { TXT: v });
export const campoDe = (id: string) => bloco('rpg_campo_valor', { ID: id });
export const itemDe = (id: string) => bloco('rpg_item_valor', { ID: id });
export const variavel = (nome: string) => bloco('rpg_var', { NOME: nome });
export const mat = (a: Bloco, op: string, b: Bloco) => bloco('rpg_mat', { OP: op }, { A: a, B: b });
export const cmp = (a: Bloco, op: string, b: Bloco) => bloco('rpg_cmp', { OP: op }, { A: a, B: b });
export const juntar = (a: Bloco, b: Bloco) => bloco('rpg_juntar', {}, { A: a, B: b });

// dados
export const rolar = (dados: Bloco) => bloco('rpg_rolar', {}, { DADOS: dados });
export const critico = (margem: Bloco) => bloco('rpg_critico', {}, { MARGEM: margem });
export const rolarDano = (dados: Bloco, margem: Bloco, mult: Bloco, modo: 'dados' | 'total' = 'dados') =>
  bloco('rpg_rolar_dano', { MODO: modo }, { DADOS: dados, MARGEM: margem, MULT: mult });

// comandos
export const log = (texto: string, valor?: Bloco) => bloco('rpg_log', { TEXTO: texto }, { VALOR: valor });
export const definir = (nome: string, valor: Bloco) => bloco('rpg_definir_var', { NOME: nome }, { VALOR: valor });
export const se = (cond: Bloco, entao: Bloco, senao?: Bloco) => bloco('rpg_se', {}, { COND: cond, ENTAO: entao, SENAO: senao });
export const alterarCampo = (id: string, valor: Bloco) => bloco('rpg_alterar_campo', { ID: id }, { VALOR: valor });
export const alterarItem = (id: string, valor: Bloco) => bloco('rpg_alterar_item', { ID: id }, { VALOR: valor });
