import type { CSSProperties } from 'react';
import { compilarAcao } from '../blocks/compiler';
import { BLOCOS_INICIAIS } from '../blocks/toolbox';
import type { AcaoDef, CampoDef, ListaDef, NoLayout, Pos, TemplateDef, TipoCampo } from '../shared/types';

export const COLUNAS_PADRAO = 12;
export const ALTURA_LINHA = 56;
export const ESPACO = 8;

/** Caminho até um nó: índices sucessivos, entrando em painéis e no item de listas. */
export type Caminho = number[];
export type ContextoGrade = 'raiz' | 'painel' | 'item';

export function templateVazio(): TemplateDef {
  return { colunas: COLUNAS_PADRAO, layout: [], acoes: [] };
}

export function colide(a: Pos, b: Pos): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function filhosDe(no: NoLayout): NoLayout[] | undefined {
  if (no.tipo === 'painel') return no.filhos;
  if (no.tipo === 'lista') return no.lista.item;
  return undefined;
}

export function comFilhos(no: NoLayout, filhos: NoLayout[]): NoLayout {
  if (no.tipo === 'painel') return { ...no, filhos };
  if (no.tipo === 'lista') return { ...no, lista: { ...no.lista, item: filhos } };
  return no;
}

export function colunasDe(no: NoLayout): number {
  if (no.tipo === 'painel') return no.colunas;
  if (no.tipo === 'lista') return no.lista.colunas;
  return 1;
}

export function obterNo(nos: NoLayout[], caminho: Caminho): NoLayout | undefined {
  let atual: NoLayout | undefined;
  let nivel = nos;
  for (const i of caminho) {
    atual = nivel[i];
    if (!atual) return undefined;
    nivel = filhosDe(atual) ?? [];
  }
  return atual;
}

/** Troca (ou remove, devolvendo null) o nó do caminho. */
export function transformar(nos: NoLayout[], caminho: Caminho, fn: (no: NoLayout) => NoLayout | null): NoLayout[] {
  if (caminho.length === 0) return nos;
  const [i, ...resto] = caminho;
  return nos.flatMap((no, j) => {
    if (j !== i) return [no];
    if (resto.length === 0) {
      const novo = fn(no);
      return novo ? [novo] : [];
    }
    const filhos = filhosDe(no);
    return filhos ? [comFilhos(no, transformar(filhos, resto, fn))] : [no];
  });
}

/** Aplica uma função à lista de filhos da grade indicada ([] = grade raiz). */
export function mapearGrade(nos: NoLayout[], grade: Caminho, fn: (filhos: NoLayout[]) => NoLayout[]): NoLayout[] {
  if (grade.length === 0) return fn(nos);
  return transformar(nos, grade, (pai) => {
    const filhos = filhosDe(pai);
    return filhos ? comFilhos(pai, fn(filhos)) : pai;
  });
}

export function contextoDaGrade(nos: NoLayout[], grade: Caminho): ContextoGrade {
  if (grade.length === 0) return 'raiz';
  const no = obterNo(nos, grade);
  return no?.tipo === 'lista' ? 'item' : 'painel';
}

export function podeConter(contexto: ContextoGrade, tipo: NoLayout['tipo']): boolean {
  if (contexto === 'raiz') return true;
  return tipo === 'campo' || tipo === 'texto' || tipo === 'acao';
}

export function listaDaGrade(nos: NoLayout[], grade: Caminho): ListaDef | undefined {
  const no = grade.length ? obterNo(nos, grade) : undefined;
  return no?.tipo === 'lista' ? no.lista : undefined;
}

export function listaPorId(def: TemplateDef, id: string): ListaDef | undefined {
  const procurar = (nos: NoLayout[]): ListaDef | undefined => {
    for (const no of nos) {
      if (no.tipo === 'lista') {
        if (no.lista.id === id) return no.lista;
      } else if (no.tipo === 'painel') {
        const achado = procurar(no.filhos);
        if (achado) return achado;
      }
    }
    return undefined;
  };
  return procurar(def.layout);
}

