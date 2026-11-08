import { useEffect, useState } from 'react';
import api from '../services/api';

const DEFAULTS = { openRequests: true, openRequestDefaults: { validityDays: [3, 7, 15, 30], defaultDays: 7, maxProposals: 5, maxPerDay: 5 } };
let cached = null;
let pending = null;

/**
 * Recursos ligados e desligados pelo servidor (hoje: o pedido aberto, que se desliga com OPEN_REQUESTS_ENABLED=false).
 * Enquanto carrega, assume o padrão (ligado); se a consulta falhar, também.
 */
export function useFeatures() {
  const [features, setFeatures] = useState(cached ?? DEFAULTS);
  useEffect(() => {
    if (cached) return undefined;
    let active = true;
    pending ??= api.get('/features').then(({ data }) => { cached = { ...DEFAULTS, ...data }; return cached; }).catch(() => { pending = null; return DEFAULTS; });
    pending.then((value) => { if (active) setFeatures(value); });
    return () => { active = false; };
  }, []);
  return features;
}
