import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

/**
 * GET com estados de carregando e erro, cancelando a resposta de requisições antigas.
 * Passe url = null para não buscar. Com keepPrevious, os dados anteriores continuam
 * na tela durante uma nova busca (bom para atualizar depois de uma ação).
 */
export function useApiResource(url, params, { keepPrevious = false } = {}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const key = url ? JSON.stringify([url, params ?? null, attempt]) : null;

  useEffect(() => {
    if (!key) return undefined;
    const [path, query] = JSON.parse(key);
    const controller = new AbortController();
    api.get(path, { params: query ?? undefined, signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setResult({ key, data }); })
      .catch((error) => { if (!controller.signal.aborted) setResult({ key, error }); });
    return () => controller.abort();
  }, [key]);

  const current = result?.key === key;
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return {
    data: current ? result.data ?? null : keepPrevious ? result?.data ?? null : null,
    error: current ? result.error ?? null : null,
    loading: !!key && !current,
    retry,
  };
}
