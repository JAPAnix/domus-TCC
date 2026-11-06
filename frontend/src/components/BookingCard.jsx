import { fromMinutes, toMinutes } from '../utils/bookingSlots';
import { UNIT, priceBreakdown, selectionHint } from '../utils/bookingPrice';
import { formatDay, formatMoney } from '../utils/format';
import { MODE_LABELS, priceLabel } from '../utils/listingText';
import { Button, Card } from './ui';
import MessageButton from './MessageButton';

/** Cartão de contratação fixo. A data, o horário e a quantidade vêm do calendário (via `selection`). */
export default function BookingCard({ listing, selection, onSelect, onRequest, user }) {
  const modes = listing.serviceModes;
  const mode = selection.mode ?? modes[0] ?? '';
  const quantity = selection.quantity ?? (UNIT[listing.pricingModel] ? 1 : null);
  const calc = priceBreakdown(listing, { packageName: selection.packageName, mode, quantity });
  const noAgenda = !(listing.availability?.weekdays ?? []).length;
  const hint = selectionHint(listing, selection);
  const quote = listing.pricingModel === 'quote';

  if (listing.isOwner) {
    return (
      <Card>
        <h2 className="text-lg font-semibold">Este é o seu anúncio</h2>
        <p className="mt-1 text-sm text-ink-muted">É assim que os clientes veem. Para mudar algo, edite o anúncio.</p>
        <div className="mt-4 flex flex-col gap-2">
          <Button to={`/pro/anuncio/${listing.uuid}/etapa/10`}>Editar anúncio</Button>
          <Button to="/pro/servicos" variant="secondary">Meus serviços</Button>
        </div>
      </Card>
    );
  }

  const end = selection.time && listing.pricingModel === 'hourly' ? fromMinutes(toMinutes(selection.time) + (quantity ?? 1) * 60) : null;
  return (
    <Card className="shadow-raised">
      <p className="text-2xl font-bold">{priceLabel(listing)}</p>
      <p className="text-sm text-ink-muted">{quote ? 'Combine o valor com o profissional.' : listing.pricingModel === 'fixed' ? 'Valor fechado pelo serviço.' : listing.pricingModel === 'hourly' ? 'Total = valor da hora x horas escolhidas.' : 'Total = valor da diária x dias escolhidos.'}</p>
      {listing.owner.reviews > 0 && <p className="mt-1 text-sm"><span aria-hidden="true" className="text-rating">★</span> {Number(listing.owner.rating).toFixed(1)} <span className="text-ink-muted">· {listing.owner.reviews} {listing.owner.reviews === 1 ? 'avaliação' : 'avaliações'}</span></p>}

      <div className="mt-5 space-y-4">
        <button type="button" onClick={() => document.getElementById('disponibilidade')?.scrollIntoView({ behavior: 'smooth' })} className="block w-full rounded-control border border-line-strong p-3 text-left hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary">
          <span className="block text-xs font-semibold uppercase tracking-wide text-ink-muted">Data e horário</span>
          <span className="block text-sm font-medium">
            {selection.date ? <>{formatDay(selection.date, { weekday: 'short', day: 'numeric', month: 'short' })}{listing.pricingModel === 'daily' && quantity > 1 ? ` · ${quantity} dias` : ''}{selection.time ? ` · ${selection.time} às ${end}` : ''}</> : <span className="text-ink-muted">Escolha no calendário abaixo</span>}
          </span>
        </button>

        {modes.length > 1 && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Como você quer ser atendido</legend>
            <div className="space-y-1">{modes.map((item) => <label key={item} className="flex min-h-control cursor-pointer items-center gap-2 text-sm"><input type="radio" name="mode" value={item} checked={mode === item} onChange={() => onSelect({ mode: item })} />{MODE_LABELS[item]}</label>)}</div>
          </fieldset>
        )}
        {listing.packages.length > 0 && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Pacote</legend>
            <div className="space-y-2">
              {[{ name: '', label: 'Serviço padrão', price: listing.price }, ...listing.packages.map((item) => ({ ...item, label: item.name }))].map((item) => (
                <label key={item.name} className={`flex cursor-pointer items-start gap-2 rounded-control border p-3 text-sm ${(selection.packageName ?? '') === item.name ? 'border-primary bg-primary-softer' : 'border-line'}`}>
                  <input type="radio" name="package" className="mt-1" value={item.name} checked={(selection.packageName ?? '') === item.name} onChange={() => onSelect({ packageName: item.name })} />
                  <span><strong>{item.label}</strong>{item.price != null && ` ${formatMoney(item.price)}`}{item.description && <span className="block text-ink-muted">{item.description}</span>}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      {calc.total != null && (
        <dl className="mt-5 space-y-1.5 border-t border-line pt-4 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-ink-soft">{calc.units ? `${formatMoney(calc.unitPrice)} x ${calc.units} ${UNIT[listing.pricingModel][calc.units === 1 ? 0 : 1]}` : 'Valor do serviço'}</dt><dd>{formatMoney(calc.service)}</dd></div>
          {calc.travel > 0 && <div className="flex justify-between gap-3"><dt className="text-ink-soft">Taxa de deslocamento</dt><dd>{formatMoney(calc.travel)}</dd></div>}
          <div className="flex justify-between gap-3"><dt className="text-ink-soft">Taxa da plataforma{calc.feePercent > 0 ? ` (${calc.feePercent}%, descontada do profissional)` : ''}</dt><dd>{calc.feePercent > 0 ? '—' : formatMoney(0)}</dd></div>
          <div className="flex justify-between gap-3 border-t border-line pt-2 text-base font-bold"><dt>Total</dt><dd>{formatMoney(calc.total)}</dd></div>
        </dl>
      )}

      <Button block className="mt-5" onClick={onRequest} disabled={noAgenda}>{!user ? 'Entrar para solicitar' : quote ? 'Pedir orçamento' : 'Solicitar serviço'}</Button>
      {noAgenda && <p role="status" className="mt-2 text-xs text-ink-muted">O profissional ainda não definiu dias de atendimento, por isso não dá para solicitar agora.</p>}
      {!noAgenda && hint && <p className="mt-2 text-xs text-ink-muted" role="status">{hint}.</p>}
      <p className="mt-2 text-center text-xs text-ink-muted">Você ainda não será cobrado.</p>
      <div className="mt-3"><MessageButton listingUuid={listing.uuid} block>Enviar mensagem</MessageButton></div>
    </Card>
  );
}
