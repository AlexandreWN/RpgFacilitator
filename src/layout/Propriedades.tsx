import { NOMES_FUNCOES } from '../shared/dice';
import { camposDoPersonagem } from '../shared/interpreter';
import type { FormatoLista, NoLayout, TemplateDef, TipoCampo } from '../shared/types';
import { ajustarColunas } from './LayoutEditor';
import { atualizarNo, idsDaFicha, idUnicoDeCampo, obterNo, removerNo, type Caminho } from './modelo';

interface Props {
  definicao: TemplateDef;
  caminho: Caminho | null;
  onChange: (def: TemplateDef) => void;
  onSelecionar: (c: Caminho | null) => void;
  onEditarBlocos: (acaoId: string) => void;
}

const TIPOS: { valor: TipoCampo; rotulo: string }[] = [
  { valor: 'numero', rotulo: 'Número' },
  { valor: 'texto', rotulo: 'Texto' },
  { valor: 'dados', rotulo: 'Dados' },
  { valor: 'marcador', rotulo: 'Sim/não' },
  { valor: 'calculado', rotulo: 'Calculado' },
];

const FORMATOS: { valor: FormatoLista; rotulo: string }[] = [
  { valor: 'cartoes', rotulo: 'Cartões lado a lado' },
  { valor: 'linhas', rotulo: 'Uma linha por item' },
  { valor: 'tabela', rotulo: 'Tabela' },
];

