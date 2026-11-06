import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiResource } from '../../hooks/useApiResource';
import { apiError } from '../../services/api';
import { formatDay, formatMoney } from '../../utils/format';
import { proposalStatus } from '../../utils/status';
import OrderCard from '../../components/OrderCard';
import Pagination from '../../components/Pagination';
import StatusBadge from '../../components/StatusBadge';
import { Button, EmptyState, ErrorState, SkeletonList } from '../../components/ui';
import AvailabilityCalendar from './AvailabilityCalendar';

const FILTERS = [['new', 'Novos'], ['active', 'Aceitos e em andamento'], ['done', 'Concluídos'], ['closed', 'Recusados e cancelados'], ['', 'Todos']];
const EMPTY = {
  new: 'Nenhum pedido novo. Quando um cliente solicitar um dos seus serviços, ele aparece aqui.',
  active: 'Nenhum serviço aceito ou em andamento.',
  done: 'Nenhum serviço concluído ainda.',
  closed: 'Nenhum pedido recusado ou cancelado.',
  '': 'Você ainda não recebeu pedidos.',
};

function Orders() {
  const [status, setStatus] = useState('new');
  const [page, setPage] = useState(1);
  const resource = useApiResource('/pro/orders', { page, limit: 10, ...(status && { status }) }, { keepPrevious: true });
  const orders = resource.data?.data;
  return (
    <section aria-labelledby="pedidos">
      <h2 id="pedidos" className="mb-3 text-xl font-semibold">Pedidos recebidos</h2>
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filtrar pedidos">
        {FILTERS.map(([value, label]) => <button key={value} type="button" aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1); }} className={`min-h-control-sm rounded-full border px-4 text-sm font-medium ${status === value ? 'border-primary bg-primary-soft text-primary-strong' : 'border-line-strong bg-surface text-ink-soft hover:bg-surface-muted'}`}>{label}</button>)}
      </div>
      {!orders && resource.loading ? <SkeletonList count={3} label="Carregando pedidos" itemClassName="h-40" />
        : resource.error ? <ErrorState title="Não foi possível carregar os pedidos" message={apiError(resource.error)} onRetry={resource.retry} />
          : !orders.length ? <EmptyState icon="list" title="Nada por aqui" description={EMPTY[status]} action={status === 'new' || status === '' ? <Button variant="secondary" to="/pro/servicos">Ver meus serviços</Button> : undefined} />
            : (
              <>
                <div className="space-y-4">{orders.map((order) => <OrderCard key={order.uuid} order={order} perspective="professional" onChanged={resource.retry} />)}</div>
                <Pagination page={page} pages={resource.data.meta.pages} onChange={setPage} label="Páginas de pedidos" />
              </>
            )}
    </section>
  );
}

/** Propostas que o profissional enviou a pedidos abertos (o fluxo de "pedido aberto"). */
function ProposalsSent() {
  const [page, setPage] = useState(1);
  const resource = useApiResource('/professionals/dashboard', { view: 'proposals', page }, { keepPrevious: true });
  const proposals = resource.data?.data;
  return (
    <section aria-labelledby="propostas">
      <h2 id="propostas" className="mb-1 text-xl font-semibold">Propostas que enviei</h2>
      <p className="mb-4 text-sm text-ink-muted">Respostas a <Link to="/servicos" className="font-semibold text-primary-strong underline underline-offset-2">pedidos abertos</Link> de clientes.</p>
      {!proposals && resource.loading ? <SkeletonList count={2} label="Carregando propostas" itemClassName="h-24" />
        : resource.error ? <ErrorState title="Não foi possível carregar as propostas" message={apiError(resource.error)} onRetry={resource.retry} />
          : !proposals.length ? <EmptyState icon="list" title="Você ainda não enviou propostas" description="Veja os pedidos abertos e responda ao que combina com o seu trabalho." action={<Button variant="secondary" to="/servicos">Ver pedidos abertos</Button>} />
            : (
              <>
                <ul className="space-y-3">
                  {proposals.map((proposal) => (
                    <li key={proposal.uuid} className="rounded-card border border-line bg-surface p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div><Link to={`/servicos/${proposal.service.uuid}`} className="font-semibold hover:text-primary-strong">{proposal.service.title}</Link><p className="text-sm text-ink-muted">Cliente: {proposal.service.client.firstName} {proposal.service.client.lastName}</p></div>
                        <StatusBadge status={proposal.status} map={proposalStatus} />
                      </div>
                      <p className="mt-2 text-sm text-ink-soft">Valor proposto: {formatMoney(proposal.proposedPrice)}{proposal.deliveryTimeDays != null ? ` · prazo de ${proposal.deliveryTimeDays} dia(s)` : ''} · enviada em {formatDay(proposal.createdAt)}</p>
                    </li>
                  ))}
                </ul>
                <Pagination page={page} pages={resource.data.meta.pages} onChange={setPage} label="Páginas de propostas" />
              </>
            )}
    </section>
  );
}

export default function ProOrders() {
  return <div className="space-y-12"><Orders /><AvailabilityCalendar /><ProposalsSent /></div>;
}