/** Resolve sobreposições empurrando os nós para baixo; o nó prioritário fica onde está. */
export function acomodar(nos: NoLayout[], colunas: number, prioritario = -1): NoLayout[] {
  const copia = nos.map((no) => ({ ...no, pos: { ...no.pos } }));
  for (const no of copia) {
    no.pos.w = Math.min(Math.max(1, Math.round(no.pos.w)), colunas);
    no.pos.h = Math.max(1, Math.round(no.pos.h));
    no.pos.x = Math.min(Math.max(0, Math.round(no.pos.x)), colunas - no.pos.w);
    no.pos.y = Math.max(0, Math.round(no.pos.y));
  }
  const ordem = copia
    .map((_, i) => i)
    .sort((a, b) => {
      if (a === prioritario) return -1;
      if (b === prioritario) return 1;
      return copia[a].pos.y - copia[b].pos.y || copia[a].pos.x - copia[b].pos.x;
    });
  const postos: NoLayout[] = [];
  for (const i of ordem) {
    const no = copia[i];
    while (postos.some((p) => colide(p.pos, no.pos))) no.pos.y++;
    postos.push(no);
  }
  return copia;
}

export function acomodarGrade(def: TemplateDef, grade: Caminho, prioritario: number): TemplateDef {
  const colunas = grade.length === 0 ? def.colunas : (colunasDe(obterNo(def.layout, grade)!) ?? def.colunas);
  return { ...def, layout: mapearGrade(def.layout, grade, (filhos) => acomodar(filhos, colunas, prioritario)) };
}

function ehPrefixo(prefixo: Caminho, caminho: Caminho): boolean {
  return prefixo.every((v, i) => caminho[i] === v);
}

/** Corrige um caminho depois de remover outro nó da árvore. */
function ajustarCaminho(caminho: Caminho, removido: Caminho): Caminho {
  const d = removido.length - 1;
  if (caminho.length > d && ehPrefixo(removido.slice(0, d), caminho) && caminho[d] > removido[d]) {
    const copia = [...caminho];
    copia[d]--;
    return copia;
  }
  return caminho;
}

export function inserirEm(def: TemplateDef, grade: Caminho, no: NoLayout): TemplateDef {
  const layout = mapearGrade(def.layout, grade, (filhos) => [...filhos, no]);
  const comNo = { ...def, layout };
  const filhos = grade.length === 0 ? layout : (filhosDe(obterNo(layout, grade)!) ?? []);
  return acomodarGrade(comNo, grade, filhos.length - 1);
}

export function moverNo(def: TemplateDef, origem: Caminho, grade: Caminho, pos: Pos): TemplateDef {
  const no = obterNo(def.layout, origem);
  if (!no || ehPrefixo(origem, grade)) return def;
  const semNo = transformar(def.layout, origem, () => null);
  const destino = ajustarCaminho(grade, origem);
  return inserirEm({ ...def, layout: semNo }, destino, { ...no, pos });
}

export function atualizarNo(def: TemplateDef, caminho: Caminho, fn: (no: NoLayout) => NoLayout): TemplateDef {
  return { ...def, layout: transformar(def.layout, caminho, fn) };
}

export function redimensionarNo(def: TemplateDef, caminho: Caminho, pos: Pos): TemplateDef {
  const atualizado = atualizarNo(def, caminho, (no) => ({ ...no, pos }));
  const grade = caminho.slice(0, -1);
  return acomodarGrade(atualizado, grade, caminho[caminho.length - 1]);
}

export function removerNo(def: TemplateDef, caminho: Caminho): TemplateDef {
  return { ...def, layout: transformar(def.layout, caminho, () => null) };
}

/** Remove a ação e todos os botões dela espalhados pelo layout. */
export function removerAcao(def: TemplateDef, acaoId: string): TemplateDef {
  const limpar = (nos: NoLayout[]): NoLayout[] =>
    nos
      .filter((no) => !(no.tipo === 'acao' && no.acaoId === acaoId))
      .map((no) => {
        const filhos = filhosDe(no);
        return filhos ? comFilhos(no, limpar(filhos)) : no;
      });
  return { ...def, layout: limpar(def.layout), acoes: def.acoes.filter((a) => a.id !== acaoId) };
}

