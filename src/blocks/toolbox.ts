import type * as Blockly from 'blockly';
import type { BlocoArquivo } from '../shared/types';
import { CORES } from './definitions';

type Item = Record<string, unknown>;

const b = (type: string, extra: Item = {}): Item => ({ kind: 'block', type, ...extra });
const sombraNum = (v: number) => ({ shadow: { type: 'rpg_numero', fields: { NUM: v } } });
const sombraTxt = (v: string) => ({ shadow: { type: 'rpg_texto', fields: { TXT: v } } });

export function criarToolbox(personalizados: BlocoArquivo[]): Blockly.utils.toolbox.ToolboxDefinition {
  const categoria = (name: string, colour: string, contents: Item[]) => ({ kind: 'category', name, colour, contents });

  return {
    kind: 'categoryToolbox',
    contents: [
      categoria('Comandos', CORES.comandos, [
        b('rpg_log'),
        b('rpg_definir_var'),
        b('rpg_se'),
        b('rpg_alterar_campo'),
        b('rpg_alterar_item'),
      ]),
      categoria('Valores', CORES.valores, [
        b('rpg_numero'),
        b('rpg_texto'),
        b('rpg_bool'),
        b('rpg_campo_valor'),
        b('rpg_item_valor'),
        b('rpg_var'),
        b('rpg_juntar', { inputs: { A: sombraTxt('1d6+'), B: sombraTxt('') } }),
      ]),
      categoria('Matemática e lógica', CORES.logica, [
        b('rpg_mat', { inputs: { A: sombraNum(1), B: sombraNum(1) } }),
        b('rpg_func', { inputs: { A: sombraNum(1) } }),
        b('rpg_cmp', { inputs: { A: sombraNum(0), B: sombraNum(0) } }),
        b('rpg_logico'),
        b('rpg_nao'),
      ]),
      categoria('Dados e crítico', CORES.dados, [
        b('rpg_rolar', { inputs: { DADOS: sombraTxt('1d20') } }),
        b('rpg_natural'),
        b('rpg_critico', { inputs: { MARGEM: sombraNum(20) } }),
        b('rpg_rolar_dano', {
          inputs: { DADOS: sombraTxt('1d6'), MARGEM: sombraNum(20), MULT: sombraNum(2) },
        }),
        { kind: 'label', text: 'Dica: troque as entradas por "item atual . campo"' },
      ]),
      categoria(
        'Meus blocos',
        CORES.meus,
        personalizados.length
          ? personalizados.flatMap((p) => [{ kind: 'label', text: p.nome }, { kind: 'block', ...p.bloco }])
          : [{ kind: 'label', text: 'Clique com o botão direito em um bloco → "Salvar como bloco personalizado…"' }],
      ),
    ],
  } as Blockly.utils.toolbox.ToolboxDefinition;
}

/** Bloco pronto usado ao criar uma ação nova, para a pessoa não começar com a tela vazia. */
export const BLOCOS_INICIAIS = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'rpg_log',
        x: 40,
        y: 40,
        fields: { TEXTO: 'Resultado' },
        inputs: { VALOR: { block: { type: 'rpg_rolar', inputs: { DADOS: { shadow: { type: 'rpg_texto', fields: { TXT: '1d20' } } } } } } },
      },
    ],
  },
};
