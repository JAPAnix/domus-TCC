import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { apiError } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { dateKey } from '../../utils/listingText';
import { formatDay } from '../../utils/format';
import { Button, ErrorState, useToast } from '../../components/ui';

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function shiftMonth(month, delta) {
  const [year, index] = month.split('-').map(Number);
  const date = new Date(year, index - 1 + delta, 1);
  return dateKey(date).slice(0, 7);
}

/** Calendário do mês: dias bloqueados, pedidos marcados e botão para bloquear ou liberar o dia. */
export default function AvailabilityCalendar() {
  const toast = useToast();
  const today = dateKey(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const resource = useApiResource('/pro/availability', { month }, { keepPrevious: true });
  const data = resource.data;

  const [year, index] = month.split('-').map(Number);
  const daysInMonth = new Date(year, index, 0).getDate();
  const offset = new Date(year, index - 1, 1).getDay();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  const ordersOn = (key) => (data?.orders ?? []).filter((order) => order.scheduledDate === key);
  const isBlocked = (key) => !!data?.blocked.includes(key);

  async function toggle(key) {
    setBusy(true);
    try {
      await api.put(`/pro/availability/${key}`, { blocked: !isBlocked(key) });
      toast.success(isBlocked(key) ? 'Dia liberado.' : 'Dia bloqueado. Ele não aparece mais como disponível para os clientes.');
      resource.retry();
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível alterar o dia.'));
    } finally {
      setBusy(false);
    }
  }

  const title = new Date(year, index - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const selectedOrders = selected ? ordersOn(selected) : [];
  return (
    <section aria-labelledby="agenda" className="rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 id="agenda" className="text-xl font-semibold">Agenda</h2><p className="text-sm text-ink-muted">Toque em um dia para bloquear ou liberar. Pedidos marcados aparecem com um ponto.</p></div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setMonth(shiftMonth(month, -1))} disabled={month <= today.slice(0, 7)} aria-label="Mês anterior">‹</Button>
          <span className="min-w-36 text-center text-sm font-semibold capitalize" aria-live="polite">{title}</span>
          <Button variant="secondary" size="sm" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Próximo mês">›</Button>
        </div>
      </div>

      {resource.error && !data ? <div className="mt-4"><ErrorState title="Não foi possível carregar a agenda" message={apiError(resource.error)} onRetry={resource.retry} /></div> : (
        <>
          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-medium text-ink-muted">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1" aria-busy={resource.loading}>
            {cells.map((key, position) => {
              if (!key) return <span key={`empty-${position}`} />;
              const past = key < today;
              const blocked = isBlocked(key);
              const orders = ordersOn(key);
              const label = `${formatDay(key, { day: 'numeric', month: 'long' })}: ${past ? 'data passada' : blocked ? 'bloqueado' : 'disponível'}${orders.length ? `, ${orders.length} ${orders.length === 1 ? 'pedido' : 'pedidos'}` : ''}`;
              return (
                <button key={key} type="button" disabled={past} onClick={() => setSelected(key)} aria-label={label} aria-pressed={selected === key}
                  className={`relative flex h-11 flex-col items-center justify-center rounded-control border text-sm transition-colors disabled:cursor-not-allowed disabled:border-transparent disabled:text-line-strong ${selected === key ? 'border-primary bg-primary-soft font-semibold' : blocked ? 'border-danger-line bg-danger-soft text-danger' : 'border-line bg-surface hover:bg-surface-muted'} ${key === today ? 'ring-1 ring-primary' : ''}`}>
                  {Number(key.slice(8))}
                  {orders.length > 0 && <span aria-hidden="true" className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
          <p className="mt-3 flex flex-wrap gap-4 text-xs text-ink-muted"><span><span aria-hidden="true" className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-danger-line bg-danger-soft" />Bloqueado</span><span><span aria-hidden="true" className="mr-1 inline-block h-2 w-2 rounded-full bg-primary" />Tem pedido</span></p>
        </>
      )}

      {selected && (
        <div className="mt-5 rounded-control border border-line bg-surface-muted p-4">
          <h3 className="font-semibold">{formatDay(selected, { dateStyle: 'full' })}</h3>
          {selectedOrders.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm">{selectedOrders.map((order) => <li key={order.uuid}><Link to={`/contratacoes/${order.uuid}`} className="font-medium text-primary-strong underline-offset-2 hover:underline">{order.title}</Link> · {order.client.name} · {order.statusLabel}</li>)}</ul>
          ) : <p className="mt-1 text-sm text-ink-muted">Nenhum pedido neste dia.</p>}
          <Button className="mt-3" size="sm" variant={isBlocked(selected) ? 'secondary' : 'dangerOutline'} onClick={() => toggle(selected)} loading={busy}>{isBlocked(selected) ? 'Liberar este dia' : 'Bloquear este dia'}</Button>
          {!isBlocked(selected) && selectedOrders.length > 0 && <p className="mt-2 text-xs text-ink-muted">Bloquear não cancela pedidos já feitos; só impede novos nessa data.</p>}
        </div>
      )}
    </section>
  );
}
