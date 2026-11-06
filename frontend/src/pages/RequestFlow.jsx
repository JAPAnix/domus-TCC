import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api, { apiError } from '../services/api';
import { useApiResource } from '../hooks/useApiResource';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { priceBreakdown, UNIT } from '../utils/bookingPrice';
import { fromMinutes, toMinutes } from '../utils/bookingSlots';
import { formatDay, formatMoney } from '../utils/format';
import { MODE_LABELS, POLICY_INFO } from '../utils/listingText';
import ImageUploader from '../components/ImageUploader';
import { Breadcrumb, Button, Card, EmptyState, ErrorState, Skeleton, Textarea } from '../components/ui';

const STEPS = ['Revisar', 'Mensagem', 'Pagamento', 'Confirmar'];
const QUESTIONS = ['Qual é o endereço aproximado (bairro)?', 'O local tem fácil acesso?', 'Preciso comprar algum material antes?', 'Existe algum horário que não funciona para mim?'];

function Summary({ listing, selection, calc }) {
  const end = selection.time ? fromMinutes(toMinutes(selection.time) + selection.quantity * 60) : null;
  return (
    <Card className="lg:sticky lg:top-44">
      {listing.images[0] && <img src={listing.images[0]} alt="" className="mb-4 aspect-[16/9] w-full rounded-control object-cover" />}
      <h2 className="font-semibold leading-snug">{listing.title}</h2>
      <p className="mt-1 text-sm text-ink-muted">{listing.owner.name}</p>
      <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-ink-soft">Data</dt><dd className="text-right font-medium">{formatDay(selection.date, { weekday: 'short', day: 'numeric', month: 'long' })}{selection.model === 'daily' && selection.quantity > 1 ? ` (${selection.quantity} dias)` : ''}</dd></div>
        {selection.time && <div className="flex justify-between gap-3"><dt className="text-ink-soft">Horário</dt><dd className="font-medium">{selection.time} às {end}</dd></div>}
        {selection.packageName && <div className="flex justify-between gap-3"><dt className="text-ink-soft">Pacote</dt><dd className="font-medium">{selection.packageName}</dd></div>}
        <div className="flex justify-between gap-3"><dt className="text-ink-soft">Atendimento</dt><dd className="text-right font-medium">{MODE_LABELS[selection.mode]}</dd></div>
        {calc.total != null && <div className="flex justify-between gap-3 border-t border-line pt-2 text-base font-bold"><dt>Total</dt><dd>{formatMoney(calc.total)}</dd></div>}
      </dl>
      <p className="mt-3 text-xs text-ink-muted">Você ainda não será cobrado.</p>
    </Card>
  );
}

function Confirmation({ result, listing }) {
  const number = result.uuid.slice(0, 8).toUpperCase();
  return (
    <main className="mx-auto max-w-form px-4 py-12 text-center sm:px-6">
      <span aria-hidden="true" className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-3xl text-success">✓</span>
      <h1 className="mt-5 text-2xl font-bold sm:text-3xl">Solicitação enviada!</h1>
      <p className="mt-2 text-ink-muted">Pedido <strong className="text-ink">nº {number}</strong> para “{listing.title}”.</p>
      <Card className="mt-8 text-left">
        <h2 className="font-semibold">Próximos passos</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-ink-soft">
          <li>O profissional recebe o pedido e responde. Avisamos você aqui e por e-mail, se estiver ativo.</li>
          <li>Quando ele aceitar, você escolhe como pagar (Pix, dinheiro ou cartão presencial) na página do pedido.</li>
          <li>Depois do serviço, vocês dois se avaliam.</li>
        </ol>
      </Card>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button to={`/contratacoes/${result.uuid}`}>Ver pedido</Button>
        <Button variant="secondary" to={result.conversation ? `/mensagens/${result.conversation}` : '/mensagens'}>Ir para mensagens</Button>
      </div>
    </main>
  );
}

