'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function NewSalePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [departures, setDepartures] = useState<any[]>([]);
  const [formData, setFormData] = useState({ clientId: '', packageId: '', departureId: '', totalPrice: '', paymentType: 'CASH', downPayment: '', numberOfPayments: '1' });

  useEffect(() => {
    fetch('/api/clients?all=true').then(r => r.json()).then(setClients);
    fetch('/api/packages').then(r => r.json()).then(setPackages);
  }, []);

  useEffect(() => {
    if (formData.packageId) {
      fetch(`/api/packages/${formData.packageId}`).then(r => r.json()).then(data => setDepartures(data?.departures || []));
    }
  }, [formData.packageId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, totalPrice: parseFloat(formData.totalPrice), downPayment: parseFloat(formData.downPayment || '0'), numberOfPayments: parseInt(formData.numberOfPayments) }),
      });
      router.push('/sales');
      router.refresh();
    } catch (err) {
      alert('Error al crear venta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/sales"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
        <h1 className="text-3xl font-bold">Nueva Venta</h1>
      </div>
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label>Cliente *</Label>
            <Select value={formData.clientId} onValueChange={(v) => setFormData({ ...formData, clientId: v })}>
              <SelectTrigger><SelectValue placeholder="Selecciona cliente" /></SelectTrigger>
              <SelectContent>{clients.map(c => <SelectItem key={c?.id} value={c?.id}>{c?.fullName}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Paquete *</Label>
            <Select value={formData.packageId} onValueChange={(v) => setFormData({ ...formData, packageId: v, departureId: '' })}>
              <SelectTrigger><SelectValue placeholder="Selecciona paquete" /></SelectTrigger>
              <SelectContent>{packages.map(p => <SelectItem key={p?.id} value={p?.id}>{p?.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {formData.packageId && (
            <div>
              <Label>Fecha de Salida *</Label>
              <Select value={formData.departureId} onValueChange={(v) => { const dep = departures.find(d => d?.id === v); setFormData({ ...formData, departureId: v, totalPrice: dep?.price?.toString() || '' }); }}>
                <SelectTrigger><SelectValue placeholder="Selecciona fecha" /></SelectTrigger>
                <SelectContent>{departures.map(d => <SelectItem key={d?.id} value={d?.id}>{new Date(d?.departureDate).toLocaleDateString('es-MX')} - ${d?.price?.toLocaleString('es-MX')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Precio Total *</Label>
            <Input type="number" value={formData.totalPrice} onChange={(e) => setFormData({ ...formData, totalPrice: e.target.value })} required />
          </div>
          <div>
            <Label>Tipo de Pago *</Label>
            <Select value={formData.paymentType} onValueChange={(v) => setFormData({ ...formData, paymentType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Contado</SelectItem>
                <SelectItem value="CREDIT">Crédito</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {formData.paymentType === 'CREDIT' && (
            <>
              <div><Label>Enganche</Label><Input type="number" value={formData.downPayment} onChange={(e) => setFormData({ ...formData, downPayment: e.target.value })} /></div>
              <div><Label>Número de Quincenas</Label><Input type="number" value={formData.numberOfPayments} onChange={(e) => setFormData({ ...formData, numberOfPayments: e.target.value })} /></div>
            </>
          )}
          <div className="flex justify-end space-x-4">
            <Link href="/sales"><Button variant="outline">Cancelar</Button></Link>
            <Button type="submit" disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear Venta'}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
