'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { LayoutDashboard, ShoppingCart, Users, FileText, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from './sidebar-context';

type NavItem = {
  title: string;
  icon: React.ElementType;
  href: string;
  module: string;
};

const primaryItems: NavItem[] = [
  { title: 'Inicio', icon: LayoutDashboard, href: '/dashboard', module: 'dashboard' },
  { title: 'Ventas', icon: ShoppingCart, href: '/sales', module: 'ventas' },
  { title: 'Clientes', icon: Users, href: '/clients', module: 'clientes' },
  { title: 'Cotizar', icon: FileText, href: '/quotations', module: 'cotizaciones' },
];

export function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { setMobileOpen } = useSidebar();

  const permissions = (session?.user as any)?.permissions as string[] | undefined;
  const userRole = (session?.user as any)?.role;

  const items = primaryItems.filter((item) => {
    if (!permissions && userRole === 'ADMIN') return true;
    if (!permissions) return true;
    return permissions.includes(item.module);
  });

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch justify-around h-16">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400',
              )}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.title}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMobileOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400"
        >
          <Menu className="w-5 h-5" />
          <span>Más</span>
        </button>
      </div>
    </nav>
  );
}
