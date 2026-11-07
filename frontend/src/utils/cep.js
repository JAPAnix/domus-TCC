// Consulta de CEP (ViaCEP, gratuito). Uso compartilhado por todos os formulários de endereço.
export const digitsOf = (value) => String(value ?? '').replace(/\D/g, '');
export const maskCep = (value) => { const d = digitsOf(value).slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };

/**
 * Busca o endereço de um CEP de 8 dígitos. Devolve { street, neighborhood, city, state }, ou null se o CEP não existe.
 * Lança erro se a consulta falhar (rede, tempo esgotado ou resposta inválida): quem chama deixa o usuário digitar.
 * Só o CEP sai do navegador, sem cookies nem referência da página.
 */
export async function lookupCep(cep, { signal } = {}) {
  const digits = digitsOf(cep);
  if (digits.length !== 8) return null;
  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error('lookup-failed');
  const data = await response.json();
  if (data.erro) return null;
  if (typeof data.localidade !== 'string' || !data.localidade.trim() || !/^[A-Z]{2}$/.test(data.uf ?? '')) throw new Error('invalid-address-response');
  const clean = (text) => (typeof text === 'string' ? text.trim() : '');
  return { street: clean(data.logradouro), neighborhood: clean(data.bairro), city: clean(data.localidade), state: data.uf };
}
