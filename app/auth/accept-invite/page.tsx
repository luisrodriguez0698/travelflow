'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plane, Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [inviteData, setInviteData] = useState<{
    email: string;
    tenantName: string;
    roleName: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setErrorMessage('No se proporcionó un token de invitación');
      return;
    }

    fetch(`/api/auth/accept-invite?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setValid(true);
          setInviteData({
            email: data.email,
            tenantName: data.tenantName,
            roleName: data.roleName,
          });
        } else {
          setErrorMessage(data.reason || 'Invitación no válida');
        }
      })
      .catch(() => setErrorMessage('Error al verificar la invitación'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (formData.password !== formData.confirmPassword) {
      setFormError('Las contraseñas no coinciden');
      return;
    }

    if (formData.password.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          name: formData.name,
          password: formData.password,
          phone: formData.phone || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || 'Error al crear la cuenta');
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch {
      setFormError('Error al crear la cuenta');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-4">
        <div className="w-full max-w-md">
          <div className="bg-[#1e293b] rounded-2xl shadow-xl p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">
              Cuenta creada exitosamente
            </h2>
            <p className="text-slate-400 mb-4">
              Redirigiendo al inicio de sesión...
            </p>
            <Link href="/login">
              <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600">
                Ir a Iniciar Sesión
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-4">
        <div className="w-full max-w-md">
          <div className="bg-[#1e293b] rounded-2xl shadow-xl p-8 text-center">
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">
              Invitación no válida
            </h2>
            <p className="text-slate-400 mb-4">{errorMessage}</p>
            <Link href="/login">
              <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600">
                Ir a Iniciar Sesión
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#1e293b] rounded-2xl shadow-xl p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-4">
              <Plane className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">
              Únete a {inviteData?.tenantName}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Has sido invitado como <span className="text-blue-400 font-medium">{inviteData?.roleName}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="bg-red-900/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                {formError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Correo electrónico</Label>
              <Input
                id="email"
                value={inviteData?.email || ''}
                disabled
                className="bg-[#0f172a] border-slate-600 text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-300">Nombre completo *</Label>
              <Input
                id="name"
                name="name"
                placeholder="Tu nombre completo"
                value={formData.name}
                onChange={handleChange}
                required
                disabled={submitting}
                className="bg-[#0f172a] border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-slate-300">Teléfono</Label>
              <Input
                id="phone"
                name="phone"
                placeholder="9611234567"
                value={formData.phone}
                onChange={handleChange}
                disabled={submitting}
                className="bg-[#0f172a] border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Contraseña *</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={submitting}
                className="bg-[#0f172a] border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-300">Confirmar contraseña *</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                disabled={submitting}
                className="bg-[#0f172a] border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creando cuenta...
                </>
              ) : (
                'Crear cuenta'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
