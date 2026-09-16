import { camposDaLista, formatarValor, listasDoTemplate, type ContextoItem, type ResultadoAcao } from '../shared/interpreter';
import type { AcaoDef, TemplateDef, Valores } from '../shared/types';

export interface RegistroLog {
  id: number;
  hora: string;
  titulo: string;
  resultado: ResultadoAcao;
}

let proximoId = 1;

export function criarRegistro(
  definicao: TemplateDef,
  acao: AcaoDef,
  ctx: ContextoItem,
  valores: Valores,
  resultado: ResultadoAcao,
): RegistroLog {
  let titulo = acao.rotulo;
  if (ctx.listaId !== undefined) {
    // O nome do item vem do primeiro campo de texto da lista, qualquer que seja o id dele.
    const lista = listasDoTemplate(definicao).find((l) => l.id === ctx.listaId);
    const campoNome = lista && camposDaLista(lista).find((c) => c.tipo === 'texto');
    const itens = valores[ctx.listaId];
    const item = Array.isArray(itens) ? itens[ctx.indice ?? -1] : undefined;
    const nome = campoNome && item ? item[campoNome.id] : undefined;
    if (typeof nome === 'string' && nome.trim()) titulo += ` — ${nome}`;
  }
  return { id: proximoId++, hora: new Date().toLocaleTimeString('pt-BR'), titulo, resultado };
}

export function RollLog({ registros, onLimpar }: { registros: RegistroLog[]; onLimpar: () => void }) {
  return (
    <div className="log">
      <div className="bloco-titulo">
        <h2>Log de rolagens</h2>
        {registros.length > 0 ? (
          <button className="discreto mono" onClick={onLimpar}>
            limpar
          </button>
        ) : (
          <span className="meta">vazio</span>
        )}
      </div>
      {registros.length === 0 && <p className="vazio">Clique numa ação para rolar os dados.</p>}
      <ol className="log-lista">
        {registros.map((r) => (
          <li key={r.id} className={`log-registro ${r.resultado.critico ? 'critico' : ''} ${r.resultado.erro ? 'com-erro' : ''}`}>
            <div className="log-cabecalho">
              <strong>{r.titulo}</strong>
              {r.resultado.critico && <span className="tag">crítico</span>}
              <span className="meta">{r.hora}</span>
            </div>
            {r.resultado.linhas.map((l, i) => (
              <div key={i} className={`log-linha ${l.critico ? 'critico' : ''}`}>
                <div>
                  {l.texto}
                  {l.valor !== undefined && (
                    <>
                      {l.texto ? ' ' : ''}
                      <b className="log-valor">{formatarValor(l.valor)}</b>
                    </>
                  )}
                </div>
                {l.detalhes.map((d, j) => (
                  <div key={j} className="log-detalhe mono">
                    {d}
                  </div>
                ))}
              </div>
            ))}
            {r.resultado.erro && <div className="erro-inline">⚠ {r.resultado.erro}</div>}
          </li>
        ))}
      </ol>
    </div>
  );
}
