import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { apiError } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { useCreateListing } from '../../hooks/useCreateListing';
import { listingStatus } from '../../utils/status';
import { locationLabel, priceLabel } from '../../utils/listingText';
import StatusBadge from '../../components/StatusBadge';
import { Button, ConfirmDialog, EmptyState, ErrorState, SkeletonList, useToast } from '../../components/ui';

function ListingRow({ listing, busy, onAction }) {
  const place = locationLabel(listing);
  const continueLabel = listing.status === 'draft' ? 'Continuar' : 'Editar';
  const editPath = `/pro/anuncio/${listing.uuid}/etapa/${listing.status === 'draft' ? listing.wizardStep : 10}`;
  return (
    <li className="flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card sm:flex-row">
      <div className="aspect-[16/9] bg-primary-soft sm:aspect-auto sm:w-48 sm:shrink-0">
        {listing.images[0] ? <img src={listing.images[0]} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full min-h-28 items-center justify-center text-sm text-ink-muted">Sem foto</div>}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2"><StatusBadge status={listing.status} map={listingStatus} />{listing.activeOrders > 0 && <span className="text-xs text-ink-muted">{listing.activeOrders} {listing.activeOrders === 1 ? 'pedido em aberto' : 'pedidos em aberto'}</span>}</div>
        <div>
          <h3 className="break-words font-semibold">{listing.title || 'Anúncio sem título'}</h3>
          <p className="mt-1 text-sm text-ink-muted">{[listing.catalogItem?.name, place].filter(Boolean).join(' · ') || 'Rascunho em andamento'}{listing.pricingModel ? ` · ${priceLabel(listing)}` : ''}</p>
          {listing.status === 'draft' && <p className="mt-1 text-xs text-ink-muted">Você parou na etapa {listing.wizardStep} de 10.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" to={editPath}>{continueLabel}</Button>
          {listing.status === 'published' && <Button size="sm" variant="secondary" to={`/anuncios/${listing.uuid}`}>Ver anúncio</Button>}
          {listing.status === 'published' && <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction('pause', listing)}>Pausar</Button>}
          {listing.status === 'paused' && <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction('resume', listing)}>Publicar de novo</Button>}
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction('duplicate', listing)}>Duplicar</Button>
          <Button size="sm" variant="dangerOutline" disabled={busy} onClick={() => onAction('delete', listing)}>Excluir</Button>
        </div>
      </div>
    </li>
  );
}

export default function ProListings() {
  const toast = useToast();
  const navigate = useNavigate();
  const { create, busy: creating } = useCreateListing();
  const resource = useApiResource('/pro/listings', undefined, { keepPrevious: true });
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const listings = resource.data;

  async function run(action, listing) {
    setBusy(true);
    try {
      if (action === 'pause') { await api.post(`/pro/listings/${listing.uuid}/pause`); toast.success('Anúncio pausado. Ele saiu da busca.'); }
      if (action === 'resume') { await api.post(`/pro/listings/${listing.uuid}/publish`); toast.success('Anúncio publicado de novo.'); }
      if (action === 'duplicate') { const { data } = await api.post(`/pro/listings/${listing.uuid}/duplicate`); toast.success('Cópia criada como rascunho.'); navigate(`/pro/anuncio/${data.uuid}/etapa/4`); return; }
      if (action === 'delete') { await api.delete(`/pro/listings/${listing.uuid}`); toast.success('Anúncio excluído.'); }
      setPending(null);
      resource.retry();
    } catch (err) {
      if (action === 'resume' && err.response?.status === 422) {
        toast.error('Faltam informações para publicar. Complete as etapas indicadas.');
        navigate(`/pro/anuncio/${listing.uuid}/etapa/${err.response.data.firstStep ?? 10}`);
        return;
      }
      toast.error(apiError(err, 'Não foi possível concluir a ação.'));
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-xl font-semibold">Meus serviços</h2><p className="text-sm text-ink-muted">Os anúncios que os clientes encontram na busca.</p></div>
        <Button onClick={create} loading={creating}>Novo anúncio</Button>
      </div>
      {!listings && resource.loading ? <SkeletonList count={3} label="Carregando seus serviços" itemClassName="h-40" />
        : resource.error ? <ErrorState title="Não foi possível carregar seus serviços" message={apiError(resource.error)} onRetry={resource.retry} />
          : !listings.length ? <EmptyState icon="list" title="Você ainda não criou nenhum serviço" description="Em poucos passos você monta um anúncio com fotos, preço e disponibilidade." action={<Button onClick={create} loading={creating}>Criar meu primeiro anúncio</Button>} />
            : <ul className="space-y-4">{listings.map((listing) => <ListingRow key={listing.uuid} listing={listing} busy={busy} onAction={(action, item) => (['delete'].includes(action) ? setPending({ action, listing: item }) : run(action, item))} />)}</ul>}
      <p className="mt-6 text-sm text-ink-muted">Clientes também publicam <Link to="/pro/oportunidades" className="font-semibold text-primary-strong underline underline-offset-2">pedidos abertos</Link>: veja em Oportunidades e responda com uma proposta.</p>
      <ConfirmDialog open={!!pending} danger busy={busy} title="Excluir anúncio" confirmLabel="Excluir" message={`O anúncio "${pending?.listing.title || 'sem título'}" será removido. Pedidos já concluídos continuam no seu histórico. Não dá para excluir enquanto houver pedido em aberto.`} onConfirm={() => run('delete', pending.listing)} onCancel={() => setPending(null)} />
    </div>
  );
}
