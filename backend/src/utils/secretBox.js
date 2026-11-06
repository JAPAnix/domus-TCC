import crypto from 'node:crypto';

// Cifra segredos guardados no banco (por exemplo a chave de API de cada subconta do gateway).
// AES-256-GCM: além de esconder, detecta qualquer alteração do texto cifrado.
// A chave vem de SECRETS_KEY (32 bytes em base64). Sem ela, nada é cifrado nem decifrado: o sistema recusa.

function keyFrom(env) {
  const raw = env.SECRETS_KEY;
  if (!raw) throw Object.assign(new Error('SECRETS_KEY não configurada.'), { status: 503 });
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw Object.assign(new Error('SECRETS_KEY precisa ter 32 bytes em base64.'), { status: 503 });
  return key;
}

export function encryptSecret(plain, env = process.env) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyFrom(env), iv);
  const body = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), body.toString('base64')].join(':');
}

export function decryptSecret(payload, env = process.env) {
  const [version, iv, tag, body] = String(payload).split(':');
  if (version !== 'v1' || !iv || !tag || !body) throw new Error('Segredo cifrado inválido.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyFrom(env), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString('utf8');
}

/** Chave nova para colocar em SECRETS_KEY: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" */
export const generateSecretsKey = () => crypto.randomBytes(32).toString('base64');
