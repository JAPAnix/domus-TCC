import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiResource } from '../hooks/useApiResource';
import { useFavoriteItems } from '../hooks/useFavoriteStatus';
import api, { apiError } from '../services/api';
import ProfessionalMiniCard from '../components/ProfessionalMiniCard';
import { Button, ConfirmDialog, EmptyState, ErrorState, Input, Modal, SkeletonList, useToast } from '../components/ui';

function ListCard({ list, onRename, onDelete }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <Link to={`/favoritos/${list.id}`} className="block transition-colors hover:bg-surface-muted">
        <div className="aspect-[4/3] bg-primary-soft">
          {list.cover
            ? <img src={list.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
            : <div className="flex h-full items-center justify-center text-primary"><svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 20.5s-8-4.9-8-11A4.5 4.5 0 0 1 12 6.6a4.5 4.5 0 0 1 8 2.9c0 6.1-8 11-8 11Z" /></svg></div>}
        </div>
        <div className="px-4 pt-3">
          <h3 className="truncate font-semibold">{list.name}</h3>
          <p className="text-sm text-ink-muted">{list.count} {list.count === 1 ? 'item salvo' : 'itens salvos'}</p>
        </div>
      </Link>
      <div className="flex gap-1 px-2 pb-2 pt-1">
        <Button variant="ghost" size="sm" onClick={() => onRename(list)}>Renomear</Button>
        <Button variant="ghost" size="sm" onClick={() => onDelete(list)}>Excluir</Button>
      </div>
    </div>
  );
}

function ListNameModal({ title, initial = '', onClose, onSubmit }) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (!name.trim()) { setError('Dê um nome à lista.'); return; }
    setBusy(true);
    try { await onSubmit(name.trim()); onClose(); } catch (err) { setError(apiError(err, 'Não foi possível salvar a lista.')); setBusy(false); }
  }
  return (
    <Modal open title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Nome da lista" value={name} onChange={(event) => { setName(event.target.value); setError(''); }} maxLength={60} error={error} required autoFocus />
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="submit" loading={busy}>Salvar</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function Favorites() {
  const toast = useToast();
  const resource = useApiResource('/favorites', undefined, { keepPrevious: true });
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const recent = resource.data?.recent ?? [];
  const status = useFavoriteItems(recent);

  async function create(name) {
    await api.post('/favorites/lists', { name });
    toast.success('Lista criada.');
    resource.retry();
  }

  async function rename(name) {
    await api.patch(`/favorites/lists/${dialog.list.id}`, { name });
    toast.success('Lista renomeada.');
    resource.retry();
  }

  async function remove() {
    setBusy(true);
    try {
      await api.delete(`/favorites/lists/${dialog.list.id}`);
      toast.success('Lista excluída.');
      resource.retry();
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível excluir a lista.'));
    } finally {
      setBusy(false);
      setDialog(null);
    }
  }

  const lists = resource.data?.lists;
  return (
    <main className="mx-auto max-w-page px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Favoritos</h1>
          <p className="mt-2 text-ink-muted">Salve serviços e profissionais em listas para comparar e contratar depois.</p>
        </div>
        <Button variant="secondary" onClick={() => setDialog({ type: 'create' })}>Criar lista</Button>
      </div>

      {!resource.data && resource.loading ? (
        <SkeletonList count={4} label="Carregando favoritos" itemClassName="h-56" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" />
      ) : resource.error ? (
        <ErrorState title="Não foi possível carregar seus favoritos" message={apiError(resource.error)} onRetry={resource.retry} />
      ) : (
        <div className="space-y-12">
          <section aria-labelledby="listas">
            <h2 id="listas" className="mb-4 text-xl font-semibold">Suas listas</h2>
            {lists.length === 0 ? (
              <EmptyState
                icon="heart"
                title="Você ainda não salvou nada"
                description="Toque no coração de um serviço ou de um profissional para salvá-lo aqui. Você pode organizar tudo em listas, como “Eletricista” ou “Fotografia”."
                action={<><Button to="/buscar">Explorar serviços</Button><Button variant="secondary" onClick={() => setDialog({ type: 'create' })}>Criar lista</Button></>}
              />
            ) : (
              <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {lists.map((list) => <li key={list.id}><ListCard list={list} onRename={(item) => setDialog({ type: 'rename', list: item })} onDelete={(item) => setDialog({ type: 'delete', list: item })} /></li>)}
              </ul>
            )}
          </section>

          <section aria-labelledby="vistos">
            <h2 id="vistos" className="mb-1 text-xl font-semibold">Vistos recentemente</h2>
            <p className="mb-4 text-sm text-ink-muted">Uma lista automática com os perfis que você abriu.</p>
            {recent.length === 0 ? (
              <p className="rounded-card border border-dashed border-line-strong bg-surface px-5 py-8 text-center text-sm text-ink-muted">Nada por aqui ainda. <Link to="/buscar" className="font-semibold text-primary-strong underline underline-offset-2">Explorar serviços</Link></p>
            ) : (
              <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {recent.map((item) => <li key={`${item.type}-${item.uuid}`}><ProfessionalMiniCard item={item} saved={status.isSaved(item)} onSavedChange={(value) => { status.mark(item, value); resource.retry(); }} /></li>)}
              </ul>
            )}
          </section>
        </div>
      )}

      {dialog?.type === 'create' && <ListNameModal title="Criar lista" onClose={() => setDialog(null)} onSubmit={create} />}
      {dialog?.type === 'rename' && <ListNameModal title="Renomear lista" initial={dialog.list.name} onClose={() => setDialog(null)} onSubmit={rename} />}
      <ConfirmDialog
        open={dialog?.type === 'delete'}
        danger
        busy={busy}
        title="Excluir lista"
        confirmLabel="Excluir"
        message={`A lista "${dialog?.list?.name}" será excluída. Os profissionais continuam existindo; só saem desta lista.`}
        onConfirm={remove}
        onCancel={() => setDialog(null)}
      />
    </main>
  );
}
