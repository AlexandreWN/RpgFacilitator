import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as EventoPonteiro } from 'react';
import { CampoCelula } from '../components/CampoCelula';
import { acharAcao, avaliarCalculado, valorPadraoCampo } from '../shared/interpreter';
import type { NoLayout, Pos, TemplateDef, TipoCampo, Valores } from '../shared/types';
import {
  ALTURA_LINHA,
  ESPACO,
  acomodarGrade,
  atualizarNo,
  contextoDaGrade,
  criarCampo,
  criarLista,
  criarNoAcao,
  criarPainel,
  criarTexto,
  estiloPos,
  idsDaFicha,
  inserirEm,
  linhasNecessarias,
  listaDaGrade,
  moverNo,
  novaAcao,
  obterNo,
  podeConter,
  redimensionarNo,
  type Caminho,
} from './modelo';

interface Props {
  definicao: TemplateDef;
  valores: Valores;
  onChange: (def: TemplateDef) => void;
  selecionado: Caminho | null;
  onSelecionar: (caminho: Caminho | null) => void;
}

type Arrasto =
  | { modo: 'novo'; no: NoLayout }
  | { modo: 'mover'; caminho: Caminho; no: NoLayout }
  | { modo: 'redimensionar'; caminho: Caminho; no: NoLayout; grade: DOMRect; colunas: number };

interface Alvo {
  grade: Caminho;
  pos: Pos;
}

const ITENS_PALETA: { rotulo: string; dica: string; criar: (usados: Set<string>) => NoLayout }[] = [
  { rotulo: 'Campo número', dica: 'FOR, PV, nível…', criar: (u) => criarCampo('numero', u) },
  { rotulo: 'Campo texto', dica: 'nome, anotações', criar: (u) => criarCampo('texto', u) },
  { rotulo: 'Campo dados', dica: '1d8+FOR_MOD', criar: (u) => criarCampo('dados', u) },
  { rotulo: 'Campo sim/não', dica: 'proficiência', criar: (u) => criarCampo('marcador', u) },
  { rotulo: 'Campo calculado', dica: 'piso((FOR-10)/2)', criar: (u) => criarCampo('calculado', u) },
  { rotulo: 'Seção', dica: 'agrupa campos', criar: () => criarPainel() },
  { rotulo: 'Lista de itens', dica: 'armas, magias', criar: (u) => criarLista(u) },
  { rotulo: 'Título / nota', dica: 'texto solto', criar: () => criarTexto() },
  { rotulo: 'Botão de ação', dica: 'rola os dados', criar: () => criarNoAcao() },
];

