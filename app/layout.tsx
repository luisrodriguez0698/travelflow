import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  title: 'TravelFlow - Gestión de Agencias de Viajes',
  description: 'SaaS multitenant para la gestión operativa de agencias de viajes',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    // 'default': hora y bateria en negro sobre fondo claro. Con 'black-translucent'
    // quedaban en blanco sobre la barra blanca de la app (ilegibles).
    statusBarStyle: 'default',
    title: 'TravelFlow',
  },
  openGraph: {
    title: 'TravelFlow - Gestión de Agencias de Viajes',
    description: 'SaaS multitenant para la gestión operativa de agencias de viajes',
    images: ['/og-image.png'],
  },
};

export const viewport: Viewport = {
  // Color de la barra del sistema (Android / app instalada) = color de la barra superior
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script src="https://apps.abacus.ai/chatllm/appllm-lib.js" async defer></script>
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
