'use client';

import { useState, useEffect } from 'react';
import { signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plane, Loader2, Eye, EyeOff } from 'lucide-react';
import { AuthShell, AuthFields, AuthItem, AuthError } from '@/components/auth/auth-shell';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Llega aqui desde el dashboard cuando su usuario fue desactivado o eliminado
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('disabled')) {
      setError('Tu usuario está desactivado. Contacta al administrador de tu agencia.');
      signOut({ redirect: false });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        // 'CredentialsSignin' = email/contraseña incorrectos; otros son mensajes
        // propios lanzados en authorize (usuario desactivado, rate limit)
        setError(result.error === 'CredentialsSignin' ? 'Credenciales inválidas' : result.error);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err) {
      setError('Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell mode="login" title="TravelFlow" subtitle="Inicia sesión en tu agencia">
      <form onSubmit={handleSubmit}>
        <AuthFields className="space-y-5">
          <AuthError message={error} />

          <AuthItem className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </AuthItem>

          <AuthItem className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Contraseña</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </AuthItem>

          <AuthItem>
            <Button type="submit" variant="gradient" className="group w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                <>
                  Iniciar sesión
                  <Plane className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-1" />
                </>
              )}
            </Button>
          </AuthItem>

          <AuthItem className="pt-1 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              ¿No tienes cuenta?{' '}
              <Link
                href="/register"
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Registra tu agencia
              </Link>
            </p>
          </AuthItem>
        </AuthFields>
      </form>
    </AuthShell>
  );
}
