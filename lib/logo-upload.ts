// Logo (de proveedor, etc.): se reduce EN EL NAVEGADOR sin recortar y conservando
// la transparencia, y se sube directo al almacenamiento con una URL firmada.

const LOGO_MAX = 600;
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

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
      reject(new Error('No se pudo leer la imagen. Prueba con un PNG o JPG.'));
    };
    img.src = url;
  });
}

/** Redimensiona (lado mayor <= 600px). WebP o PNG para no perder el fondo transparente. */
async function toLogoBlob(file: File): Promise<Blob> {
  const img = await loadImage(file);
  const scale = Math.min(1, LOGO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Tu navegador no permite procesar la imagen');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
  const webp = await encode('image/webp');
  if (webp && webp.type === 'image/webp') return webp;
  const png = await encode('image/png');
  if (!png) throw new Error('No se pudo procesar la imagen');
  return png;
}

/** Procesa y sube el logo; devuelve su URL publica. */
export async function uploadLogo(file: File): Promise<string> {
  if (file.type && !ACCEPTED.includes(file.type)) throw new Error('Formato no permitido. Usa PNG, JPG o WebP.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('La imagen es demasiado grande (máximo 15 MB).');

  const blob = await toLogoBlob(file);
  const ext = blob.type === 'image/webp' ? 'webp' : 'png';

  const presigned = await fetch('/api/upload/presigned', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: `logo.${ext}`, contentType: blob.type, folder: 'logos' }),
  });
  if (!presigned.ok) throw new Error('No se pudo preparar la subida');
  const { uploadUrl, publicUrl } = await presigned.json();

  const upload = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob });
  if (!upload.ok) throw new Error('No se pudo subir la imagen');

  return publicUrl as string;
}
