import crypto from 'node:crypto';

/** Assinatura da API do Cloudinary: parâmetros em ordem alfabética, seguidos do segredo. */
export function signCloudinaryParams(params, secret) {
  const payload = Object.keys(params).sort().map((name) => `${name}=${params[name]}`).join('&');
  return crypto.createHash('sha1').update(payload + secret).digest('hex');
}

async function callApi(action, form) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/${action}`, {
    method: 'POST', body: form, signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Cloudinary respondeu ${response.status} em ${action}.`);
  return response.json();
}

function signedForm(params) {
  const form = new FormData();
  for (const [name, value] of Object.entries(params)) form.set(name, String(value));
  form.set('api_key', process.env.CLOUDINARY_API_KEY);
  form.set('signature', signCloudinaryParams(params, process.env.CLOUDINARY_API_SECRET));
  return form;
}

/** Cloudinary: para produção. Plano gratuito sem cartão; usa só as variáveis CLOUDINARY_*. */
export const cloudinaryStorage = {
  async save({ buffer, key, mimeType }) {
    const publicId = key.replace(/\.[a-z]+$/, '');
    const form = signedForm({ public_id: publicId, timestamp: Math.floor(Date.now() / 1000) });
    form.set('file', new Blob([buffer], { type: mimeType }));
    const data = await callApi('upload', form);
    return { key: publicId, url: data.secure_url };
  },
  async remove(key) {
    await callApi('destroy', signedForm({ public_id: key, timestamp: Math.floor(Date.now() / 1000) }));
  },
  /** Remove as fotos de um usuário pelo prefixo da pasta (Admin API). Ainda não foi testado com conta real. */
  async removeAll(userUuid) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userUuid)) return;
    const auth = Buffer.from(`${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`).toString('base64');
    const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(process.env.CLOUDINARY_CLOUD_NAME)}/resources/image/upload?prefix=${encodeURIComponent(`${userUuid}/`)}`;
    const response = await fetch(url, { method: 'DELETE', headers: { Authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Cloudinary respondeu ${response.status} ao remover fotos.`);
  },
};
