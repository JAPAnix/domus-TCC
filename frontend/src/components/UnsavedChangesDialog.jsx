import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';
import { primaryClass, linkClass } from '../pages/settings/personalFields';

export default function UnsavedChangesDialog({ dirty, busy, allowLeave }) {
  const dialog = useRef(null);
  const blocker = useBlocker(() => !allowLeave.current && (dirty || busy));
  useEffect(() => {
    if (!dirty && !busy) return;
    const handler = (event) => { if (!allowLeave.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, busy, allowLeave]);
  useEffect(() => {
    if (blocker.state === 'blocked') dialog.current?.showModal();
    else dialog.current?.close();
  }, [blocker.state]);
  return <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); blocker.reset?.(); }} aria-labelledby="unsaved-title" aria-describedby="unsaved-description" className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xl backdrop:bg-black/40">
    <h2 id="unsaved-title" className="text-xl font-semibold">{busy ? 'Aguarde a conclusão' : 'Tem certeza de que quer sair?'}</h2>
    <p id="unsaved-description" className="mt-3 text-sm text-[#6B7280]">{busy ? 'Sua solicitação está sendo processada.' : 'Suas alterações ainda não foram salvas.'}</p>
    <div className="mt-6 flex flex-wrap gap-3"><button autoFocus onClick={() => blocker.reset?.()} className={primaryClass}>Continuar editando</button><button disabled={busy} onClick={() => blocker.proceed?.()} className={linkClass}>Sair sem salvar</button></div>
  </dialog>;
}