export function LayoutEditor({ definicao, valores, onChange, selecionado, onSelecionar }: Props) {
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const [ponteiro, setPonteiro] = useState({ x: 0, y: 0 });
  const [alvo, setAlvo] = useState<Alvo | null>(null);
  const defRef = useRef(definicao);
  defRef.current = definicao;
  const alvoRef = useRef<Alvo | null>(null);
  alvoRef.current = alvo;

  const localizarAlvo = useCallback((x: number, y: number, no: NoLayout): Alvo | null => {
    const elemento = document
      .elementsFromPoint(x, y)
      .find((e): e is HTMLElement => e instanceof HTMLElement && e.dataset.grade !== undefined);
    if (!elemento) return null;
    const grade = JSON.parse(elemento.dataset.grade!) as Caminho;
    const colunas = Number(elemento.dataset.colunas) || 1;
    if (!podeConter(contextoDaGrade(defRef.current.layout, grade), no.tipo)) return null;
    const r = elemento.getBoundingClientRect();
    const larguraCelula = (r.width + ESPACO) / colunas;
    const w = Math.min(no.pos.w, colunas);
    const col = Math.floor((x - r.left) / larguraCelula);
    const linha = Math.floor((y - r.top) / (ALTURA_LINHA + ESPACO));
    return {
      grade,
      pos: { x: Math.min(Math.max(0, col), colunas - w), y: Math.max(0, linha), w, h: no.pos.h },
    };
  }, []);

  useEffect(() => {
    if (!arrasto) return;

    const mover = (e: PointerEvent) => {
      setPonteiro({ x: e.clientX, y: e.clientY });
      if (arrasto.modo === 'redimensionar') {
        const { grade, colunas, no, caminho } = arrasto;
        const larguraCelula = (grade.width + ESPACO) / colunas;
        const w = Math.max(1, Math.min(colunas - no.pos.x, Math.round((e.clientX - grade.left) / larguraCelula) - no.pos.x));
        const h = Math.max(1, Math.round((e.clientY - grade.top) / (ALTURA_LINHA + ESPACO)) - no.pos.y);
        setAlvo({ grade: caminho.slice(0, -1), pos: { ...no.pos, w, h } });
        return;
      }
      setAlvo(localizarAlvo(e.clientX, e.clientY, arrasto.no));
    };

    const soltar = () => {
      const destino = alvoRef.current;
      const def = defRef.current;
      if (destino) {
        if (arrasto.modo === 'redimensionar') {
          onChange(redimensionarNo(def, arrasto.caminho, destino.pos));
        } else if (arrasto.modo === 'mover') {
          onChange(moverNo(def, arrasto.caminho, destino.grade, destino.pos));
          onSelecionar(null);
        } else {
          let novoDef = def;
          let no = arrasto.no;
          if (no.tipo === 'acao') {
            const lista = listaDaGrade(def.layout, destino.grade);
            const criada = novaAcao(def, lista?.id);
            novoDef = criada.def;
            no = { ...no, acaoId: criada.acao.id };
          }
          onChange(inserirEm(novoDef, destino.grade, { ...no, pos: destino.pos }));
        }
      }
      setArrasto(null);
      setAlvo(null);
    };

    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    return () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
    };
  }, [arrasto, localizarAlvo, onChange, onSelecionar]);

  const iniciarNovo = (e: EventoPonteiro, criar: (usados: Set<string>) => NoLayout) => {
    e.preventDefault();
    setPonteiro({ x: e.clientX, y: e.clientY });
    setArrasto({ modo: 'novo', no: criar(idsDaFicha(definicao)) });
  };

  const iniciarMover = (e: EventoPonteiro, caminho: Caminho, no: NoLayout) => {
    e.stopPropagation();
    e.preventDefault();
    setPonteiro({ x: e.clientX, y: e.clientY });
    onSelecionar(caminho);
    setArrasto({ modo: 'mover', caminho, no });
  };

  const iniciarRedimensionar = (e: EventoPonteiro, caminho: Caminho, no: NoLayout) => {
    e.stopPropagation();
    e.preventDefault();
    const grade = (e.currentTarget as HTMLElement).closest('[data-grade]') as HTMLElement | null;
    if (!grade) return;
    setArrasto({
      modo: 'redimensionar',
      caminho,
      no,
      grade: grade.getBoundingClientRect(),
      colunas: Number(grade.dataset.colunas) || 1,
    });
  };

  const grade = (nos: NoLayout[], caminho: Caminho, colunas: number) => (
    <GradeEditavel
      nos={nos}
      caminho={caminho}
      colunas={colunas}
      alvo={alvo && arrasto ? alvo : null}
      selecionado={selecionado}
      definicao={definicao}
      valores={valores}
      onSelecionar={onSelecionar}
      iniciarMover={iniciarMover}
      iniciarRedimensionar={iniciarRedimensionar}
      renderGrade={grade}
    />
  );

  return (
    <div className="layout-editor">
      <aside className="paleta">
        <span className="rotulo-mono">Arraste para a ficha</span>
        {ITENS_PALETA.map((item) => (
          <button
            key={item.rotulo}
            className="paleta-item"
            onPointerDown={(e) => iniciarNovo(e, item.criar)}
            onClick={() => {
              let def = definicao;
              let no = item.criar(idsDaFicha(definicao));
              if (no.tipo === 'acao') {
                const criada = novaAcao(def);
                def = criada.def;
                no = { ...no, acaoId: criada.acao.id };
              }
              onChange(inserirEm(def, [], { ...no, pos: { ...no.pos, y: linhasNecessarias(def.layout) } }));
            }}
          >
            <strong>{item.rotulo}</strong>
            <span className="meta">{item.dica}</span>
          </button>
        ))}
      </aside>

      <div className="tela-ficha" onClick={() => onSelecionar(null)}>
        <div className="ficha ficha-edicao">
          {definicao.layout.length === 0 && (
            <p className="vazio dica-vazia">
              Arraste um campo da esquerda para cá. A ficha tem {definicao.colunas} colunas e os elementos encaixam nelas.
            </p>
          )}
          {grade(definicao.layout, [], definicao.colunas)}
        </div>
      </div>

      {arrasto && arrasto.modo !== 'redimensionar' && (
        <div className="fantasma" style={{ left: ponteiro.x + 12, top: ponteiro.y + 12 }}>
          {rotuloDoNo(arrasto.no, definicao)}
        </div>
      )}
    </div>
  );
}

function rotuloDoNo(no: NoLayout, def: TemplateDef): string {
  switch (no.tipo) {
    case 'campo':
      return no.campo.rotulo || no.campo.id;
    case 'painel':
      return no.titulo || 'Seção';
    case 'lista':
      return no.lista.rotulo;
    case 'texto':
      return no.texto;
    case 'acao':
      return acharAcao(def, no.acaoId)?.rotulo ?? 'Ação';
  }
}

