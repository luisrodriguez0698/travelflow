'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Upload, X, Loader2 } from 'lucide-react';

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

    setUploading(true);
    setError('');

    try {
      const uploadedPaths: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Get presigned URL
        const response = await fetch('/api/upload/presigned', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
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

        // Upload file to S3
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
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
      setError(err?.message || 'Error uploading images');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    onImagesChange(newImages);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label htmlFor="package-images" className="cursor-pointer">
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
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading}
          />
        </label>
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
