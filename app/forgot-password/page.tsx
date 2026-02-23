'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plane, Loader2, ArrowLeft, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al procesar la solicitud');
        return;
      }

      setSent(true);
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-4">
              <Plane className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">TravelFlow</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
              {sent ? 'Correo enviado' : 'Recuperar contraseña'}
            </p>
          </div>

          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-7 h-7 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                  Si existe una cuenta asociada a <strong>{email}</strong>, recibirás un correo con las instrucciones para restablecer tu contraseña.
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-2">
                  El enlace expirará en 1 hora. Revisa también tu carpeta de spam.
                </p>
              </div>
              <Link href="/login">
                <Button variant="outline" className="w-full mt-2">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver al inicio de sesión
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 text-center">
                Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
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
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar enlace de recuperación'
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  Volver al inicio de sesión
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
