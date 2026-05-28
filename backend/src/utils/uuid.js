import { randomUUID } from 'crypto';

export const uuidToBuffer = (uuid) => {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex');
};

export const bufferToUuid = (buffer) => {
  const hex = buffer.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join('-');
};

export const generateUuid = () => {
  return uuidToBuffer(randomUUID());
};