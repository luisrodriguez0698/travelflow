'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function EditPackagePage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ name: '', description: '', servicesIncluded: '', servicesNotIncluded: '' });

  useEffect(() => {
    fetch(`/api/packages/${params?.id}`)
      .then(res => res.json())
      .then(data => {
        setFormData({
          name: data.name || '',
          description: data.description || '',
          servicesIncluded: JSON.parse(data.servicesIncluded || '[]').join('\n'),
          servicesNotIncluded: JSON.parse(data.servicesNotIncluded || '[]').join('\n'),
        });
        setLoading(false);
      });
  }, [params?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`/api/packages/${params?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          servicesIncluded: JSON.stringify(formData.servicesIncluded.split('\n').filter(Boolean)),
          servicesNotIncluded: JSON.stringify(formData.servicesNotIncluded.split('\n').filter(Boolean)),
        }),
      });
      router.push('/packages');
      router.refresh();
    } catch (err) {
      alert('Error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/packages"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
        <h1 className="text-3xl font-bold">Editar Paquete</h1>
      </div>
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div><Label>Nombre *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
          <div><Label>Descripción *</Label><Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={4} required /></div>
          <div><Label>Servicios Incluidos</Label><Textarea value={formData.servicesIncluded} onChange={(e) => setFormData({ ...formData, servicesIncluded: e.target.value })} rows={6} /></div>
          <div><Label>Servicios NO Incluidos</Label><Textarea value={formData.servicesNotIncluded} onChange={(e) => setFormData({ ...formData, servicesNotIncluded: e.target.value })} rows={6} /></div>
          <div className="flex justify-end space-x-4">
            <Link href="/packages"><Button variant="outline">Cancelar</Button></Link>
            <Button type="submit" disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
