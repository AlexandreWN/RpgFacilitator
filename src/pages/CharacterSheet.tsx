import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, mensagemErro } from '../api';
import { RollLog, criarRegistro, type RegistroLog } from '../components/RollLog';
import { SheetRenderer } from '../components/SheetRenderer';
import { completarValores, executarAcao, type ContextoItem } from '../shared/interpreter';
import type { AcaoDef, PersonagemArquivo, TemplateArquivo, Valores } from '../shared/types';

export default function CharacterSheet() {
  const { id = '' } = useParams();
  const [personagem, setPersonagem] = useState<PersonagemArquivo | null>(null);
  const [template, setTemplate] = useState<TemplateArquivo | null>(null);
  const [nome, setNome] = useState('');
  const [valores, setValores] = useState<Valores>({});
  const [status, setStatus] = useState('');
  const [erro, setErro] = useState('');
  const [log, setLog] = useState<RegistroLog[]>([]);
  const salvoRef = useRef<string | null>(null);

  useEffect(() => {
    let ativo = true;
    salvoRef.current = null;
    (async () => {
      try {
        const p = await api.ler<PersonagemArquivo>('personagens', id);
        if (!ativo) return;
        setPersonagem(p);
        setNome(p.nome);
        let t: TemplateArquivo;
        try {
          t = await api.ler<TemplateArquivo>('templates', p.template);
        } catch {
          throw new Error(`O template “${p.template}” deste personagem não foi encontrado em data/templates.`);
        }
        if (!ativo) return;
        const completos = completarValores(t.definicao, p.valores);
        setTemplate(t);
        setValores(completos);
        salvoRef.current = JSON.stringify({ nome: p.nome, valores: completos });
      } catch (e) {
        if (ativo) setErro(mensagemErro(e));
      }
    })();
    return () => {
      ativo = false;
    };
  }, [id]);

  const salvar = useCallback(async () => {
    if (!personagem || salvoRef.current === null) return;
    const nomeFinal = nome.trim() || personagem.nome;
    const instantaneo = JSON.stringify({ nome, valores });
    setStatus('Salvando…');
    try {
      await api.salvar('personagens', personagem.id, { ...personagem, nome: nomeFinal, valores });
      salvoRef.current = instantaneo;
      setStatus('Salvo');
    } catch (e) {
      setStatus(`Erro ao salvar: ${mensagemErro(e)}`);
    }
  }, [personagem, nome, valores]);

  // Salvamento automático alguns instantes depois da última alteração.
  useEffect(() => {
    if (salvoRef.current === null || JSON.stringify({ nome, valores }) === salvoRef.current) return;
    setStatus('Alterações não salvas');
    const timer = setTimeout(salvar, 700);
    return () => clearTimeout(timer);
  }, [nome, valores, salvar]);

  const executar = (acao: AcaoDef, ctx: ContextoItem) => {
    if (!template) return;
    const resultado = executarAcao(template.definicao, acao, valores, ctx);
    setLog((atual) => [criarRegistro(acao, ctx, valores, resultado), ...atual].slice(0, 200));
    if (!resultado.erro) setValores(resultado.valores);
  };

  return (
    <div className="pagina-ficha">
      <header className="barra">
        <Link to="/" className="voltar">
          ← Início
        </Link>
        <input className="nome-arquivo" value={nome} onChange={(e) => setNome(e.target.value)} disabled={!personagem} />
        {template && (
          <span className="meta">
            template: <Link to={`/templates/${template.id}`}>{template.nome}</Link> · data/personagens/{id}.txt
          </span>
        )}
        <span className="espaco" />
        <span className="status">{status}</span>
        <button className="primario" onClick={salvar} disabled={!template}>
          Salvar
        </button>
      </header>
      {erro && <p className="erro">{erro}</p>}
      <div className="ficha-corpo">
        <main className="ficha-principal">
          {template && <SheetRenderer definicao={template.definicao} valores={valores} onChange={setValores} onAcao={executar} />}
        </main>
        <aside className="painel-lateral">
          <RollLog registros={log} onLimpar={() => setLog([])} />
        </aside>
      </div>
    </div>
  );
}
