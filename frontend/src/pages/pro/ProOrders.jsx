import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiResource } from '../../hooks/useApiResource';
import { apiError } from '../../services/api';
import { formatDay, formatMoney } from '../../utils/format';
import { proposalStatus } from '../../utils/status';
import OrderCard from '../../components/OrderCard';
import Pagination from '../../components/Pagination';
import StatusBadge from '../../components/StatusBadge';
import { Button, EmptyState, ErrorState, SkeletonList, Tabs } from '../../components/ui';
import AvailabilityCalendar from './AvailabilityCalendar';

const FILTERS = [['new', 'Novos'], ['proposed', 'Propostas enviadas'], ['accepted', 'Aceitos'], ['in_progress', 'Em andamento'], ['done', 'Concluídos'], ['closed', 'Recusados e expirados']];
const EMPTY = {
  new: ['Nenhum pedido novo', 'Quando um cliente pedir um dos seus serviços, ele aparece aqui e você é avisado. Responda em até 72 horas.', 'Dica: anúncios com fotos, descrição completa e agenda aberta recebem mais pedidos.'],
  proposed: ['Nenhuma proposta aguardando resposta', 'Em pedidos sob consulta, você envia o valor e o prazo e o cliente decide.', 'Dica: responda rápido e detalhe o que está incluso para se destacar.'],
  accepted: ['Nenhum serviço aceito', 'Pedidos aceitos esperando o início aparecem aqui.', 'Dica: combine os detalhes pela conversa antes da data.'],
  in_progress: ['Nenhum serviço em andamento', 'Os serviços que você iniciou aparecem aqui até serem concluídos.', null],
  done: ['Nenhum serviço concluído ainda', 'Quando você concluir um serviço, ele fica guardado aqui junto com a avaliação.', null],
  closed: ['Nada recusado ou expirado', 'Pedidos que você recusou, que foram cancelados ou que venceram sem resposta ficam aqui.', null],
};

function Orders() {
  const [status, setStatus] = useState('new');
  const [page, setPage] = useState(1);
  const resource = useApiResource('/pro/orders', { page, limit: 10, status }, { keepPrevious: true });
  const counts = useApiResource('/orders/counts', { side: 'professional' }, { keepPrevious: true });
  const orders = resource.data?.data;
  const empty = EMPTY[status];
  const tabs = FILTERS.map(([value, label]) => ({ value, label, count: counts.data ? counts.data[value] : undefined, alert: value === 'new' }));
  const refresh = () => { resource.retry(); counts.retry(); };
  return (
    <section aria-labelledby="pedidos">
      <h2 id="pedidos" className="mb-3 text-xl font-semibold">Pedidos recebidos</h2>
      <Tabs tabs={tabs} value={status} onChange={(value) => { setStatus(value); setPage(1); }} label="Filtrar pedidos" />
      <div role="tabpanel" id={`panel-${status}`} aria-labelledby={`tab-${status}`}>
        {!orders && resource.loading ? <SkeletonList count={3} label="Carregando pedidos" itemClassName="h-40" />
          : resource.error ? <ErrorState title="Não foi possível carregar os pedidos" message={apiError(resource.error)} onRetry={resource.retry} />
            : !orders.length ? <EmptyState icon="list" title={empty[0]} description={<>{empty[1]}{empty[2] && <span className="mt-2 block text-ink-muted">{empty[2]}</span>}</>} action={status === 'new' ? <Button variant="secondary" to="/pro/servicos">Melhorar meus anúncios</Button> : undefined} />
              : (
                <>
                  <div className="space-y-4">{orders.map((order) => <OrderCard key={order.uuid} order={order} perspective="professional" onChanged={refresh} />)}</div>
                  <Pagination page={page} pages={resource.data.meta.pages} onChange={setPage} label="Páginas de pedidos" />
                </>
              )}
      </div>
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
