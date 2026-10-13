'use client';

import { usePathname } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from './theme-provider';
import { Toaster } from './ui/toaster';
import { Toaster as SonnerToaster } from './ui/sonner';
import { PointerEventsGuard } from './pointer-events-guard';
import { ConnectionStatus } from './connection-status';

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Portal del cliente (/v/...): es publico y puede abrirse en el dominio de la
  // agencia, donde no existen /api/auth ni /api/health. Sin sesion ni indicador
  // de conexion (evita errores en consola y un falso "servidor caido").
  if (pathname?.startsWith('/v/')) {
    return (
      <ThemeProvider attribute="class" forcedTheme="light" disableTransitionOnChange>
        {children}
        <SonnerToaster position="top-right" richColors />
      </ThemeProvider>
    );
  }

  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <Toaster />
        {/* Varias pantallas usan toast() de sonner (usuarios, perfil, servicios, plantillas) */}
        <SonnerToaster position="top-right" richColors />
        <PointerEventsGuard />
        {/* Sin internet / servidor caido / conexion restablecida */}
        <ConnectionStatus />
      </ThemeProvider>
    </SessionProvider>
  );
}
