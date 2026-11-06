import { useState } from 'react';
import { formatMoney } from '../utils/format';
import { MODE_LABELS, POLICY_INFO, PRICING_LABELS, WEEKDAY_NAMES, WEEKDAY_ORDER, locationLabel, priceLabel } from '../utils/listingText';
import { Modal } from './ui';
import Gallery from './listing/Gallery';
import AvailabilityCalendar from './listing/AvailabilityCalendar';
import ListingMap from './listing/ListingMap';
import ProCard, { HighlightBadge, OwnerLine } from './listing/ProCard';
import RelatedListings from './listing/RelatedListings';
import Reviews from './listing/Reviews';
import ReportListing from './listing/ReportListingModal';

const POLICY_HOURS = { flexible: '24 horas', moderate: '72 horas', strict: '7 dias' };

function Section({ id, title, children }) {
  return <section id={id} className="scroll-mt-32 border-t border-line py-8"><h2 className="mb-4 text-xl font-semibold">{title}</h2>{children}</section>;
}

function Highlights({ listing }) {
  const items = [
    listing.serviceModes.includes('client_place') && ['🚗', 'Vai até você', listing.radiusKm ? `Atende em um raio de ${listing.radiusKm} km.` : 'Atendimento na casa do cliente.'],
    listing.serviceModes.includes('remote') && ['💻', 'Atendimento online', 'Sem precisar sair de casa.'],
    listing.serviceModes.includes('pro_place') && ['📍', 'No local do profissional', 'O cliente vai até o espaço dele.'],
    listing.owner.responseMinutes != null && listing.owner.responseMinutes <= 60 && ['⚡', 'Responde rápido', 'Costuma responder em até 1 hora.'],
    listing.included.length > 0 && ['✅', `${listing.included.length} ${listing.included.length === 1 ? 'item incluso' : 'itens inclusos'}`, 'Veja abaixo o que está no valor.'],
    listing.owner.verified && ['🛡️', 'Profissional verificado', 'Documento conferido pelo Dommos.'],
  ].filter(Boolean).slice(0, 3);
  if (!items.length) return null;
  return (
    <ul className="grid gap-4 sm:grid-cols-3">
      {items.map(([icon, title, text]) => <li key={title} className="flex gap-3 rounded-card border border-line bg-surface p-4"><span aria-hidden="true" className="text-2xl">{icon}</span><div><p className="text-sm font-semibold">{title}</p><p className="text-xs leading-5 text-ink-muted">{text}</p></div></li>)}
    </ul>
  );
}

function Description({ text }) {
  const [more, setMore] = useState(false);
  const long = text.length > 420;
  return (
    <>
      <p className={`whitespace-pre-line break-words leading-7 text-ink-soft ${long && !more ? 'line-clamp-6' : ''}`}>{text || 'A descrição aparece aqui.'}</p>
      {long && <button type="button" onClick={() => setMore((value) => !value)} className="mt-2 font-semibold underline underline-offset-2">{more ? 'Mostrar menos' : 'Mostrar mais'}</button>}
    </>
  );
}

