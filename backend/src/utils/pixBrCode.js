// Pix "copia e cola" (BR Code, padrão EMV) gerado localmente. Não chama nenhuma API.
// Especificação: Manual de Padrões para Iniciação do Pix, do Banco Central do Brasil.

/** CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF), em hexadecimal maiúsculo com 4 dígitos. */
export function crc16(text) {
  let crc = 0xffff;
  for (const byte of Buffer.from(text, 'utf8')) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const field = (id, value) => `${id}${String(value.length).padStart(2, '0')}${value}`;

/** Remove acentos e caracteres fora do ASCII imprimível, como o padrão exige para nome e cidade. */
export function asciiUpper(value, max) {
  return String(value ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, max);
}

/**
 * Monta o BR Code estático.
 * @param {{ key: string, name: string, city: string, amount?: number|null, description?: string }} data
 * A chave de telefone deve vir no formato +55DDDNÚMERO; CPF e CNPJ, só com dígitos.
 */
export function buildPixBrCode({ key, name, city, amount = null, description = '' }) {
  if (!key) throw new Error('Chave Pix ausente.');
  const merchantName = asciiUpper(name, 25) || 'RECEBEDOR';
  const merchantCity = asciiUpper(city, 15) || 'BRASIL';
  const account = field('00', 'br.gov.bcb.pix') + field('01', key) + (description ? field('02', asciiUpper(description, 40)) : '');
  if (account.length > 99) throw new Error('Chave Pix longa demais para o BR Code.');
  const hasAmount = amount != null && Number(amount) > 0;
  const body = [
    field('00', '01'),
    field('01', '11'),
    field('26', account),
    field('52', '0000'),
    field('53', '986'),
    hasAmount ? field('54', Number(amount).toFixed(2)) : '',
    field('58', 'BR'),
    field('59', merchantName),
    field('60', merchantCity),
    field('62', field('05', '***')),
  ].join('');
  const withCrcId = `${body}6304`;
  return withCrcId + crc16(withCrcId);
}

/** Extrai a chave Pix de dentro do BR Code (campo 26, subcampo 01). */
export function pixKeyFromBrCode(code) {
  try {
    const { fields } = parseBrCode(code);
    const account = fields['26'] ?? '';
    let index = 0;
    while (index < account.length) {
      const id = account.slice(index, index + 2);
      const length = Number(account.slice(index + 2, index + 4));
      if (id === '01') return account.slice(index + 4, index + 4 + length);
      index += 4 + length;
    }
  } catch { /* BR Code inválido */ }
  return null;
}

/** Lê os campos de primeiro nível de um BR Code e confere o CRC. Usado nos testes e em validações. */
export function parseBrCode(code) {
  const fields = {};
  let index = 0;
  while (index < code.length) {
    const id = code.slice(index, index + 2);
    const length = Number(code.slice(index + 2, index + 4));
    if (!/^\d{2}$/.test(id) || !Number.isInteger(length)) throw new Error('BR Code malformado.');
    fields[id] = code.slice(index + 4, index + 4 + length);
    index += 4 + length;
  }
  const crcOk = code.slice(-4) === crc16(code.slice(0, -4));
  return { fields, crcOk };
}
