import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export const uploadDirectory = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(backendRoot, 'uploads');

function resolveInsideUploads(key) {
  const target = path.resolve(uploadDirectory, key);
  if (!target.startsWith(uploadDirectory + path.sep)) throw new Error('Caminho de arquivo inválido.');
  return target;
}

/** Disco local: para desenvolvimento. Os arquivos ficam em backend/uploads, fora do git. */
export const localStorage = {
  async save({ buffer, key, baseUrl }) {
    const target = resolveInsideUploads(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer, { flag: 'wx' });
    return { key, url: `${baseUrl}/uploads/${key}` };
  },
  async remove(key) {
    await fs.rm(resolveInsideUploads(key), { force: true });
  },
  /** Remove todas as fotos de um usuário (pasta nomeada com o uuid dele). */
  async removeAll(userUuid) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userUuid)) return;
    await fs.rm(resolveInsideUploads(userUuid), { recursive: true, force: true });
  },
};
