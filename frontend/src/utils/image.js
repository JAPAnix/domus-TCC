export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Retorna a mensagem de erro do arquivo, ou null se ele puder ser enviado. */
export function validateImageFile(file) {
  if (!ACCEPTED_TYPES.includes(file.type)) return `"${file.name}" não foi aceito. Envie uma imagem JPG, PNG ou WebP.`;
  if (file.size > MAX_FILE_BYTES) return `"${file.name}" tem mais de 5 MB. Escolha uma imagem menor.`;
  return null;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível processar a imagem.'))), type, quality);
  });
}

async function encode(canvas, name) {
  // Navegadores sem codificador WebP devolvem PNG, e nesse caso o JPEG comprime melhor.
  let blob = await canvasToBlob(canvas, 'image/webp', 0.85);
  if (blob.type !== 'image/webp') blob = await canvasToBlob(canvas, 'image/jpeg', 0.85);
  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `${name}.${extension}`, { type: blob.type });
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível abrir esta imagem. O arquivo pode estar corrompido.'));
    image.src = src;
  });
}

function newCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** Reduz para maxSize no maior lado e recomprime. Reencodar também descarta metadados como GPS. */
export async function compressImage(file, maxSize = 1600) {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = newCanvas(Math.round(image.naturalWidth * scale), Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return await encode(canvas, 'foto');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Recorta um quadrado da imagem. crop está em pixels da imagem original. */
export async function cropSquare(image, crop, outputSize = 512) {
  const canvas = newCanvas(outputSize, outputSize);
  canvas.getContext('2d').drawImage(image, crop.x, crop.y, crop.size, crop.size, 0, 0, outputSize, outputSize);
  return encode(canvas, 'avatar');
}
