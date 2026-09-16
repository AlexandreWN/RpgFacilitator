/**
 * Template de exemplo no formato novo: layout posicionado na grade + ações em blocos.
 * Usado pelos testes e por `npm run exemplo` para gerar os arquivos em data/.
 */
import type { AcaoDef, CampoDef, NoLayout, Pos, TemplateDef } from '../shared/types';
import { compilarAcao } from './compiler';

const pos = (x: number, y: number, w: number, h = 1): Pos => ({ x, y, w, h });
const campo = (p: Pos, campo: CampoDef): NoLayout => ({ tipo: 'campo', pos: p, campo });
const botao = (p: Pos, acaoId: string): NoLayout => ({ tipo: 'acao', pos: p, acaoId });

const modificador = (id: string, rotulo: string, atributo: string): CampoDef => ({
  id,
  tipo: 'calculado',
  rotulo,
  formula: `piso((${atributo}-10)/2)`,
});

const ACOES: Omit<AcaoDef, 'corpo'>[] = [
  {
    id: 'testeForca',
    rotulo: 'Teste de Força',
    workspace: workspace(log('Teste de Força', mat(rolar(txt('1d20')), '+', campoDe('FOR_MOD')))),
  },
  {
    id: 'descanso',
    rotulo: 'Descanso longo',
    workspace: workspace(
      bloco('rpg_alterar_campo', { ID: 'PV' }, { VALOR: campoDe('PV_MAX') }),
      log('PV restaurados', campoDe('PV')),
    ),
  },
  {
    id: 'atacar',
    rotulo: 'Atacar',
    escopo: 'armas',
    workspace: workspace(
      bloco('rpg_definir_var', { NOME: 'ataque' }, {
        VALOR: mat(rolar(txt('1d20')), '+', mat(mat(campoDe('FOR_MOD'), '+', campoDe('PROF')), '+', itemDe('bonus'))),
      }),
      bloco('rpg_se', {}, {
        COND: bloco('rpg_critico', {}, { MARGEM: itemDe('margemCritico') }),
        ENTAO: log('CRÍTICO! Ataque', variavel('ataque')),
        SENAO: log('Ataque', variavel('ataque')),
      }),
      log(
        'Dano',
        bloco('rpg_rolar_dano', { MODO: 'dados' }, {
          DADOS: itemDe('dano'),
          MARGEM: itemDe('margemCritico'),
          MULT: itemDe('multCritico'),
        }),
      ),
      bloco('rpg_se', {}, {
        COND: bloco('rpg_cmp', { OP: '!=' }, { A: itemDe('efeitos'), B: txt('') }),
        ENTAO: log('Efeitos', itemDe('efeitos')),
      }),
    ),
  },
];

const LAYOUT: NoLayout[] = [
  {
    tipo: 'painel',
    pos: pos(0, 0, 5, 3),
    titulo: 'Identidade',
    colunas: 4,
    filhos: [
      campo(pos(0, 0, 2), { id: 'classe', tipo: 'texto', rotulo: 'Classe', padrao: 'Guerreiro' }),
      campo(pos(2, 0, 2), { id: 'nivel', tipo: 'numero', rotulo: 'Nível', padrao: 1 }),
    ],
  },
  {
    tipo: 'painel',
    pos: pos(5, 0, 7, 4),
    titulo: 'Atributos',
    colunas: 6,
    filhos: [
      campo(pos(0, 0, 2), { id: 'FOR', tipo: 'numero', rotulo: 'Força', padrao: 10 }),
      campo(pos(2, 0, 2), modificador('FOR_MOD', 'Mod. Força', 'FOR')),
      campo(pos(4, 0, 2), { id: 'PROF', tipo: 'numero', rotulo: 'Proficiência', padrao: 2 }),
      campo(pos(0, 1, 2), { id: 'DES', tipo: 'numero', rotulo: 'Destreza', padrao: 10 }),
      campo(pos(2, 1, 2), modificador('DES_MOD', 'Mod. Destreza', 'DES')),
      botao(pos(4, 1, 2), 'testeForca'),
    ],
  },
  {
    tipo: 'painel',
    pos: pos(0, 3, 5, 3),
    titulo: 'Vida',
    colunas: 4,
    filhos: [
      campo(pos(0, 0, 2), { id: 'PV_MAX', tipo: 'numero', rotulo: 'PV máximo', padrao: 10 }),
      campo(pos(2, 0, 2), { id: 'PV', tipo: 'numero', rotulo: 'PV atual', padrao: 10 }),
      botao(pos(0, 1, 3), 'descanso'),
    ],
  },
  {
    tipo: 'lista',
    pos: pos(0, 6, 12, 7),
    lista: {
      id: 'armas',
      rotulo: 'Armas',
      formato: 'cartoes',
      colunas: 6,
      item: [
        campo(pos(0, 0, 4), { id: 'nome', tipo: 'texto', rotulo: 'Nome', padrao: '' }),
        campo(pos(4, 0, 2), { id: 'dano', tipo: 'dados', rotulo: 'Dano', padrao: '1d6+FOR_MOD' }),
        campo(pos(0, 1, 2), { id: 'bonus', tipo: 'numero', rotulo: 'Bônus de ataque', padrao: 0 }),
        campo(pos(2, 1, 2), { id: 'margemCritico', tipo: 'numero', rotulo: 'Margem de crítico', padrao: 20 }),
        campo(pos(4, 1, 2), { id: 'multCritico', tipo: 'numero', rotulo: 'Multiplicador', padrao: 2 }),
        campo(pos(0, 2, 4), { id: 'efeitos', tipo: 'texto', rotulo: 'Efeitos', padrao: '' }),
        botao(pos(4, 2, 2), 'atacar'),
      ],
    },
  },
];

export function templateExemplo(): { definicao: TemplateDef; avisos: string[] } {
  const avisos: string[] = [];
  const acoes: AcaoDef[] = ACOES.map((a) => {
    const r = compilarAcao(a.workspace);
    avisos.push(...r.avisos);
    return { ...a, corpo: r.corpo };
  });
  return { definicao: { colunas: 12, layout: LAYOUT, acoes }, avisos };
}

export const valoresExemplo = {
  classe: 'Guerreiro',
  nivel: 3,
  FOR: 16,
  DES: 12,
  PROF: 2,
  PV_MAX: 28,
  PV: 20,
  armas: [
    { nome: 'Machado grande', dano: '1d12+FOR_MOD', bonus: 0, margemCritico: 20, multCritico: 3, efeitos: '' },
    { nome: 'Espada longa', dano: '1d8+FOR_MOD', bonus: 1, margemCritico: 19, multCritico: 2, efeitos: 'Sangramento' },
  ],
};
