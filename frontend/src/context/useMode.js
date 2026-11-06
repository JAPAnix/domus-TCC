import { createContext, useContext } from 'react';

export const ModeContext = createContext(null);

/** Modo ativo da conta: 'client' ("Vou contratar") ou 'professional' ("Vou trabalhar"). */
export function useMode() {
  const context = useContext(ModeContext);
  if (!context) throw new Error('useMode deve ser usado dentro do ModeProvider');
  return context;
}
