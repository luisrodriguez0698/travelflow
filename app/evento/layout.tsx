import type { Metadata } from 'next';

// Invitaciones a eventos: publicas, privadas de cada invitado y sin la app instalable
export const metadata: Metadata = {
  title: 'Invitación especial',
  manifest: null,
  robots: { index: false, follow: false, nocache: true },
};

export default function EventLayout({ children }: { children: React.ReactNode }) {
  return children;
}
