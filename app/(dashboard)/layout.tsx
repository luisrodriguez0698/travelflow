import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { Sidebar } from '@/components/sidebar';
import { Navbar } from '@/components/navbar';
import { BottomNav } from '@/components/bottom-nav';
import { SidebarProvider } from '@/components/sidebar-context';
import { DashboardContent } from './dashboard-content';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 relative">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.08),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.15),transparent)]" />
        <Sidebar />
        <DashboardContent>
          <Navbar />
          <main className="p-4 lg:p-6 pt-16 lg:pt-6 pb-24 lg:pb-6">{children}</main>
        </DashboardContent>
        <BottomNav />
      </div>
    </SidebarProvider>
  );
}
