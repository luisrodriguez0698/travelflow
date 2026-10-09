// Foto de perfil: se recorta cuadrada y se comprime EN EL NAVEGADOR antes de
// subirla (una foto de 10 MB del celular queda en ~30-60 KB), y se sube directo
// al almacenamiento con una URL firmada.

const AVATAR_SIZE = 512;
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen. Prueba con una foto JPG o PNG.'));
    };
    img.src = url;
  });
}

/** Recorte cuadrado centrado + redimension a 512x512. WebP si el navegador lo soporta, si no JPEG. */
async function toSquareBlob(file: File): Promise<Blob> {
  const img = await loadImage(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Tu navegador no permite procesar la imagen');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  // Safari antiguo no codifica WebP y devuelve PNG: en ese caso usar JPEG
  const webp = await encode('image/webp');
  if (webp && webp.type === 'image/webp') return webp;
  const jpeg = await encode('image/jpeg');
  if (!jpeg) throw new Error('No se pudo procesar la imagen');
  return jpeg;
}

/** Procesa y sube la foto; devuelve su URL publica. */
export async function uploadAvatar(file: File): Promise<string> {
  if (file.type && !ACCEPTED.includes(file.type)) throw new Error('Formato no permitido. Usa JPG, PNG o WebP.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('La imagen es demasiado grande (máximo 15 MB).');

  const blob = await toSquareBlob(file);
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';

  const presigned = await fetch('/api/upload/presigned', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: `avatar.${ext}`, contentType: blob.type, folder: 'avatars' }),
  });
  if (!presigned.ok) throw new Error('No se pudo preparar la subida');
  const { uploadUrl, publicUrl } = await presigned.json();

  const upload = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob });
  if (!upload.ok) throw new Error('No se pudo subir la imagen');

  return publicUrl as string;
}