function Items({ items, tone, limit }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.slice(0, limit).map((item) => (
        <li key={item} className={`flex gap-3 text-sm leading-6 ${tone === 'no' ? 'text-ink-muted line-through' : 'text-ink-soft'}`}>
          <span aria-hidden="true" className={`mt-0.5 font-bold no-underline ${tone === 'no' ? 'text-danger' : 'text-success'}`}>{tone === 'no' ? '×' : '✓'}</span>
          <span><span className="sr-only">{tone === 'no' ? 'Não incluso: ' : 'Incluso: '}</span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Includes({ listing }) {
  const [open, setOpen] = useState(false);
  const total = listing.included.length + listing.excluded.length;
  const LIMIT = 6;
  return (
    <>
      {listing.included.length > 0 && <div><h3 className="mb-3 text-sm font-semibold">O que esse serviço inclui</h3><Items items={listing.included} limit={LIMIT} /></div>}
      {listing.excluded.length > 0 && <div className="mt-6"><h3 className="mb-3 text-sm font-semibold">O que NÃO inclui</h3><Items items={listing.excluded} tone="no" limit={LIMIT} /></div>}
      {(listing.included.length > LIMIT || listing.excluded.length > LIMIT) && <button type="button" onClick={() => setOpen(true)} className="mt-5 rounded-control border border-line-strong px-4 py-2 text-sm font-semibold hover:bg-surface-muted">Mostrar todos os {total} itens</button>}
      <Modal open={open} title="O que esse serviço inclui" onClose={() => setOpen(false)} placement="sheet" closeLabel="Fechar lista de itens">
        {listing.included.length > 0 && <div><h3 className="mb-3 text-sm font-semibold">Incluso</h3><Items items={listing.included} /></div>}
        {listing.excluded.length > 0 && <div className="mt-6"><h3 className="mb-3 text-sm font-semibold">Não incluso</h3><Items items={listing.excluded} tone="no" /></div>}
      </Modal>
    </>
  );
}

function KnowBefore({ listing }) {
  const [rules, setRules] = useState(false);
  const days = [...(listing.availability?.weekdays ?? [])].sort((a, b) => WEEKDAY_ORDER.indexOf(a.day) - WEEKDAY_ORDER.indexOf(b.day));
  const lead = listing.availability?.leadTimeHours ?? 0;
  const requirements = listing.requirements ?? '';
  const blocks = [
    ['Como a contratação funciona', <p key="a">Você envia a solicitação e o profissional precisa aceitar. Nada é cobrado pelo Dommos: o pagamento é combinado direto com ele, pelo pedido.</p>],
    ['Horários e antecedência', <><p>{lead === 0 ? 'Sem antecedência mínima.' : `Peça com pelo menos ${lead} ${lead === 1 ? 'hora' : 'horas'} de antecedência.`}</p>{days.length > 0 && <ul className="mt-1 text-ink-muted">{days.map((day) => <li key={day.day}>{WEEKDAY_NAMES[day.day]}: {day.from} às {day.to}</li>)}</ul>}</>],
    ['Regras e requisitos', requirements ? <><p className={`whitespace-pre-line ${!rules && requirements.length > 160 ? 'line-clamp-3' : ''}`}>{requirements}</p>{requirements.length > 160 && <button type="button" onClick={() => setRules((value) => !value)} className="mt-1 font-semibold underline underline-offset-2">{rules ? 'Ver menos' : 'Ver mais'}</button>}</> : <p>O profissional não definiu requisitos especiais.</p>],
    ['Segurança', <p key="d">Converse e combine o pagamento pelo Dommos. Desconfie de pedidos de dinheiro adiantado, de links estranhos e de quem quer sair da plataforma.</p>],
    ['Política de cancelamento', listing.cancellationPolicy ? <p key="e"><strong>{POLICY_INFO[listing.cancellationPolicy].label}.</strong> Cancelamento gratuito até {POLICY_HOURS[listing.cancellationPolicy]} antes da data combinada. Depois disso, eventuais custos são combinados direto com o profissional.</p> : <p>Escolha a política de cancelamento.</p>],
  ];
  return <div className="grid gap-x-10 gap-y-6 text-sm leading-6 text-ink-soft sm:grid-cols-2 lg:grid-cols-3">{blocks.map(([title, body]) => <div key={title}><h3 className="mb-1 text-sm font-semibold text-ink">{title}</h3>{body}</div>)}</div>;
}

/**
 * A vitrine do anúncio. Usada na página pública e na prévia do passo a passo (preview).
 * `aside` é o cartão de contratação; `selection` e `onSelect` ligam o calendário ao cartão.
 */
export default function ListingView({ listing, preview = false, aside, actions, selection, onSelect }) {
  // Na prévia do passo a passo a página já tem o próprio título principal.
  const Title = preview ? 'h2' : 'h1';
  const days = [...(listing.availability?.weekdays ?? [])].sort((a, b) => WEEKDAY_ORDER.indexOf(a.day) - WEEKDAY_ORDER.indexOf(b.day));
  const owner = listing.owner;
  const place = locationLabel(listing);
  const interactive = !preview && !!listing.calendar && !!onSelect;
  const region = `${place || 'Atendimento online'}${listing.radiusKm && listing.serviceModes.includes('client_place') ? `, até ${listing.radiusKm} km` : ''}`;

  return (
    <div>
      <header className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Title className="break-words text-2xl font-bold sm:text-3xl">{listing.title || 'Título do anúncio'}</Title>
            <p className="mt-2 text-sm text-ink-soft">
              {[listing.category?.name, listing.catalogItem?.name].filter(Boolean).join(' · ')}
              {listing.serviceModes.length > 0 && ` · ${listing.serviceModes.map((mode) => MODE_LABELS[mode]).join(', ')}`}
              {place && ` · ${place}`}
            </p>
          </div>
          {actions}
        </div>
      </header>

      <Gallery images={listing.images} title={listing.title || 'Anúncio'} />

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <article className="min-w-0 space-y-8">
          <HighlightBadge owner={owner} />
          <OwnerLine owner={owner} preview={preview} />
          <Highlights listing={listing} />
          <Description text={listing.description} />

          {(listing.included.length > 0 || listing.excluded.length > 0) && <Section id="inclui" title="O que esse serviço inclui"><Includes listing={listing} /></Section>}

          {listing.materials && <Section title="Materiais"><p className="whitespace-pre-line text-sm leading-6 text-ink-soft">{listing.materials}</p></Section>}

          <Section title="Preço">
            <p className="text-xl font-bold">{priceLabel(listing)}</p>
            <p className="text-sm text-ink-muted">{PRICING_LABELS[listing.pricingModel] ?? 'Defina como você cobra'}</p>
            {listing.travelFee > 0 && <p className="mt-2 text-sm text-ink-soft">Taxa de deslocamento: {formatMoney(listing.travelFee)} (atendimento na casa do cliente).</p>}
            {listing.packages.length > 0 && (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {listing.packages.map((item) => (
                  <li key={item.name} className="rounded-card border border-line p-4">
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-lg font-bold text-primary-strong">{formatMoney(item.price)}</p>
                    {item.description && <p className="mt-1 text-sm text-ink-muted">{item.description}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section id="disponibilidade" title="Disponibilidade">
            {interactive ? <AvailabilityCalendar listing={listing} selection={selection} onChange={onSelect} />
              : days.length ? (
                <dl className="max-w-sm divide-y divide-line rounded-card border border-line">
                  {days.map((day) => <div key={day.day} className="flex justify-between gap-4 px-4 py-2 text-sm"><dt className="font-medium">{WEEKDAY_NAMES[day.day]}</dt><dd className="text-ink-soft">{day.from} às {day.to}</dd></div>)}
                </dl>
              ) : <p className="text-sm text-ink-muted">Os dias e horários aparecem aqui.</p>}
          </Section>

          {!preview && owner.uuid && (
            <Section id="avaliacoes" title="Avaliações">
              <Reviews uuid={listing.uuid} isOwner={!!listing.isOwner} ownerUuid={owner.uuid} />
            </Section>
          )}

          <Section id="profissional" title="Conheça seu profissional"><ProCard owner={owner} listingUuid={listing.uuid} isOwner={!!listing.isOwner} preview={preview} /></Section>

          <Section id="localizacao" title="Onde o serviço é prestado">
            <p className="mb-4 text-sm text-ink-soft">{region}.</p>
            {preview || !listing.city ? <p className="text-sm text-ink-muted">{listing.city ? 'O mapa aparece na página publicada.' : 'Atendimento online: sem endereço.'}</p> : <ListingMap city={listing.city} state={listing.state} radiusKm={listing.radiusKm} label={region} />}
          </Section>

          <Section id="saber" title="O que você deve saber"><KnowBefore listing={listing} /></Section>

          {!preview && <section id="parecidos" className="border-t border-line py-8"><RelatedListings listing={listing} /></section>}
          {!preview && !listing.isOwner && <div className="border-t border-line pt-6"><ReportListing uuid={listing.uuid} /></div>}
        </article>

        {aside && <aside aria-label="Contratação" className="lg:sticky lg:top-44 lg:self-start">{aside}</aside>}
      </div>
    </div>
  );
}
