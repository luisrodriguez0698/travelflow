import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { RealtimeProvider } from '@/components/realtime-provider';

// Pantalla completa del sorteo (sin menu lateral), pensada para proyectar o transmitir
export default async function SorteoLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if ((session.user as any)?.disabled) redirect('/login?disabled=1');
  return <RealtimeProvider>{children}</RealtimeProvider>;
}
