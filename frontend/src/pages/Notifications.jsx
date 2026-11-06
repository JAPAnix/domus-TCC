import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiResource } from '../hooks/useApiResource';
import api, { apiError } from '../services/api';
import Pagination from '../components/Pagination';
import { EmptyState, ErrorState, SkeletonList, useToast } from '../components/ui';

export default function Notifications() {
  const [page, setPage] = useState(1);
  const toast = useToast();
  const navigate = useNavigate();
  const resource = useApiResource('/notifications', { page });
  const items = resource.data?.data ?? [];

  async function open(item) {
    try {
      await api.patch(`/notifications/${item.id}/read`);
      window.dispatchEvent(new Event('notifications-read'));
      navigate(item.href);
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível abrir a notificação.'));
    }
  }

  return (
    <main className="mx-auto max-w-content px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Notificações</h1>
      {resource.loading ? (
        <SkeletonList count={4} label="Carregando notificações" itemClassName="h-20" className="space-y-3" />
      ) : resource.error ? (
        <ErrorState title="Não foi possível carregar as notificações" message={apiError(resource.error)} onRetry={resource.retry} />
      ) : !items.length ? (
        <EmptyState icon="bell" title="Você ainda não tem notificações" description="Avisaremos aqui quando houver novas propostas, respostas e avaliações." />
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => open(item)} className={`w-full rounded-card border p-4 text-left text-sm transition-colors hover:border-primary ${item.readAt ? 'border-line bg-surface' : 'border-primary-line bg-primary-softer'}`}>
                  {!item.readAt && <span className="mb-1 block text-xs font-semibold text-primary-strong">Nova</span>}
                  <span className="block text-ink">{item.message}</span>
                  <time dateTime={item.createdAt} className="mt-2 block text-xs text-ink-muted">{new Date(item.createdAt).toLocaleString('pt-BR')}</time>
                </button>
              </li>
            ))}
          </ul>
          <Pagination page={page} pages={resource.data?.pages} onChange={setPage} label="Páginas de notificações" />
        </>
      )}
    </main>
  );
}
