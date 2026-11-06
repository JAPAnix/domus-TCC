import { useSyncExternalStore } from 'react';

const KEY = 'dommos:tema';
const listeners = new Set();

const current = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };

/** Tema claro ou escuro. A escolha fica neste navegador; sem escolha, segue o do sistema (definido antes da primeira pintura, em index.html). */
export function setTheme(next) {
  if (next === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
  try { localStorage.setItem(KEY, next); } catch { /* sem armazenamento: vale até recarregar */ }
  listeners.forEach((listener) => listener());
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, current, () => 'light');
  return { theme, dark: theme === 'dark', setTheme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') };
}
