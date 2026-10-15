'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { uploadLogo } from '@/lib/logo-upload';
import { cn } from '@/lib/utils';

interface LogoFieldProps {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  hint?: string;
}

/** Subir / cambiar / quitar un logo (se guarda la URL publica). */
export function LogoField({ value, onChange, disabled, hint }: LogoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      onChange(await uploadLogo(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo subir el logo');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        className={cn(
          'relative flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#fff_0%_50%)] [background-size:16px_16px] transition-colors hover:border-primary dark:bg-[repeating-conic-gradient(#1e293b_0%_25%,#0f172a_0%_50%)]',
          value ? 'border-transparent' : 'border-muted-foreground/30'
        )}
        aria-label={value ? 'Cambiar logo' : 'Subir logo'}
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Logo" className="h-full w-full object-contain p-1.5" />
        ) : (
          <ImagePlus className="h-6 w-6 text-muted-foreground" />
        )}
      </button>
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={disabled || uploading}>
            {value ? 'Cambiar' : 'Subir logo'}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={() => onChange('')}
              disabled={disabled || uploading}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Quitar
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{hint ?? 'PNG con fondo transparente se ve mejor.'}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </div>
  );
}
