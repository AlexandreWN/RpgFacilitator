import * as Blockly from 'blockly';
import * as PtBr from 'blockly/msg/pt-br';
import type { CampoDef } from '../shared/types';

/** Cores dos blocos: versões mais escuras da paleta de tipos, para o texto branco ficar legível. */
export const CORES = {
  comandos: '#d97a36',
  valores: '#3f82d6',
  logica: '#2ea596',
  dados: '#cf4a5d',
  meus: '#c0609c',
};

const comando = 'comando';

/** Campos que os menus suspensos dos blocos oferecem — trocados conforme a ação em edição. */
let camposPersonagem: CampoDef[] = [];
let camposItem: CampoDef[] = [];

export function definirCamposDisponiveis(campos: CampoDef[], doItem: CampoDef[] = []) {
  camposPersonagem = campos;
  camposItem = doItem;
}

function opcoes(campos: CampoDef[], vazio: string) {
  return function (this: Blockly.FieldDropdown): Blockly.MenuOption[] {
    const lista: Blockly.MenuOption[] = campos.map((c) => [c.rotulo ? `${c.rotulo} (${c.id})` : c.id, c.id]);
    // Mantém o valor salvo mesmo que o campo tenha sido removido da ficha, para não trocar a ação sozinho.
    const atual = this.getValue?.();
    if (atual && !lista.some(([, valor]) => valor === atual)) lista.unshift([`⚠ ${atual}`, atual]);
    return lista.length ? lista : [[vazio, '']];
  };
}

