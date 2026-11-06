import { useCallback, useMemo, useRef, useState } from 'react';
import { ToastContext } from './toastContext';

const tones = {
  success: { box: 'border-success-line bg-success-soft text-success', icon: '✓' },
  error: { box: 'border-danger-line bg-danger-soft text-danger', icon: '!' },
  info: { box: 'border-info-line bg-info-soft text-info', icon: 'i' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const show = useCallback((type, text) => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((current) => [...current.slice(-2), { id, type, text }]);
    setTimeout(() => dismiss(id), type === 'error' ? 7000 : 4000);
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (text) => show('success', text),
    error: (text) => show('error', text),
    info: (text) => show('info', text),
  }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-[calc(var(--spacing-bottom-nav)+1rem)] z-[70] flex flex-col items-center gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:items-end">
        {toasts.map((toast) => (
          <div key={toast.id} role={toast.type === 'error' ? 'alert' : 'status'} className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-control border px-4 py-3 text-sm font-medium shadow-raised ${tones[toast.type].box}`}>
            <span aria-hidden="true" className="font-bold">{tones[toast.type].icon}</span>
            <span className="flex-1">{toast.text}</span>
            <button type="button" onClick={() => dismiss(toast.id)} aria-label="Fechar aviso" className="-m-1 rounded p-1 leading-none">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
