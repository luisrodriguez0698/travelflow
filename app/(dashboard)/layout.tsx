import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { Sidebar } from '@/components/sidebar';
import { Navbar } from '@/components/navbar';
import { BottomNav } from '@/components/bottom-nav';
import { SidebarProvider } from '@/components/sidebar-context';
import { DashboardContent } from './dashboard-content';
import { RealtimeProvider } from '@/components/realtime-provider';
import { Celebrations } from '@/components/celebrations';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  // Usuario desactivado/eliminado con sesion abierta: el login cierra la sesion
  if ((session.user as any)?.disabled) {
    redirect('/login?disabled=1');
  }

  return (
    // Una sola conexion de tiempo real (SSE) para todo el sistema
    <RealtimeProvider>
    <SidebarProvider>
      {/* Fondo de pagina: gris muy claro / el tono mas oscuro del tema (las tarjetas resaltan encima) */}
      <div className="min-h-screen bg-muted/50 dark:bg-background relative">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.08),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.15),transparent)]" />
        <Sidebar />
        <DashboardContent>
          <Navbar />
          {/* pb: barra inferior (64px) + zona del gesto de inicio del iPhone */}
          <main className="px-3 py-4 sm:p-4 lg:p-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-6">{children}</main>
        </DashboardContent>
        <BottomNav />
        {/* Confeti y felicitaciones en vivo (metas alcanzadas) */}
        <Celebrations />
      </div>
    </SidebarProvider>
    </RealtimeProvider>
  );
}
