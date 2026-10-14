'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plane, Loader2 } from 'lucide-react';
import { AuthShell, AuthFields, AuthItem, AuthError } from '@/components/auth/auth-shell';
import { PASSWORD_MIN_LENGTH, PASSWORD_MIN_MESSAGE } from '@/lib/password';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    agencyName: '',
    email: '',
    phone: '',
    address: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (formData.password.length < PASSWORD_MIN_LENGTH) {
      setError(PASSWORD_MIN_MESSAGE);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Error al registrar la agencia');
        setLoading(false);
        return;
      }

      // Auto login after signup
      const signInResult = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (signInResult?.error) {
        router.push('/login');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError('Error al registrar la agencia');
      setLoading(false);
    }
  };

  return (
    <AuthShell mode="register" title="Registra tu agencia" subtitle="Comienza a gestionar tus ventas">
      <form onSubmit={handleSubmit}>
        <AuthFields className="space-y-4">
          <AuthError message={error} />

          <AuthItem className="space-y-2">
            <Label htmlFor="agencyName">Nombre de la agencia *</Label>
            <Input
              id="agencyName"
              name="agencyName"
              placeholder="Mi Agencia de Viajes"
              required
              value={formData.agencyName}
              onChange={handleChange}
              disabled={loading}
            />
          </AuthItem>
          <AuthItem className="space-y-2">
            <Label htmlFor="email">Correo electrónico *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="contacto@agencia.com"
              required
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
            />
          </AuthItem>
          <AuthItem className="space-y-2">
            <Label htmlFor="phone">Teléfono *</Label>
            <Input
              id="phone"
              name="phone"
              placeholder="9611234567"
              required
              value={formData.phone}
              onChange={handleChange}
              disabled={loading}
            />
          </AuthItem>
          <AuthItem className="space-y-2">
            <Label htmlFor="address">Dirección</Label>
            <Textarea
              id="address"
              name="address"
              placeholder="Calle, número, colonia, ciudad"
              rows={2}
              value={formData.address}
              onChange={handleChange}
              disabled={loading}
            />
          </AuthItem>

          <AuthItem className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña *</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar *</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
          </AuthItem>

          <AuthItem>
            <Button type="submit" variant="gradient" className="group w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  Registrar agencia
                  <Plane className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-1" />
                </>
              )}
            </Button>
          </AuthItem>

          <AuthItem className="pt-1 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              ¿Ya tienes cuenta?{' '}
              <Link
                href="/login"
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Inicia sesión
              </Link>
            </p>
          </AuthItem>
        </AuthFields>
      </form>
    </AuthShell>
  );
}
