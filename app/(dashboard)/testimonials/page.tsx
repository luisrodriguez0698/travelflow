'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Star, Facebook, Globe, X, Loader2 } from 'lucide-react';

interface Testimonial {
  id: string;
  name: string;
  text: string;
  rating: number;
  source: 'google' | 'facebook';
  avatarUrl: string | null;
}

const defaultForm = { name: '', text: '', rating: 5, source: 'google' as 'google' | 'facebook', avatarUrl: '' };

export default function TestimonialsPage() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState('');

  useEffect(() => { fetchTestimonials(); }, []);

  async function fetchTestimonials() {
    setLoading(true);
    const res = await fetch('/api/testimonials');
    if (res.ok) setTestimonials(await res.json());
    setLoading(false);
  }

  function openCreate() {
    setForm(defaultForm);
    setEditingId(null);
    setError('');
    setShowModal(true);
  }

  function openEdit(t: Testimonial) {
    setForm({ name: t.name, text: t.text, rating: t.rating, source: t.source, avatarUrl: t.avatarUrl ?? '' });
    setEditingId(t.id);
    setError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.text.trim()) { setError('Nombre y texto son requeridos'); return; }
    setSaving(true);
    setError('');
    const url  = editingId ? `/api/testimonials/${editingId}` : '/api/testimonials';
    const method = editingId ? 'PUT' : 'POST';
    const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (res.ok) { setShowModal(false); fetchTestimonials(); }
    else { const d = await res.json(); setError(d.error || 'Error al guardar'); }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este testimonio?')) return;
    await fetch(`/api/testimonials/${id}`, { method: 'DELETE' });
    setTestimonials((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Opiniones de Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Agrega los testimonios que aparecerán en tu página de inicio.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Agregar opinión
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : testimonials.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
          <p className="font-medium">Sin testimonios aún</p>
          <p className="text-sm mt-1">Agrega las mejores opiniones de tus clientes de Google y Facebook.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {testimonials.map((t) => (
            <div key={t.id} className="bg-card border rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {t.avatarUrl
                    ? <img src={t.avatarUrl} alt={t.name} className="w-9 h-9 rounded-full object-cover" />
                    : <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">{t.name[0]?.toUpperCase()}</div>
                  }
                  <div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-3 h-3 ${i < t.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {t.source === 'facebook'
                    ? <Facebook className="w-4 h-4 text-blue-600" />
                    : <Globe className="w-4 h-4 text-red-500" />
                  }
                  <button onClick={() => openEdit(t)} className="p-1 hover:bg-muted rounded"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(t.id)} className="p-1 hover:bg-muted rounded text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-3">{t.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl shadow-xl w-full max-w-md space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{editingId ? 'Editar opinión' : 'Nueva opinión'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3">
              {/* Source */}
              <div className="flex gap-2">
                {(['google', 'facebook'] as const).map((src) => (
                  <button
                    key={src}
                    onClick={() => setForm((f) => ({ ...f, source: src }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition
                      ${form.source === src ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}
                  >
                    {src === 'facebook' ? <Facebook className="w-4 h-4 text-blue-600" /> : <Globe className="w-4 h-4 text-red-500" />}
                    {src === 'facebook' ? 'Facebook' : 'Google'}
                  </button>
                ))}
              </div>

              <Input placeholder="Nombre del cliente" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <Textarea placeholder="Texto de la opinión" rows={4} value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} />

              {/* Stars */}
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground mr-1">Calificación:</span>
                {Array.from({ length: 5 }).map((_, i) => (
                  <button key={i} onClick={() => setForm((f) => ({ ...f, rating: i + 1 }))}>
                    <Star className={`w-5 h-5 ${i < form.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                  </button>
                ))}
              </div>

              <Input
                placeholder="URL de foto de perfil (opcional)"
                value={form.avatarUrl}
                onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))}
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
