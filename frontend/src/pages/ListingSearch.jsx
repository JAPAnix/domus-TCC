import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApiResource } from '../hooks/useApiResource';
import { useCategories } from '../hooks/useCategories';
import { useFavoriteStatus } from '../hooks/useFavoriteStatus';
import { apiError } from '../services/api';
import { formatDay } from '../utils/format';
import { MODE_LABELS } from '../utils/listingText';
import ListingCard from '../components/ListingCard';
import Pagination from '../components/Pagination';
import { Button, EmptyState, ErrorState, Input, Modal, Select, SkeletonList } from '../components/ui';

const SORTS = { relevance: 'Mais relevantes', rating: 'Melhor avaliação', price_asc: 'Menor preço', price_desc: 'Maior preço', newest: 'Mais recentes' };

function FilterForm({ filters, onApply, onClear }) {
  const [draft, setDraft] = useState({ precoMin: filters.minPrice, precoMax: filters.maxPrice, nota: filters.minRating, modo: filters.mode });
  const change = (event) => setDraft((current) => ({ ...current, [event.target.name]: event.target.value }));
  return (
    <form onSubmit={(event) => { event.preventDefault(); onApply(draft); }} className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Preço mínimo (R$)" name="precoMin" type="number" min="0" inputMode="decimal" value={draft.precoMin} onChange={change} />
        <Input label="Preço máximo (R$)" name="precoMax" type="number" min="0" inputMode="decimal" value={draft.precoMax} onChange={change} />
      </div>
      <Select label="Avaliação mínima do profissional" name="nota" value={draft.nota} onChange={change}>
        <option value="">Qualquer</option><option value="4">4,0 ou mais</option><option value="4.5">4,5 ou mais</option><option value="4.8">4,8 ou mais</option>
      </Select>
      <Select label="Forma de atendimento" name="modo" value={draft.modo} onChange={change}>
        <option value="">Qualquer</option>
        {Object.entries(MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </Select>
      <p className="text-xs text-ink-muted">Anúncios “sob consulta” não têm preço e não aparecem quando você filtra por preço.</p>
      <div className="flex justify-between gap-3">
        <Button variant="ghost" onClick={onClear}>Limpar filtros</Button>
        <Button type="submit">Mostrar resultados</Button>
      </div>
    </form>
  );
}

export default function ListingSearch() {
  const [params, setParams] = useSearchParams();
  const { categories } = useCategories();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const get = (name) => params.get(name) ?? '';
  const city = get('cidade'), date = get('data'), serviceId = get('serviceId'), serviceName = get('servico'), categoryId = get('categoria');
  const sort = SORTS[get('ordem')] ? get('ordem') : 'relevance';
  const page = Math.max(1, Number(get('pagina')) || 1);
  const filters = { minPrice: get('precoMin'), maxPrice: get('precoMax'), minRating: get('nota'), mode: get('modo') };
  const activeFilters = Object.values(filters).filter(Boolean).length;

  const resource = useApiResource('/listings/search', {
    ...(city && { city }), ...(date && { date }), ...(serviceId && { serviceId }), ...(categoryId && { categoryId }),
    ...(filters.minPrice && { minPrice: filters.minPrice }), ...(filters.maxPrice && { maxPrice: filters.maxPrice }),
    ...(filters.minRating && { minRating: filters.minRating }), ...(filters.mode && { mode: filters.mode }), sort, page,
  }, { keepPrevious: true });
  const listings = resource.data?.data ?? [];
  const favorites = useFavoriteStatus('listing', listings.map((item) => item.uuid));
  const categoryName = categories.find((item) => String(item.id) === categoryId)?.name;
  const total = resource.data?.meta?.total ?? 0;
  const hasTerms = !!(city || date || serviceId || categoryId || activeFilters);
  const heading = serviceName || categoryName || 'Profissionais e serviços';

  function update(changes) {
    const next = new URLSearchParams(params);
    next.delete('pagina');
    for (const [key, value] of Object.entries(changes)) { if (value) next.set(key, value); else next.delete(key); }
    setParams(next);
  }

  return (
    <main className="mx-auto max-w-page px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          {date && <p className="text-sm font-medium text-primary-strong">{formatDay(date, { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
          <h1 className="mt-1 text-2xl font-bold">{heading}{city ? ` em ${city}` : ''}</h1>
          <p className="mt-1 text-sm text-ink-muted" aria-live="polite">{resource.loading ? 'Buscando...' : `${total} ${total === 1 ? 'serviço encontrado' : 'serviços encontrados'}`}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Button variant="secondary" onClick={() => setFiltersOpen(true)}>Filtros{activeFilters ? ` (${activeFilters})` : ''}</Button>
          <Select label="Ordenar por" value={sort} onChange={(event) => update({ ordem: event.target.value === 'relevance' ? '' : event.target.value })} wrapperClassName="min-w-44">
            {Object.entries(SORTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </div>
      </div>

      <Modal open={filtersOpen} title="Filtros" onClose={() => setFiltersOpen(false)} placement="sheet" closeLabel="Fechar filtros">{filtersOpen && <FilterForm filters={filters} onApply={(draft) => { update(draft); setFiltersOpen(false); }} onClear={() => { update({ precoMin: '', precoMax: '', nota: '', modo: '' }); setFiltersOpen(false); }} />}</Modal>

      {!resource.data && resource.loading ? (
        <SkeletonList count={8} label="Carregando serviços" itemClassName="h-72" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" />
      ) : resource.error ? (
        <ErrorState title="Não foi possível carregar os serviços" message={apiError(resource.error)} onRetry={resource.retry} />
      ) : listings.length === 0 ? (
        <EmptyState
          icon="search"
          title="Nenhum serviço encontrado"
          description={hasTerms ? 'Tente outra cidade ou data, ou retire algum filtro. Você também pode publicar um pedido e receber propostas.' : 'Ainda não há anúncios publicados. Publique um pedido e receba propostas de profissionais.'}
          action={<>{hasTerms && <Button variant="secondary" to="/buscar">Ver todos os serviços</Button>}<Button to="/servicos/novo">Publicar um pedido</Button></>}
        />
      ) : (
        <>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {listings.map((item) => <li key={item.uuid}><ListingCard listing={item} saved={favorites.isSaved(item.uuid)} onSavedChange={(value) => favorites.mark(item.uuid, value)} /></li>)}
          </ul>
          <Pagination page={page} pages={resource.data.meta.pages} onChange={(next) => { const updated = new URLSearchParams(params); updated.set('pagina', String(next)); setParams(updated); }} label="Páginas de resultados" />
        </>
      )}
    </main>
  );
}
