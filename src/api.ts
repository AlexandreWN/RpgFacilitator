import type { ResumoArquivo } from './shared/types';

export type Colecao = 'templates' | 'personagens' | 'blocos';

async function requisicao<T>(url: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(url, init);
  if (!resposta.ok) {
    let mensagem = resposta.statusText;
    try {
      mensagem = ((await resposta.json()) as { erro?: string }).erro ?? mensagem;
    } catch {
      // resposta sem JSON
    }
    throw new Error(mensagem);
  }
  return (resposta.status === 204 ? undefined : await resposta.json()) as T;
}

const url = (colecao: Colecao, id?: string) => `/api/${colecao}${id === undefined ? '' : `/${encodeURIComponent(id)}`}`;

export const api = {
  listar: (colecao: Colecao) => requisicao<ResumoArquivo[]>(url(colecao)),
  listarCompleto: <T>(colecao: Colecao) => requisicao<T[]>(`${url(colecao)}?completo=1`),
  ler: <T>(colecao: Colecao, id: string) => requisicao<T>(url(colecao, id)),
  salvar: (colecao: Colecao, id: string, dados: object) =>
    requisicao<void>(url(colecao, id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) }),
  excluir: (colecao: Colecao, id: string) => requisicao<void>(url(colecao, id), { method: 'DELETE' }),
};

export function mensagemErro(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
