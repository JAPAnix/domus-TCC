// Endereço do serviço: validação e formato enviado à API. O formulário fica em components/AddressForm.jsx.
export const EMPTY_ADDRESS = { postal_code: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' };

export const digits = (value) => value.replace(/\D/g, '');
export const maskCep = (value) => { const d = digits(value).slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };

/** Confere o endereço antes de enviar. Devolve { campo: mensagem } só com o que está errado. */
export function validateAddress(address) {
  const errors = {};
  if (digits(address.postal_code).length !== 8) errors.postal_code = 'Informe o CEP com 8 dígitos.';
  if (!address.street.trim()) errors.street = 'Informe a rua.';
  if (!address.number.trim()) errors.number = 'Informe o número (ou "s/n").';
  if (!address.neighborhood.trim()) errors.neighborhood = 'Informe o bairro.';
  if (!address.city.trim()) errors.city = 'Informe a cidade.';
  if (!/^[A-Za-z]{2}$/.test(address.state.trim())) errors.state = 'Use a sigla do estado, por exemplo SP.';
  return errors;
}

/** Corpo da API: CEP com hífen, estado em maiúsculas, complemento só se existir. */
export function addressPayload(address) {
  return {
    postal_code: maskCep(address.postal_code), street: address.street.trim(), number: address.number.trim(),
    ...(address.complement.trim() && { complement: address.complement.trim() }),
    neighborhood: address.neighborhood.trim(), city: address.city.trim(), state: address.state.trim().toUpperCase(),
  };
}
