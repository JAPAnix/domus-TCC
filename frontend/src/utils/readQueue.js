/**
 * Fila para marcar notificações como lidas sem perder nenhuma: se a rede falhar, tenta de novo depois.
 * Não conhece axios nem o navegador (as peças vêm de fora), por isso é fácil de testar.
 *
 * - post(ids): envia um lote e devolve o número de não lidas que restaram.
 * - onUnread(n): chamado a cada lote que deu certo (o contador do menu atualiza na hora).
 * - wait(ms, fn): agenda a nova tentativa (setTimeout no navegador).
 */
export function createReadQueue({ post, onUnread, wait = (ms, fn) => setTimeout(fn, ms), retryMs = 5000, batch = 100 }) {
  const pending = new Set();
  let running = false;
  let scheduled = false;

  async function flush() {
    if (running || !pending.size) return;
    running = true;
    const ids = [...pending].slice(0, batch);
    try {
      const unread = await post(ids);
      ids.forEach((id) => pending.delete(id));
      onUnread?.(unread);
    } catch (error) {
      const status = error?.response?.status;
      // Erro do pedido (4xx, menos "muitas tentativas"): repetir não adianta. Falha de rede ou do servidor: tenta de novo.
      if (status && status < 500 && status !== 429) ids.forEach((id) => pending.delete(id));
      else if (!scheduled) { scheduled = true; wait(retryMs, () => { scheduled = false; flush(); }); }
    } finally {
      running = false;
    }
    if (pending.size && !scheduled) await flush();
  }

  return {
    enqueue(ids) { ids.forEach((id) => pending.add(String(id))); return flush(); },
    flush,
    get size() { return pending.size; },
  };
}
