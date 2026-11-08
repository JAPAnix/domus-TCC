import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiResource } from '../../hooks/useApiResource';
import { useFeatures } from '../../hooks/useFeatures';
import api, { apiError } from '../../services/api';
import { formatBudget } from '../../utils/format';
import { timeLeftLabel } from '../../utils/orderText';
import { serviceStatus } from '../../utils/status';
import StatusBadge from '../../components/StatusBadge';
import RequestOwnerActions from '../../components/RequestOwnerActions';
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, SkeletonList, Tabs, useToast } from '../../components/ui';

// Cada aba é um recorte da mesma lista: o que ainda espera propostas, o que já recebeu, o que está em andamento e o que acabou.
const GROUPS = {
  abertos: { label: 'Abertos', test: (s) => ['draft', 'open'].includes(s.status) && !s.pendingProposals },
  propostas: { label: 'Com propostas', test: (s) => s.status === 'open' && s.pendingProposals > 0 },
  andamento: { label: 'Em andamento', test: (s) => s.status === 'in_progress' },
  encerrados: { label: 'Encerrados', test: (s) => ['completed', 'cancelled', 'expired', 'removed'].includes(s.status) },
};
const EMPTY = {
  abertos: ['Nenhum pedido aguardando propostas', 'Publique um pedido: descreva o que precisa e os profissionais respondem com valor e prazo.'],
  propostas: ['Nenhuma proposta para decidir', 'Quando um profissional responder a um pedido seu, ele aparece aqui para você comparar.'],
  andamento: ['Nenhum pedido em andamento', 'Depois de aceitar uma proposta e pagar, o serviço aparece aqui.'],
  encerrados: ['Nenhum pedido encerrado', 'Pedidos concluídos, cancelados ou vencidos ficam guardados aqui.'],
};

function RequestRow({ service, busy, onDelete, onChanged }) {
  const proposals = service._count?.proposals ?? 0;
  const pending = service.pendingProposals ?? 0;
  return (
    <Card as="article" padded={false} className="flex flex-col overflow-hidden sm:flex-row">
      {service.images?.[0] && <img src={service.images[0]} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover sm:aspect-auto sm:w-40" />}
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={service.status} map={serviceStatus} />
          {pending > 0 && <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-white">{pending} {pending === 1 ? 'proposta nova' : 'propostas novas'}</span>}
          <span className="text-xs text-ink-muted">{service.category?.name ?? 'Sem categoria'}</span>
        </div>
        <div>
          <Link to={`/servicos/${service.uuid}`} className="font-semibold hover:text-primary-strong">{service.title}</Link>
          <p className="mt-1 text-sm text-ink-muted">{service.budgetMin == null && service.budgetMax == null ? 'Orçamento a combinar' : formatBudget(service.budgetMin, service.budgetMax)} · {proposals} {proposals === 1 ? 'proposta recebida' : 'propostas recebidas'} (limite de {service.maxProposals})</p>
          {service.status === 'open' && service.expiresAt && <p className="mt-1 text-xs text-ink-muted">Recebe propostas por mais {timeLeftLabel(service.expiresAt)}.</p>}
          {service.status === 'expired' && <p className="mt-1 text-xs text-ink-muted">Venceu. Reabra para voltar a receber propostas.</p>}
          {service.status === 'removed' && <p className="mt-1 text-xs text-danger">Removido pela moderação por não seguir as regras da comunidade.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {service.status === 'open' && <Button size="sm" to={`/servicos/${service.uuid}/propostas`}>{pending ? 'Comparar propostas' : 'Ver propostas'}</Button>}
          {['in_progress', 'completed'].includes(service.status) && <Button size="sm" to={`/servicos/${service.uuid}`}>{service.status === 'completed' ? 'Avaliar serviço' : 'Acompanhar'}</Button>}
          <RequestOwnerActions service={service} onChanged={onChanged} />
          {!['in_progress', 'open'].includes(service.status) && <Button size="sm" variant="dangerOutline" disabled={busy} onClick={() => onDelete(service)}>Excluir</Button>}
        </div>
      </div>
    </Card>
  );
}

/** "Meus pedidos abertos": o que o cliente publicou, separado em abas, com as propostas recebidas. */
export default function OpenRequests() {
  const toast = useToast();
  const { openRequests } = useFeatures();
  const [group, setGroup] = useState('abertos');
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const resource = useApiResource('/services/mine', { page: 1, limit: 48 }, { keepPrevious: true });
  const services = resource.data?.data;
  const groups = Object.entries(GROUPS);

  async function confirmDelete() {
    setBusy(true);
    try {
      await api.delete(`/services/${pending.uuid}`);
      toast.success('Pedido excluído.');
      setPending(null);
      resource.retry();
    } catch (err) {
      toast.error(apiError(err));
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  const tabs = groups.map(([value, config]) => ({ value, label: config.label, count: services ? services.filter(config.test).length : undefined, alert: value === 'propostas' }));
  const visible = services?.filter(GROUPS[group].test) ?? [];
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-muted"><strong className="text-ink">Pedido aberto:</strong> você descreve o que precisa e profissionais enviam propostas de preço e prazo. Para contratar um serviço específico, use as <Link to="/meus-servicos" className="font-semibold text-primary-strong underline underline-offset-2">contratações por anúncio</Link>.</p>
        {openRequests && <Button to="/servicos/novo">Publicar um pedido</Button>}
      </div>
      <Tabs label="Meus pedidos abertos" value={group} onChange={setGroup} tabs={tabs} />
      <div role="tabpanel" id={`panel-${group}`} aria-labelledby={`tab-${group}`}>
        {!services && resource.loading ? <SkeletonList count={3} label="Carregando seus pedidos" />
          : resource.error ? <ErrorState title="Não foi possível carregar seus pedidos" message={apiError(resource.error)} onRetry={resource.retry} />
            : !visible.length ? <EmptyState icon="list" title={EMPTY[group][0]} description={EMPTY[group][1]} action={openRequests && group === 'abertos' ? <Button to="/servicos/novo">Publicar um pedido</Button> : undefined} />
              : <div className="space-y-4">{visible.map((service) => <RequestRow key={service.uuid} service={service} busy={busy} onDelete={setPending} onChanged={resource.retry} />)}</div>}
      </div>
      <ConfirmDialog open={!!pending} danger busy={busy} title="Excluir pedido" confirmLabel="Excluir" cancelLabel="Voltar" message={`O pedido "${pending?.title}" será removido da sua lista. Essa ação não pode ser desfeita.`} onConfirm={confirmDelete} onCancel={() => setPending(null)} />
    </>
  );
}
