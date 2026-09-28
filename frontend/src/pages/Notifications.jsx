import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
export default function Notifications() {
  const [page, setPage] = useState(1);
  return <main className="mx-auto min-h-screen max-w-3xl px-4 py-10"><h1 className="mb-6 text-2xl font-bold">Notificações</h1><NotificationList key={page} page={page} setPage={setPage} /></main>;
}
function NotificationList({ page, setPage }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    const load = () => api.get('/notifications', { params: { page } }).then(({ data }) => { if (active) { setResult(data); setError(''); } }).catch(() => { if (active) setError('Não foi possível carregar as notificações.'); });
    load(); const timer = setInterval(load, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [page, retry]);
  async function open(item) {
    try {
      await api.patch('/notifications/'+item.id+'/read');
      window.dispatchEvent(new Event('notifications-read'));
      navigate(item.href);
    } catch { setError('Não foi possível abrir a notificação. Tente novamente.'); }
  }
  return <>
    {error && <div role="alert" className="mb-4 rounded-xl bg-red-50 p-4">{error} <button onClick={() => setRetry(value => value+1)} className="text-violet-700">Tentar novamente</button></div>}
    {!result && !error && <p role="status">Carregando...</p>}
    {result && <>
      {!result.data.length && <p className="rounded-xl border p-8 text-center text-slate-500">Você ainda não tem notificações.</p>}
      <ul className="space-y-3">{result.data.map(item => <li key={item.id}><button onClick={() => open(item)} className={'w-full rounded-xl border p-5 text-left hover:border-violet-400 '+(item.readAt ? 'bg-white' : 'border-violet-200 bg-violet-50')}>
        {!item.readAt && <span className="mb-1 block text-xs font-semibold text-violet-700">Nova</span>}
        <p>{item.message}</p><time className="mt-2 block text-xs text-slate-500">{new Date(item.createdAt).toLocaleString('pt-BR')}</time>
      </button></li>)}</ul>
      {result.pages > 1 && <nav aria-label="Paginação" className="mt-5 flex justify-between"><button disabled={page===1} onClick={() => setPage(page-1)}>Anterior</button><span>{page} de {result.pages}</span><button disabled={page>=result.pages} onClick={() => setPage(page+1)}>Próxima</button></nav>}
    </>}
  </>;
}
