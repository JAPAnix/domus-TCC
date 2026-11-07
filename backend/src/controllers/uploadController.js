import { randomUUID } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { getStorage } from '../services/storage/index.js';
import { detectImageType, isOwnedStorageKey, UPLOAD_PURPOSES } from '../utils/imageFile.js';
import { logger } from '../utils/logger.js';

async function isActiveUser(req) {
  const user = await prisma.user.findFirst({ where: { id: BigInt(req.user.id), deletedAt: null }, select: { id: true } });
  return !!user;
}

export const uploadImage = async (req, res) => {
  try {
    if (!await isActiveUser(req)) return res.status(401).json({ message: 'Conta indisponível. Entre novamente.' });
    if (!req.file) return res.status(400).json({ message: 'Selecione uma imagem para enviar.' });
    if (process.env.NODE_ENV === 'production' && (process.env.STORAGE_PROVIDER || 'local') === 'local') {
      // Em hospedagem com disco temporário, a foto sumiria no próximo reinício. Melhor recusar do que perder depois.
      logger.error('uploadImage: STORAGE_PROVIDER=local em produção. Configure o Cloudinary no servidor.');
      return res.status(503).json({ message: 'O envio de fotos ainda não está configurado no servidor. Avise o suporte.' });
    }

    const purpose = req.body.purpose;
    if (!UPLOAD_PURPOSES.includes(purpose)) return res.status(400).json({ message: 'Destino da imagem inválido.' });

    const type = detectImageType(req.file.buffer);
    if (!type) return res.status(415).json({ message: 'Formato não aceito. Envie uma imagem JPG, PNG ou WebP.' });

    const key = `${req.user.uuid}/${purpose}/${randomUUID()}.${type.extension}`;
    const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const saved = await getStorage().save({ buffer: req.file.buffer, key, mimeType: type.mimeType, baseUrl });
    res.status(201).json(saved);
  } catch (err) {
    logger.error('uploadImage', err);
    res.status(502).json({ message: 'Não foi possível salvar a imagem. Tente novamente.' });
  }
};

export const deleteImage = async (req, res) => {
  const { key } = req.body ?? {};
  if (!isOwnedStorageKey(key, req.user.uuid)) return res.status(403).json({ message: 'Você não pode remover esta imagem.' });
  try {
    await getStorage().remove(key);
    res.sendStatus(204);
  } catch (err) {
    logger.error('deleteImage', err);
    res.status(502).json({ message: 'Não foi possível remover a imagem. Tente novamente.' });
  }
};
