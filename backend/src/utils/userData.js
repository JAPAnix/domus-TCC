export function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

// Armazenamos somente DDD + número, sem pontuação. O código +55 informado
// pelo usuário é aceito e removido antes de persistir.
export function normalizeBrazilianPhone(value) {
  if (value == null || value === '') return null;

  let digits = String(value).replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }

  if (!/^[1-9]\d{9,10}$/.test(digits)) {
    throw new Error('Telefone inválido. Informe DDD e número, por exemplo (11) 99999-8888.');
  }

  return digits;
}

export function normalizeOptionalText(value) {
  if (value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized || null;
}

export function normalizeCity(value) {
  if (value === undefined) return undefined;
  const normalized = String(value).trim().replace(/\s+/g, ' ');
  return normalized || null;
}

export function normalizeState(value) {
  if (value === undefined) return undefined;
  const normalized = String(value).trim().toUpperCase();
  return normalized || null;
}
