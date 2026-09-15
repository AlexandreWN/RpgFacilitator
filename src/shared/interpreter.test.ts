import { describe, expect, it } from 'vitest';
import type { Rng } from './dice';
import { avaliarCalculado, camposDoPersonagem, completarValores, executarAcao } from './interpreter';
import type { AcaoDef, CampoDef, Expr, NoLayout, Pos, TemplateDef } from './types';

const d = (resultado: number, faces: number) => (resultado - 0.5) / faces;
function sequencia(...valores: number[]): Rng {
  let i = 0;
  return () => valores[i++ % valores.length];
}

const campo = (id: string): Expr => ({ k: 'campo', id });
const item = (id: string): Expr => ({ k: 'item', id });
const pos = (x: number, y: number, w = 2, h = 1): Pos => ({ x, y, w, h });
const no = (p: Pos, c: CampoDef): NoLayout => ({ tipo: 'campo', pos: p, campo: c });

const atacar: AcaoDef = {
  id: 'atacar',
  rotulo: 'Atacar',
  escopo: 'armas',
  corpo: [
    { k: 'definir', nome: 'ataque', valor: { k: 'mat', op: '+', a: { k: 'rolar', dados: { k: 'txt', v: '1d20' } }, b: campo('FOR_MOD') } },
    { k: 'log', texto: 'Ataque', valor: { k: 'var', nome: 'ataque' } },
    { k: 'log', texto: 'Dano', valor: { k: 'rolarDano', dados: item('dano'), margem: item('margem'), mult: item('mult'), modo: 'dados' } },
  ],
};

const descanso: AcaoDef = {
  id: 'descanso',
  rotulo: 'Descanso',
  corpo: [{ k: 'alterar', alvo: 'campo', id: 'PV', valor: campo('PV_MAX') }],
};

const def: TemplateDef = {
  colunas: 12,
  layout: [
    {
      tipo: 'painel',
      pos: { x: 0, y: 0, w: 12, h: 4 },
      titulo: 'Atributos',
      colunas: 6,
      filhos: [
        no(pos(0, 0), { id: 'FOR', tipo: 'numero', rotulo: 'Força', padrao: 10 }),
        no(pos(2, 0), { id: 'FOR_MOD', tipo: 'calculado', rotulo: 'Mod', formula: 'piso((FOR-10)/2)' }),
        no(pos(0, 1), { id: 'PV_MAX', tipo: 'numero', rotulo: 'PV máx', padrao: 10 }),
        no(pos(2, 1), { id: 'PV', tipo: 'numero', rotulo: 'PV', padrao: 10 }),
        { tipo: 'acao', pos: pos(4, 1), acaoId: 'descanso' },
      ],
    },
    {
      tipo: 'lista',
      pos: { x: 0, y: 4, w: 12, h: 5 },
      lista: {
        id: 'armas',
        rotulo: 'Armas',
        formato: 'cartoes',
        colunas: 6,
        item: [
          no(pos(0, 0), { id: 'nome', tipo: 'texto', rotulo: 'Nome' }),
          no(pos(2, 0), { id: 'dano', tipo: 'dados', rotulo: 'Dano', padrao: '1d6' }),
          no(pos(0, 1), { id: 'margem', tipo: 'numero', rotulo: 'Margem', padrao: 20 }),
          no(pos(2, 1), { id: 'mult', tipo: 'numero', rotulo: 'Mult', padrao: 2 }),
          { tipo: 'acao', pos: pos(4, 1), acaoId: 'atacar' },
        ],
      },
    },
  ],
  acoes: [atacar, descanso],
};

const personagem = (margem: number, mult: number) =>
  completarValores(def, { FOR: 16, PV_MAX: 30, PV: 5, armas: [{ nome: 'Espada', dano: '1d8+FOR_MOD', margem, mult }] });

describe('leitura do layout', () => {
  it('encontra os campos dentro dos painéis, sem misturar com os da lista', () => {
    expect(camposDoPersonagem(def).map((c) => c.id)).toEqual(['FOR', 'FOR_MOD', 'PV_MAX', 'PV']);
  });
});

