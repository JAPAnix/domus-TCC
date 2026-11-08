import { useFeatures } from '../hooks/useFeatures';
import { Button } from './ui';

/** "Não encontrou o que precisa?": leva ao passo a passo do pedido aberto. Some se o recurso estiver desligado. */
export default function PublishRequestCta({ className = '' }) {
  const { openRequests } = useFeatures();
  if (!openRequests) return null;
  return (
    <aside aria-label="Publicar um pedido" className={`flex flex-col items-start justify-between gap-3 rounded-card border border-primary-line bg-primary-softer p-5 sm:flex-row sm:items-center ${className}`}>
      <div>
        <p className="font-semibold">Não encontrou o que precisa?</p>
        <p className="mt-1 text-sm text-ink-soft">Publique um pedido e receba propostas dos profissionais, com valor e prazo.</p>
      </div>
      <Button to="/servicos/novo" className="shrink-0">Publicar um pedido</Button>
    </aside>
  );
}
