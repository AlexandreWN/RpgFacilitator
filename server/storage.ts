import { promises as fs } from 'node:fs';
import path from 'node:path';

export const COLECOES = ['templates', 'personagens', 'blocos'] as const;
export type Colecao = (typeof COLECOES)[number];

export const PASTA_DADOS = path.resolve(process.env.RPG_DATA_DIR ?? path.join(process.cwd(), 'data'));

const ID_ARQUIVO = /^[a-z0-9][a-z0-9_-]{0,79}$/;

export class ErroArmazenamento extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

export function ehColecao(valor: string): valor is Colecao {
  return (COLECOES as readonly string[]).includes(valor);
}

export interface ResumoArquivo {
  id: string;
  nome: string;
  template?: string;
  modificado: string;
  erro?: string;
}

function pasta(colecao: Colecao): string {
  return path.join(PASTA_DADOS, colecao);
}

function caminho(colecao: Colecao, id: string): string {
  if (!ID_ARQUIVO.test(id)) {
    throw new ErroArmazenamento(400, `ID inválido: "${id}" (use letras minúsculas, números, - e _)`);
  }
  return path.join(pasta(colecao), `${id}.txt`);
}

export async function listar(colecao: Colecao, completo = false): Promise<unknown[]> {
  const dir = pasta(colecao);
  await fs.mkdir(dir, { recursive: true });
  const nomes = (await fs.readdir(dir)).filter((n) => n.endsWith('.txt'));
  const itens = await Promise.all(
    nomes.map(async (arquivo) => {
      const id = arquivo.slice(0, -4);
      const p = path.join(dir, arquivo);
      const stat = await fs.stat(p);
      try {
        const dados = JSON.parse(await fs.readFile(p, 'utf8'));
        if (completo) return { ...dados, id };
        const resumo: ResumoArquivo = {
          id,
          nome: typeof dados.nome === 'string' ? dados.nome : id,
          modificado: stat.mtime.toISOString(),
        };
        if (typeof dados.template === 'string') resumo.template = dados.template;
        return resumo;
      } catch {
        return completo ? null : { id, nome: id, modificado: stat.mtime.toISOString(), erro: 'Arquivo não é um JSON válido' };
      }
    }),
  );
  return itens
    .filter((i) => i !== null)
    .sort((a, b) => String((a as ResumoArquivo).nome).localeCompare(String((b as ResumoArquivo).nome), 'pt-BR'));
}

export async function ler(colecao: Colecao, id: string): Promise<unknown | null> {
  const p = caminho(colecao, id);
  let conteudo: string;
  try {
    conteudo = await fs.readFile(p, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
  try {
    return JSON.parse(conteudo);
  } catch {
    throw new ErroArmazenamento(422, `O arquivo ${colecao}/${id}.txt não é um JSON válido`);
  }
}

export async function salvar(colecao: Colecao, id: string, dados: Record<string, unknown>): Promise<void> {
  const p = caminho(colecao, id);
  await fs.mkdir(pasta(colecao), { recursive: true });
  const temporario = `${p}.tmp`;
  await fs.writeFile(temporario, JSON.stringify({ ...dados, id }, null, 2) + '\n', 'utf8');
  await fs.rename(temporario, p);
}

export async function excluir(colecao: Colecao, id: string): Promise<boolean> {
  try {
    await fs.unlink(caminho(colecao, id));
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw e;
  }
}
