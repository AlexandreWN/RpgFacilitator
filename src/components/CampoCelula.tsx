import type { CampoDef, Item, Valor } from '../shared/types';

interface Props {
  campo: CampoDef;
  valor: Valor | Item[] | undefined;
  onChange: (v: Valor) => void;
  calcular: () => string;
  somenteLeitura?: boolean;
  /** Em tabelas o rótulo já está no cabeçalho da coluna. */
  semRotulo?: boolean;
}

export function CampoCelula({ campo, valor, onChange, calcular, somenteLeitura, semRotulo }: Props) {
  const rotulo = semRotulo ? null : (
    <span className="rotulo-mono" title={`id: ${campo.id}`}>
      {campo.rotulo || campo.id}
    </span>
  );
  const texto = typeof valor === 'string' || typeof valor === 'number' ? String(valor) : '';

  if (campo.tipo === 'calculado') {
    return (
      <div className="celula">
        {rotulo}
        <output className="valor-calculado">{calcular()}</output>
        {!semRotulo && <span className="nota mono">{campo.formula || 'sem fórmula'}</span>}
      </div>
    );
  }

  if (campo.tipo === 'marcador') {
    return (
      <label className="celula celula-marcador">
        <input
          type="checkbox"
          checked={valor === true}
          disabled={somenteLeitura}
          onChange={(e) => onChange(e.target.checked)}
        />
        {rotulo}
      </label>
    );
  }

  if (campo.tipo === 'numero') {
    return (
      <label className="celula">
        {rotulo}
        <input
          type="number"
          value={texto}
          disabled={somenteLeitura}
          onChange={(e) => {
            const bruto = e.target.value;
            const n = Number(bruto);
            onChange(bruto.trim() !== '' && Number.isFinite(n) ? n : bruto);
          }}
        />
      </label>
    );
  }

  return (
    <label className="celula">
      {rotulo}
      <input
        className={campo.tipo === 'dados' ? 'mono' : undefined}
        placeholder={campo.tipo === 'dados' ? '1d6+2' : '—'}
        value={texto}
        disabled={somenteLeitura}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
