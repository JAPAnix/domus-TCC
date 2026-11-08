import { useEffect, useState } from 'react';
import api from '../services/api';

export const NOTIFICATIONS_CHANGED = 'notifications-read';
const STORAGE_KEY = 'dommos:notificacoes';

/**
 * Avisa o resto do site (e as outras abas) que o número de notificações não lidas mudou.
 * Com `unread` o contador atualiza na hora, sem esperar a próxima consulta.
 */
export function announceNotifications(unread) {
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED, { detail: { unread } }));
  try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch { /* sem armazenamento: as outras abas atualizam na próxima consulta */ }
}

/**
 * Quantidade de notificações não lidas (contador do menu). Consulta o servidor a cada 15 segundos com a aba visível,
 * ao voltar para a aba, ao reconectar e quando outra aba marca algo como lido. Zero some do menu.
 */
export function useUnreadNotifications(enabled) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (document.hidden || pending) return;
      pending = true;
      try {
        const { data } = await api.get('/notifications/unread-count');
        if (active) setCount(data.count);
      } catch {
        // Falha temporária: mantém o último valor e tenta de novo no próximo ciclo.
      } finally {
        pending = false;
      }
    };
    const onChanged = (event) => {
      if (typeof event.detail?.unread === 'number' && active) setCount(event.detail.unread);
      else refresh();
    };
    const onStorage = (event) => { if (event.key === STORAGE_KEY) refresh(); };
    refresh();
    const timer = setInterval(refresh, 15000);
    window.addEventListener(NOTIFICATIONS_CHANGED, onChanged);
    window.addEventListener('storage', onStorage);
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_CHANGED, onChanged);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [enabled]);

  return enabled ? count : 0;
}
