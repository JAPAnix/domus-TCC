import { useEffect, useState } from 'react';
import api from '../services/api';
import { NOTIFICATIONS_CHANGED } from './useUnreadNotifications';

const NONE = { proNew: 0, clientToDecide: 0, opportunities: 0 };

/**
 * Números dos menus de pedidos: pedidos novos esperando o profissional e propostas esperando decisão do cliente.
 * Consulta a cada 30 s com a aba visível, ao voltar para a aba, ao reconectar e quando chega uma notificação nova.
 * Se a consulta falhar, mantém o último valor e tenta de novo no próximo ciclo.
 */
export function useOrderBadges(enabled) {
  const [badges, setBadges] = useState(NONE);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (document.hidden || pending) return;
      pending = true;
      try {
        const { data } = await api.get('/orders/badges');
        if (active) setBadges({ proNew: data.proNew ?? 0, clientToDecide: data.clientToDecide ?? 0, opportunities: data.opportunities ?? 0 });
      } catch {
        // Falha temporária: o último valor continua valendo.
      } finally {
        pending = false;
      }
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [enabled]);

  return enabled ? badges : NONE;
}
