import { Button } from './ui';

export default function Pagination({ page, pages, onChange, label = 'Paginação' }) {
  if (!pages || pages <= 1) return null;
  return (
    <nav aria-label={label} className="mt-8 flex flex-wrap items-center justify-center gap-4">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</Button>
      <span className="text-sm text-ink-muted">Página {page} de {pages}</span>
      <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Próxima</Button>
    </nav>
  );
}
