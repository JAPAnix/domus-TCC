import { useEffect, useRef, useState } from 'react';
import { useApiResource } from '../../hooks/useApiResource';
import { useFavoriteStatus } from '../../hooks/useFavoriteStatus';
import ListingCard from '../ListingCard';
import { Button } from '../ui';

/** Carrossel de cartões com setas e indicador de página (1/2). */
function Carousel({ title, items }) {
  const track = useRef(null);
  const [state, setState] = useState({ page: 1, pages: 1 });
  const favorites = useFavoriteStatus('listing', items.map((item) => item.uuid));

  useEffect(() => {
    const node = track.current;
    if (!node) return undefined;
    const update = () => setState({ page: Math.round(node.scrollLeft / node.clientWidth) + 1, pages: Math.max(1, Math.ceil(node.scrollWidth / node.clientWidth - 0.05)) });
    update();
    node.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { node.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [items.length]);

  const move = (direction) => track.current?.scrollBy({ left: direction * track.current.clientWidth, behavior: 'smooth' });
  return (
    <section aria-label={title} className="mt-8 first:mt-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-muted" aria-live="polite">{state.page}/{state.pages}</span>
          <Button variant="secondary" size="sm" onClick={() => move(-1)} disabled={state.page <= 1} aria-label={`${title}: anterior`}>‹</Button>
          <Button variant="secondary" size="sm" onClick={() => move(1)} disabled={state.page >= state.pages} aria-label={`${title}: próximos`}>›</Button>
        </div>
      </div>
      <ul ref={track} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none]" tabIndex={0} aria-label={`${title}, role para o lado para ver mais`}>
        {items.map((item) => <li key={item.uuid} className="w-[70%] shrink-0 snap-start sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.7rem)]"><ListingCard listing={item} saved={favorites.isSaved(item.uuid)} onSavedChange={(value) => favorites.mark(item.uuid, value)} /></li>)}
      </ul>
    </section>
  );
}

function Group({ title, params }) {
  const resource = useApiResource('/listings/search', { ...params, limit: 12 });
  const items = resource.data?.data ?? [];
  if (!items.length) return null;
  return <Carousel title={title} items={items} />;
}

/** "Mais serviços do profissional" e "Serviços parecidos na sua região". Some sozinho quando não há o que mostrar. */
export default function RelatedListings({ listing }) {
  return (
    <div>
      <Group title="Mais serviços do profissional" params={{ ownerUuid: listing.owner.uuid, exclude: listing.uuid }} />
      <Group title={listing.city ? `Serviços parecidos em ${listing.city}` : 'Serviços parecidos'} params={{ ...(listing.category && { categoryId: listing.category.id }), ...(listing.city && { city: listing.city }), exclude: listing.uuid }} />
    </div>
  );
}
