import api from './api';

/**
 * Conexão de tempo real (WebSocket) com o servidor. Uma só para o app inteiro.
 * Se cair, reconecta sozinha com espera crescente. Enquanto estiver fora do ar, as telas consultam a API
 * a cada poucos segundos (ver `isRealtimeOpen`), então nada deixa de funcionar.
 */
const listeners = new Set();
let socket = null;
let open = false;
let wanted = false;
let attempt = 0;
let timer = null;

const emit = (event) => { for (const listener of listeners) listener(event); };

function wsUrl() {
  return String(api.defaults.baseURL).replace(/^http/, 'ws').replace(/\/api\/?$/, '/ws');
}

function connect() {
  const token = localStorage.getItem('token');
  if (!wanted || !token || typeof WebSocket === 'undefined') return;
  try { socket = new WebSocket(wsUrl()); } catch { schedule(); return; }
  socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token }));
  socket.onmessage = (event) => {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    if (data.type === 'ready') { open = true; attempt = 0; emit({ type: 'status', open: true }); return; }
    emit(data);
  };
  socket.onclose = () => {
    const wasOpen = open;
    open = false;
    socket = null;
    if (wasOpen) emit({ type: 'status', open: false });
    schedule();
  };
  socket.onerror = () => socket?.close();
}

function schedule() {
  if (!wanted || timer) return;
  attempt += 1;
  timer = setTimeout(() => { timer = null; connect(); }, Math.min(30000, 1000 * 2 ** Math.min(attempt, 5)));
}

export function startRealtime() {
  if (wanted) return;
  wanted = true;
  connect();
}

export function stopRealtime() {
  wanted = false;
  clearTimeout(timer);
  timer = null;
  attempt = 0;
  const current = socket;
  socket = null;
  if (open) { open = false; emit({ type: 'status', open: false }); }
  current?.close();
}

export const isRealtimeOpen = () => open;

/** Escuta eventos ({ type: 'message' | 'typing' | 'read' | 'unread' | 'status' }). Retorna a função que cancela. */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let lastTypingAt = 0;

/** Avisa que o usuário está digitando (no máximo a cada 3 segundos). Sem tempo real, usa a API. */
export function signalTyping(conversation) {
  const now = Date.now();
  if (now - lastTypingAt < 3000) return;
  lastTypingAt = now;
  if (open && socket?.readyState === 1) socket.send(JSON.stringify({ type: 'typing', conversation }));
  else api.post(`/conversations/${conversation}/typing`).catch(() => {});
}

/** Avisa as telas (por exemplo o contador do menu) que as mensagens mudaram neste navegador. */
export const MESSAGES_CHANGED_EVENT = 'dommos:mensagens';
export const notifyMessagesChanged = () => window.dispatchEvent(new Event(MESSAGES_CHANGED_EVENT));
