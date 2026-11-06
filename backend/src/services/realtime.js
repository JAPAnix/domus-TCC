import { WebSocketServer } from 'ws';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { logger } from '../utils/logger.js';

/**
 * Tempo real das mensagens: WebSocket no próprio servidor Express (gratuito, sem serviço externo).
 * O navegador conecta em /ws e, na primeira mensagem, envia o token; sem isso o socket é fechado em 5 segundos.
 * Se o WebSocket cair ou não estiver disponível (hospedagem que não suporta), as telas voltam a consultar a API a cada
 * poucos segundos: tudo continua funcionando, só com um pequeno atraso.
 */
const sockets = new Map(); // id do usuário -> sockets autenticados
let typingHandler = null;

export const isOnline = (userId) => (sockets.get(String(userId))?.size ?? 0) > 0;

/** Envia um evento a todos os dispositivos conectados dos usuários indicados. */
export function publish(userIds, payload) {
  const text = JSON.stringify(payload);
  for (const id of new Set(userIds.map(String))) {
    for (const socket of sockets.get(id) ?? []) {
      if (socket.readyState === 1) socket.send(text);
    }
  }
}

/** O serviço de mensagens registra aqui como tratar "digitando" (precisa checar a conversa no banco). */
export const onTyping = (handler) => { typingHandler = handler; };

function allowedOrigins() {
  return ['http://localhost:5173', 'http://127.0.0.1:5173', process.env.FRONTEND_URL].filter(Boolean);
}

export function attachRealtime(server) {
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4 * 1024 });

  wss.on('connection', (socket, request) => {
    const origin = request.headers.origin;
    if (origin && !allowedOrigins().includes(origin)) { socket.close(4403, 'origem não permitida'); return; }

    let userId = null;
    let burst = { count: 0, since: Date.now() };
    let lastTyping = 0;
    socket.isAlive = true;
    const authTimer = setTimeout(() => { if (!userId) socket.close(4401, 'autenticação necessária'); }, 5000);

    socket.on('pong', () => { socket.isAlive = true; });
    socket.on('message', async (raw) => {
      const now = Date.now();
      if (now - burst.since > 10000) burst = { count: 0, since: now };
      if (++burst.count > 30) { socket.close(4429, 'muitas mensagens'); return; }
      let message;
      try { message = JSON.parse(raw.toString()); } catch { return; }
      if (!message || typeof message.type !== 'string') return;

      if (message.type === 'auth') {
        if (userId) return;
        const { user } = await authenticateToken(message.token);
        if (!user) { socket.close(4401, 'token inválido'); return; }
        userId = String(user.id);
        clearTimeout(authTimer);
        if (!sockets.has(userId)) sockets.set(userId, new Set());
        sockets.get(userId).add(socket);
        socket.send(JSON.stringify({ type: 'ready' }));
        return;
      }
      if (!userId) { socket.close(4401, 'autenticação necessária'); return; }
      if (message.type === 'typing' && typeof message.conversation === 'string' && now - lastTyping > 1500) {
        lastTyping = now;
        try { await typingHandler?.(BigInt(userId), message.conversation); } catch (err) { logger.error('realtime.typing', err); }
      }
    });
    socket.on('close', () => {
      clearTimeout(authTimer);
      if (userId) { sockets.get(userId)?.delete(socket); if (!sockets.get(userId)?.size) sockets.delete(userId); }
    });
    socket.on('error', () => socket.terminate());
  });

  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!socket.isAlive) { socket.terminate(); continue; }
      socket.isAlive = false;
      socket.ping();
    }
  }, 30000);
  heartbeat.unref();
  wss.on('close', () => clearInterval(heartbeat));
  return wss;
}