interface PropsGrade {
  nos: NoLayout[];
  caminho: Caminho;
  colunas: number;
  alvo: Alvo | null;
  selecionado: Caminho | null;
  definicao: TemplateDef;
  valores: Valores;
  onSelecionar: (c: Caminho | null) => void;
  iniciarMover: (e: EventoPonteiro, caminho: Caminho, no: NoLayout) => void;
  iniciarRedimensionar: (e: EventoPonteiro, caminho: Caminho, no: NoLayout) => void;
  renderGrade: (nos: NoLayout[], caminho: Caminho, colunas: number) => React.ReactNode;
}

function GradeEditavel(props: PropsGrade) {
  const { nos, caminho, colunas, alvo, selecionado, definicao, valores, onSelecionar, iniciarMover, iniciarRedimensionar, renderGrade } =
    props;
  const mostrarAlvo = alvo && JSON.stringify(alvo.grade) === JSON.stringify(caminho);
  const linhas = Math.max(linhasNecessarias(nos, 1), mostrarAlvo ? alvo.pos.y + alvo.pos.h + 1 : 1);

  return (
    <div
      className="grade-ficha grade-edicao"
      data-grade={JSON.stringify(caminho)}
      data-colunas={colunas}
      style={{ '--colunas': colunas, gridTemplateRows: `repeat(${linhas}, ${ALTURA_LINHA}px)` } as CSSProperties}
    >
      {nos.map((no, i) => {
        const caminhoNo = [...caminho, i];
        const escolhido = JSON.stringify(selecionado) === JSON.stringify(caminhoNo);
        return (
          <div
            key={i}
            className={`no no-${no.tipo} ${escolhido ? 'selecionado' : ''}`}
            style={estiloPos(no.pos)}
            onPointerDown={(e) => iniciarMover(e, caminhoNo, no)}
            onClick={(e) => {
              e.stopPropagation();
              onSelecionar(caminhoNo);
            }}
          >
            <ConteudoNo no={no} caminho={caminhoNo} definicao={definicao} valores={valores} renderGrade={renderGrade} />
            <span className="alca" onPointerDown={(e) => iniciarRedimensionar(e, caminhoNo, no)} title="Redimensionar" />
          </div>
        );
      })}
      {mostrarAlvo && <div className="alvo-encaixe" style={estiloPos(alvo.pos)} />}
    </div>
  );
}

function ConteudoNo({
  no,
  caminho,
  definicao,
  valores,
  renderGrade,
}: {
  no: NoLayout;
  caminho: Caminho;
  definicao: TemplateDef;
  valores: Valores;
  renderGrade: PropsGrade['renderGrade'];
}) {
  switch (no.tipo) {
    case 'campo':
      return (
        <CampoCelula
          campo={no.campo}
          valor={valores[no.campo.id] ?? valorPadraoCampo(no.campo)}
          somenteLeitura
          onChange={() => undefined}
          calcular={() => avaliarCalculado(definicao, valores, no.campo)}
        />
      );
    case 'texto':
      return no.estilo === 'titulo' ? <h3 className="texto-titulo">{no.texto}</h3> : <p className="texto-nota">{no.texto}</p>;
    case 'acao': {
      const acao = acharAcao(definicao, no.acaoId);
      return <span className="acao acao-previa">⚄ {acao?.rotulo ?? 'ação removida'}</span>;
    }
    case 'painel':
      return (
        <section className="painel-ficha">
          <header className="painel-cabecalho">{no.titulo || 'Seção'}</header>
          <div className="painel-corpo">{renderGrade(no.filhos, caminho, no.colunas)}</div>
        </section>
      );
    case 'lista':
      return (
        <section className="lista-edicao">
          <header className="painel-cabecalho">
            {no.lista.rotulo}
            <span className="tag">{no.lista.formato}</span>
            <span className="meta">desenho de um item</span>
          </header>
          <div className="painel-corpo">{renderGrade(no.lista.item, caminho, no.lista.colunas)}</div>
        </section>
      );
  }
}

/** Reexportado para o painel de propriedades montar campos novos com os mesmos padrões. */
export { criarCampo, type TipoCampo };

/** Usado pelo editor ao mudar o número de colunas de uma grade. */
export function ajustarColunas(def: TemplateDef, caminho: Caminho, colunas: number): TemplateDef {
  const atualizado = atualizarNo(def, caminho, (no) =>
    no.tipo === 'painel' ? { ...no, colunas } : no.tipo === 'lista' ? { ...no, lista: { ...no.lista, colunas } } : no,
  );
  const no = obterNo(atualizado.layout, caminho);
  return no ? acomodarGrade(atualizado, caminho, -1) : atualizado;
}