describe('completarValores', () => {
  it('preenche padrões e itens de lista', () => {
    const v = completarValores(def, { armas: [{ nome: 'Adaga' }] });
    expect(v.FOR).toBe(10);
    expect(v.armas).toEqual([{ nome: 'Adaga', dano: '1d6', margem: 20, mult: 2 }]);
    expect('FOR_MOD' in v).toBe(false);
  });
});

describe('campos calculados', () => {
  it('a fórmula em texto usa os campos do personagem', () => {
    const calculado = camposDoPersonagem(def).find((c) => c.id === 'FOR_MOD')!;
    expect(avaliarCalculado(def, personagem(20, 2), calculado)).toBe('3');
  });

  it('fórmula inválida vira aviso em vez de quebrar a ficha', () => {
    const quebrado = { id: 'X', tipo: 'calculado' as const, rotulo: 'X', formula: 'NAO_EXISTE+1' };
    expect(avaliarCalculado(def, personagem(20, 2), quebrado)).toContain('⚠');
  });
});

describe('executarAcao', () => {
  it('crítico usa a margem e o multiplicador da ficha do personagem', () => {
    // natural 19, margem do personagem 19 → crítico; dano 1d8 ×3 dados + FOR_MOD
    const rng = sequencia(d(19, 20), d(2, 8), d(5, 8), d(8, 8));
    const r = executarAcao(def, atacar, personagem(19, 3), { listaId: 'armas', indice: 0, rng });
    expect(r.erro).toBeUndefined();
    expect(r.critico).toBe(true);
    expect(r.linhas[0]).toMatchObject({ texto: 'Ataque', valor: 22 });
    expect(r.linhas[1]).toMatchObject({ texto: 'Dano', valor: 2 + 5 + 8 + 3, critico: true });
    expect(r.linhas[1].detalhes[0]).toContain('3d8[2, 5, 8]');
  });

  it('sem crítico quando o natural fica abaixo da margem do personagem', () => {
    const rng = sequencia(d(19, 20), d(6, 8));
    const r = executarAcao(def, atacar, personagem(20, 3), { listaId: 'armas', indice: 0, rng });
    expect(r.critico).toBe(false);
    expect(r.linhas[1]).toMatchObject({ texto: 'Dano', valor: 9 });
  });

  it('modo total multiplica o resultado', () => {
    const acao: AcaoDef = {
      id: 'x',
      rotulo: 'x',
      corpo: [
        { k: 'definir', nome: 'a', valor: { k: 'rolar', dados: { k: 'txt', v: '1d20' } } },
        { k: 'log', texto: 'Dano', valor: { k: 'rolarDano', dados: { k: 'txt', v: '1d6+1' }, margem: { k: 'num', v: 20 }, mult: { k: 'num', v: 2 }, modo: 'total' } },
      ],
    };
    const r = executarAcao(def, acao, personagem(20, 2), { rng: sequencia(d(20, 20), d(4, 6)) });
    expect(r.linhas[0].valor).toBe(10);
  });

  it('alterar campo devolve novos valores sem mutar os originais', () => {
    const original = personagem(20, 2);
    const r = executarAcao(def, descanso, original);
    expect(r.valores.PV).toBe(30);
    expect(original.PV).toBe(5);
  });

  it('erro mantém valores originais e informa a mensagem', () => {
    const acao: AcaoDef = { id: 'x', rotulo: 'x', corpo: [{ k: 'alterar', alvo: 'campo', id: 'PV', valor: campo('INEXISTENTE') }] };
    const original = personagem(20, 2);
    const r = executarAcao(def, acao, original);
    expect(r.erro).toContain('INEXISTENTE');
    expect(r.valores).toBe(original);
  });

  it('item atual fora de lista gera erro', () => {
    const r = executarAcao(def, atacar, personagem(20, 2), { rng: sequencia(d(10, 20)) });
    expect(r.erro).toContain('só funciona em ações dentro de uma lista');
  });
});
