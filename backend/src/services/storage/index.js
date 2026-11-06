import { localStorage } from './localStorage.js';
import { cloudinaryStorage } from './cloudinaryStorage.js';

const providers = { local: localStorage, cloudinary: cloudinaryStorage };

export function storageProviderName() {
  return process.env.STORAGE_PROVIDER || 'local';
}

/** Provedor escolhido por STORAGE_PROVIDER. Para trocar, implemente save() e remove() e registre aqui. */
export function getStorage() {
  const provider = providers[storageProviderName()];
  if (!provider) throw new Error(`STORAGE_PROVIDER desconhecido: ${storageProviderName()}`);
  return provider;
}
