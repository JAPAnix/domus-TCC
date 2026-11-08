import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { apiError } from '../services/api';
import { useApiResource } from '../hooks/useApiResource';
import { formatDay, formatMoney } from '../utils/format';
import { MODE_LABELS, POLICY_INFO, PRICING_LABELS } from '../utils/listingText';
import { orderStatus } from '../utils/status';
import { deadlineNotice, proposalTerm } from '../utils/orderText';
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
  const { hash } = useLocation();
  const orderUuid = order?.uuid;
  // Vindo do aceite da proposta (#pagamento), rola até a área de pagamento assim que o pedido carrega.
  useEffect(() => {
    if (hash === '#pagamento' && orderUuid) document.getElementById('pagamento')?.scrollIntoView({ block: 'start' });
  }, [hash, orderUuid]);
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

  const notice = deadlineNotice(order);
  const pro = order.role === 'professional';
  const timeline = [['Pedido enviado', order.createdAt], ['Proposta enviada', order.proposal?.sentAt], ['Aceito', order.acceptedAt], ['Serviço iniciado', order.startedAt], ['Concluído', order.completedAt], [order.cancelledByMe ? 'Cancelado por você' : 'Cancelado', order.cancelledAt]].filter(([, date]) => date);
  const other = isClient ? order.professional : order.client;
  return (
    <main className="mx-auto max-w-content px-4 py-10 sm:px-6">
      <Breadcrumb items={crumbs} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><h1 className="break-words text-2xl font-bold sm:text-3xl">{order.title}</h1><p className="mt-1 text-ink-muted">{order.service ? 'Prazo' : 'Para'} {formatDay(order.scheduledDate, { dateStyle: 'full' })}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          {notice && <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${notice.tone}`}>{notice.text}</span>}
          <StatusBadge status={order.status} map={orderStatus} />
        </div>
      </div>
      {order.status === 'expired' && <p role="status" className="mt-4 rounded-control bg-surface-muted p-3 text-sm text-ink-soft">{order.proposal ? 'A proposta venceu sem resposta.' : 'O prazo para responder acabou.'} {pro ? 'Nenhuma ação é necessária.' : 'Você pode pedir de novo ou escolher outro profissional.'}</p>}
      {order.status === 'declined' && order.declineReason && <p role="status" className="mt-4 rounded-control bg-surface-muted p-3 text-sm text-ink-soft">Motivo informado: {order.declineReason}</p>}

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
              {order.price != null && <div><dt className="text-sm text-ink-muted">{order.service ? 'Valor da proposta' : 'Valor do anúncio'}</dt><dd className="font-medium">{formatMoney(order.price)}</dd></div>}
              {order.travelFee != null && <div><dt className="text-sm text-ink-muted">Deslocamento</dt><dd className="font-medium">{formatMoney(order.travelFee)}</dd></div>}
              {order.total != null && <div><dt className="text-sm text-ink-muted">Valor estimado</dt><dd className="font-medium">{formatMoney(order.total)}</dd></div>}
              {order.finalAmount != null && <div><dt className="text-sm text-ink-muted">Valor final informado</dt><dd className="font-semibold text-primary-strong">{formatMoney(order.finalAmount)}</dd></div>}
              {order.policy && <div className="sm:col-span-2"><dt className="text-sm text-ink-muted">Cancelamento</dt><dd className="font-medium">{POLICY_INFO[order.policy].label}: <span className="font-normal text-ink-soft">{POLICY_INFO[order.policy].text}</span></dd></div>}
            </dl>
            {order.serviceAddress && (
              <div className="border-t border-line pt-5">
                <h2 className="text-sm font-semibold">Local do serviço</h2>
                {order.serviceAddress.partial ? (
                  <p className="mt-1 text-sm leading-6 text-ink-soft">{order.serviceAddress.neighborhood} · {order.serviceAddress.city}/{order.serviceAddress.state}. <span className="text-ink-muted">O endereço completo aparece depois que você aceitar o pedido.</span></p>
                ) : (
                  <p className="mt-1 text-sm leading-6 text-ink-soft">{order.serviceAddress.street}, {order.serviceAddress.number}{order.serviceAddress.complement ? ` (${order.serviceAddress.complement})` : ''} · {order.serviceAddress.neighborhood} · {order.serviceAddress.city}/{order.serviceAddress.state} · CEP {order.serviceAddress.postal_code}</p>
                )}
              </div>
            )}
            {order.note && <div className="border-t border-line pt-5"><h2 className="text-sm font-semibold">{order.service ? 'Mensagem do profissional na proposta' : 'Observações do cliente'}</h2><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">{order.note}</p></div>}
            {order.referenceImages?.length > 0 && <div className="border-t border-line pt-5"><h2 className="text-sm font-semibold">Fotos de referência</h2><ul className="mt-2 flex flex-wrap gap-2">{order.referenceImages.map((url, index) => <li key={url}><a href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Foto de referência ${index + 1}`} loading="lazy" className="h-20 w-20 rounded-control object-cover" /></a></li>)}</ul></div>}
          </Card>
          {order.proposal && (
            <Card className="space-y-3">
              <h2 className="font-semibold">{pro ? 'Sua proposta' : 'Proposta do profissional'}</h2>
              <p className="text-2xl font-bold text-primary-strong">{formatMoney(order.proposal.amount)}</p>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <div><dt className="text-ink-muted">Prazo</dt><dd className="font-medium">{proposalTerm(order.proposal, formatDay)}</dd></div>
                {order.status === 'proposed' && <div><dt className="text-ink-muted">Válida até</dt><dd className="font-medium">{when(order.proposal.validUntil)}</dd></div>}
                {order.proposal.included && <div className="sm:col-span-2"><dt className="text-ink-muted">O que está incluso</dt><dd className="whitespace-pre-wrap break-words">{order.proposal.included}</dd></div>}
                {order.proposal.note && <div className="sm:col-span-2"><dt className="text-ink-muted">Observações</dt><dd className="whitespace-pre-wrap break-words">{order.proposal.note}</dd></div>}
              </dl>
              {order.status === 'proposed' && !pro && <p className="text-sm text-ink-muted">Ao aceitar, você segue para o pagamento. O combinado fica registrado neste pedido.</p>}
            </Card>
          )}
          {['accepted', 'in_progress', 'completed'].includes(order.status) && <div id="pagamento" className="scroll-mt-24"><OrderPayment key={order.status} orderUuid={order.uuid} /></div>}
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold">O que fazer agora</h2>
            <div className="mt-4 space-y-3">
              {order.actions.length > 0 ? <OrderActions order={order} onChanged={resource.retry} size="md" /> : <p className="text-sm text-ink-muted">Nenhuma ação disponível neste status.</p>}
              {order.status === 'completed' && (order.reviewedByMe ? <p className="text-sm text-success">Você já avaliou este serviço.</p> : <Button to={order.service ? `/servicos/${order.service.uuid}/avaliar` : `/contratacoes/${order.uuid}/avaliar`}>Avaliar {other.name}</Button>)}
              {['expired', 'declined', 'cancelled'].includes(order.status) && pro ? null : <MessageButton orderUuid={order.uuid} block>{pro && ['requested', 'proposed'].includes(order.status) ? 'Pedir mais informações' : `Conversar com ${other.name}`}</MessageButton>}
              {order.listing?.available && <Button to={`/anuncios/${order.listing.uuid}`} variant="secondary">Ver o anúncio</Button>}
              {order.service && <Button to={`/servicos/${order.service.uuid}`} variant="secondary">Ver o pedido aberto</Button>}
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