const DEFINICOES = [
  // ── Comandos ─────────────────────────────────────────────
  {
    type: 'rpg_log',
    message0: 'mostrar no log %1 %2',
    args0: [{ type: 'field_input', name: 'TEXTO', text: 'Resultado' }, { type: 'input_value', name: 'VALOR' }],
    previousStatement: comando,
    nextStatement: comando,
    colour: CORES.comandos,
    tooltip: 'Escreve uma linha no log de rolagens, junto com os detalhes dos dados rolados.',
  },
  {
    type: 'rpg_definir_var',
    message0: 'definir variável %1 = %2',
    args0: [{ type: 'field_input', name: 'NOME', text: 'ataque' }, { type: 'input_value', name: 'VALOR' }],
    previousStatement: comando,
    nextStatement: comando,
    colour: CORES.comandos,
    tooltip: 'Guarda um valor para usar depois nesta ação.',
  },
  {
    type: 'rpg_se',
    message0: 'se %1',
    args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }],
    message1: 'então %1',
    args1: [{ type: 'input_statement', name: 'ENTAO', check: comando }],
    message2: 'senão %1',
    args2: [{ type: 'input_statement', name: 'SENAO', check: comando }],
    previousStatement: comando,
    nextStatement: comando,
    colour: CORES.comandos,
    tooltip: 'Executa um grupo de comandos ou outro, dependendo da condição.',
  },
  // ── Valores ──────────────────────────────────────────────
  {
    type: 'rpg_numero',
    message0: '%1',
    args0: [{ type: 'field_number', name: 'NUM', value: 0 }],
    output: 'Number',
    colour: CORES.valores,
  },
  {
    type: 'rpg_texto',
    message0: '“%1”',
    args0: [{ type: 'field_input', name: 'TXT', text: '' }],
    output: 'String',
    colour: CORES.valores,
    tooltip: 'Texto. Também serve para expressões de dados, como 1d20+FOR_MOD.',
  },
  {
    type: 'rpg_bool',
    message0: '%1',
    args0: [{ type: 'field_dropdown', name: 'BOOL', options: [['verdadeiro', 'true'], ['falso', 'false']] }],
    output: 'Boolean',
    colour: CORES.valores,
  },
  {
    type: 'rpg_var',
    message0: 'variável %1',
    args0: [{ type: 'field_input', name: 'NOME', text: 'ataque' }],
    output: null,
    colour: CORES.valores,
  },
  {
    type: 'rpg_juntar',
    message0: 'juntar %1 %2',
    args0: [{ type: 'input_value', name: 'A' }, { type: 'input_value', name: 'B' }],
    inputsInline: true,
    output: 'String',
    colour: CORES.valores,
    tooltip: 'Junta dois valores em um texto (útil para montar expressões de dados).',
  },
  // ── Matemática e lógica ──────────────────────────────────
  {
    type: 'rpg_mat',
    message0: '%1 %2 %3',
    args0: [
      { type: 'input_value', name: 'A' },
      {
        type: 'field_dropdown',
        name: 'OP',
        options: [['+', '+'], ['-', '-'], ['×', '*'], ['÷', '/'], ['resto', '%'], ['mín', 'min'], ['máx', 'max']],
      },
      { type: 'input_value', name: 'B' },
    ],
    inputsInline: true,
    output: 'Number',
    colour: CORES.logica,
  },
  {
    type: 'rpg_func',
    message0: '%1 %2',
    args0: [
      {
        type: 'field_dropdown',
        name: 'F',
        options: [['arredondar p/ baixo', 'piso'], ['arredondar p/ cima', 'teto'], ['arredondar', 'arred'], ['absoluto', 'abs']],
      },
      { type: 'input_value', name: 'A' },
    ],
    inputsInline: true,
    output: 'Number',
    colour: CORES.logica,
  },
  {
    type: 'rpg_cmp',
    message0: '%1 %2 %3',
    args0: [
      { type: 'input_value', name: 'A' },
      { type: 'field_dropdown', name: 'OP', options: [['=', '=='], ['≠', '!='], ['<', '<'], ['≤', '<='], ['>', '>'], ['≥', '>=']] },
      { type: 'input_value', name: 'B' },
    ],
    inputsInline: true,
    output: 'Boolean',
    colour: CORES.logica,
  },
  {
    type: 'rpg_logico',
    message0: '%1 %2 %3',
    args0: [
      { type: 'input_value', name: 'A', check: 'Boolean' },
      { type: 'field_dropdown', name: 'OP', options: [['e', 'e'], ['ou', 'ou']] },
      { type: 'input_value', name: 'B', check: 'Boolean' },
    ],
    inputsInline: true,
    output: 'Boolean',
    colour: CORES.logica,
  },
  {
    type: 'rpg_nao',
    message0: 'não %1',
    args0: [{ type: 'input_value', name: 'A', check: 'Boolean' }],
    output: 'Boolean',
    colour: CORES.logica,
  },
  // ── Dados e crítico ──────────────────────────────────────
  {
    type: 'rpg_rolar',
    message0: 'rolar %1',
    args0: [{ type: 'input_value', name: 'DADOS' }],
    output: 'Number',
    colour: CORES.dados,
    tooltip: 'Rola uma expressão de dados (ex.: 1d20+FOR_MOD) e devolve o total. Os detalhes vão para o log.',
  },
  {
    type: 'rpg_natural',
    message0: 'natural do último d20',
    output: 'Number',
    colour: CORES.dados,
    tooltip: 'O valor tirado no dado do último d20 rolado nesta ação, sem modificadores.',
  },
  {
    type: 'rpg_critico',
    message0: 'é crítico? natural ≥ %1',
    args0: [{ type: 'input_value', name: 'MARGEM' }],
    output: 'Boolean',
    colour: CORES.dados,
    tooltip: 'Verdadeiro se o último d20 natural for maior ou igual à margem (use a margem vinda da ficha do personagem).',
  },
  {
    type: 'rpg_rolar_dano',
    message0: 'rolar dano %1',
    args0: [{ type: 'input_value', name: 'DADOS' }],
    message1: 'margem de crítico %1',
    args1: [{ type: 'input_value', name: 'MARGEM', align: 'RIGHT' }],
    message2: 'multiplicador %1',
    args2: [{ type: 'input_value', name: 'MULT', align: 'RIGHT' }],
    message3: 'no crítico %1',
    args3: [{ type: 'field_dropdown', name: 'MODO', options: [['multiplica os dados', 'dados'], ['multiplica o total', 'total']] }],
    output: 'Number',
    colour: CORES.dados,
    tooltip: 'Rola o dano. Se o último d20 natural atingiu a margem, aplica o multiplicador. Margem e multiplicador podem vir da ficha do personagem.',
  },
];

