import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';

/** Quantidade de notificações não lidas, atualizada enquanto a aba está visível. */
export function useUnreadNotifications(enabled) {
  const [count, setCount] = useState(0);
  const { pathname } = useLocation();

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (document.hidden || pending) return;
      pending = true;
      try {
        const { data } = await api.get('/notifications');
        if (active) setCount(data.unread);
      } catch {
        // Falha temporária: mantém o último valor e tenta de novo no próximo ciclo.
      } finally {
        pending = false;
      }
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener('notifications-read', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('notifications-read', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [enabled, pathname]);

  return enabled ? count : 0;
}
