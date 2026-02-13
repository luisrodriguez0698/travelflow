import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { Sidebar } from '@/components/sidebar';
import { Navbar } from '@/components/navbar';
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <Sidebar />
        <DashboardContent>
          <Navbar />
          <main className="p-4 md:p-6 pt-16 md:pt-6">{children}</main>
        </DashboardContent>
      </div>
    </SidebarProvider>
  );
}
