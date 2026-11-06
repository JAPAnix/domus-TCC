import { Link, useParams } from 'react-router-dom';
import { apiError } from '../services/api';
import { useApiResource } from '../hooks/useApiResource';
import { formatDay, formatMoney } from '../utils/format';
import { MODE_LABELS, POLICY_INFO, PRICING_LABELS } from '../utils/listingText';
import { orderStatus } from '../utils/status';
import OrderActions from '../components/OrderActions';
import OrderPayment from '../components/OrderPayment';
import MessageButton from '../components/MessageButton';
import StatusBadge from '../components/StatusBadge';
import { Avatar, Breadcrumb, Button, Card, EmptyState, ErrorState, SkeletonList } from '../components/ui';

const when = (value) => (value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null);

function Person({ label, person }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar src={person.profilePictureUrl} name={person.name} decorative />
      <div><p className="text-xs text-ink-muted">{label}</p><Link to={`/usuarios/${person.uuid}`} className="font-medium text-primary-strong underline-offset-2 hover:underline">{person.name}</Link></div>
    </div>
  );
}

export default function OrderPage() {
  const { uuid } = useParams();
  const resource = useApiResource(`/orders/${uuid}`, undefined, { keepPrevious: true });
  const order = resource.data;
  const isClient = order?.role === 'client';
  const crumbs = [{ label: isClient || !order ? 'Pedidos e contratações' : 'Pedidos e agenda', to: !order || isClient ? '/meus-servicos' : '/pro/pedidos' }, { label: order?.title ?? 'Pedido' }];

  if (!order && resource.loading) return <main className="mx-auto max-w-content px-4 py-10 sm:px-6"><Breadcrumb items={crumbs} /><SkeletonList count={3} label="Carregando pedido" itemClassName="h-32" /></main>;
  if (resource.error) {
    const missing = resource.error.response?.status === 404;
    return (
      <main className="mx-auto max-w-content px-4 py-10 sm:px-6">
        <Breadcrumb items={crumbs} />
        {missing ? <EmptyState as="h1" icon="search" title="Pedido não encontrado" description="Ele não existe ou você não participa dele." action={<Button to="/meus-servicos">Ver meus pedidos</Button>} />
          : <ErrorState title="Não foi possível carregar o pedido" message={apiError(resource.error)} onRetry={resource.retry} />}
      </main>
    );
  }

  const timeline = [['Pedido enviado', order.createdAt], ['Aceito', order.acceptedAt], ['Serviço iniciado', order.startedAt], ['Concluído', order.completedAt], [order.cancelledByMe ? 'Cancelado por você' : 'Cancelado', order.cancelledAt]].filter(([, date]) => date);
  const other = isClient ? order.professional : order.client;
  return (
    <main className="mx-auto max-w-content px-4 py-10 sm:px-6">
      <Breadcrumb items={crumbs} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><h1 className="break-words text-2xl font-bold sm:text-3xl">{order.title}</h1><p className="mt-1 text-ink-muted">Para {formatDay(order.scheduledDate, { dateStyle: 'full' })}</p></div>
        <StatusBadge status={order.status} map={orderStatus} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2"><Person label="Cliente" person={order.client} /><Person label="Profissional" person={order.professional} /></div>
            <dl className="grid gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-2">
              <div><dt className="text-sm text-ink-muted">Forma de atendimento</dt><dd className="font-medium">{MODE_LABELS[order.serviceMode]}</dd></div>
              {order.packageName && <div><dt className="text-sm text-ink-muted">Pacote</dt><dd className="font-medium">{order.packageName}</dd></div>}
              {order.scheduledTime && <div><dt className="text-sm text-ink-muted">Horário</dt><dd className="font-medium">{order.scheduledTime}{order.quantity ? ` (${order.quantity} ${order.quantity === 1 ? 'hora' : 'horas'})` : ''}</dd></div>}
              {!order.scheduledTime && order.quantity > 1 && <div><dt className="text-sm text-ink-muted">Dias</dt><dd className="font-medium">{order.quantity}{order.endDate ? ` (até ${formatDay(order.endDate)})` : ''}</dd></div>}
              <div><dt className="text-sm text-ink-muted">Como o preço é cobrado</dt><dd className="font-medium">{PRICING_LABELS[order.pricingModel] ?? 'Sob consulta'}</dd></div>
              {order.price != null && <div><dt className="text-sm text-ink-muted">Valor do anúncio</dt><dd className="font-medium">{formatMoney(order.price)}</dd></div>}
              {order.travelFee != null && <div><dt className="text-sm text-ink-muted">Deslocamento</dt><dd className="font-medium">{formatMoney(order.travelFee)}</dd></div>}
              {order.total != null && <div><dt className="text-sm text-ink-muted">Valor estimado</dt><dd className="font-medium">{formatMoney(order.total)}</dd></div>}
              {order.finalAmount != null && <div><dt className="text-sm text-ink-muted">Valor final informado</dt><dd className="font-semibold text-primary-strong">{formatMoney(order.finalAmount)}</dd></div>}
              {order.policy && <div className="sm:col-span-2"><dt className="text-sm text-ink-muted">Cancelamento</dt><dd className="font-medium">{POLICY_INFO[order.policy].label}: <span className="font-normal text-ink-soft">{POLICY_INFO[order.policy].text}</span></dd></div>}
            </dl>
            {order.note && <div className="border-t border-line pt-5"><h2 className="text-sm font-semibold">Observações do cliente</h2><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">{order.note}</p></div>}
            {order.referenceImages?.length > 0 && <div className="border-t border-line pt-5"><h2 className="text-sm font-semibold">Fotos de referência</h2><ul className="mt-2 flex flex-wrap gap-2">{order.referenceImages.map((url, index) => <li key={url}><a href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Foto de referência ${index + 1}`} loading="lazy" className="h-20 w-20 rounded-control object-cover" /></a></li>)}</ul></div>}
          </Card>
          {['accepted', 'in_progress', 'completed'].includes(order.status) && <OrderPayment key={order.status} orderUuid={order.uuid} />}
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold">O que fazer agora</h2>
            <div className="mt-4 space-y-3">
              {order.actions.length > 0 ? <OrderActions order={order} onChanged={resource.retry} size="md" /> : <p className="text-sm text-ink-muted">Nenhuma ação disponível neste status.</p>}
              {order.status === 'completed' && (order.reviewedByMe ? <p className="text-sm text-success">Você já avaliou este serviço.</p> : <Button to={`/contratacoes/${order.uuid}/avaliar`}>Avaliar {other.name}</Button>)}
              <MessageButton orderUuid={order.uuid} block>Conversar com {other.name}</MessageButton>
              {order.listing?.available && <Button to={`/anuncios/${order.listing.uuid}`} variant="secondary">Ver o anúncio</Button>}
            </div>
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">Histórico</h2>
            <ol className="space-y-2 border-l-2 border-line pl-4">
              {timeline.map(([label, date]) => <li key={label} className="text-sm"><span className="font-medium">{label}</span><span className="block text-xs text-ink-muted">{when(date)}</span></li>)}
            </ol>
          </Card>
        </div>
      </div>
    </main>
  );
}
