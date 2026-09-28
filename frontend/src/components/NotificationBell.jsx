import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
export default function NotificationBell({ api }) {
  const [count, setCount] = useState(0);
  const [failed, setFailed] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (document.hidden || pending) return;
      pending = true;
      try {
        const { data } = await api.get('/notifications');
        if (active) { setCount(data.unread); setFailed(false); }
      } catch { if (active) setFailed(true); }
      finally { pending = false; }
    };
    refresh();
    const timer = setInterval(refresh, 10000);
    window.addEventListener('notifications-read', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false; clearInterval(timer);
      window.removeEventListener('notifications-read', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [api, pathname]);
  const label = failed ? 'Não foi possível atualizar as notificações. Clique para abrir.' : 'Notificações: '+count+' não lidas';
  return <Link to="/notificacoes" title={label} aria-label={label} className="relative rounded-full border border-slate-200 p-2 text-violet-700">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
    {failed ? <span className="absolute -right-2 -top-2 rounded-full bg-amber-500 px-1.5 text-xs text-white">!</span> : count > 0 && <span className="absolute -right-2 -top-2 rounded-full bg-violet-600 px-1.5 text-xs text-white">{count > 99 ? '99+' : count}</span>}
  </Link>;
}
