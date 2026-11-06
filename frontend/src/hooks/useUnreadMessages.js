import { useEffect, useState } from 'react';
import api from '../services/api';
import { MESSAGES_CHANGED_EVENT, startRealtime, stopRealtime, subscribe } from '../services/realtime';

/**
 * Mensagens não lidas (contador do menu). Também mantém a conexão de tempo real enquanto há alguém logado.
 * Atualiza na hora quando chega um evento e, por garantia, a cada minuto.
 */
export function useUnreadMessages(enabled) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const { data } = await api.get('/conversations/unread-count');
        if (active) setCount(data.count);
      } catch {
        // Falha temporária: mantém o último valor.
      } finally {
        pending = false;
      }
    };
    startRealtime();
    refresh();
    const unsubscribe = subscribe((event) => { if (['message', 'read', 'unread', 'status'].includes(event.type)) refresh(); });
    const timer = setInterval(() => { if (!document.hidden) refresh(); }, 60000);
    window.addEventListener(MESSAGES_CHANGED_EVENT, refresh);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      unsubscribe();
      clearInterval(timer);
      window.removeEventListener(MESSAGES_CHANGED_EVENT, refresh);
      window.removeEventListener('focus', refresh);
      stopRealtime();
    };
  }, [enabled]);

  return enabled ? count : 0;
}
