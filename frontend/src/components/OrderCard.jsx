import { Link } from 'react-router-dom';
import { formatDay, formatMoney } from '../utils/format';
import { MODE_LABELS } from '../utils/listingText';
import { orderStatus } from '../utils/status';
import OrderActions from './OrderActions';
import StatusBadge from './StatusBadge';
import { Avatar } from './ui';

/** Cartão de contratação para as listas do cliente e do profissional. */
export default function OrderCard({ order, perspective, onChanged }) {
  const other = perspective === 'professional' ? order.client : order.professional;
  const amount = order.finalAmount ?? order.total;
  return (
    <article className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-card sm:flex-row">
      {order.listing?.cover && <img src={order.listing.cover} alt="" loading="lazy" className="aspect-[16/9] w-full rounded-control object-cover sm:aspect-auto sm:h-28 sm:w-40" />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} map={orderStatus} />
          <span className="text-sm text-ink-muted">Para {formatDay(order.scheduledDate)} · {MODE_LABELS[order.serviceMode]}</span>
        </div>
        <h3 className="mt-2 break-words font-semibold"><Link to={`/contratacoes/${order.uuid}`} className="hover:text-primary-strong">{order.title}</Link></h3>
        <p className="mt-1 flex items-center gap-2 text-sm text-ink-soft">
          <Avatar src={other.profilePictureUrl} name={other.name} size="xs" decorative />
          {perspective === 'professional' ? 'Cliente' : 'Profissional'}: <Link to={`/usuarios/${other.uuid}`} className="font-medium text-primary-strong underline-offset-2 hover:underline">{other.name}</Link>
        </p>
        <p className="mt-1 text-sm text-ink-muted">{order.packageName ? `Pacote ${order.packageName} · ` : ''}{amount != null ? `${order.finalAmount != null ? 'Valor final' : 'Valor estimado'}: ${formatMoney(amount)}` : 'Valor a combinar'}</p>
        {order.note && <p className="mt-2 line-clamp-2 text-sm text-ink-soft">“{order.note}”</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <OrderActions order={order} onChanged={onChanged} />
          <Link to={`/contratacoes/${order.uuid}`} className="text-sm font-semibold text-primary-strong underline underline-offset-2">Ver detalhes</Link>
          {order.status === 'completed' && <Link to={`/contratacoes/${order.uuid}/avaliar`} className="text-sm font-semibold text-primary-strong underline underline-offset-2">Avaliar</Link>}
        </div>
      </div>
    </article>
  );
}