/** Ids usados por campos e listas — precisam ser únicos porque aparecem nas fórmulas. */
export function idsDaFicha(def: TemplateDef): Set<string> {
  const ids = new Set<string>();
  const andar = (nos: NoLayout[]) => {
    for (const no of nos) {
      if (no.tipo === 'campo') ids.add(no.campo.id);
      if (no.tipo === 'lista') {
        ids.add(no.lista.id);
        andar(no.lista.item);
      }
      if (no.tipo === 'painel') andar(no.filhos);
    }
  };
  andar(def.layout);
  return ids;
}

/** Id válido para fórmulas: letras, números e _, começando por letra. */
export function idUnicoDeCampo(base: string, usados: Set<string>): string {
  const limpo =
    base
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9_]/g, '_')
      .replace(/^[^A-Za-z_]+/, '') || 'campo';
  if (!usados.has(limpo)) return limpo;
  let i = 2;
  while (usados.has(`${limpo}${i}`)) i++;
  return `${limpo}${i}`;
}

const ROTULOS_TIPO: Record<TipoCampo, string> = {
  numero: 'Número',
  texto: 'Texto',
  dados: 'Dados',
  marcador: 'Sim/não',
  calculado: 'Calculado',
};

export function criarCampo(tipo: TipoCampo, usados: Set<string>): NoLayout {
  const id = idUnicoDeCampo(tipo === 'calculado' ? 'calculado' : 'campo', usados);
  const campo: CampoDef = { id, tipo, rotulo: ROTULOS_TIPO[tipo], padrao: tipo === 'numero' ? 0 : tipo === 'marcador' ? false : '' };
  if (tipo === 'calculado') {
    delete campo.padrao;
    campo.formula = '0';
  }
  if (tipo === 'dados') campo.padrao = '1d6';
  return { tipo: 'campo', pos: { x: 0, y: 0, w: 2, h: 1 }, campo };
}

export function criarPainel(): NoLayout {
  return { tipo: 'painel', pos: { x: 0, y: 0, w: 6, h: 4 }, titulo: 'Nova seção', colunas: 6, filhos: [] };
}

export function criarLista(usados: Set<string>): NoLayout {
  const id = idUnicoDeCampo('lista', usados);
  return {
    tipo: 'lista',
    pos: { x: 0, y: 0, w: 12, h: 6 },
    lista: { id, rotulo: 'Nova lista', formato: 'cartoes', colunas: 6, item: [] },
  };
}

export function criarTexto(): NoLayout {
  return { tipo: 'texto', pos: { x: 0, y: 0, w: 4, h: 1 }, texto: 'Título', estilo: 'titulo' };
}

export function criarNoAcao(): NoLayout {
  return { tipo: 'acao', pos: { x: 0, y: 0, w: 3, h: 1 }, acaoId: '' };
}

/** Cria uma ação nova já com um bloco de exemplo dentro. */
export function novaAcao(def: TemplateDef, escopo?: string): { def: TemplateDef; acao: AcaoDef } {
  const usados = new Set(def.acoes.map((a) => a.id));
  const acao: AcaoDef = {
    id: idUnicoDeCampo('acao', usados),
    rotulo: 'Nova ação',
    escopo,
    workspace: BLOCOS_INICIAIS,
    corpo: compilarAcao(BLOCOS_INICIAIS).corpo,
  };
  return { def: { ...def, acoes: [...def.acoes, acao] }, acao };
}

export function estiloPos(pos: Pos): CSSProperties {
  return { gridColumn: `${pos.x + 1} / span ${pos.w}`, gridRow: `${pos.y + 1} / span ${pos.h}` };
}

export function linhasNecessarias(nos: NoLayout[], extras = 0): number {
  return Math.max(1, ...nos.map((n) => n.pos.y + n.pos.h)) + extras;
}

/** Nós na ordem em que aparecem na ficha (cima → baixo, esquerda → direita). */
export function ordenarPorPosicao<T extends NoLayout>(nos: T[]): T[] {
  return [...nos].sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x);
}
