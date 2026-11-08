import api from '../services/api';
import { announceNotifications } from '../hooks/useUnreadNotifications';
import { createReadQueue } from './readQueue';

// Uma fila só para o site inteiro: sobrevive à troca de página e volta a tentar quando a internet volta.
const queue = createReadQueue({
  post: async (ids) => (await api.post('/notifications/read', { ids })).data.unread,
  onUnread: announceNotifications,
});

if (typeof window !== 'undefined') window.addEventListener('online', () => queue.flush());

export const markNotificationsRead = (ids) => queue.enqueue(ids);
