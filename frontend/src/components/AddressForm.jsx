import { useEffect, useRef } from 'react';
import { Input } from './ui';
import { useCepLookup } from '../hooks/useCepLookup';
import { maskCep } from '../utils/cep';

/** Endereço do serviço, com preenchimento automático pelo CEP (ViaCEP, gratuito). Se a consulta falhar, o cliente digita. */
export default function AddressForm({ value, onChange, errors = {}, defaultCity = '', defaultState = '' }) {
  const latest = useRef(value);
  useEffect(() => { latest.current = value; });
  // Preenche só o que ainda está vazio: o que a pessoa já digitou nunca é sobrescrito.
  const { status, lookup } = useCepLookup((found) => {
    const now = latest.current;
    onChange({ ...now, street: now.street || found.street, neighborhood: now.neighborhood || found.neighborhood, city: now.city || found.city, state: now.state || found.state });
  });

  const set = (name, text) => onChange({ ...value, [name]: text });
  function onCep(text) {
    const masked = maskCep(text);
    onChange({ ...value, postal_code: masked });
    lookup(masked);
  }

  return (
    <div className="space-y-4">
      <Input label="CEP" name="postal_code" inputMode="numeric" autoComplete="postal-code" value={value.postal_code} onChange={(event) => onCep(event.target.value)} error={errors.postal_code} hint={status || 'Preenchemos o resto do endereço pelo CEP.'} />
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
