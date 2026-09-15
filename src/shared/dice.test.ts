import { describe, expect, it } from 'vitest';
import { ErroDados, avaliarFormula, rolarExpressao, type Rng } from './dice';

/** Gera um rng que produz os resultados pedidos: d(3, 6) → face 3 de um d6. */
const d = (resultado: number, faces: number) => (resultado - 0.5) / faces;
function sequencia(...valores: number[]): Rng {
  let i = 0;
  return () => valores[i++ % valores.length];
}

describe('rolarExpressao', () => {
  it('rola dados e soma modificador', () => {
    const r = rolarExpressao('2d6+3', { rng: sequencia(d(3, 6), d(5, 6)) });
    expect(r.total).toBe(11);
    expect(r.detalhe).toBe('2d6[3, 5] + 3');
    expect(r.grupos).toEqual([{ quantidade: 2, faces: 6, resultados: [3, 5] }]);
  });

  it('respeita precedência e parênteses; divisão arredonda para baixo', () => {
    expect(rolarExpressao('2+3*4').total).toBe(14);
    expect(rolarExpressao('(2+3)*4').total).toBe(20);
    expect(rolarExpressao('7/2').total).toBe(3);
    expect(rolarExpressao('-2 + 5').total).toBe(3);
  });

  it('resolve identificadores de campos', () => {
    const r = rolarExpressao('1d20 + FOR_MOD', { rng: sequencia(d(14, 20)), resolver: (id) => (id === 'FOR_MOD' ? 3 : 0) });
    expect(r.total).toBe(17);
    expect(r.detalhe).toBe('1d20[14] + FOR_MOD(3)');
    expect(r.naturalD20).toBe(14);
  });

  it('d sem quantidade e d%', () => {
    expect(rolarExpressao('d20', { rng: sequencia(d(7, 20)) }).total).toBe(7);
    expect(rolarExpressao('d%', { rng: sequencia(d(55, 100)) }).total).toBe(55);
  });

  it('multiplicarDados multiplica só os dados, não o modificador', () => {
    const r = rolarExpressao('1d8+2', { rng: sequencia(d(4, 8), d(6, 8)), multiplicarDados: 2 });
    expect(r.total).toBe(12);
    expect(r.grupos[0].resultados).toEqual([4, 6]);
  });

  it('naturalD20 é undefined sem d20', () => {
    expect(rolarExpressao('2d6').naturalD20).toBeUndefined();
  });

  it('erros de sintaxe', () => {
    expect(() => rolarExpressao('')).toThrow(ErroDados);
    expect(() => rolarExpressao('1d6+')).toThrow(ErroDados);
    expect(() => rolarExpressao('(1d6')).toThrow(ErroDados);
    expect(() => rolarExpressao('FOR')).toThrow(ErroDados);
    expect(() => rolarExpressao('1d6 $ 2')).toThrow(ErroDados);
    expect(() => rolarExpressao('0d6')).toThrow(ErroDados);
  });

  it('resultados sempre dentro das faces com o rng padrão', () => {
    const r = rolarExpressao('1000d6');
    expect(r.grupos[0].resultados.every((v) => v >= 1 && v <= 6)).toBe(true);
    expect(new Set(r.grupos[0].resultados).size).toBe(6);
  });
});

describe('funções nas expressões', () => {
  const campos = (id: string) => ({ FOR: 16, DES: 13 })[id] ?? 0;

  it('piso, teto, arred e abs', () => {
    expect(rolarExpressao('piso(7/2)').total).toBe(3);
    expect(rolarExpressao('teto(5/2)').total).toBe(3);
    expect(rolarExpressao('arred(2,4)').total).toBe(2);
    expect(rolarExpressao('abs(0-7)').total).toBe(7);
  });

  it('min e max recebem dois valores', () => {
    expect(rolarExpressao('min(3, 8)').total).toBe(3);
    expect(rolarExpressao('max(3, 8)').total).toBe(8);
    expect(() => rolarExpressao('min(3)')).toThrow(ErroDados);
  });

  it('função com campo dentro, como num modificador de atributo', () => {
    expect(avaliarFormula('piso((FOR-10)/2)', campos)).toBe(3);
    expect(avaliarFormula('piso((DES-10)/2)', campos)).toBe(1);
  });

  it('fórmula de campo calculado não aceita dados', () => {
    expect(() => avaliarFormula('1d6+FOR', campos)).toThrow(ErroDados);
  });
});
