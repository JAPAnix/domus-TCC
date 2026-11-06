export default function Skeleton({ className = 'h-4 w-full' }) {
  return <div aria-hidden="true" className={`animate-shimmer rounded-control bg-surface-muted ${className}`} />;
}

/** Bloco com anúncio para leitor de tela enquanto o conteúdo carrega. */
export function SkeletonList({ count = 3, label = 'Carregando...', itemClassName = 'h-28', className = 'space-y-4' }) {
  return (
    <div role="status" aria-label={label} className={className}>
      {Array.from({ length: count }, (_, index) => <Skeleton key={index} className={`w-full rounded-card ${itemClassName}`} />)}
    </div>
  );
}
