import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, mensagemErro, type Colecao } from '../api';
import { templateVazio } from '../layout/modelo';
import { idUnico, slugify } from '../shared/ids';
import type { PersonagemArquivo, ResumoArquivo, TemplateArquivo } from '../shared/types';
import { CORES_TIPO, estiloCor, indice } from '../ui/cores';

export default function Home() {
  const navegar = useNavigate();
  const [templates, setTemplates] = useState<ResumoArquivo[]>([]);
  const [personagens, setPersonagens] = useState<ResumoArquivo[]>([]);
  const [blocos, setBlocos] = useState<ResumoArquivo[]>([]);
  const [erro, setErro] = useState('');
  const [nomeTemplate, setNomeTemplate] = useState('');
  const [nomePersonagem, setNomePersonagem] = useState('');
  const [templateEscolhido, setTemplateEscolhido] = useState('');

  const carregar = useCallback(async () => {
    try {
      const [t, p, b] = await Promise.all([api.listar('templates'), api.listar('personagens'), api.listar('blocos')]);
      setTemplates(t);
      setPersonagens(p);
      setBlocos(b);
      setTemplateEscolhido((atual) => (t.some((x) => x.id === atual) ? atual : (t[0]?.id ?? '')));
    } catch (e) {
      setErro(`Não foi possível falar com o servidor: ${mensagemErro(e)}`);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criarTemplate(e: FormEvent) {
    e.preventDefault();
    const nome = nomeTemplate.trim();
    if (!nome) return;
    const id = idUnico(slugify(nome), templates.map((t) => t.id));
    const arquivo: TemplateArquivo = { formato: 'rpg-template', versao: 2, id, nome, definicao: templateVazio() };
    try {
      await api.salvar('templates', id, arquivo);
      navegar(`/templates/${id}`);
    } catch (err) {
      setErro(mensagemErro(err));
    }
  }

  async function criarPersonagem(e: FormEvent) {
    e.preventDefault();
    const nome = nomePersonagem.trim();
    if (!nome || !templateEscolhido) return;
    const id = idUnico(slugify(nome), personagens.map((p) => p.id));
    const arquivo: PersonagemArquivo = { formato: 'rpg-personagem', versao: 1, id, nome, template: templateEscolhido, valores: {} };
    try {
      await api.salvar('personagens', id, arquivo);
      navegar(`/personagens/${id}`);
    } catch (err) {
      setErro(mensagemErro(err));
    }
  }

  async function excluir(colecao: Colecao, item: ResumoArquivo) {
    if (!window.confirm(`Excluir "${item.nome}"? O arquivo ${colecao}/${item.id}.txt será apagado.`)) return;
    try {
      await api.excluir(colecao, item.id);
      await carregar();
    } catch (err) {
      setErro(mensagemErro(err));
    }
  }

  const indiceTemplate = (id?: string) => templates.findIndex((t) => t.id === id);
  const personagensDo = (id: string) => personagens.filter((p) => p.template === id).length;

  return (
    <div className="pagina">
      <header className="hero">
        <p className="eyebrow">RPG Facilitator · fichas montadas com blocos</p>
        <h1>Mesa de fichas</h1>
        <p className="lead">
          Monte o template arrastando blocos, crie personagens a partir dele e role os dados direto da ficha. Tudo fica em
          arquivos .txt na pasta <code>data/</code>.
        </p>
        <dl className="stats">
          <div>
            <dt>Templates</dt>
            <dd>{templates.length}</dd>
          </div>
          <div>
            <dt>Personagens</dt>
            <dd>{personagens.length}</dd>
          </div>
          <div>
            <dt>Blocos personalizados</dt>
            <dd>{blocos.length}</dd>
          </div>
        </dl>
      </header>

      {erro && (
        <p className="erro" onClick={() => setErro('')}>
          {erro}
        </p>
      )}

      <section className="bloco">
        <div className="bloco-titulo">
          <h2>Templates de ficha</h2>
          <span className="meta">data/templates</span>
        </div>
        <div className="grade grade-4">
          {templates.map((t, i) => (
            <article key={t.id} className="cartao-borda" style={estiloCor(i)}>
              <div className="cartao-topo">
                <span className="indice-mono">{indice(i)}</span>
                <button className="discreto" onClick={() => excluir('templates', t)} title="Excluir template">
                  ✕
                </button>
              </div>
              <Link to={`/templates/${t.id}`} className="cartao-nome">
                {t.nome}
              </Link>
              <p className="cartao-sub">
                {personagensDo(t.id)} personagem(ns) · <span className="mono">{t.id}.txt</span>
              </p>
              {t.erro && <span className="aviso-inline">{t.erro}</span>}
            </article>
          ))}
          <form className="cartao-borda cartao-novo" onSubmit={criarTemplate}>
            <span className="indice-mono">novo</span>
            <input placeholder="Nome do template" value={nomeTemplate} onChange={(e) => setNomeTemplate(e.target.value)} />
            <button className="primario" disabled={!nomeTemplate.trim()}>
              Criar template
            </button>
          </form>
        </div>
      </section>

      <section className="bloco">
        <div className="bloco-titulo">
          <h2>Personagens</h2>
          <span className="meta">um arquivo por personagem</span>
        </div>
        <div className="grade grade-3">
          {personagens.map((p, i) => {
            const it = indiceTemplate(p.template);
            return (
              <article key={p.id} className="cartao">
                <header className="cartao-cabecalho">
                  <span className="badge-num" style={estiloCor(i)}>
                    {indice(i)}
                  </span>
                  <div className="corpo">
                    <Link to={`/personagens/${p.id}`} className="cartao-nome">
                      {p.nome}
                    </Link>
                    <span className="meta">data/personagens/{p.id}.txt</span>
                    <div>
                      {it >= 0 ? (
                        <span className="tag" style={estiloCor(it)}>
                          {templates[it].nome}
                        </span>
                      ) : (
                        <span className="tag" style={{ '--cor': 'var(--erro)' } as React.CSSProperties}>
                          template “{p.template}” não encontrado
                        </span>
                      )}
                    </div>
                  </div>
                  <button className="discreto" onClick={() => excluir('personagens', p)} title="Excluir personagem">
                    ✕
                  </button>
                </header>
              </article>
            );
          })}
          <form className="cartao form-cartao" onSubmit={criarPersonagem}>
            <span className="rotulo-mono">Novo personagem</span>
            <input placeholder="Nome do personagem" value={nomePersonagem} onChange={(e) => setNomePersonagem(e.target.value)} />
            <select value={templateEscolhido} onChange={(e) => setTemplateEscolhido(e.target.value)} disabled={!templates.length}>
              {templates.length === 0 && <option>Crie um template primeiro</option>}
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
            <button className="primario" disabled={!nomePersonagem.trim() || !templateEscolhido}>
              Criar personagem
            </button>
          </form>
        </div>
      </section>

      <section className="bloco">
        <div className="bloco-titulo">
          <h2>Meus blocos</h2>
          <span className="meta">botão direito num bloco → salvar como bloco personalizado</span>
        </div>
        {blocos.length === 0 ? (
          <p className="vazio">Nenhum bloco personalizado ainda.</p>
        ) : (
          <div className="grade grade-4">
            {blocos.map((b, i) => (
              <article key={b.id} className="cartao-borda" style={{ '--cor': CORES_TIPO.fairy } as React.CSSProperties}>
                <div className="cartao-topo">
                  <span className="indice-mono">{indice(i)}</span>
                  <button className="discreto" onClick={() => excluir('blocos', b)} title="Excluir bloco">
                    ✕
                  </button>
                </div>
                <span className="cartao-nome">{b.nome}</span>
                <span className="meta">{b.id}.txt</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
