import { promises as fs } from 'node:fs';
import path from 'node:path';
import { templateExemplo, valoresExemplo } from '../src/blocks/exemplo';
import type { PersonagemArquivo, TemplateArquivo } from '../src/shared/types';

const pasta = path.resolve(process.env.RPG_DATA_DIR ?? 'data');
const { definicao, avisos } = templateExemplo();
if (avisos.length) console.warn('Avisos:', avisos);

const template: TemplateArquivo = {
  formato: 'rpg-template',
  versao: 2,
  id: 'exemplo-dnd',
  nome: 'Exemplo D&D',
  definicao,
};

const personagem: PersonagemArquivo = {
  formato: 'rpg-personagem',
  versao: 1,
  id: 'thorin-exemplo',
  nome: 'Thorin (exemplo)',
  template: template.id,
  valores: valoresExemplo,
};

async function gravar(sub: string, id: string, dados: unknown) {
  await fs.mkdir(path.join(pasta, sub), { recursive: true });
  const arquivo = path.join(pasta, sub, `${id}.txt`);
  await fs.writeFile(arquivo, JSON.stringify(dados, null, 2) + '\n', 'utf8');
  console.log('Gravado', arquivo);
}

await gravar('templates', template.id, template);
await gravar('personagens', personagem.id, personagem);
