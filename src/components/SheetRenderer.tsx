import type { CSSProperties } from 'react';
import { acharAcao, avaliarCalculado, itemPadrao, type ContextoItem } from '../shared/interpreter';
import type { AcaoDef, Item, ListaDef, NoLayout, TemplateDef, Valor, Valores } from '../shared/types';
import { ALTURA_LINHA, estiloPos, linhasNecessarias, ordenarPorPosicao } from '../layout/modelo';
import { estiloCor, indice } from '../ui/cores';
import { CampoCelula } from './CampoCelula';

interface Props {
  definicao: TemplateDef;
  valores: Valores;
  onChange: (valores: Valores) => void;
  onAcao: (acao: AcaoDef, ctx: ContextoItem) => void;
}

export function SheetRenderer({ definicao, valores, onChange, onAcao }: Props) {
  if (definicao.layout.length === 0) {
    return <p className="vazio">A ficha ainda não tem nada. Monte o layout na aba “Layout” do template.</p>;
  }
  return (
    <Grade
      nos={definicao.layout}
      colunas={definicao.colunas}
      definicao={definicao}
      valores={valores}
      onChange={onChange}
      onAcao={onAcao}
      ctx={{}}
    />
  );
}

interface GradeProps {
  nos: NoLayout[];
  colunas: number;
  definicao: TemplateDef;
  valores: Valores;
  onChange: (valores: Valores) => void;
  onAcao: (acao: AcaoDef, ctx: ContextoItem) => void;
  ctx: ContextoItem;
  item?: Item;
}

function Grade(props: GradeProps) {
  const { nos, colunas } = props;
  return (
    <div
      className="grade-ficha"
      style={{ '--colunas': colunas, gridTemplateRows: `repeat(${linhasNecessarias(nos)}, minmax(${ALTURA_LINHA}px, auto))` } as CSSProperties}
    >
      {nos.map((no, i) => (
        <div key={i} style={estiloPos(no.pos)} className="no-ficha">
          <No no={no} {...props} />
        </div>
      ))}
    </div>
  );
}

function No({ no, ...props }: GradeProps & { no: NoLayout }) {
  const { definicao, valores, onChange, onAcao, ctx, item } = props;

  switch (no.tipo) {
    case 'texto':
      return no.estilo === 'titulo' ? <h3 className="texto-titulo">{no.texto}</h3> : <p className="texto-nota">{no.texto}</p>;

    case 'campo': {
      const campo = no.campo;
      const emItem = ctx.listaId !== undefined;
      const valor = emItem ? item?.[campo.id] : valores[campo.id];
      const alterar = (v: Valor) => {
        if (!emItem) {
          onChange({ ...valores, [campo.id]: v });
          return;
        }
        const lista = valores[ctx.listaId!];
        if (!Array.isArray(lista)) return;
        onChange({ ...valores, [ctx.listaId!]: lista.map((it, j) => (j === ctx.indice ? { ...it, [campo.id]: v } : it)) });
      };
      return (
        <CampoCelula campo={campo} valor={valor} onChange={alterar} calcular={() => avaliarCalculado(definicao, valores, campo, ctx)} />
      );
    }

    case 'acao': {
      const acao = acharAcao(definicao, no.acaoId);
      if (!acao) return <span className="nota">ação removida</span>;
      return (
        <button className="acao" onClick={() => onAcao(acao, ctx)}>
          ⚄ {acao.rotulo}
        </button>
      );
    }

    case 'painel':
      return (
        <section className="painel-ficha">
          {no.titulo && <header className="painel-cabecalho">{no.titulo}</header>}
          <div className="painel-corpo">
            <Grade {...props} nos={no.filhos} colunas={no.colunas} />
          </div>
        </section>
      );

    case 'lista':
      return <Lista {...props} lista={no.lista} />;
  }
}

