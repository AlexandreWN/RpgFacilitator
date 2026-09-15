import { describe, expect, it } from 'vitest';
import type { Rng } from '../shared/dice';
import { camposDaLista, completarValores, executarAcao, listasDoTemplate } from '../shared/interpreter';
import { compilarAcao, limparIds } from './compiler';
import { templateExemplo, valoresExemplo } from './exemplo';

const d = (resultado: number, faces: number) => (resultado - 0.5) / faces;
function sequencia(...valores: number[]): Rng {
  let i = 0;
  return () => valores[i++ % valores.length];
}

const ws = (...blocos: unknown[]) => ({ blocks: { languageVersion: 0, blocks: blocos } });

describe('compilarAcao', () => {
  it('compila uma pilha de comandos na ordem', () => {
    const { corpo, avisos } = compilarAcao(
      ws({
        type: 'rpg_definir_var',
        fields: { NOME: 'ataque' },
        inputs: { VALOR: { block: { type: 'rpg_rolar', inputs: { DADOS: { shadow: { type: 'rpg_texto', fields: { TXT: '1d20' } } } } } } },
        next: {
          block: { type: 'rpg_log', fields: { TEXTO: 'Ataque' }, inputs: { VALOR: { block: { type: 'rpg_var', fields: { NOME: 'ataque' } } } } },
        },
      }),
    );
    expect(avisos).toEqual([]);
    expect(corpo).toEqual([
      { k: 'definir', nome: 'ataque', valor: { k: 'rolar', dados: { k: 'txt', v: '1d20' } } },
      { k: 'log', texto: 'Ataque', valor: { k: 'var', nome: 'ataque' } },
    ]);
  });

  it('workspace vazio vira ação vazia', () => {
    expect(compilarAcao({})).toEqual({ corpo: [], avisos: [] });
  });

  it('avisa quando o bloco aponta para um campo que não existe mais', () => {
    const entrada = ws({
      type: 'rpg_log',
      fields: { TEXTO: 'x' },
      inputs: { VALOR: { block: { type: 'rpg_campo_valor', fields: { ID: 'DES' } } } },
    });
    const { avisos } = compilarAcao(entrada, { campos: [{ id: 'FOR', tipo: 'numero', rotulo: 'Força' }] });
    expect(avisos).toContain('O campo "DES" não existe mais na ficha');
  });

  it('avisa quando "item atual" é usado numa ação que não é de lista', () => {
    const entrada = ws({
      type: 'rpg_log',
      fields: { TEXTO: 'x' },
      inputs: { VALOR: { block: { type: 'rpg_item_valor', fields: { ID: 'dano' } } } },
    });
    const { avisos } = compilarAcao(entrada, { campos: [], camposItem: [] });
    expect(avisos).toContain('"item atual . dano": esta ação não pertence a uma lista');
  });

  it('avisa quando falta encaixar um valor', () => {
    const { avisos } = compilarAcao(ws({ type: 'rpg_definir_var', fields: { NOME: 'x' } }));
    expect(avisos).toContain('Falta encaixar um valor em definir variável "x"');
  });

  it('ignora blocos desativados', () => {
    expect(compilarAcao(ws({ type: 'rpg_log', enabled: false, fields: { TEXTO: 'x' } })).corpo).toEqual([]);
  });
});

describe('template de exemplo', () => {
  it('compila sem avisos e tem o layout esperado', () => {
    const { definicao, avisos } = templateExemplo();
    expect(avisos).toEqual([]);
    expect(definicao.layout.map((n) => n.tipo)).toEqual(['painel', 'painel', 'painel', 'lista']);
    const armas = listasDoTemplate(definicao)[0];
    expect(armas.formato).toBe('cartoes');
    expect(camposDaLista(armas).map((c) => c.id)).toEqual(['nome', 'dano', 'bonus', 'margemCritico', 'multCritico', 'efeitos']);
    expect(definicao.acoes.map((a) => a.id)).toEqual(['testeForca', 'descanso', 'atacar']);
  });

  it('Espada longa (margem 19 do personagem) critica com natural 19', () => {
    const { definicao } = templateExemplo();
    const atacar = definicao.acoes.find((a) => a.id === 'atacar')!;
    const valores = completarValores(definicao, valoresExemplo);
    const rng = sequencia(d(19, 20), d(7, 8), d(3, 8));
    const r = executarAcao(definicao, atacar, valores, { listaId: 'armas', indice: 1, rng });
    expect(r.erro).toBeUndefined();
    expect(r.critico).toBe(true);
    // ataque: 19 + FOR_MOD 3 + PROF 2 + bonus 1
    expect(r.linhas[0]).toMatchObject({ texto: 'CRÍTICO! Ataque', valor: 25 });
    // dano: 2d8 (crítico ×2) + FOR_MOD 3
    expect(r.linhas[1]).toMatchObject({ texto: 'Dano', valor: 7 + 3 + 3 });
    expect(r.linhas[2]).toMatchObject({ texto: 'Efeitos', valor: 'Sangramento' });
  });

  it('Machado grande (margem 20) não critica com natural 19', () => {
    const { definicao } = templateExemplo();
    const atacar = definicao.acoes.find((a) => a.id === 'atacar')!;
    const valores = completarValores(definicao, valoresExemplo);
    const r = executarAcao(definicao, atacar, valores, { listaId: 'armas', indice: 0, rng: sequencia(d(19, 20), d(5, 12)) });
    expect(r.critico).toBe(false);
    expect(r.linhas.map((l) => l.texto)).toEqual(['Ataque', 'Dano']);
  });
});

describe('limparIds', () => {
  it('remove id, x e y recursivamente', () => {
    expect(limparIds({ type: 'a', id: '1', x: 1, y: 2, inputs: { A: { block: { type: 'b', id: '2' } } } })).toEqual({
      type: 'a',
      inputs: { A: { block: { type: 'b' } } },
    });
  });
});
