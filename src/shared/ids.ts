export function slugify(texto: string): string {
  const slug = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'sem-nome';
}

export function idUnico(base: string, existentes: Iterable<string>): string {
  const usados = new Set(existentes);
  if (!usados.has(base)) return base;
  let i = 2;
  while (usados.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
