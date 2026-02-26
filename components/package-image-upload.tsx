'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const ACCEPTED_EXTENSIONS = '.jpg, .jpeg, .png, .webp, .gif';
const MAX_DIMENSION = 1920;
const COMPRESS_QUALITY = 0.82;
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function compressImage(file: File): Promise<{ blob: Blob; contentType: string }> {
  return new Promise((resolve, reject) => {
    // GIF: skip compression (canvas breaks animation)
    if (file.type === 'image/gif') {
      resolve({ blob: file, contentType: file.type });
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Scale down if exceeds max dimension
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

      // PNG with transparency stays as PNG; otherwise convert to JPEG
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
}

export function PackageImageUpload({ images, onImagesChange }: PackageImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Validate file types before doing anything
    const invalidFiles = Array.from(files).filter((f) => !ACCEPTED_TYPES.includes(f.type));
    if (invalidFiles.length > 0) {
      setError(`Tipo de archivo no permitido: ${invalidFiles.map((f) => f.name).join(', ')}. Solo se aceptan: ${ACCEPTED_EXTENSIONS}`);
      e.target.value = '';
      return;
    }

    // Validate file size (max 5 MB per image)
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

        // Compress image on the client before uploading
        const { blob: compressedBlob, contentType } = await compressImage(file);

        // Build a File from the compressed blob to keep the original name
        const ext = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : file.name.split('.').pop() ?? 'jpg';
        const baseName = file.name.replace(/\.[^.]+$/, '');
        const compressedFile = new File([compressedBlob], `${baseName}.${ext}`, { type: contentType });

        // Get presigned URL
        const response = await fetch('/api/upload/presigned', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: compressedFile.name,
            contentType: compressedFile.type,
            isPublic: true,
          }),
        });

        if (!response.ok) {
          throw new Error('Error getting upload URL');
        }

        const { uploadUrl, cloud_storage_path } = await response.json();

        // Check if content-disposition is in signed headers
        const url = new URL(uploadUrl);
        const signedHeaders = url.searchParams.get('X-Amz-SignedHeaders');
        const hasContentDisposition = signedHeaders?.includes('content-disposition');

        // Upload compressed file to S3
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: compressedFile,
          headers: {
            'Content-Type': compressedFile.type,
            ...(hasContentDisposition ? { 'Content-Disposition': 'attachment' } : {}),
          },
        });

        if (!uploadResponse.ok) {
          throw new Error('Error uploading file');
        }

        uploadedPaths.push(cloud_storage_path);
      }

      onImagesChange([...images, ...uploadedPaths]);
    } catch (err: any) {
      setError(err?.message || 'Error al subir las imágenes');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    onImagesChange(newImages);
  };

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
                onClick={() => removeImage(index)}
                className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ImageDisplay({ cloudPath, alt }: { cloudPath: string; alt: string }) {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (cloudPath) {
      // Use the API route to get a presigned URL (getFileUrl is server-only)
      setImageUrl(`/api/files/${cloudPath}`);
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
