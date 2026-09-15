import type { CSSProperties } from 'react';

/** Paleta de "tipos" usada para diferenciar seções, itens e templates. */
export const CORES_TIPO = {
  ghost: '#9d86e0',
  fairy: '#f09ccf',
  fire: '#f28b3f',
  steel: '#93a7b8',
  water: '#5b9cf0',
  fighting: '#e8586b',
  ice: '#63d6cb',
  grass: '#79c956',
  dragon: '#6b83f2',
  bug: '#b1c94a',
  poison: '#c46cc0',
  flying: '#a9b8f2',
};

const SEQUENCIA = [
  CORES_TIPO.ghost,
  CORES_TIPO.fairy,
  CORES_TIPO.fire,
  CORES_TIPO.steel,
  CORES_TIPO.water,
  CORES_TIPO.fighting,
  CORES_TIPO.ice,
  CORES_TIPO.grass,
  CORES_TIPO.dragon,
  CORES_TIPO.bug,
];

export function corDoIndice(i: number): string {
  return SEQUENCIA[((i % SEQUENCIA.length) + SEQUENCIA.length) % SEQUENCIA.length];
}

/** Define a variável CSS --cor usada por bordas, badges e tags. */
export function estiloCor(i: number): CSSProperties {
  return { '--cor': corDoIndice(i) } as CSSProperties;
}

export function indice(i: number): string {
  return String(i + 1).padStart(2, '0');
}
