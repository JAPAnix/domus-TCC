import axios from 'axios';

export const SESSION_EXPIRED_EVENT = 'dommos:sessao-expirada';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(undefined, (error) => {
  // Token vencido ou inválido em uma chamada autenticada encerra a sessão local.
  const sentToken = !!error.config?.headers?.Authorization;
  const isCredentialCheck = /\/auth\/(login|google)$/.test(error.config?.url ?? '');
  if (error.response?.status === 401 && sentToken && !isCredentialCheck) {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
  return Promise.reject(error);
});

/** Mensagem legível de um erro da API, incluindo os detalhes de validação. */
export function apiError(error, fallback = 'Não foi possível concluir a ação. Tente novamente.') {
  if (!error.response) return 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.';
  const details = error.response.data?.errors;
  if (Array.isArray(details) && details.length) return details.map((item) => item.message).join(' ');
  return error.response.data?.message || fallback;
}

/** Erros por campo da API, no formato { campo: mensagem }. */
export function apiFieldErrors(error) {
  const details = error.response?.data?.errors;
  return Array.isArray(details) ? Object.fromEntries(details.map((item) => [item.field, item.message])) : {};
}

export default api;
