import type { Metadata } from 'next';

// El portal del cliente no es la app instalable de la agencia: sin manifest
// (en el dominio de la agencia /manifest.json no existe y daba error 404).
export const metadata: Metadata = {
  manifest: null,
};

export default function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
