import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { createReadQueue } from '../utils/readQueue';

/**
 * Marca a conversa como lida enquanto ela está à vista. Roda ao abrir, quando chega mensagem nova da outra pessoa e
 * quando a aba volta a ficar visível. Se a rede falhar, tenta de novo (e de novo ao reconectar): o contador nunca
 * fica preso por causa de uma falha passageira.
 *
 * `lastIncomingUuid` é a última mensagem da OUTRA pessoa. Antes a leitura só era enviada quando a última mensagem
 * da conversa era dela, então mensagens antigas ficavam "não lidas" se você tivesse respondido por outro lugar.
 */
export function useMarkConversationRead(uuid, lastIncomingUuid, onRead) {
  const [visible, setVisible] = useState(() => !document.hidden);
  const latest = useRef(onRead);
  useEffect(() => { latest.current = onRead; });

  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => { document.removeEventListener('visibilitychange', update); window.removeEventListener('focus', update); };
  }, []);

  useEffect(() => {
    if (!uuid || !lastIncomingUuid || !visible) return undefined;
    let active = true;
    const timers = [];
    const queue = createReadQueue({
      post: async () => { await api.post(`/conversations/${uuid}/read`); return 0; },
      onUnread: () => { if (active) latest.current?.(); },
      wait: (ms, fn) => { timers.push(setTimeout(() => { if (active) fn(); }, ms)); },
    });
    queue.enqueue([uuid]);
    const retryNow = () => queue.flush();
    window.addEventListener('online', retryNow);
    return () => { active = false; timers.forEach(clearTimeout); window.removeEventListener('online', retryNow); };
  }, [uuid, lastIncomingUuid, visible]);
}