export function Propriedades({ definicao, caminho, onChange, onSelecionar, onEditarBlocos }: Props) {
  const no = caminho ? obterNo(definicao.layout, caminho) : undefined;

  if (!caminho || !no) {
    return (
      <div className="propriedades">
        <div className="bloco-titulo">
          <h2>Propriedades</h2>
        </div>
        <p className="vazio">Clique num elemento da ficha para configurar. Arraste pela borda para mover e pelo canto para redimensionar.</p>
      </div>
    );
  }

  const trocar = (fn: (no: NoLayout) => NoLayout) => onChange(atualizarNo(definicao, caminho, fn));
  const trocarPos = (campo: 'w' | 'h', valor: number) => trocar((n) => ({ ...n, pos: { ...n.pos, [campo]: Math.max(1, valor) } }));
  const remover = () => {
    onChange(removerNo(definicao, caminho));
    onSelecionar(null);
  };

  return (
    <div className="propriedades">
      <div className="bloco-titulo">
        <h2>Propriedades</h2>
        <button className="discreto" onClick={remover}>
          remover
        </button>
      </div>

      {no.tipo === 'campo' && (
        <>
          <label className="prop">
            <span className="rotulo-mono">Rótulo</span>
            <input value={no.campo.rotulo} onChange={(e) => trocar((n) => (n.tipo === 'campo' ? { ...n, campo: { ...n.campo, rotulo: e.target.value } } : n))} />
          </label>
          <label className="prop">
            <span className="rotulo-mono">Id (usado nas fórmulas)</span>
            <input
              className="mono"
              value={no.campo.id}
              onChange={(e) =>
                trocar((n) => {
                  if (n.tipo !== 'campo') return n;
                  const usados = idsDaFicha(definicao);
                  usados.delete(n.campo.id);
                  return { ...n, campo: { ...n.campo, id: idUnicoDeCampo(e.target.value, usados) } };
                })
              }
            />
          </label>
          <label className="prop">
            <span className="rotulo-mono">Tipo</span>
            <select
              value={no.campo.tipo}
              onChange={(e) =>
                trocar((n) => {
                  if (n.tipo !== 'campo') return n;
                  const tipo = e.target.value as TipoCampo;
                  const campo = { ...n.campo, tipo };
                  if (tipo === 'calculado') {
                    delete campo.padrao;
                    campo.formula ??= '0';
                  } else {
                    delete campo.formula;
                    campo.padrao = tipo === 'numero' ? 0 : tipo === 'marcador' ? false : tipo === 'dados' ? '1d6' : '';
                  }
                  return { ...n, campo };
                })
              }
            >
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </select>
          </label>

          {no.campo.tipo === 'calculado' ? (
            <label className="prop">
              <span className="rotulo-mono">Fórmula</span>
              <input
                className="mono"
                value={no.campo.formula ?? ''}
                placeholder="piso((FOR-10)/2)"
                onChange={(e) => trocar((n) => (n.tipo === 'campo' ? { ...n, campo: { ...n.campo, formula: e.target.value } } : n))}
              />
              <span className="nota">
                Campos disponíveis: <span className="mono">{camposDoPersonagem(definicao).map((c) => c.id).join(', ') || '—'}</span>
              </span>
              <span className="nota">Funções: {NOMES_FUNCOES.join(', ')}</span>
            </label>
          ) : (
            <label className="prop">
              <span className="rotulo-mono">Valor padrão</span>
              {no.campo.tipo === 'marcador' ? (
                <input
                  type="checkbox"
                  checked={no.campo.padrao === true}
                  onChange={(e) => trocar((n) => (n.tipo === 'campo' ? { ...n, campo: { ...n.campo, padrao: e.target.checked } } : n))}
                />
              ) : (
                <input
                  className={no.campo.tipo === 'dados' ? 'mono' : undefined}
                  value={String(no.campo.padrao ?? '')}
                  onChange={(e) =>
                    trocar((n) => {
                      if (n.tipo !== 'campo') return n;
                      const bruto = e.target.value;
                      const padrao = n.campo.tipo === 'numero' ? (Number.isFinite(Number(bruto)) && bruto.trim() !== '' ? Number(bruto) : 0) : bruto;
                      return { ...n, campo: { ...n.campo, padrao } };
                    })
                  }
                />
              )}
            </label>
          )}
        </>
      )}

      {no.tipo === 'painel' && (
        <>
          <label className="prop">
            <span className="rotulo-mono">Título</span>
            <input value={no.titulo} onChange={(e) => trocar((n) => (n.tipo === 'painel' ? { ...n, titulo: e.target.value } : n))} />
          </label>
          <label className="prop">
            <span className="rotulo-mono">Colunas internas</span>
            <input
              type="number"
              min={1}
              max={12}
              value={no.colunas}
              onChange={(e) => onChange(ajustarColunas(definicao, caminho, Math.min(12, Math.max(1, Number(e.target.value) || 1))))}
            />
          </label>
        </>
      )}

      {no.tipo === 'lista' && (
        <>
          <label className="prop">
            <span className="rotulo-mono">Rótulo</span>
            <input value={no.lista.rotulo} onChange={(e) => trocar((n) => (n.tipo === 'lista' ? { ...n, lista: { ...n.lista, rotulo: e.target.value } } : n))} />
          </label>
          <label className="prop">
            <span className="rotulo-mono">Id da lista</span>
            <input
              className="mono"
              value={no.lista.id}
              onChange={(e) =>
                trocar((n) => {
                  if (n.tipo !== 'lista') return n;
                  const usados = idsDaFicha(definicao);
                  usados.delete(n.lista.id);
                  return { ...n, lista: { ...n.lista, id: idUnicoDeCampo(e.target.value, usados) } };
                })
              }
            />
          </label>
          <label className="prop">
            <span className="rotulo-mono">Formato na ficha</span>
            <select
              value={no.lista.formato}
              onChange={(e) => trocar((n) => (n.tipo === 'lista' ? { ...n, lista: { ...n.lista, formato: e.target.value as FormatoLista } } : n))}
            >
              {FORMATOS.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.rotulo}
                </option>
              ))}
            </select>
          </label>
          <label className="prop">
            <span className="rotulo-mono">Colunas do item</span>
            <input
              type="number"
              min={1}
              max={12}
              value={no.lista.colunas}
              onChange={(e) => onChange(ajustarColunas(definicao, caminho, Math.min(12, Math.max(1, Number(e.target.value) || 1))))}
            />
          </label>
        </>
      )}

      {no.tipo === 'texto' && (
        <>
          <label className="prop">
            <span className="rotulo-mono">Texto</span>
            <input value={no.texto} onChange={(e) => trocar((n) => (n.tipo === 'texto' ? { ...n, texto: e.target.value } : n))} />
          </label>
          <label className="prop">
            <span className="rotulo-mono">Estilo</span>
            <select value={no.estilo} onChange={(e) => trocar((n) => (n.tipo === 'texto' ? { ...n, estilo: e.target.value as 'titulo' | 'nota' } : n))}>
              <option value="titulo">Título</option>
              <option value="nota">Nota</option>
            </select>
          </label>
        </>
      )}

      {no.tipo === 'acao' && (
        <>
          <label className="prop">
            <span className="rotulo-mono">Ação</span>
            <select value={no.acaoId} onChange={(e) => trocar((n) => (n.tipo === 'acao' ? { ...n, acaoId: e.target.value } : n))}>
              <option value="">— escolha —</option>
              {definicao.acoes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.rotulo}
                  {a.escopo ? ` (lista ${a.escopo})` : ''}
                </option>
              ))}
            </select>
          </label>
          {no.acaoId && (
            <button onClick={() => onEditarBlocos(no.acaoId)}>Editar blocos desta ação →</button>
          )}
        </>
      )}

      <div className="prop-tamanho">
        <label className="prop">
          <span className="rotulo-mono">Largura</span>
          <input type="number" min={1} value={no.pos.w} onChange={(e) => trocarPos('w', Number(e.target.value) || 1)} />
        </label>
        <label className="prop">
          <span className="rotulo-mono">Altura</span>
          <input type="number" min={1} value={no.pos.h} onChange={(e) => trocarPos('h', Number(e.target.value) || 1)} />
        </label>
      </div>
    </div>
  );
}
