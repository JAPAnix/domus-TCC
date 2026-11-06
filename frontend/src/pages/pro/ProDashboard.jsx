import { Link } from 'react-router-dom';
import { useApiResource } from '../../hooks/useApiResource';
import { useCreateListing } from '../../hooks/useCreateListing';
import { apiError } from '../../services/api';
import { formatDay, formatMoney } from '../../utils/format';
import { MODE_LABELS } from '../../utils/listingText';
import { Button, Card, EmptyState, ErrorState, SkeletonList } from '../../components/ui';

function Stat({ label, value, to, note }) {
  const body = (
    <>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold text-primary-strong">{value}</p>
      {note && <p className="mt-1 text-xs text-ink-muted">{note}</p>}
    </>
  );
  return to
    ? <Link to={to} className="block rounded-card border border-line bg-surface p-5 shadow-card transition-colors hover:border-primary">{body}</Link>
    : <div className="rounded-card border border-line bg-surface p-5 shadow-card">{body}</div>;
}

export default function ProDashboard() {
  const resource = useApiResource('/pro/summary', undefined, { keepPrevious: true });
  const unread = useApiResource('/conversations/unread-count', undefined, { keepPrevious: true });
  const { create, busy } = useCreateListing();
  const data = resource.data;

  if (!data && resource.loading) return <SkeletonList count={4} label="Carregando painel" itemClassName="h-28" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" />;
  if (resource.error) return <ErrorState title="Não foi possível carregar o painel" message={apiError(resource.error)} onRetry={resource.retry} />;

  return (
    <div className="space-y-10">
      <section aria-label="Resumo" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Pedidos novos" value={data.newOrders} to="/pro/pedidos" note={data.newOrders ? 'Aguardando a sua resposta' : 'Nada esperando por você'} />
        <Stat label="Em andamento" value={data.inProgress} to="/pro/pedidos" />
        <Stat label="Ganhos do mês" value={formatMoney(data.monthEarnings.amount)} to="/pro/ganhos" note={`${data.monthEarnings.count} ${data.monthEarnings.count === 1 ? 'serviço concluído' : 'serviços concluídos'}. Valores informados por você.`} />
        <Stat label="Nota média" value={data.rating.total ? `★ ${data.rating.average.toFixed(1)}` : '—'} note={data.rating.total ? `${data.rating.total} ${data.rating.total === 1 ? 'avaliação' : 'avaliações'}` : 'Ainda sem avaliações'} />
        <Stat label="Propostas pendentes" value={data.proposalsPending} to="/pro/pedidos" note="Enviadas a pedidos abertos" />
        <Stat label="Mensagens não lidas" value={unread.data?.count ?? '—'} to="/mensagens" note={unread.data?.count ? 'Clientes esperando resposta' : 'Tudo em dia'} />
      </section>

      {data.receivingWarning && <p role="alert" className="rounded-control border border-warning-line bg-warning-soft p-4 text-sm leading-6 text-warning-strong">{data.receivingWarning.message} <Link to="/configuracoes/pagamentos" className="font-medium underline">Ir para “Como recebo”</Link></p>}
      {!data.verified && <p role="note" className="rounded-control border border-info-line bg-info-soft p-4 text-sm leading-6 text-info">O selo “Verificado” aparece depois de uma análise manual dos seus dados. Enquanto isso, você já recebe pedidos normalmente.</p>}

      <section aria-labelledby="proximos">
        <h2 id="proximos" className="mb-3 text-xl font-semibold">Próximos serviços</h2>
        {data.upcoming.length === 0 ? (
          <EmptyState icon="list" title="Nenhum serviço marcado" description="Quando você aceitar um pedido, ele aparece aqui, na data combinada." action={<Button to="/pro/pedidos" variant="secondary">Ver pedidos</Button>} />
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line bg-surface">
            {data.upcoming.map((order) => (
              <li key={order.uuid}>
                <Link to={`/contratacoes/${order.uuid}`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-surface-muted">
                  <span><span className="block font-medium">{order.title}</span><span className="text-sm text-ink-muted">{order.client.name} · {MODE_LABELS[order.serviceMode]}</span></span>
                  <span className="text-sm font-semibold text-primary-strong">{formatDay(order.scheduledDate, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="atalhos">
        <h2 id="atalhos" className="mb-3 text-xl font-semibold">Atalhos</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card><h3 className="font-semibold">Novo serviço</h3><p className="mt-1 text-sm text-ink-muted">{data.listings.published} publicado{data.listings.published === 1 ? '' : 's'}, {data.listings.draft} em rascunho.</p><Button className="mt-3" size="sm" onClick={create} loading={busy}>Criar anúncio</Button></Card>
          <Card><h3 className="font-semibold">Agenda</h3><p className="mt-1 text-sm text-ink-muted">Bloqueie os dias em que não atende.</p><Button className="mt-3" size="sm" variant="secondary" to="/pro/pedidos">Abrir agenda</Button></Card>
          <Card><h3 className="font-semibold">Pedidos abertos</h3><p className="mt-1 text-sm text-ink-muted">Clientes que esperam propostas.</p><Button className="mt-3" size="sm" variant="secondary" to="/servicos">Ver pedidos</Button></Card>
          <Card><h3 className="font-semibold">Impostos e recebimento</h3><p className="mt-1 text-sm text-ink-muted">CPF ou CNPJ e chave Pix.</p><Button className="mt-3" size="sm" variant="secondary" to="/configuracoes/impostos">Abrir</Button></Card>
        </div>
      </section>
    </div>
  );
}
