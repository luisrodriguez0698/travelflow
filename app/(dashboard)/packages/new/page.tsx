'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function NewPackagePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    servicesIncluded: '',
    servicesNotIncluded: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          images: [],
          servicesIncluded: JSON.stringify(formData.servicesIncluded.split('\n').filter(Boolean)),
          servicesNotIncluded: JSON.stringify(formData.servicesNotIncluded.split('\n').filter(Boolean)),
        }),
      });

      if (!response.ok) throw new Error('Error al crear paquete');
      router.push('/packages');
      router.refresh();
    } catch (err) {
      alert('Error al crear paquete');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/packages">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Nuevo Paquete</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Crea un nuevo paquete turístico
          </p>
        </div>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="name">Nombre del Destino *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Cancún - Riviera Maya"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Descripción *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descripción del paquete..."
              rows={4}
              required
            />
          </div>

          <div>
            <Label htmlFor="servicesIncluded">Servicios Incluidos (uno por línea)</Label>
            <Textarea
              id="servicesIncluded"
              value={formData.servicesIncluded}
              onChange={(e) => setFormData({ ...formData, servicesIncluded: e.target.value })}
              placeholder="Traslados aeropuerto-hotel&#10;Plan todo incluido&#10;Actividades..."
              rows={6}
            />
          </div>

          <div>
            <Label htmlFor="servicesNotIncluded">Servicios NO Incluidos (uno por línea)</Label>
            <Textarea
              id="servicesNotIncluded"
              value={formData.servicesNotIncluded}
              onChange={(e) => setFormData({ ...formData, servicesNotIncluded: e.target.value })}
              placeholder="Vuelos&#10;Tours opcionales&#10;Propinas..."
              rows={6}
            />
          </div>

          <div className="flex justify-end space-x-4">
            <Link href="/packages">
              <Button type="button" variant="outline">Cancelar</Button>
            </Link>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Crear Paquete
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
