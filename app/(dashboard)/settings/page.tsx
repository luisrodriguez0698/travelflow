'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Building2,
  Save,
  Loader2,
  Upload,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

interface AgencySettings {
  id: string;
  name: string;
  logo: string | null;
  email: string;
  phone: string;
  address: string | null;
  policies: string | null;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AgencySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    logo: '',
    email: '',
    phone: '',
    address: '',
    policies: '',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setFormData({
          name: data.name || '',
          logo: data.logo || '',
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          policies: data.policies || '',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo cargar la configuración',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre de la agencia es obligatorio',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Error saving');

      const data = await res.json();
      setSettings(data);

      toast({
        title: 'Éxito',
        description: 'Configuración guardada correctamente',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la configuración',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Solo se permiten archivos de imagen',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'El archivo no puede exceder 2MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      // Get presigned URL
      const presignedRes = await fetch('/api/upload/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          isPublic: true,
        }),
      });

      if (!presignedRes.ok) throw new Error('Error getting upload URL');

      const { uploadUrl, cloud_storage_path } = await presignedRes.json();

      // Check if content-disposition is in signed headers
      const urlParams = new URLSearchParams(uploadUrl.split('?')[1]);
      const signedHeaders = urlParams.get('X-Amz-SignedHeaders') || '';
      const includesContentDisposition = signedHeaders.includes('content-disposition');

      // Upload to S3
      const uploadHeaders: Record<string, string> = {
        'Content-Type': file.type,
      };
      if (includesContentDisposition) {
        uploadHeaders['Content-Disposition'] = 'attachment';
      }

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: uploadHeaders,
        body: file,
      });

      if (!uploadRes.ok) throw new Error('Error uploading file');

      // Update form with cloud storage path
      setFormData((prev) => ({ ...prev, logo: cloud_storage_path }));

      toast({
        title: 'Éxito',
        description: 'Logo subido correctamente. Guarda los cambios.',
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: 'No se pudo subir el logo',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeLogo = () => {
    setFormData((prev) => ({ ...prev, logo: '' }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Configuración</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Configura los datos de tu agencia
        </p>
      </div>

      {/* Settings Form */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Building2 className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-semibold">Datos de la Agencia</h2>
        </div>

        <div className="space-y-6">
          {/* Logo Upload */}
          <div className="space-y-2">
            <Label>Logo de la Agencia</Label>
            <div className="flex items-start gap-4">
              {/* Logo Preview */}
              <div className="w-32 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-800">
                {formData.logo ? (
                  <div className="relative w-full h-full">
                    <Image
                      src={`/api/files/${encodeURIComponent(formData.logo)}`}
                      alt="Logo"
                      fill
                      className="object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <ImageIcon className="w-10 h-10 text-gray-400" />
                )}
              </div>

              {/* Upload Controls */}
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Subir Logo
                </Button>
                {formData.logo && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeLogo}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Quitar
                  </Button>
                )}
                <p className="text-xs text-gray-500">
                  PNG, JPG o SVG. Máximo 2MB.
                </p>
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la Agencia *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Nombre de tu agencia de viajes"
            />
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="contacto@miagencia.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="+52 555 123 4567"
              />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">Dirección</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, address: e.target.value }))
              }
              placeholder="Calle, número, colonia, ciudad, estado, CP"
              rows={2}
            />
          </div>

          {/* Policies */}
          <div className="space-y-2">
            <Label htmlFor="policies">Políticas y Condiciones</Label>
            <Textarea
              id="policies"
              value={formData.policies}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, policies: e.target.value }))
              }
              placeholder="Escribe aquí las políticas de cancelación, condiciones de pago, términos del servicio, etc."
              rows={6}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Este texto aparecerá al final de los PDFs de ventas y cotizaciones.
            </p>
          </div>

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Nota:</strong> Esta información aparecerá en los estados de cuenta y cotizaciones (PDF) que generes para tus clientes.
            </p>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Guardar Cambios
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
