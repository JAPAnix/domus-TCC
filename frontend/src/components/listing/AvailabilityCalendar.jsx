import { useMemo, useState } from 'react';
import { addDays, dayHours, daysOf, hourSlots, MAX_DAYS, MAX_HOURS, toMinutes } from '../../utils/bookingSlots';
import { weekdayOf } from '../../utils/listingText';
import { formatDay } from '../../utils/format';
import { Button } from '../ui';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;
const HORIZON_DAYS = 120;

function Month({ year, month, isEnabled, selected, inRange, onPick }) {
  const first = new Date(Date.UTC(year, month, 1, 12)).getUTCDay();
  const total = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: total }, (_, index) => index + 1)];
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-2 text-center text-sm font-semibold capitalize">{MONTHS[month]} de {year}</p>
      <div className="grid grid-cols-7 gap-y-1 text-center" role="grid" aria-label={`${MONTHS[month]} de ${year}`}>
        {WEEK.map((letter, index) => <span key={index} role="columnheader" className="pb-1 text-xs text-ink-muted">{letter}</span>)}
        {cells.map((day, index) => {
          if (!day) return <span key={`blank-${index}`} role="gridcell" />;
          const key = keyOf(year, month, day);
          const enabled = isEnabled(key);
          const isSelected = selected(key);
          const between = inRange(key);
          return (
            <span key={key} role="gridcell" className={between && !isSelected ? 'bg-primary-soft' : ''}>
              <button
                type="button" disabled={!enabled} onClick={() => onPick(key)} aria-pressed={isSelected}
                aria-label={`${day} de ${MONTHS[month]} de ${year}: ${isSelected ? 'selecionado' : enabled ? 'disponível' : 'indisponível'}`}
                className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm transition-colors ${isSelected ? 'bg-primary font-semibold text-white' : enabled ? 'font-medium hover:bg-primary-soft' : 'cursor-not-allowed text-ink-muted/50 line-through'}`}
              >{day}</button>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Calendário de 2 meses. Por hora: depois da data, lista de horários livres e quantidade de horas.
 * Por diária: escolhe a data inicial e a final. Nos outros modelos, só a data.
 * `selection` = { date, time, quantity }, `onChange(parcial)`.
 */
export default function AvailabilityCalendar({ listing, selection, onChange }) {
  const model = listing.pricingModel;
  const calendar = listing.calendar;
  const weekdays = listing.availability?.weekdays ?? [];
  const [offset, setOffset] = useState(0);
  const [picking, setPicking] = useState(false); // por diária: esperando a data final
  const today = new Date();
  const latest = addDays(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`, HORIZON_DAYS);
  const busyHours = calendar.busyHours ?? {};
  const busyDays = useMemo(() => new Set(calendar.busyDays ?? []), [calendar.busyDays]);
  const blocked = useMemo(() => new Set(calendar.blocked ?? []), [calendar.blocked]);

  const windowOf = (key) => weekdays.find((day) => day.day === weekdayOf(key));
  const freeHours = (key) => dayHours(windowOf(key)).filter((hour) => !(busyHours[key] ?? []).includes(hour));
  function isEnabled(key) {
    if (key < calendar.earliest || key > latest || blocked.has(key) || !windowOf(key)) return false;
    if (model === 'daily') return !busyDays.has(key);
    if (model === 'hourly') return freeHours(key).length > 0;
    return true;
  }

  const quantity = selection.quantity ?? 1;
  const endDate = model === 'daily' && selection.date ? addDays(selection.date, quantity - 1) : selection.date;
  const selected = (key) => (model === 'daily' ? !!selection.date && key >= selection.date && key <= endDate && (key === selection.date || key === endDate) : key === selection.date);
  const inRange = (key) => model === 'daily' && !!selection.date && key > selection.date && key < endDate;

  function pick(key) {
    if (model === 'daily') {
      if (picking && key > selection.date && daysOf(selection.date, Math.min(MAX_DAYS, daysBetween(selection.date, key) + 1)).every(isEnabled) && daysBetween(selection.date, key) + 1 <= MAX_DAYS) {
        onChange({ quantity: daysBetween(selection.date, key) + 1 });
        setPicking(false);
        return;
      }
      onChange({ date: key, quantity: 1, time: null });
      setPicking(true);
      return;
    }
    onChange({ date: key, time: null, ...(model === 'hourly' ? { quantity: selection.quantity ?? 1 } : {}) });
  }

  // Horas por hora: início possível se todas as horas seguidas estão livres.
  const hours = model === 'hourly' && selection.date ? freeHours(selection.date) : [];
  const fits = (start) => hourSlots(start, quantity).every((slot) => hours.includes(slot));
  const clear = () => { setPicking(false); onChange({ date: null, time: null, quantity: model === 'fixed' || model === 'quote' ? null : 1 }); };

  const base = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const months = [0, 1].map((step) => { const d = new Date(base.getFullYear(), base.getMonth() + step, 1); return { year: d.getFullYear(), month: d.getMonth() }; });
  const canPrev = offset > 0;
  const canNext = months[1].year * 12 + months[1].month < Number(latest.slice(0, 4)) * 12 + Number(latest.slice(5, 7)) - 1;

  let title = 'Selecione a data do serviço';
  if (selection.date) {
    if (model === 'daily') title = quantity === 1 ? `${formatDay(selection.date, { weekday: 'long', day: 'numeric', month: 'long' })} (1 dia)${picking ? ': escolha a data final se precisar de mais dias' : ''}` : `${quantity} dias: de ${formatDay(selection.date, { day: 'numeric', month: 'short' })} a ${formatDay(endDate, { day: 'numeric', month: 'short' })}`;
    else if (model === 'hourly') title = selection.time ? `${formatDay(selection.date, { weekday: 'long', day: 'numeric', month: 'long' })}, ${selection.time} às ${hourSlots(selection.time, quantity).length ? `${String(Math.floor((toMinutes(selection.time) + quantity * 60) / 60)).padStart(2, '0')}:00` : ''}` : `${formatDay(selection.date, { weekday: 'long', day: 'numeric', month: 'long' })}: escolha o horário`;
    else title = formatDay(selection.date, { weekday: 'long', day: 'numeric', month: 'long' });
  }

  return (
    <div>
      <h3 className="text-base font-semibold" aria-live="polite">{title}</h3>
      <p className="mt-1 text-sm text-ink-muted">{listing.availability?.leadTimeHours ? `Antecedência mínima de ${listing.availability.leadTimeHours} horas.` : 'Sem antecedência mínima.'}</p>
      <div className="mt-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setOffset((value) => value - 1)} disabled={!canPrev} aria-label="Mês anterior">‹</Button>
        <Button variant="ghost" size="sm" onClick={() => setOffset((value) => value + 1)} disabled={!canNext} aria-label="Próximo mês">›</Button>
      </div>
      <div className="mt-1 flex flex-col gap-6 md:flex-row md:gap-10">
        {months.map(({ year, month }, index) => <div key={`${year}-${month}`} className={`flex-1 ${index === 1 ? 'hidden sm:block' : ''}`}><Month year={year} month={month} isEnabled={isEnabled} selected={selected} inRange={inRange} onPick={pick} /></div>)}
      </div>

      {model === 'hourly' && selection.date && (
        <div className="mt-5 space-y-4 border-t border-line pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium" id="hours-label">Quantas horas?</span>
            <div className="flex items-center gap-2" role="group" aria-labelledby="hours-label">
              <Button variant="secondary" size="sm" onClick={() => onChange({ quantity: Math.max(1, quantity - 1), time: null })} disabled={quantity <= 1} aria-label="Menos uma hora">−</Button>
              <output className="w-10 text-center font-semibold" aria-live="polite">{quantity}</output>
              <Button variant="secondary" size="sm" onClick={() => onChange({ quantity: Math.min(MAX_HOURS, quantity + 1), time: null })} disabled={quantity >= MAX_HOURS} aria-label="Mais uma hora">+</Button>
            </div>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Horário de início</legend>
            <div className="flex flex-wrap gap-2">
              {hours.map((hour) => (
                <button key={hour} type="button" disabled={!fits(hour)} aria-pressed={selection.time === hour} onClick={() => onChange({ time: hour })} className={`min-h-control rounded-control border px-4 text-sm ${selection.time === hour ? 'border-primary bg-primary font-semibold text-white' : fits(hour) ? 'border-line-strong hover:bg-primary-soft' : 'cursor-not-allowed border-line text-ink-muted/50 line-through'}`}>{hour}</button>
              ))}
              {hours.length === 0 && <p className="text-sm text-ink-muted">Sem horários livres neste dia.</p>}
            </div>
          </fieldset>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted" aria-label="Legenda">
          <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-full border border-line-strong bg-surface" />Disponível</li>
          <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-full bg-primary" />Selecionado</li>
          <li className="flex items-center gap-1.5"><span aria-hidden="true" className="text-ink-muted/60 line-through">12</span>Indisponível</li>
        </ul>
        <Button variant="ghost" size="sm" onClick={clear} disabled={!selection.date}>Limpar datas</Button>
      </div>
    </div>
  );
}

function daysBetween(from, to) {
  return Math.round((new Date(`${to}T12:00:00Z`) - new Date(`${from}T12:00:00Z`)) / 86400000);
}
