import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiResource } from '../hooks/useApiResource';
import { announceNotifications } from '../hooks/useUnreadNotifications';
import api, { apiError } from '../services/api';
import { markNotificationsRead } from '../utils/notificationQueue';
import Pagination from '../components/Pagination';
import { Button, EmptyState, ErrorState, SkeletonList, useToast } from '../components/ui';

const REFRESH_MS = 15000;

export default function Notifications() {
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState(() => new Set()); // as que estavam não lidas nesta visita: seguem destacadas como "Nova"
  const seen = useRef(new Set());
  const toast = useToast();
  const navigate = useNavigate();
  const resource = useApiResource('/notifications', { page }, { keepPrevious: true });
  const items = useMemo(() => resource.data?.data ?? [], [resource.data]);
  const unread = resource.data?.unread ?? 0;
  const { retry } = resource;

  // Abrir a página é ver as notificações: as que aparecem não lidas são marcadas como lidas (o destaque fica só nesta visita).
  useEffect(() => {
    const unseen = items.filter((item) => !item.readAt && !seen.current.has(item.id));
    if (!unseen.length) return undefined;
    const timer = setTimeout(() => {
      const ids = unseen.map((item) => item.id);
      ids.forEach((id) => seen.current.add(id));
      setFresh((current) => new Set([...current, ...ids]));
      markNotificationsRead(ids).then(() => retry());
    }, 1200);
    return () => clearTimeout(timer);
  }, [items, retry]);

  // Notificações que chegam com a página aberta aparecem sozinhas.
  useEffect(() => {
    if (page !== 1) return undefined;
    const timer = setInterval(() => { if (!document.hidden) retry(); }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [page, retry]);

  async function open(item) {
    // Marca como lida (com nova tentativa se a rede falhar) e leva ao destino sem esperar.
    markNotificationsRead([item.id]);
    navigate(item.href);
  }

  async function markAll() {
    setBusy(true);
    try {
      const { data } = await api.post('/notifications/read-all');
      announceNotifications(data.unread);
      setFresh((current) => new Set([...current, ...items.filter((item) => !item.readAt).map((item) => item.id)]));
      retry();
      toast.success('Tudo marcado como lido.');
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível marcar como lidas. Tente de novo.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-content px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">Notificações</h1>
        {unread > 0 && <Button variant="secondary" size="sm" onClick={markAll} loading={busy}>Marcar todas como lidas</Button>}
      </div>
      {!resource.data && resource.loading ? (
        <SkeletonList count={4} label="Carregando notificações" itemClassName="h-20" className="space-y-3" />
      ) : resource.error && !resource.data ? (
        <ErrorState title="Não foi possível carregar as notificações" message={apiError(resource.error)} onRetry={resource.retry} />
      ) : !items.length ? (
        <EmptyState icon="bell" title="Você ainda não tem notificações" description="Avisaremos aqui quando houver novos pedidos, propostas, pagamentos e avaliações." />
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((item) => {
              const isNew = !item.readAt || fresh.has(item.id);
              return (
                <li key={item.id}>
                  <button type="button" onClick={() => open(item)} className={`w-full rounded-card border p-4 text-left text-sm transition-colors hover:border-primary ${isNew ? 'border-primary-line bg-primary-softer' : 'border-line bg-surface'}`}>
                    {isNew && <span className="mb-1 block text-xs font-semibold text-primary-strong">Nova</span>}
                    <span className="block text-ink">{item.message}</span>
                    <time dateTime={item.createdAt} className="mt-2 block text-xs text-ink-muted">{new Date(item.createdAt).toLocaleString('pt-BR')}</time>
                  </button>
                </li>
              );
            })}
          </ul>
          <Pagination page={page} pages={resource.data?.pages} onChange={setPage} label="Páginas de notificações" />
        </>
      )}
    </main>
  );
}
