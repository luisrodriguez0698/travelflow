'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from './theme-provider';
import { Toaster } from './ui/toaster';
import { Toaster as SonnerToaster } from './ui/sonner';
import { PointerEventsGuard } from './pointer-events-guard';
import { ConnectionStatus } from './connection-status';

export function Providers({ children }: { children: React.ReactNode }) {
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
