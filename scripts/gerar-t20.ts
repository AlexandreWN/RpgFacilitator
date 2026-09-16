/**
 * Gera a ficha de Tormenta 20 em data/templates/t20.txt, continuando o layout
 * que já estava no arquivo (painel "Personagem" + painel "Atributos").
 * Faz uma cópia do arquivo anterior antes de gravar.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { compilarAcao } from '../src/blocks/compiler';
import {
  alterarCampo,
  campoDe,
  cmp,
  critico,
  definir,
  empilhar,
  itemDe,
  log,
  mat,
  rolar,
  rolarDano,
  se,
  txt,
  variavel,
  workspace,
} from '../src/blocks/construtor';
import type { AcaoDef, CampoDef, Item, NoLayout, Pos, TemplateArquivo, TemplateDef, TipoCampo } from '../src/shared/types';

const pasta = path.resolve(process.env.RPG_DATA_DIR ?? 'data');

// ── Atalhos de layout ──────────────────────────────────────
const pos = (x: number, y: number, w: number, h = 1): Pos => ({ x, y, w, h });
const campo = (p: Pos, campo: CampoDef): NoLayout => ({ tipo: 'campo', pos: p, campo });
const botao = (p: Pos, acaoId: string): NoLayout => ({ tipo: 'acao', pos: p, acaoId });
const numero = (id: string, rotulo: string, padrao = 0): CampoDef => ({ id, tipo: 'numero', rotulo, padrao });
const texto = (id: string, rotulo: string, padrao = ''): CampoDef => ({ id, tipo: 'texto', rotulo, padrao });
const dados = (id: string, rotulo: string, padrao: string): CampoDef => ({ id, tipo: 'dados', rotulo, padrao });
const calculado = (id: string, rotulo: string, formula: string): CampoDef => ({ id, tipo: 'calculado' as TipoCampo, rotulo, formula });

// ── Perícias de T20: nome + atributo-chave ─────────────────
// A chave é guardada como texto ("DES") e a fórmula do total a resolve,
// então mudar o atributo na ficha atualiza todas as perícias dele.
const PERICIAS: [string, string][] = [
  ['Acrobacia', 'DES'],
  ['Adestramento', 'CAR'],
  ['Atletismo', 'FOR'],
  ['Atuação', 'CAR'],
  ['Cavalgar', 'DES'],
  ['Conhecimento', 'INT'],
  ['Cura', 'SAB'],
  ['Diplomacia', 'CAR'],
  ['Enganação', 'CAR'],
  ['Fortitude', 'CON'],
  ['Furtividade', 'DES'],
  ['Guerra', 'INT'],
  ['Iniciativa', 'DES'],
  ['Intimidação', 'CAR'],
  ['Intuição', 'SAB'],
  ['Investigação', 'INT'],
  ['Jogatina', 'CAR'],
  ['Ladinagem', 'DES'],
  ['Luta', 'FOR'],
  ['Misticismo', 'INT'],
  ['Nobreza', 'INT'],
  ['Ofício', 'INT'],
  ['Percepção', 'SAB'],
  ['Pilotagem', 'DES'],
  ['Pontaria', 'DES'],
  ['Reflexos', 'DES'],
  ['Religião', 'SAB'],
  ['Sobrevivência', 'SAB'],
  ['Vontade', 'SAB'],
];

const itensPericias: Item[] = PERICIAS.map(([Nome, Chave]) => ({ Nome, Chave, Treino: 0, Outros: 0 }));

// ── Ações ──────────────────────────────────────────────────
const ACOES: Omit<AcaoDef, 'corpo'>[] = [
  {
    id: 'testarPericia',
    rotulo: 'Testar',
    escopo: 'Pericias',
    workspace: workspace(log('Teste', mat(rolar(txt('1d20')), '+', itemDe('Total')))),
  },
  {
    id: 'atacar',
    rotulo: 'Atacar',
    escopo: 'Ataques',
    workspace: workspace(
      definir('ataque', mat(rolar(txt('1d20')), '+', itemDe('Ataque'))),
      se(
        critico(itemDe('Margem')),
        log('ACERTO CRÍTICO! Ataque', variavel('ataque')),
        log('Ataque', variavel('ataque')),
      ),
      log('Dano', rolarDano(itemDe('Dano'), itemDe('Margem'), itemDe('Mult'), 'dados')),
      se(cmp(itemDe('Tipo'), '!=', txt('')), log('Tipo de dano', itemDe('Tipo'))),
    ),
  },
  {
    id: 'conjurar',
    rotulo: 'Conjurar',
    escopo: 'Magias',
    workspace: workspace(
      se(
        cmp(campoDe('PM_Atual'), '>=', itemDe('Custo_PM')),
        empilhar(
          alterarCampo('PM_Atual', mat(campoDe('PM_Atual'), '-', itemDe('Custo_PM'))),
          log('PM gastos', itemDe('Custo_PM')),
          log('PM restantes', campoDe('PM_Atual')),
          se(cmp(itemDe('Dano'), '!=', txt('')), log('Dano', rolar(itemDe('Dano')))),
          se(cmp(itemDe('Resistencia'), '!=', txt('')), log('Resistência', itemDe('Resistencia'))),
        ),
        log('PM insuficiente — faltam', mat(itemDe('Custo_PM'), '-', campoDe('PM_Atual'))),
      ),
    ),
  },
  {
    id: 'descanso',
    rotulo: 'Descanso',
    workspace: workspace(
      alterarCampo('PV_Atual', campoDe('PV_Max')),
      alterarCampo('PM_Atual', campoDe('PM_Max')),
      log('Descanso completo — PV', campoDe('PV_Atual')),
      log('PM', campoDe('PM_Atual')),
    ),
  },
  {
    id: 'sofrerDano',
    rotulo: 'Sofrer dano',
    workspace: workspace(
      alterarCampo('PV_Atual', mat(campoDe('PV_Atual'), '-', campoDe('Ajuste'))),
      log('Dano sofrido', campoDe('Ajuste')),
      log('PV atual', campoDe('PV_Atual')),
    ),
  },
  {
    id: 'curar',
    rotulo: 'Curar',
    workspace: workspace(
      alterarCampo('PV_Atual', mat(mat(campoDe('PV_Atual'), '+', campoDe('Ajuste')), 'min', campoDe('PV_Max'))),
      log('Cura', campoDe('Ajuste')),
      log('PV atual', campoDe('PV_Atual')),
    ),
  },
];

// ── Layout ─────────────────────────────────────────────────
const LAYOUT: NoLayout[] = [
  {
    tipo: 'painel',
    pos: pos(0, 0, 12, 4),
    titulo: 'Personagem',
    colunas: 10,
    filhos: [
      campo(pos(0, 0, 6), texto('Nome', 'Nome')),
      campo(pos(6, 0, 4), texto('Jogador', 'Jogador')),
      campo(pos(0, 1, 2), numero('Nivel', 'Nível', 1)),
      campo(pos(2, 1, 2), texto('Raca', 'Raça')),
      campo(pos(4, 1, 2), texto('Origem', 'Origem')),
      campo(pos(6, 1, 2), texto('Classe', 'Classe')),
      campo(pos(8, 1, 2), texto('Divindade', 'Divindade')),
    ],
  },
  {
    tipo: 'painel',
    pos: pos(0, 4, 6, 6),
    titulo: 'Atributos',
    colunas: 6,
    filhos: [
      campo(pos(0, 0, 2), numero('FOR', 'Força')),
      campo(pos(2, 0, 2), numero('DES', 'Destreza')),
      campo(pos(4, 0, 2), numero('CON', 'Constituição')),
      campo(pos(0, 1, 2), numero('INT', 'Inteligência')),
      campo(pos(2, 1, 2), numero('SAB', 'Sabedoria')),
      campo(pos(4, 1, 2), numero('CAR', 'Carisma')),
      { tipo: 'texto', pos: pos(0, 2, 6), texto: 'Em T20 o valor do atributo já é o modificador.', estilo: 'nota' },
    ],
  },
  {
    tipo: 'painel',
    pos: pos(6, 4, 6, 6),
    titulo: 'Vida, mana e defesa',
    colunas: 6,
    filhos: [
      campo(pos(0, 0, 2), numero('PV_Atual', 'PV atual')),
      campo(pos(2, 0, 2), numero('PV_Max', 'PV máximo')),
      campo(pos(4, 0, 2), calculado('Defesa', 'Defesa', '10+DES+Armadura+Escudo')),
      campo(pos(0, 1, 2), numero('PM_Atual', 'PM atual')),
      campo(pos(2, 1, 2), numero('PM_Max', 'PM máximo')),
      campo(pos(4, 1, 2), numero('Deslocamento', 'Deslocamento (m)', 9)),
      campo(pos(0, 2, 2), numero('Armadura', 'Bônus de armadura')),
      campo(pos(2, 2, 2), numero('Escudo', 'Bônus de escudo')),
      campo(pos(4, 2, 2), numero('Ajuste', 'Dano / cura')),
      botao(pos(0, 3, 2), 'descanso'),
      botao(pos(2, 3, 2), 'sofrerDano'),
      botao(pos(4, 3, 2), 'curar'),
    ],
  },
  {
    tipo: 'lista',
    pos: pos(0, 10, 12, 9),
    lista: {
      id: 'Pericias',
      rotulo: 'Perícias',
      formato: 'tabela',
      colunas: 12,
      itensPadrao: itensPericias,
      item: [
        campo(pos(0, 0, 4), texto('Nome', 'Perícia')),
        campo(pos(4, 0, 2), texto('Chave', 'Atributo', 'DES')),
        campo(pos(6, 0, 2), numero('Treino', 'Treino')),
        campo(pos(8, 0, 2), numero('Outros', 'Outros')),
        campo(pos(10, 0, 2), calculado('Total', 'Total', 'piso(Nivel/2)+Chave+Treino+Outros')),
        botao(pos(0, 1, 2), 'testarPericia'),
      ],
    },
  },
  {
    tipo: 'lista',
    pos: pos(0, 19, 12, 8),
    lista: {
      id: 'Ataques',
      rotulo: 'Ataques',
      formato: 'cartoes',
      colunas: 6,
      item: [
        campo(pos(0, 0, 3), texto('Nome', 'Arma')),
        campo(pos(3, 0, 3), dados('Dano', 'Dano', '1d8+FOR')),
        campo(pos(0, 1, 2), texto('Ataque', 'Bônus de ataque', 'piso(Nivel/2)+FOR')),
        campo(pos(2, 1, 2), numero('Margem', 'Margem de crítico', 20)),
        campo(pos(4, 1, 2), numero('Mult', 'Multiplicador', 2)),
        campo(pos(0, 2, 3), texto('Tipo', 'Tipo de dano')),
        botao(pos(3, 2, 3), 'atacar'),
      ],
    },
  },
  {
    tipo: 'lista',
    pos: pos(0, 27, 12, 8),
    lista: {
      id: 'Magias',
      rotulo: 'Magias',
      formato: 'linhas',
      colunas: 12,
      item: [
        campo(pos(0, 0, 4), texto('Nome', 'Magia')),
        campo(pos(4, 0, 2), numero('Circulo', 'Círculo', 1)),
        campo(pos(6, 0, 2), numero('Custo_PM', 'Custo em PM', 1)),
        campo(pos(8, 0, 2), texto('Execucao', 'Execução', 'Padrão')),
        campo(pos(10, 0, 2), texto('Alcance', 'Alcance', 'Curto')),
        campo(pos(0, 1, 2), texto('Duracao', 'Duração', 'Instantânea')),
        campo(pos(2, 1, 2), texto('Resistencia', 'Resistência')),
        campo(pos(4, 1, 2), dados('Dano', 'Dano', '')),
        campo(pos(6, 1, 4), texto('Descricao', 'Efeito')),
        botao(pos(10, 1, 2), 'conjurar'),
      ],
    },
  },
  {
    tipo: 'lista',
    pos: pos(0, 35, 12, 6),
    lista: {
      id: 'Poderes',
      rotulo: 'Poderes e habilidades',
      formato: 'linhas',
      colunas: 12,
      item: [
        campo(pos(0, 0, 4), texto('Nome', 'Nome')),
        campo(pos(4, 0, 2), texto('Tipo', 'Tipo', 'Classe')),
        campo(pos(6, 0, 6), texto('Descricao', 'Descrição')),
      ],
    },
  },
  {
    tipo: 'lista',
    pos: pos(0, 41, 8, 7),
    lista: {
      id: 'Equipamento',
      rotulo: 'Equipamento',
      formato: 'tabela',
      colunas: 12,
      item: [
        campo(pos(0, 0, 4), texto('Nome', 'Item')),
        campo(pos(4, 0, 2), numero('Quantidade', 'Qtd.', 1)),
        campo(pos(6, 0, 2), numero('Espacos', 'Espaços', 1)),
        campo(pos(8, 0, 4), texto('Observacoes', 'Observações')),
      ],
    },
  },
  {
    tipo: 'painel',
    pos: pos(8, 41, 4, 5),
    titulo: 'Recursos',
    colunas: 4,
    filhos: [
      campo(pos(0, 0, 2), numero('Tibares', 'Tibares (T$)')),
      campo(pos(2, 0, 2), calculado('Espacos_Max', 'Espaços', '10+FOR')),
      { tipo: 'texto', pos: pos(0, 1, 4), texto: 'Acima dos espaços você fica sobrecarregado.', estilo: 'nota' },
    ],
  },
];

function montar(): { definicao: TemplateDef; avisos: string[] } {
  const avisos: string[] = [];
  const acoes: AcaoDef[] = ACOES.map((a) => {
    const r = compilarAcao(a.workspace);
    avisos.push(...r.avisos.map((av) => `${a.rotulo}: ${av}`));
    return { ...a, corpo: r.corpo };
  });
  return { definicao: { colunas: 12, layout: LAYOUT, acoes }, avisos };
}

const { definicao, avisos } = montar();
if (avisos.length) console.warn('Avisos:', avisos);

const arquivo: TemplateArquivo = { formato: 'rpg-template', versao: 2, id: 't20', nome: 'T20', definicao };
const destino = path.join(pasta, 'templates', 't20.txt');

await fs.mkdir(path.join(pasta, 'templates'), { recursive: true });
try {
  const anterior = await fs.readFile(destino, 'utf8');
  const copia = path.join(pasta, `backup-t20-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await fs.writeFile(copia, anterior, 'utf8');
  console.log('Cópia do arquivo anterior em', copia);
} catch {
  // ainda não existia
}

await fs.writeFile(destino, JSON.stringify(arquivo, null, 2) + '\n', 'utf8');
console.log('Gravado', destino);
console.log(`${definicao.layout.length} elementos, ${definicao.acoes.length} ações, ${itensPericias.length} perícias iniciais.`);
