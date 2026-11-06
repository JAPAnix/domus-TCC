import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/useAuth';

/**
 * Quais itens da página já estão salvos nos favoritos (uma chamada só, para pintar todos os corações).
 * Sem login, nada está salvo. `mark` atualiza um item sem recarregar a lista.
 */
export function useFavoriteStatus(type, uuids) {
  const { user } = useAuth();
  const key = user && uuids.length ? uuids.slice(0, 60).join(',') : '';
  const [state, setState] = useState({ key: '', saved: {} });

  useEffect(() => {
    if (!key) return undefined;
    let active = true;
    api.get('/favorites/status', { params: { type, uuids: key } })
      .then(({ data }) => { if (active) setState({ key, saved: data.saved }); })
      .catch(() => { if (active) setState({ key, saved: {} }); });
    return () => { active = false; };
  }, [type, key]);

  const mark = useCallback((uuid, saved) => setState((current) => ({ ...current, saved: { ...current.saved, [uuid]: saved } })), []);
  const saved = state.key === key ? state.saved : {};
  return { isSaved: (uuid) => !!saved[uuid], mark };
}

/** Igual ao anterior, para listas que misturam profissionais e anúncios (cada item tem `type` e `uuid`). */
export function useFavoriteItems(items) {
  const professionals = useFavoriteStatus('professional', items.filter((item) => item.type === 'professional').map((item) => item.uuid));
  const listings = useFavoriteStatus('listing', items.filter((item) => item.type === 'listing').map((item) => item.uuid));
  const pick = (item) => (item.type === 'listing' ? listings : professionals);
  return { isSaved: (item) => pick(item).isSaved(item.uuid), mark: (item, saved) => pick(item).mark(item.uuid, saved) };
}
