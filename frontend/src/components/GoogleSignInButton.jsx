import { useEffect, useRef, useState } from 'react';

const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client';

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  const existing = document.querySelector(`script[src="${GOOGLE_SCRIPT}"]`);
  if (existing) return new Promise((resolve, reject) => {
    existing.addEventListener('load', resolve, { once: true });
    existing.addEventListener('error', reject, { once: true });
  });
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function GoogleSignInButton({ onCredential, disabled }) {
  const containerRef = useRef(null);
  const [error, setError] = useState('');
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || !containerRef.current) return undefined;
    let active = true;
    loadGoogleScript().then(() => {
      if (!active || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: ({ credential }) => onCredential(credential) });
      window.google.accounts.id.renderButton(containerRef.current, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width: 384, locale: 'pt-BR' });
    }).catch(() => active && setError('Não foi possível carregar o login com Google.'));
    return () => { active = false; };
  }, [clientId, onCredential]);

  if (!clientId) return null;
  return <div className={disabled ? 'pointer-events-none opacity-60' : ''}><div ref={containerRef} className="flex justify-center" />{error && <p className="mt-2 text-center text-xs text-red-600">{error}</p>}</div>;
}
