import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiResource } from '../../hooks/useApiResource';
import api, { apiError } from '../../services/api';
import { formatBudget } from '../../utils/format';
import { serviceStatus } from '../../utils/status';
import StatusBadge from '../../components/StatusBadge';
import Pagination from '../../components/Pagination';
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, SkeletonList, useToast } from '../../components/ui';

const confirmations = {
  cancel: { title: 'Cancelar pedido', confirmLabel: 'Cancelar pedido', cancelLabel: 'Manter pedido', message: (title) => `O pedido "${title}" deixará de receber propostas, e as pendentes serão recusadas. Essa ação não pode ser desfeita.` },
  delete: { title: 'Excluir pedido', confirmLabel: 'Excluir', cancelLabel: 'Voltar', message: (title) => `O pedido "${title}" será removido da sua lista. Essa ação não pode ser desfeita.` },
};

function RequestRow({ service, busy, onAction }) {
  const proposals = service._count?.proposals ?? 0;
  return (
    <Card as="article" padded={false} className="flex flex-col overflow-hidden sm:flex-row">
      {service.images?.[0] && <img src={service.images[0]} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover sm:aspect-auto sm:w-40" />}
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2"><StatusBadge status={service.status} map={serviceStatus} /><span className="text-xs text-ink-muted">{service.category?.name ?? 'Sem categoria'}</span></div>
        <div>
          <Link to={`/servicos/${service.uuid}`} className="font-semibold hover:text-primary-strong">{service.title}</Link>
          <p className="mt-1 text-sm text-ink-muted">{formatBudget(service.budgetMin, service.budgetMax)} · {proposals} {proposals === 1 ? 'proposta' : 'propostas'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {service.status === 'open' && <Button size="sm" to={`/servicos/${service.uuid}/propostas`}>Ver propostas</Button>}
          {['in_progress', 'completed'].includes(service.status) && <Button size="sm" to={`/servicos/${service.uuid}`}>{service.status === 'completed' ? 'Avaliar serviço' : 'Acompanhar'}</Button>}
          {['open', 'in_progress', 'draft'].includes(service.status) && <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction('cancel', service)}>Cancelar</Button>}
          {service.status !== 'in_progress' && <Button size="sm" variant="dangerOutline" disabled={busy} onClick={() => onAction('delete', service)}>Excluir</Button>}
        </div>
      </div>
    </Card>
  );
}

/** Pedidos abertos que o cliente publicou, com as propostas recebidas. */
export default function OpenRequests() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const resource = useApiResource('/services/mine', { page, limit: 20 }, { keepPrevious: true });
  const services = resource.data?.data;

  async function confirmAction() {
    const { type, service } = pending;
    setBusy(true);
    try {
      if (type === 'cancel') await api.patch(`/services/${service.uuid}/status`, { status: 'cancelled' });
      else await api.delete(`/services/${service.uuid}`);
      toast.success(type === 'cancel' ? 'Pedido cancelado.' : 'Pedido excluído.');
      setPending(null);
      resource.retry();
    } catch (err) {
      toast.error(apiError(err));
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  const confirmation = pending && confirmations[pending.type];
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-muted">Pedidos abertos: você descreve o que precisa e profissionais enviam propostas de preço e prazo.</p>
        <Button to="/servicos/novo" variant="secondary">Publicar pedido</Button>
      </div>
      {!services && resource.loading ? <SkeletonList count={3} label="Carregando seus pedidos" />
        : resource.error ? <ErrorState title="Não foi possível carregar seus pedidos" message={apiError(resource.error)} onRetry={resource.retry} />
          : !services?.length ? <EmptyState icon="list" title="Você ainda não publicou nenhum pedido aberto" description="Não achou o profissional ideal? Descreva o que precisa e receba propostas." action={<Button to="/servicos/novo">Publicar pedido</Button>} />
            : (
              <>
                <div className="space-y-4">{services.map((service) => <RequestRow key={service.uuid} service={service} busy={busy} onAction={(type, item) => setPending({ type, service: item })} />)}</div>
                <Pagination page={page} pages={resource.data?.meta?.pages} onChange={setPage} label="Páginas de pedidos" />
              </>
            )}
      <ConfirmDialog open={!!pending} danger busy={busy} title={confirmation?.title} confirmLabel={confirmation?.confirmLabel} cancelLabel={confirmation?.cancelLabel} message={confirmation?.message(pending?.service.title)} onConfirm={confirmAction} onCancel={() => setPending(null)} />
    </>
  );
}
