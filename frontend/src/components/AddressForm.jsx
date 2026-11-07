import { useRef, useState } from 'react';
import { Input } from './ui';
import { digits, maskCep } from '../utils/address';

/** Endereço do serviço, com preenchimento automático pelo CEP (ViaCEP, gratuito). Se a consulta falhar, o cliente digita. */
export default function AddressForm({ value, onChange, errors = {}, defaultCity = '', defaultState = '' }) {
  const [lookup, setLookup] = useState('');
  const lastCep = useRef('');

  const set = (name, text) => onChange({ ...value, [name]: text });

  async function onCep(text) {
    const masked = maskCep(text);
    const next = { ...value, postal_code: masked };
    onChange(next);
    const clean = digits(masked);
    if (clean.length !== 8 || lastCep.current === clean) return;
    lastCep.current = clean;
    setLookup('Buscando o endereço...');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${clean}/json/`, { signal: AbortSignal.timeout(6000) });
      const data = await response.json();
      if (data.erro) { setLookup('CEP não encontrado. Preencha o endereço abaixo.'); return; }
      onChange({ ...next, street: next.street || data.logradouro || '', neighborhood: next.neighborhood || data.bairro || '', city: next.city || data.localidade || '', state: next.state || data.uf || '' });
      setLookup('Endereço preenchido. Confira e complete o número.');
    } catch {
      setLookup('Não foi possível buscar o CEP agora. Preencha o endereço abaixo.');
    }
  }

  return (
    <div className="space-y-4">
      <Input label="CEP" name="postal_code" inputMode="numeric" autoComplete="postal-code" value={value.postal_code} onChange={(event) => onCep(event.target.value)} error={errors.postal_code} hint={lookup || 'Preenchemos o resto do endereço pelo CEP.'} />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <Input label="Rua" name="street" autoComplete="address-line1" value={value.street} onChange={(event) => set('street', event.target.value)} error={errors.street} maxLength={120} />
        <Input label="Número" name="number" value={value.number} onChange={(event) => set('number', event.target.value)} error={errors.number} maxLength={20} />
      </div>
      <Input label="Complemento" optional name="complement" autoComplete="address-line2" value={value.complement} onChange={(event) => set('complement', event.target.value)} error={errors.complement} maxLength={80} placeholder="Apartamento, bloco, ponto de referência" />
      <Input label="Bairro" name="neighborhood" value={value.neighborhood} onChange={(event) => set('neighborhood', event.target.value)} error={errors.neighborhood} maxLength={80} />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <Input label="Cidade" name="city" autoComplete="address-level2" value={value.city} onChange={(event) => set('city', event.target.value)} error={errors.city} maxLength={80} placeholder={defaultCity} />
        <Input label="Estado" name="state" autoComplete="address-level1" value={value.state} onChange={(event) => set('state', event.target.value.toUpperCase().slice(0, 2))} error={errors.state} maxLength={2} placeholder={defaultState || 'UF'} />
      </div>
    </div>
  );
}
