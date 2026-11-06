import { useEffect, useRef, useState } from 'react';

/** Painel suspenso: fecha com Esc, clique fora ou quando `close()` é chamado. */
export default function Dropdown({ trigger, children, align = 'right', panelClassName = 'w-72' }) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => { if (!wrapper.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      wrapper.current?.querySelector('button')?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapper} className="relative">
      {trigger({ open, toggle: () => setOpen((value) => !value) })}
      {open && (
        <div className={`absolute top-full z-50 mt-2 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-card border border-line bg-surface p-2 shadow-raised ${align === 'right' ? 'right-0' : 'left-0'} ${panelClassName}`}>
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  );
}
