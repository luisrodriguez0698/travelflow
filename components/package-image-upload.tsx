'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Upload, X, Loader2, ImageIcon, Trash2, AlertTriangle } from 'lucide-react';

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const ACCEPTED_EXTENSIONS = '.jpg, .jpeg, .png, .webp, .gif';
const MAX_DIMENSION = 1920;
const COMPRESS_QUALITY = 0.82;
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function compressImage(file: File): Promise<{ blob: Blob; contentType: string }> {
  return new Promise((resolve, reject) => {
    if (file.type === 'image/gif') {
      resolve({ blob: file, contentType: file.type });
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo crear el contexto del canvas'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const quality = outputType === 'image/jpeg' ? COMPRESS_QUALITY : undefined;

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Error al comprimir la imagen'));
            return;
          }
          resolve({ blob, contentType: outputType });
        },
        outputType,
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo cargar la imagen'));
    };

    img.src = objectUrl;
  });
}

interface PackageImageUploadProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  /** Carpeta dentro del tenant: 'hotels' | 'packages' | 'logos' | 'uploads' */
  folder?: string;
}

export function PackageImageUpload({ images, onImagesChange, folder = 'uploads' }: PackageImageUploadProps) {
  const [uploading, setUploading]           = useState(false);
  const [error, setError]                   = useState('');
  const [confirmIndex, setConfirmIndex]     = useState<number | null>(null);
  const [removingImage, setRemovingImage]   = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const invalidFiles = Array.from(files).filter((f) => !ACCEPTED_TYPES.includes(f.type));
    if (invalidFiles.length > 0) {
      setError(`Tipo de archivo no permitido: ${invalidFiles.map((f) => f.name).join(', ')}. Solo se aceptan: ${ACCEPTED_EXTENSIONS}`);
      e.target.value = '';
      return;
    }

    const oversizedFiles = Array.from(files).filter((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (oversizedFiles.length > 0) {
      setError(`Las siguientes imágenes superan el límite de ${MAX_FILE_SIZE_MB} MB: ${oversizedFiles.map((f) => f.name).join(', ')}`);
      e.target.value = '';
      return;
    }

    setUploading(true);
    setError('');

    try {
      const uploadedPaths: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        const { blob: compressedBlob, contentType } = await compressImage(file);

        const ext = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : file.name.split('.').pop() ?? 'jpg';
        const baseName = file.name.replace(/\.[^.]+$/, '');
        const compressedFile = new File([compressedBlob], `${baseName}.${ext}`, { type: contentType });

        const response = await fetch('/api/upload/presigned', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: compressedFile.name,
            contentType: compressedFile.type,
            folder,
          }),
        });

        if (!response.ok) throw new Error('Error getting upload URL');

        const { uploadUrl, publicUrl } = await response.json();

        const url = new URL(uploadUrl);
        const signedHeaders = url.searchParams.get('X-Amz-SignedHeaders');
        const hasContentDisposition = signedHeaders?.includes('content-disposition');

        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: compressedFile,
          headers: {
            'Content-Type': compressedFile.type,
            ...(hasContentDisposition ? { 'Content-Disposition': 'attachment' } : {}),
          },
        });

        if (!uploadResponse.ok) throw new Error('Error uploading file');

        uploadedPaths.push(publicUrl);
      }

      onImagesChange([...images, ...uploadedPaths]);
    } catch (err: any) {
      setError(err?.message || 'Error al subir las imágenes');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const confirmRemoveImage = async () => {
    if (confirmIndex === null) return;
    const imageUrl = images[confirmIndex];
    setRemovingImage(true);

    try {
      const res = await fetch('/api/upload/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: imageUrl }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const newImages = [...images];
      newImages.splice(confirmIndex, 1);
      onImagesChange(newImages);
    } catch (err: any) {
      setError(err?.message || 'No se pudo eliminar la imagen');
    } finally {
      setRemovingImage(false);
      setConfirmIndex(null);
    }
  };

  const imageToConfirm = confirmIndex !== null ? images[confirmIndex] : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="package-images" className="cursor-pointer w-fit">
          <Button type="button" variant="outline" disabled={uploading} asChild>
            <span>
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Seleccionar Imágenes
                </>
              )}
            </span>
          </Button>
          <input
            id="package-images"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.gif"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading}
          />
        </label>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ImageIcon className="w-3.5 h-3.5 shrink-0" />
          Formatos aceptados: JPG, JPEG, PNG, WEBP, GIF · Máx. 5 MB por imagen · Se comprimen automáticamente
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {images?.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((imagePath, index) => (
            <div key={index} className="relative group aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
              <ImageDisplay cloudPath={imagePath} alt={`Package image ${index + 1}`} />
              <button
                type="button"
                onClick={() => setConfirmIndex(index)}
                className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Dialog confirmación eliminar imagen */}
      <Dialog open={confirmIndex !== null} onOpenChange={(open) => { if (!open && !removingImage) setConfirmIndex(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <DialogTitle className="text-lg">Eliminar imagen</DialogTitle>
            </div>
            <DialogDescription className="text-sm leading-relaxed">
              Esta acción eliminará la imagen de forma permanente desde Cloudflare.
              <br />
              <span className="font-medium text-foreground">No se puede deshacer.</span>
            </DialogDescription>
          </DialogHeader>

          {/* Preview de la imagen a eliminar */}
          {imageToConfirm && (
            <div className="rounded-lg overflow-hidden aspect-video bg-gray-100 dark:bg-gray-800 w-full">
              <img
                src={imageToConfirm}
                alt="Imagen a eliminar"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setConfirmIndex(null)}
              disabled={removingImage}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRemoveImage}
              disabled={removingImage}
            >
              {removingImage ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Eliminar imagen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ImageDisplay({ cloudPath, alt }: { cloudPath: string; alt: string }) {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (cloudPath) {
      const isFullUrl = cloudPath.startsWith('http://') || cloudPath.startsWith('https://');
      setImageUrl(isFullUrl ? cloudPath : `/api/files/${cloudPath}`);
      setLoading(false);
    }
  }, [cloudPath]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
        <span className="text-gray-500 text-sm">Error</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className="absolute inset-0 w-full h-full object-cover"
      onError={() => setError(true)}
    />
  );
}