/** Blocos cujo menu lista os campos que existem na ficha. */
function definirBlocosDeCampo() {
  Blockly.Blocks['rpg_campo_valor'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('campo')
        .appendField(new Blockly.FieldDropdown(opcoes(camposPersonagem, '(sem campos na ficha)')), 'ID');
      this.setOutput(true, null);
      this.setColour(CORES.valores);
      this.setTooltip('Lê um campo da ficha do personagem.');
    },
  };

  Blockly.Blocks['rpg_item_valor'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('item atual .')
        .appendField(new Blockly.FieldDropdown(opcoes(camposItem, '(ação não é de uma lista)')), 'ID');
      this.setOutput(true, null);
      this.setColour(CORES.valores);
      this.setTooltip('Lê um campo do item em que o botão foi clicado.');
    },
  };

  Blockly.Blocks['rpg_alterar_campo'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('VALOR')
        .appendField('alterar campo')
        .appendField(new Blockly.FieldDropdown(opcoes(camposPersonagem, '(sem campos na ficha)')), 'ID')
        .appendField('para');
      this.setPreviousStatement(true, comando);
      this.setNextStatement(true, comando);
      this.setColour(CORES.comandos);
      this.setTooltip('Muda um valor salvo na ficha do personagem (ex.: reduzir PV).');
    },
  };

  Blockly.Blocks['rpg_alterar_item'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('VALOR')
        .appendField('alterar campo do item')
        .appendField(new Blockly.FieldDropdown(opcoes(camposItem, '(ação não é de uma lista)')), 'ID')
        .appendField('para');
      this.setPreviousStatement(true, comando);
      this.setNextStatement(true, comando);
      this.setColour(CORES.comandos);
      this.setTooltip('Muda um valor do item clicado (ex.: gastar munição).');
    },
  };
}

let tema: Blockly.Theme | null = null;

export function temaEscuro(): Blockly.Theme {
  tema ??= Blockly.Theme.defineTheme('rpg-escuro', {
    name: 'rpg-escuro',
    base: Blockly.Themes.Classic,
    componentStyles: {
      workspaceBackgroundColour: '#15171b',
      toolboxBackgroundColour: '#1b1e23',
      toolboxForegroundColour: '#b9bfc7',
      flyoutBackgroundColour: '#1f2328',
      flyoutForegroundColour: '#858c96',
      flyoutOpacity: 0.97,
      scrollbarColour: '#3a3f48',
      scrollbarOpacity: 0.7,
      insertionMarkerColour: '#5cc8dc',
      insertionMarkerOpacity: 0.35,
      cursorColour: '#5cc8dc',
    },
    fontStyle: { family: '"Space Grotesk", system-ui, sans-serif', weight: '500', size: 11 },
  });
  return tema;
}

let registrado = false;

export function registrarBlocos() {
  if (registrado) return;
  registrado = true;
  Blockly.setLocale(PtBr as unknown as Record<string, string>);
  Blockly.common.defineBlocksWithJsonArray(DEFINICOES);
  definirBlocosDeCampo();

  const idMenu = 'rpg_salvar_bloco_personalizado';
  if (!Blockly.ContextMenuRegistry.registry.getItem(idMenu)) {
    Blockly.ContextMenuRegistry.registry.register({
      id: idMenu,
      weight: 300,
      scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
      displayText: 'Salvar como bloco personalizado…',
      preconditionFn: (scope) => (aoSalvarBloco && scope.block && !scope.block.isInFlyout ? 'enabled' : 'hidden'),
      callback: (scope) => {
        if (scope.block && aoSalvarBloco) aoSalvarBloco(scope.block);
      },
    });
  }
}

let aoSalvarBloco: ((bloco: Blockly.BlockSvg) => void) | null = null;

/** O editor registra aqui o que fazer quando o usuário escolhe "Salvar como bloco personalizado". */
export function definirAoSalvarBloco(fn: ((bloco: Blockly.BlockSvg) => void) | null) {
  aoSalvarBloco = fn;
}
