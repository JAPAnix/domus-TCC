const digitsOf = (value) => String(value ?? '').replace(/\D/g, '');

/** Confere só os dígitos verificadores. Não consulta a Receita nem prova que o documento é da pessoa. */
export function isValidCpf(value) {
  const digits = digitsOf(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  for (const length of [9, 10]) {
    const sum = [...digits.slice(0, length)].reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    const remainder = sum % 11;
    if (Number(digits[length]) !== (remainder < 2 ? 0 : 11 - remainder)) return false;
  }
  return true;
}

export function isValidCnpj(value) {
  const digits = digitsOf(value);
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;
  const check = (length) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = [...digits.slice(0, length)].reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return check(12) === Number(digits[12]) && check(13) === Number(digits[13]);
}

export function onlyDigits(value) {
  return digitsOf(value);
}

export function maskDocument(type, digits) {
  if (!digits) return null;
  if (type === 'cnpj') return `••.•••.•••/••••-${digits.slice(-2)}`;
  return `•••.•••.•••-${digits.slice(-2)}`;
}

export function maskPayoutKey(type, key) {
  if (!key) return null;
  if (type === 'cpf' || type === 'cnpj') return maskDocument(type, digitsOf(key));
  if (type === 'email') {
    const [name, domain] = key.split('@');
    return `${name[0]}•••@${domain}`;
  }
  if (type === 'phone') return `•••••${key.slice(-4)}`;
  return `${key.slice(0, 4)}••••••••`;
}