function Lista({ lista, definicao, valores, onChange, onAcao }: GradeProps & { lista: ListaDef }) {
  const itens = Array.isArray(valores[lista.id]) ? (valores[lista.id] as Item[]) : [];
  const adicionar = () => onChange({ ...valores, [lista.id]: [...itens, itemPadrao(lista)] });
  const remover = (i: number) => onChange({ ...valores, [lista.id]: itens.filter((_, j) => j !== i) });

  const cabecalho = (
    <div className="bloco-titulo">
      <h3>{lista.rotulo}</h3>
      <span className="meta">
        {itens.length} {itens.length === 1 ? 'item' : 'itens'}
      </span>
    </div>
  );

  if (lista.formato === 'tabela') {
    const colunas = ordenarPorPosicao(lista.item.filter((n) => n.tipo === 'campo'));
    const acoes = ordenarPorPosicao(lista.item.filter((n) => n.tipo === 'acao'));
    return (
      <section className="lista-ficha">
        {cabecalho}
        <div className="tabela-rolagem">
          <table className="tabela-itens">
            <thead>
              <tr>
                <th className="col-num">#</th>
                {colunas.map((n, i) => (
                  <th key={i}>{n.tipo === 'campo' ? n.campo.rotulo || n.campo.id : ''}</th>
                ))}
                {acoes.length > 0 && <th />}
                <th />
              </tr>
            </thead>
            <tbody>
              {itens.map((item, i) => (
                <tr key={i}>
                  <td className="col-num mono">{indice(i)}</td>
                  {colunas.map((n, j) => (
                    <td key={j}>
                      {n.tipo === 'campo' && (
                        <CampoCelula
                          campo={n.campo}
                          valor={item[n.campo.id]}
                          semRotulo
                          onChange={(v) =>
                            onChange({
                              ...valores,
                              [lista.id]: itens.map((it, k) => (k === i ? { ...it, [n.campo.id]: v } : it)),
                            })
                          }
                          calcular={() => avaliarCalculado(definicao, valores, n.campo, { listaId: lista.id, indice: i })}
                        />
                      )}
                    </td>
                  ))}
                  {acoes.length > 0 && (
                    <td>
                      <div className="acoes-linha">
                        {acoes.map((n, j) => {
                          const acao = n.tipo === 'acao' ? acharAcao(definicao, n.acaoId) : undefined;
                          return acao ? (
                            <button key={j} className="acao" onClick={() => onAcao(acao, { listaId: lista.id, indice: i })}>
                              ⚄ {acao.rotulo}
                            </button>
                          ) : null;
                        })}
                      </div>
                    </td>
                  )}
                  <td>
                    <button className="discreto" onClick={() => remover(i)} title="Remover item">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="adicionar-item" onClick={adicionar}>
          + Adicionar {lista.rotulo.toLowerCase()}
        </button>
      </section>
    );
  }

  const campoTitulo = ordenarPorPosicao(lista.item.filter((n) => n.tipo === 'campo')).find((n) => n.campo.tipo === 'texto');

  return (
    <section className="lista-ficha">
      {cabecalho}
      <div className={lista.formato === 'cartoes' ? 'grade-itens' : 'itens-linhas'}>
        {itens.map((item, i) => {
          const nome = campoTitulo ? String(item[campoTitulo.campo.id] ?? '').trim() : '';
          return (
            <article key={i} className="cartao item-cartao" style={estiloCor(i)}>
              <header className="cartao-cabecalho">
                <span className="badge-num">{indice(i)}</span>
                <h4>{nome || `${lista.rotulo} ${i + 1}`}</h4>
                <button className="discreto" onClick={() => remover(i)} title="Remover item">
                  ✕
                </button>
              </header>
              <div className="item-corpo">
                <Grade
                  nos={lista.item}
                  colunas={lista.colunas}
                  definicao={definicao}
                  valores={valores}
                  onChange={onChange}
                  onAcao={onAcao}
                  ctx={{ listaId: lista.id, indice: i }}
                  item={item}
                />
              </div>
            </article>
          );
        })}
        <button className="adicionar-item" onClick={adicionar}>
          + Adicionar {lista.rotulo.toLowerCase()}
        </button>
      </div>
    </section>
  );
}
