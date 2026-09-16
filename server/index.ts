import express, { type NextFunction, type Request, type Response } from 'express';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ErroArmazenamento, PASTA_DADOS, ehColecao, excluir, ler, listar, salvar, type Colecao } from './storage';

const PORTA = Number(process.env.RPG_API_PORT ?? 3001);
const app = express();
app.use(express.json({ limit: '10mb' }));

function colecaoDe(req: Request): Colecao {
  const colecao = String(req.params.colecao);
  if (!ehColecao(colecao)) throw new ErroArmazenamento(404, `Coleção desconhecida: ${colecao}`);
  return colecao;
}

app.get('/api/:colecao', async (req, res) => {
  res.json(await listar(colecaoDe(req), req.query.completo === '1'));
});

app.get('/api/:colecao/:id', async (req, res) => {
  const dados = await ler(colecaoDe(req), req.params.id);
  if (dados === null) throw new ErroArmazenamento(404, `"${req.params.id}" não encontrado`);
  res.json(dados);
});

app.put('/api/:colecao/:id', async (req, res) => {
  const corpo = req.body as unknown;
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new ErroArmazenamento(400, 'O corpo da requisição deve ser um objeto JSON');
  }
  await salvar(colecaoDe(req), req.params.id, corpo as Record<string, unknown>);
  res.status(204).end();
});

app.delete('/api/:colecao/:id', async (req, res) => {
  const removido = await excluir(colecaoDe(req), req.params.id);
  if (!removido) throw new ErroArmazenamento(404, `"${req.params.id}" não encontrado`);
  res.status(204).end();
});

app.use('/api', (_req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

const dist = path.resolve('dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.use((_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ErroArmazenamento) {
    res.status(err.status).json({ erro: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ erro: err instanceof Error ? err.message : 'Erro interno' });
});

/** Abre o navegador no app (usado pelo iniciar.bat, via RPG_ABRIR=1). */
function abrirNavegador(url: string) {
  const [comando, argumentos] =
    process.platform === 'win32'
      ? (['cmd', ['/c', 'start', '""', url]] as const)
      : process.platform === 'darwin'
        ? (['open', [url]] as const)
        : (['xdg-open', [url]] as const);
  try {
    spawn(comando, [...argumentos], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    // sem navegador disponível: o endereço já foi impresso no console
  }
}

app.listen(PORTA, () => {
  const url = `http://localhost:${PORTA}`;
  console.log(`RPG Facilitator em ${url}`);
  console.log(`Dados em ${PASTA_DADOS}`);
  if (process.env.RPG_ABRIR === '1') abrirNavegador(url);
});
