import * as Blockly from 'blockly';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, mensagemErro } from '../api';
import { compilarAcao, limparIds } from '../blocks/compiler';
import { definirAoSalvarBloco, definirCamposDisponiveis, registrarBlocos, temaEscuro } from '../blocks/definitions';
import { criarToolbox } from '../blocks/toolbox';
import { RollLog, criarRegistro, type RegistroLog } from '../components/RollLog';
import { SheetRenderer } from '../components/SheetRenderer';
import { LayoutEditor } from '../layout/LayoutEditor';
import { Propriedades } from '../layout/Propriedades';
import { listaPorId, novaAcao, removerAcao, templateVazio, type Caminho } from '../layout/modelo';
import { idUnico, slugify } from '../shared/ids';
import { camposDaLista, camposDoPersonagem, completarValores, executarAcao, listasDoTemplate, type ContextoItem } from '../shared/interpreter';
import type { AcaoDef, BlocoArquivo, TemplateArquivo, TemplateDef, Valores } from '../shared/types';

export default function TemplateEditor() {
  const { id = '' } = useParams();
  const areaRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const carregandoRef = useRef(false);
  const blocosRef = useRef<BlocoArquivo[]>([]);
  const salvoRef = useRef('');

  const [template, setTemplate] = useState<TemplateArquivo | null>(null);
  const [def, setDef] = useState<TemplateDef>(templateVazio());
  const [nome, setNome] = useState('');
  const [aba, setAba] = useState<'layout' | 'funcoes'>('layout');
  const [selecionado, setSelecionado] = useState<Caminho | null>(null);
  const [acaoAtual, setAcaoAtual] = useState<string | null>(null);
  const [blocos, setBlocos] = useState<BlocoArquivo[]>([]);
  const [wsPronto, setWsPronto] = useState(0);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [valoresPreview, setValoresPreview] = useState<Valores>({});
  const [log, setLog] = useState<RegistroLog[]>([]);
  const [status, setStatus] = useState('');
  const [erro, setErro] = useState('');

  const defRef = useRef(def);
  defRef.current = def;
  const acaoAtualRef = useRef(acaoAtual);
  acaoAtualRef.current = acaoAtual;
  blocosRef.current = blocos;

  const modificado = JSON.stringify({ nome, def }) !== salvoRef.current;

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const [t, b] = await Promise.all([api.ler<TemplateArquivo>('templates', id), api.listarCompleto<BlocoArquivo>('blocos')]);
        if (!ativo) return;
        const definicao = t.definicao ?? templateVazio();
        setTemplate(t);
        setNome(t.nome);
        setDef(definicao);
        setBlocos(b);
        setAcaoAtual(definicao.acoes[0]?.id ?? null);
        salvoRef.current = JSON.stringify({ nome: t.nome, def: definicao });
      } catch (e) {
        if (ativo) setErro(mensagemErro(e));
      }
    })();
    return () => {
      ativo = false;
    };
  }, [id]);

  // ── Blockly: existe só enquanto a aba "Funções" está aberta ──
  useEffect(() => {
    if (aba !== 'funcoes') return;
    const area = areaRef.current;
    if (!area) return;
    let cancelado = false;
    let desmontar: (() => void) | undefined;

    document.fonts
      .load('500 11px "Space Grotesk"')
      .catch(() => undefined)
      .then(() => {
        if (cancelado || !areaRef.current) return;
        registrarBlocos();
        const ws = Blockly.inject(areaRef.current, {
          toolbox: criarToolbox(blocosRef.current),
          theme: temaEscuro(),
          grid: { spacing: 24, length: 2, colour: '#262a31', snap: true },
          zoom: { controls: true, wheel: true, startScale: 0.85 },
          trashcan: true,
          move: { scrollbars: true, drag: true, wheel: false },
        });
        wsRef.current = ws;
        ws.addChangeListener((e: Blockly.Events.Abstract) => {
          if (e.isUiEvent || carregandoRef.current) return;
          sincronizarAcao();
        });
        const observador = new ResizeObserver(() => Blockly.svgResize(ws));
        observador.observe(areaRef.current);
        setWsPronto((n) => n + 1);

        desmontar = () => {
          observador.disconnect();
          ws.dispose();
          wsRef.current = null;
        };
      });

    return () => {
      cancelado = true;
      desmontar?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba]);

  useEffect(() => {
    wsRef.current?.updateToolbox(criarToolbox(blocos));
  }, [blocos]);

  /** Lê o workspace, compila e guarda na ação selecionada. */
  const sincronizarAcao = useCallback(() => {
    const ws = wsRef.current;
    const acaoId = acaoAtualRef.current;
    if (!ws || !acaoId) return;
    const atual = defRef.current;
    const acao = atual.acoes.find((a) => a.id === acaoId);
    if (!acao) return;
    const estado = Blockly.serialization.workspaces.save(ws);
    const lista = acao.escopo ? listaPorId(atual, acao.escopo) : undefined;
    const r = compilarAcao(estado, {
      campos: camposDoPersonagem(atual),
      camposItem: lista ? camposDaLista(lista) : [],
    });
    setAvisos(r.avisos);
    setDef({ ...atual, acoes: atual.acoes.map((a) => (a.id === acaoId ? { ...a, workspace: estado, corpo: r.corpo } : a)) });
  }, []);

  // Carrega no workspace a ação escolhida (e os campos que os menus dos blocos oferecem).
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || aba !== 'funcoes') return;
    const acao = def.acoes.find((a) => a.id === acaoAtual);
    const lista = acao?.escopo ? listaPorId(def, acao.escopo) : undefined;
    definirCamposDisponiveis(camposDoPersonagem(def), lista ? camposDaLista(lista) : []);
    carregandoRef.current = true;
    ws.clear();
    if (acao?.workspace) {
      try {
        Blockly.serialization.workspaces.load(acao.workspace as object, ws);
      } catch (e) {
        setErro(`Não foi possível carregar os blocos da ação: ${mensagemErro(e)}`);
      }
    }
    carregandoRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acaoAtual, aba, wsPronto]);

  // Menu de contexto "Salvar como bloco personalizado…"
  useEffect(() => {
    definirAoSalvarBloco(async (bloco) => {
      const nomeBloco = window.prompt('Nome do bloco personalizado:', '')?.trim();
      if (!nomeBloco) return;
      const incluirAbaixo = !!bloco.getNextBlock() && window.confirm('Incluir também os blocos empilhados abaixo dele?');
      const estado = limparIds(
        Blockly.serialization.blocks.save(bloco, { addCoordinates: false, addNextBlocks: incluirAbaixo, saveIds: false }),
      ) as Record<string, unknown> | null;
      if (!estado) return;
      const idBloco = idUnico(slugify(nomeBloco), blocosRef.current.map((b) => b.id));
      const arquivo: BlocoArquivo = { formato: 'rpg-bloco', versao: 1, id: idBloco, nome: nomeBloco, bloco: estado };
      try {
        await api.salvar('blocos', idBloco, arquivo);
        setBlocos((atual) => [...atual, arquivo]);
        setStatus(`Bloco “${nomeBloco}” salvo em Meus blocos`);
      } catch (e) {
        setErro(mensagemErro(e));
      }
    });
    return () => definirAoSalvarBloco(null);
  }, []);

  const salvar = useCallback(async () => {
    if (!template) return;
    const nomeFinal = nome.trim() || template.nome;
    const atual = defRef.current;
    const arquivo: TemplateArquivo = { formato: 'rpg-template', versao: 2, id: template.id, nome: nomeFinal, definicao: atual };
    setStatus('Salvando…');
    try {
      await api.salvar('templates', template.id, arquivo);
      salvoRef.current = JSON.stringify({ nome: nomeFinal, def: atual });
      setNome(nomeFinal);
      setStatus('Salvo');
    } catch (e) {
      setStatus('');
      setErro(`Erro ao salvar: ${mensagemErro(e)}`);
    }
  }, [template, nome]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        salvar();
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [salvar]);

  useEffect(() => {
    if (!modificado) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [modificado]);

  const valores = useMemo(() => completarValores(def, valoresPreview), [def, valoresPreview]);

  const executar = (acao: AcaoDef, ctx: ContextoItem) => {
    const resultado = executarAcao(def, acao, valores, ctx);
    setLog((atual) => [criarRegistro(acao, ctx, valores, resultado), ...atual].slice(0, 100));
    if (!resultado.erro) setValoresPreview(resultado.valores);
  };

  const irParaBlocos = (acaoId: string) => {
    setAcaoAtual(acaoId);
    setAba('funcoes');
  };

  const criarAcao = (escopo?: string) => {
    const { def: novoDef, acao } = novaAcao(def, escopo);
    setDef(novoDef);
    setAcaoAtual(acao.id);
  };

  const excluirAcao = (acaoId: string) => {
    if (!window.confirm('Excluir esta ação? Os botões dela saem da ficha.')) return;
    const novoDef = removerAcao(def, acaoId);
    setDef(novoDef);
    if (acaoAtual === acaoId) setAcaoAtual(novoDef.acoes[0]?.id ?? null);
  };

  const listas = listasDoTemplate(def);
  const acaoSelecionada = def.acoes.find((a) => a.id === acaoAtual);

  return (
    <div className="editor">
      <header className="barra">
        <Link to="/" className="voltar">
          ← Início
        </Link>
        <input className="nome-arquivo" value={nome} onChange={(e) => setNome(e.target.value)} disabled={!template} />
        <div className="abas">
          <button className={`aba ${aba === 'layout' ? 'ativa' : ''}`} onClick={() => setAba('layout')}>
            1 · Layout
          </button>
          <button className={`aba ${aba === 'funcoes' ? 'ativa' : ''}`} onClick={() => setAba('funcoes')}>
            2 · Funções
          </button>
        </div>
        <span className="espaco" />
        <span className="status">{status}</span>
        <button className="primario" onClick={salvar} disabled={!template} title="Ctrl+S">
          Salvar{modificado ? ' •' : ''}
        </button>
      </header>

      {erro && (
        <p className="erro" onClick={() => setErro('')}>
          {erro}
        </p>
      )}

      {aba === 'layout' ? (
        <div className="editor-corpo">
          <LayoutEditor definicao={def} valores={valores} onChange={setDef} selecionado={selecionado} onSelecionar={setSelecionado} />
          <aside className="painel-lateral">
            <Propriedades
              definicao={def}
              caminho={selecionado}
              onChange={setDef}
              onSelecionar={setSelecionado}
              onEditarBlocos={irParaBlocos}
            />
          </aside>
        </div>
      ) : (
        <div className="editor-corpo">
          <aside className="lista-acoes">
            <div className="bloco-titulo">
              <h2>Ações</h2>
              <button className="discreto mono" onClick={() => criarAcao()}>
                + global
              </button>
            </div>
            {def.acoes.length === 0 && <p className="vazio">Nenhuma ação ainda.</p>}
            <ul className="acoes-lista">
              {def.acoes.map((a) => (
                <li key={a.id} className={a.id === acaoAtual ? 'ativa' : ''}>
                  <button className="acao-item" onClick={() => setAcaoAtual(a.id)}>
                    <strong>{a.rotulo}</strong>
                    <span className="meta">{a.escopo ? `item de ${a.escopo}` : 'ficha'}</span>
                  </button>
                  <button className="discreto" onClick={() => excluirAcao(a.id)} title="Excluir ação">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            {listas.map((l) => (
              <button key={l.id} className="mono" onClick={() => criarAcao(l.id)}>
                + ação em {l.rotulo}
              </button>
            ))}
            {acaoSelecionada && (
              <label className="prop">
                <span className="rotulo-mono">Nome da ação</span>
                <input
                  value={acaoSelecionada.rotulo}
                  onChange={(e) =>
                    setDef({
                      ...def,
                      acoes: def.acoes.map((a) => (a.id === acaoSelecionada.id ? { ...a, rotulo: e.target.value } : a)),
                    })
                  }
                />
              </label>
            )}
          </aside>

          <div className="blockly-area" ref={areaRef} />

          <aside className="painel-lateral">
            {avisos.length > 0 && (
              <ul className="avisos">
                {avisos.map((a) => (
                  <li key={a}>⚠ {a}</li>
                ))}
              </ul>
            )}
            <div className="bloco-titulo">
              <h2>Teste a ficha</h2>
              <span className="meta">valores de teste</span>
            </div>
            <SheetRenderer definicao={def} valores={valores} onChange={setValoresPreview} onAcao={executar} />
            <RollLog registros={log} onLimpar={() => setLog([])} />
          </aside>
        </div>
      )}
    </div>
  );
}