export default function RequestFlow() {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const resource = useApiResource(`/listings/${uuid}`);
  const listing = resource.data;
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState('');
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  useDocumentMeta({ title: listing ? `Solicitar: ${listing.title}` : 'Solicitar serviço' });

  const crumbs = [{ label: 'Buscar', to: '/buscar' }, { label: listing?.title ?? 'Serviço', to: `/anuncios/${uuid}` }, { label: 'Solicitar' }];
  if (!listing && resource.loading) return <main className="mx-auto max-w-page px-4 py-10 sm:px-6"><Breadcrumb items={crumbs} /><div role="status" aria-label="Carregando"><Skeleton className="h-64 w-full rounded-card" /></div></main>;
  if (resource.error) {
    const missing = resource.error.response?.status === 404;
    return <main className="mx-auto max-w-content px-4 py-10 sm:px-6"><Breadcrumb items={crumbs} />{missing ? <EmptyState as="h1" icon="search" title="Serviço não encontrado" description="Ele pode ter sido pausado ou removido." action={<Button to="/buscar">Buscar serviços</Button>} /> : <ErrorState title="Não foi possível carregar o serviço" message={apiError(resource.error)} onRetry={resource.retry} />}</main>;
  }
  if (listing.isOwner) return <main className="mx-auto max-w-content px-4 py-10 sm:px-6"><EmptyState as="h1" icon="alert" title="Este é o seu anúncio" description="Você não pode contratar o próprio serviço." action={<Button to="/pro/servicos">Meus serviços</Button>} /></main>;
  if (result) return <Confirmation result={result} listing={listing} />;

  const date = params.get('data');
  const quantity = UNIT[listing.pricingModel] ? Number(params.get('qtd') ?? 1) : null;
  const selection = { date, time: params.get('hora'), quantity, mode: params.get('modo') ?? listing.serviceModes[0], packageName: params.get('pacote') ?? '', model: listing.pricingModel };
  if (!date || (listing.pricingModel === 'hourly' && !selection.time)) {
    return <main className="mx-auto max-w-content px-4 py-10 sm:px-6"><Breadcrumb items={crumbs} /><EmptyState as="h1" icon="list" title="Escolha a data primeiro" description="Volte ao anúncio e escolha a data e, se for por hora, o horário." action={<Button to={`/anuncios/${uuid}#disponibilidade`}>Escolher no calendário</Button>} /></main>;
  }
  const calc = priceBreakdown(listing, { packageName: selection.packageName, mode: selection.mode, quantity });

  async function send() {
    setBusy(true);
    setError('');
    setConflict(false);
    try {
      const { data } = await api.post('/orders', {
        listing_uuid: uuid, date, service_mode: selection.mode, ...(selection.packageName && { package_name: selection.packageName }),
        ...(selection.time && { time: selection.time }), ...(quantity && { quantity }),
        ...(message.trim() && { note: message.trim() }), ...(photos.length && { image_urls: photos }),
      });
      setResult(data);
    } catch (err) {
      setConflict(err.response?.status === 409);
      setError(apiError(err, 'Não foi possível enviar a solicitação.'));
      setBusy(false);
    }
  }

  const policy = listing.cancellationPolicy ? POLICY_INFO[listing.cancellationPolicy] : null;
  return (
    <main className="mx-auto max-w-page px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumb items={crumbs} />
      <h1 className="text-2xl font-bold sm:text-3xl">{listing.pricingModel === 'quote' ? 'Pedir orçamento' : 'Solicitar serviço'}</h1>
      <ol className="mt-5 flex flex-wrap gap-2" aria-label="Etapas">
        {STEPS.map((name, index) => (
          <li key={name} aria-current={index === step ? 'step' : undefined} className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${index === step ? 'bg-gradient-primary font-semibold text-white' : index < step ? 'bg-success-soft text-success' : 'bg-surface-muted text-ink-muted'}`}>
            <span aria-hidden="true" className="font-bold">{index < step ? '✓' : index + 1}</span>{name}{index < step && <span className="sr-only"> (concluída)</span>}
          </li>
        ))}
      </ol>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {step === 0 && (
            <Card>
              <h2 className="text-lg font-semibold">Revise o seu pedido</h2>
              <dl className="mt-4 divide-y divide-line text-sm">
                {[['Serviço', listing.title], ['Profissional', listing.owner.name], ['Data', formatDay(date, { dateStyle: 'full' })], ...(selection.time ? [['Horário', `${selection.time} às ${fromMinutes(toMinutes(selection.time) + quantity * 60)} (${quantity} ${UNIT.hourly[quantity === 1 ? 0 : 1]})`]] : []), ...(listing.pricingModel === 'daily' ? [['Dias', String(quantity)]] : []), ...(selection.packageName ? [['Pacote', selection.packageName]] : []), ['Atendimento', MODE_LABELS[selection.mode]], ['Valor total', calc.total != null ? formatMoney(calc.total) : 'Combinado com o profissional']].map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-3"><dt className="text-ink-muted">{label}</dt><dd className="text-right font-medium">{value}</dd></div>)}
              </dl>
              <p className="mt-4 text-sm"><Link to={`/anuncios/${uuid}#disponibilidade`} className="font-medium text-primary-strong underline">Alterar data ou horário</Link></p>
            </Card>
          )}
          {step === 1 && (
            <Card className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold">Mensagem ao profissional</h2>
                <p className="mt-1 text-sm text-ink-muted">Conte o que você precisa. Isso agiliza a resposta e evita idas e vindas.</p>
              </div>
              <Textarea label="O que você precisa?" optional rows={5} maxLength={1000} value={message} onChange={(event) => setMessage(event.target.value)} />
              <div>
                <p className="mb-2 text-xs font-medium text-ink-muted">Perguntas úteis (toque para adicionar)</p>
                <div className="flex flex-wrap gap-2">{QUESTIONS.map((question) => <button key={question} type="button" onClick={() => setMessage((current) => `${current}${current && !current.endsWith('\n') ? '\n' : ''}${question} `.slice(0, 1000))} className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft hover:bg-surface-muted">{question}</button>)}</div>
              </div>
              <ImageUploader variant="gallery" purpose="message" max={5} value={photos} onChange={setPhotos} label="Fotos de referência (opcional)" hint="Mostre o local, o problema ou um exemplo do resultado que você quer." onBusyChange={setUploading} />
            </Card>
          )}
          {step === 2 && (
            <Card className="space-y-4">
              <h2 className="text-lg font-semibold">Como funciona o pagamento</h2>
              <ul className="space-y-3 text-sm leading-6 text-ink-soft">
                <li className="flex gap-3"><span aria-hidden="true">1️⃣</span><span>O pedido só é confirmado <strong>quando o profissional aceitar</strong>. Até lá, nada é cobrado.</span></li>
                <li className="flex gap-3"><span aria-hidden="true">2️⃣</span><span>Depois do aceite, você paga {calc.total != null ? <strong>{formatMoney(calc.total)}</strong> : 'o valor combinado'} direto ao profissional, pelo método que ele aceita: <strong>Pix</strong> (com QR Code e “copia e cola”), dinheiro ou cartão na maquininha, presencialmente.</span></li>
                <li className="flex gap-3"><span aria-hidden="true">3️⃣</span><span>O profissional confirma o recebimento e o Dommos gera o seu <strong>recibo</strong>.</span></li>
              </ul>
              <p className="rounded-control bg-info-soft p-3 text-sm text-info"><strong>Dommos em modo gratuito:</strong> o dinheiro não passa pela plataforma. Nunca pague fora do pedido nem a outra pessoa que não seja o profissional do anúncio.</p>
            </Card>
          )}
          {step === 3 && (
            <Card className="space-y-4">
              <h2 className="text-lg font-semibold">Regras e cancelamento</h2>
              {policy && <p className="text-sm leading-6 text-ink-soft"><strong>Política {policy.label.toLowerCase()}.</strong> {policy.text} Depois disso, eventuais custos são combinados direto com o profissional.</p>}
              {listing.requirements && <div><p className="text-sm font-semibold">O que você precisa providenciar</p><p className="mt-1 whitespace-pre-line text-sm leading-6 text-ink-soft">{listing.requirements}</p></div>}
              <label className="flex cursor-pointer items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>Li e aceito as regras do serviço, a política de cancelamento e os <Link to="/termos-de-uso" target="_blank" className="font-medium text-primary-strong underline">termos de uso</Link>.</span></label>
              {error && (
                <div role="alert" className="rounded-control border border-danger-line bg-danger-soft p-3 text-sm text-danger">
                  <p>{error}</p>
                  {conflict && <p className="mt-2"><Button size="sm" variant="secondary" onClick={() => navigate(`/anuncios/${uuid}#disponibilidade`)}>Escolher outra data ou horário</Button></p>}
                </div>
              )}
            </Card>
          )}

          <div className="flex flex-wrap justify-between gap-3">
            <Button variant="secondary" onClick={() => (step === 0 ? navigate(`/anuncios/${uuid}`) : setStep(step - 1))} disabled={busy}>{step === 0 ? 'Voltar ao anúncio' : 'Voltar'}</Button>
            {step < 3 ? <Button onClick={() => setStep(step + 1)} disabled={uploading}>Continuar</Button> : <Button onClick={send} loading={busy} disabled={!accepted}>Enviar solicitação</Button>}
          </div>
        </div>
        <Summary listing={listing} selection={selection} calc={calc} />
      </div>
    </main>
  );
}
