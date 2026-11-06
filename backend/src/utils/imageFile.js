export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const UPLOAD_PURPOSES = ['avatar', 'professional', 'portfolio', 'service', 'message', 'quick_reply'];

/** Identifica a imagem pelo conteúdo do arquivo, sem confiar no nome nem no tipo enviado. */
export function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: 'jpg', mimeType: 'image/jpeg' };
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { extension: 'png', mimeType: 'image/png' };
  }
  if (buffer.length >= 12 && buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP') {
    return { extension: 'webp', mimeType: 'image/webp' };
  }
  return null;
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const KEY_PATTERN = new RegExp(`^${UUID}/(${UPLOAD_PURPOSES.join('|')})/${UUID}(\\.(jpg|png|webp))?$`);

/** A chave precisa ter o formato gerado pelo servidor e estar na pasta do próprio usuário. */
export function isOwnedStorageKey(key, userUuid) {
  return typeof key === 'string' && KEY_PATTERN.test(key) && key.startsWith(`${userUuid}/`);
}
