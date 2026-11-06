import { useEffect, useId, useRef } from 'react';
import Button from './Button';

const placements = {
  center: 'm-auto w-[calc(100%-2rem)] max-w-lg rounded-panel',
  sheet: 'm-0 mt-auto w-full max-w-none rounded-t-panel sm:m-auto sm:w-[calc(100%-2rem)] sm:max-w-2xl sm:rounded-panel',
  drawer: 'my-0 ml-auto mr-0 h-dvh max-h-none w-[min(22rem,calc(100%-3rem))] rounded-none',
  full: 'm-0 h-dvh max-h-none w-full max-w-none rounded-none',
};

/** Modal sobre <dialog>: captura foco, fecha com Esc e ao clicar no fundo. */
export default function Modal({ open, title, onClose, footer, children, placement = 'center', closeLabel = 'Fechar' }) {
  const dialog = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose?.(); }}
      onClick={(event) => { if (event.target === dialog.current) onClose?.(); }}
      className={`${placements[placement]} max-h-[92dvh] border-0 bg-surface p-0 text-ink shadow-overlay`}
    >
      {open && (
        <div className="flex h-full max-h-[inherit] flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
            <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
            <button type="button" onClick={onClose} aria-label={closeLabel} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-surface-muted">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-3 border-t border-line px-5 py-4">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({ open, title = 'Confirmar ação', message, confirmLabel = 'Confirmar', cancelLabel = 'Voltar', danger = false, busy = false, onConfirm, onCancel }) {
  return (
    <Modal open={open} title={title} onClose={onCancel} footer={<>
      <Button variant="secondary" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
      <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>{confirmLabel}</Button>
    </>}>
      <p className="text-sm leading-6 text-ink-soft">{message}</p>
    </Modal>
  );
}
