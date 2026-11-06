import { useCallback, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { ModeContext } from './useMode';

const storageKey = (uuid) => `dommos:modo:${uuid}`;

function readStoredMode(uuid) {
  if (!uuid) return 'client';
  try {
    return localStorage.getItem(storageKey(uuid)) === 'professional' ? 'professional' : 'client';
  } catch {
    return 'client';
  }
}

function ModeState({ uuid, canWork, children }) {
  const [stored, setStored] = useState(() => readStoredMode(uuid));

  // Identidade estável: telas que chamam setMode num efeito (ProLayout) não podem rodar de novo a cada troca de modo.
  const setMode = useCallback((next) => {
    setStored(next);
    try {
      if (uuid) localStorage.setItem(storageKey(uuid), next);
    } catch {
      // Sem armazenamento disponível, a escolha vale até recarregar a página.
    }
  }, [uuid]);

  const value = useMemo(() => ({
    // Sem perfil profissional, a conta só pode estar no modo cliente.
    mode: stored === 'professional' && canWork ? 'professional' : 'client',
    setMode,
  }), [stored, canWork, setMode]);

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

/** A escolha é salva por conta neste navegador; trocar de conta recarrega a escolha daquela conta. */
export function ModeProvider({ children }) {
  const { user } = useAuth();
  return (
    <ModeState key={user?.uuid ?? 'visitante'} uuid={user?.uuid} canWork={!!user?.roles?.includes('professional')}>
      {children}
    </ModeState>
  );
}
