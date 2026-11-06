import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { apiError } from '../services/api';
import { useAuth } from '../context/useAuth';
import { useApiResource } from '../hooks/useApiResource';
import { Button, Modal, Spinner, controlClass, useToast } from './ui';

function SaveToListModal({ type, uuid, name, onClose, onSaved }) {
  const toast = useToast();
  const resource = useApiResource('/favorites/item', { type, uuid });
  const [created, setCreated] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const lists = resource.data ? [...resource.data.lists, ...created] : null;
  const isChecked = (list) => (list.id in overrides ? overrides[list.id] : list.saved);

  async function createList(event) {
    event.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/favorites/lists', { name: newName.trim() });
      setCreated((current) => [...current, { id: data.id, name: data.name, saved: false }]);
      setOverrides((current) => ({ ...current, [data.id]: true }));
      setNewName('');
    } catch (err) {
      setError(apiError(err, 'Não foi possível criar a lista.'));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.put('/favorites/item', { type, uuid, list_ids: lists.filter(isChecked).map((list) => list.id) });
      toast.success(data.saved ? 'Salvo nos seus favoritos.' : 'Removido dos favoritos.');
      onSaved(data.saved);
      onClose();
    } catch (err) {
      setError(apiError(err, 'Não foi possível salvar.'));
      setBusy(false);
    }
  }

  const loadError = resource.error && apiError(resource.error, 'Não foi possível carregar suas listas.');
  return (
    <Modal open title="Salvar em lista" onClose={onClose} footer={<>
      <Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
      <Button onClick={save} loading={busy} disabled={!lists}>Concluído</Button>
    </>}>
      <p className="mb-4 text-sm text-ink-muted">{name ? `Escolha onde salvar ${name}.` : 'Escolha onde salvar.'}</p>
      {(error || loadError) && <p role="alert" className="mb-4 rounded-control border border-danger-line bg-danger-soft p-3 text-sm text-danger">{error || loadError} {loadError && <button type="button" onClick={resource.retry} className="font-semibold underline">Tentar novamente</button>}</p>}
      {resource.loading && <p role="status" className="flex items-center gap-2 text-sm text-ink-muted"><Spinner />Carregando listas...</p>}
      {lists && (
        <fieldset>
          <legend className="sr-only">Listas</legend>
          <ul className="space-y-1">
            {lists.map((list) => (
              <li key={list.id}>
                <label className="flex min-h-control cursor-pointer items-center gap-3 rounded-control px-2 text-sm hover:bg-surface-muted">
                  <input type="checkbox" className="h-5 w-5" checked={isChecked(list)} onChange={(event) => setOverrides((current) => ({ ...current, [list.id]: event.target.checked }))} />
                  {list.name}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
      <form onSubmit={createList} className="mt-5 flex gap-2 border-t border-line pt-4">
        <label className="sr-only" htmlFor="nova-lista">Nome da nova lista</label>
        <input id="nova-lista" value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={60} placeholder="Nova lista (ex.: Eletricista)" className={controlClass()} />
        <Button type="submit" variant="secondary" disabled={!newName.trim() || busy}>Criar</Button>
      </form>
    </Modal>
  );
}

/** Coração dos cartões. Visitantes são levados ao login e voltam para a mesma página. */
export default function FavoriteButton({ type = 'professional', uuid, name, saved, onChange, className = '' }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  function click(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!user) navigate('/login', { state: { from: location.pathname + location.search } });
    else setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={click}
        aria-label={saved ? `Remover ${name ?? 'item'} dos favoritos` : `Salvar ${name ?? 'item'} nos favoritos`}
        aria-pressed={!!saved}
        className={`flex h-10 w-10 items-center justify-center rounded-full bg-surface/95 shadow-card transition-colors hover:bg-surface ${className}`}
      >
        <svg className={`h-5 w-5 ${saved ? 'text-primary' : 'text-ink-soft'}`} viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20.5s-8-4.9-8-11A4.5 4.5 0 0 1 12 6.6a4.5 4.5 0 0 1 8 2.9c0 6.1-8 11-8 11Z" />
        </svg>
      </button>
      {open && <SaveToListModal type={type} uuid={uuid} name={name} onClose={() => setOpen(false)} onSaved={(value) => onChange?.(value)} />}
    </>
  );
}
