import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { apiError } from '../services/api';
import { useAuth } from '../context/useAuth';
import { useApiResource } from '../hooks/useApiResource';
import { useFavoriteStatus } from '../hooks/useFavoriteStatus';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import BookingCard from '../components/BookingCard';
import { priceBreakdown, selectionHint } from '../utils/bookingPrice';
import InnerNav, { MobileBookingBar } from '../components/listing/InnerNav';
import { priceLabel } from '../utils/listingText';
import FavoriteButton from '../components/FavoriteButton';
import ListingView from '../components/ListingView';
import { Breadcrumb, Button, EmptyState, ErrorState, Skeleton, useToast } from '../components/ui';

export default function ListingPage() {
  const { uuid } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const resource = useApiResource(`/listings/${uuid}`);
  const listing = resource.data;
  const [selection, setSelection] = useState({ date: null, time: null, quantity: null, mode: null, packageName: '' });
  const onSelect = (partial) => setSelection((current) => ({ ...current, ...partial }));
  // Valores padrão que dependem do anúncio: primeira forma de atendimento e 1 hora/dia nos modelos por hora e por diária.
  const effective = listing ? { ...selection, mode: selection.mode ?? listing.serviceModes[0], quantity: selection.quantity ?? (['hourly', 'daily'].includes(listing.pricingModel) ? 1 : null) } : selection;

  function request() {
    const problem = selectionHint(listing, effective);
    if (problem) {
      document.getElementById('disponibilidade')?.scrollIntoView({ behavior: 'smooth' });
      toast.error(`${problem}.`);
      return;
    }
    const query = new URLSearchParams({ data: effective.date, modo: effective.mode, ...(effective.time && { hora: effective.time }), ...(effective.quantity && { qtd: String(effective.quantity) }), ...(effective.packageName && { pacote: effective.packageName }) });
    navigate(`/anuncios/${uuid}/solicitar?${query}`);
  }
  const tracked = !!listing && !listing.isOwner;
  const place = listing ? [listing.city, listing.state].filter(Boolean).join(', ') : '';
  useDocumentMeta({
    title: listing ? listing.title : resource.error ? 'Anúncio não encontrado' : 'Anúncio',
    description: listing ? `${listing.description.slice(0, 150).trim()}${listing.description.length > 150 ? '…' : ''}` : undefined,
    image: listing?.images?.[0],
    // Dados estruturados (schema.org) só com informações reais do anúncio.
    jsonLd: listing && listing.status === 'published' ? {
      '@context': 'https://schema.org', '@type': 'Service', name: listing.title, description: listing.description,
      ...(listing.images?.length && { image: listing.images }), ...(listing.category?.name && { serviceType: listing.category.name }),
      provider: { '@type': 'Person', name: listing.owner.name },
      ...(place && { areaServed: { '@type': 'City', name: place } }),
      ...(listing.price != null && { offers: { '@type': 'Offer', price: listing.price, priceCurrency: 'BRL', url: window.location.href } }),
      ...(listing.owner.reviews > 0 && { aggregateRating: { '@type': 'AggregateRating', ratingValue: listing.owner.rating, reviewCount: listing.owner.reviews } }),
    } : null,
  });
  const status = useFavoriteStatus('listing', tracked ? [uuid] : []);

  // Registra a visita para a lista automática "Vistos recentemente".
  useEffect(() => {
    if (user && tracked) api.post('/favorites/recent', { type: 'listing', uuid }).catch(() => {});
  }, [user, tracked, uuid]);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: listing.title, url });
      else { await navigator.clipboard.writeText(url); toast.success('Link copiado.'); }
    } catch (err) {
      if (err?.name !== 'AbortError') toast.error('Não foi possível copiar. Copie o endereço na barra do navegador.');
    }
  }

  const crumbs = [{ label: 'Buscar', to: '/buscar' }, ...(listing?.category ? [{ label: listing.category.name, to: `/buscar?categoria=${listing.category.id}` }] : []), { label: listing?.title ?? 'Anúncio' }];
  return (
    <main className="mx-auto max-w-page px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumb items={crumbs} />
      {resource.loading ? (
        <div role="status" aria-label="Carregando anúncio" className="space-y-4"><Skeleton className="aspect-[16/7] w-full rounded-card" /><Skeleton className="h-10 w-2/3" /><Skeleton className="h-40 w-full rounded-card" /></div>
      ) : resource.error ? (
        resource.error.response?.status === 404
          ? <EmptyState as="h1" icon="search" title="Anúncio não encontrado" description="Ele pode ter sido pausado ou removido pelo profissional." action={<Button to="/buscar">Buscar profissionais</Button>} />
          : <ErrorState title="Não foi possível carregar o anúncio" message={apiError(resource.error)} onRetry={resource.retry} />
      ) : (
        <ListingView
          listing={listing}
          selection={effective}
          onSelect={onSelect}
          aside={<BookingCard listing={listing} selection={effective} onSelect={onSelect} onRequest={request} user={user} />}
          actions={(
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={share}>Compartilhar</Button>
              {!listing.isOwner && <FavoriteButton type="listing" uuid={uuid} name={listing.title} saved={status.isSaved(uuid)} onChange={(value) => status.mark(uuid, value)} className="border border-line" />}
            </div>
          )}
        />
      )}
      {listing && !listing.isOwner && (
        <>
          <InnerNav price={priceLabel(listing)} rating={listing.owner.rating} reviews={listing.owner.reviews} onRequest={request} />
          <MobileBookingBar
            price={priceBreakdown(listing, effective).total != null ? `${priceLabel(listing)} · total ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(priceBreakdown(listing, effective).total)}` : priceLabel(listing)}
            hint={selectionHint(listing, effective)} onRequest={request} label={listing.pricingModel === 'quote' ? 'Pedir orçamento' : 'Solicitar'}
          />
        </>
      )}
    </main>
  );
}
