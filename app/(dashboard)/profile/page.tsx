'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { UserCircle, Mail, KeyRound, Save, Loader2, Eye, EyeOff, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { PASSWORD_MIN_LENGTH, PASSWORD_MIN_MESSAGE } from '@/lib/password';

interface Profile {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  createdAt: string;
  roleName: string;
  tenantName: string;
}

type ProfileUpdate =
  | { type: 'info'; name: string; phone: string | null }
  | { type: 'email'; email: string; currentPassword: string }
  | { type: 'password'; currentPassword: string; newPassword: string };

function PasswordInput({
  id,
  value,
  onChange,
  disabled,
  placeholder = '••••••••',
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoComplete={autoComplete}
        className="pr-10"
      />
      <button
        type="button"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        onClick={() => setShow(!show)}
        tabIndex={-1}
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function ProfilePage() {
  const { update: refreshSession } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [info, setInfo] = useState({ name: '', phone: '' });
  const [emailForm, setEmailForm] = useState({ email: '', currentPassword: '' });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [saving, setSaving] = useState<ProfileUpdate['type'] | null>(null);

  const loadProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfile(data);
      setInfo({ name: data.name || '', phone: data.phone || '' });
    } catch (err: any) {
      toast.error(err.message || 'Error al cargar tu perfil');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const save = async (payload: ProfileUpdate, successMessage: string) => {
    setSaving(payload.type);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(successMessage);
      // Refresca nombre/correo en la sesion (navbar, menu de usuario)
      await refreshSession();
      await loadProfile();
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
      return false;
    } finally {
      setSaving(null);
    }
  };

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    await save({ type: 'info', name: info.name, phone: info.phone || null }, 'Datos actualizados');
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await save(
      { type: 'email', email: emailForm.email, currentPassword: emailForm.currentPassword },
      'Correo actualizado. Úsalo la próxima vez que inicies sesión.'
    );
    if (ok) setEmailForm({ email: '', currentPassword: '' });
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword.length < PASSWORD_MIN_LENGTH) {
      toast.error(PASSWORD_MIN_MESSAGE);
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    const ok = await save(
      {
        type: 'password',
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      },
      'Contraseña actualizada'
    );
    if (ok) setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!profile) return null;

  const initials = (profile.name || profile.email)
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Mi perfil</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Administra tus datos personales y la seguridad de tu cuenta
        </p>
      </div>

      {/* Summary */}
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 shrink-0 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-blue-500/25">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold truncate">{profile.name || 'Sin nombre'}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{profile.email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                {profile.roleName}
              </Badge>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Building2 className="w-3 h-3" />
                {profile.tenantName}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Personal info */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <UserCircle className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-semibold">Información personal</h2>
        </div>
        <form onSubmit={handleSaveInfo} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo *</Label>
              <Input
                id="name"
                value={info.name}
                onChange={(e) => setInfo({ ...info, name: e.target.value })}
                disabled={saving !== null}
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                placeholder="9611234567"
                value={info.phone}
                onChange={(e) => setInfo({ ...info, phone: e.target.value })}
                disabled={saving !== null}
                autoComplete="tel"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="gradient" disabled={saving !== null}>
              {saving === 'info' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Guardar cambios
            </Button>
          </div>
        </form>
      </Card>

      {/* Email */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <Mail className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-semibold">Correo electrónico</h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Tu correo actual es <strong>{profile.email}</strong>. Es el que usas para iniciar sesión.
        </p>
        <form onSubmit={handleSaveEmail} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="newEmail">Nuevo correo *</Label>
              <Input
                id="newEmail"
                type="email"
                placeholder="nuevo@correo.com"
                value={emailForm.email}
                onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })}
                disabled={saving !== null}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailPassword">Contraseña actual *</Label>
              <PasswordInput
                id="emailPassword"
                value={emailForm.currentPassword}
                onChange={(currentPassword) => setEmailForm({ ...emailForm, currentPassword })}
                disabled={saving !== null}
                autoComplete="current-password"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="gradient"
              disabled={saving !== null || !emailForm.email || !emailForm.currentPassword}
            >
              {saving === 'email' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              Cambiar correo
            </Button>
          </div>
        </form>
      </Card>

      {/* Password */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <KeyRound className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-semibold">Contraseña</h2>
        </div>
        <form onSubmit={handleSavePassword} className="space-y-4">
          <div className="space-y-2 sm:max-w-[calc(50%-0.5rem)]">
            <Label htmlFor="currentPassword">Contraseña actual *</Label>
            <PasswordInput
              id="currentPassword"
              value={passwordForm.currentPassword}
              onChange={(currentPassword) => setPasswordForm({ ...passwordForm, currentPassword })}
              disabled={saving !== null}
              autoComplete="current-password"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nueva contraseña *</Label>
              <PasswordInput
                id="newPassword"
                value={passwordForm.newPassword}
                onChange={(newPassword) => setPasswordForm({ ...passwordForm, newPassword })}
                disabled={saving !== null}
                placeholder={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword">Confirmar nueva contraseña *</Label>
              <PasswordInput
                id="confirmNewPassword"
                value={passwordForm.confirmPassword}
                onChange={(confirmPassword) => setPasswordForm({ ...passwordForm, confirmPassword })}
                disabled={saving !== null}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="gradient"
              disabled={
                saving !== null ||
                !passwordForm.currentPassword ||
                !passwordForm.newPassword ||
                !passwordForm.confirmPassword
              }
            >
              {saving === 'password' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4 mr-2" />
              )}
              Cambiar contraseña
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
