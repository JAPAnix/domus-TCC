import { createContext, useContext } from 'react';

export const ToastContext = createContext(null);

/** Uso: const toast = useToast(); toast.success('Salvo.'); toast.error('Falhou.'); */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast deve ser usado dentro do ToastProvider');
  return context;
}
