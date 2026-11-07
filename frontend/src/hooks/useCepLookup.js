import { useCallback, useEffect, useRef, useState } from 'react';
import { digitsOf, lookupCep } from '../utils/cep';

/**
 * Ao completar o CEP (8 dígitos), busca o endereço e chama onFound({ street, neighborhood, city, state }).
 * `status` traz a mensagem para mostrar ao usuário (buscando, encontrado, não encontrado, falha).
 * Uma busca nova cancela a anterior e a resposta de um CEP antigo nunca sobrescreve um CEP mais novo.
 */
export function useCepLookup(onFound) {
  const [status, setStatus] = useState('');
  const request = useRef(null);
  const handler = useRef(onFound);
  useEffect(() => { handler.current = onFound; });
  useEffect(() => () => request.current?.abort(), []);

  const lookup = useCallback(async (cep) => {
    request.current?.abort();
    if (digitsOf(cep).length !== 8) { setStatus(''); return; }
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 8000);
    setStatus('Buscando o endereço...');
    try {
      const address = await lookupCep(cep, { signal: controller.signal });
      if (controller !== request.current) return;
      if (!address) { setStatus('CEP não encontrado. Confira o número ou preencha o endereço abaixo.'); return; }
      handler.current(address);
      setStatus('Endereço preenchido. Confira e complete o número.');
    } catch {
      if (controller === request.current) setStatus('Não foi possível buscar o CEP agora. Preencha o endereço abaixo.');
    } finally { clearTimeout(timeout); }
  }, []);

  return { status, lookup };
}
