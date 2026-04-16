import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bienvenido',
};

/**
 * Layout para las landing pages de los tenants.
 * No incluye <html>/<body> — los provee el root layout de Next.js.
 * Tampoco incluye el sidebar ni navbar del SaaS.
 */
export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
