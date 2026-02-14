'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Plane,
  Menu,
  X,
  CalendarDays,
  Settings,
  Truck,
  Landmark,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { useSidebar } from './sidebar-context';

const menuItems = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
  },
  {
    title: 'Clientes',
    icon: Users,
    href: '/clients',
  },
  {
    title: 'Paquetes',
    icon: Package,
    href: '/packages',
  },
  {
    title: 'Temporadas',
    icon: CalendarDays,
    href: '/seasons',
  },
  {
    title: 'Ventas',
    icon: ShoppingCart,
    href: '/sales',
  },
  {
    title: 'Proveedores',
    icon: Truck,
    href: '/suppliers',
  },
  {
    title: 'Bancos',
    icon: Landmark,
    href: '/banks',
  },
  {
    title: 'Configuración',
    icon: Settings,
    href: '/settings',
  },
];

export function Sidebar() {
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar();
  const pathname = usePathname();

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  // Mobile hamburger button
  const MobileMenuButton = () => (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setMobileOpen(!mobileOpen)}
      className="md:hidden fixed top-3 left-3 z-50 bg-white dark:bg-gray-900 shadow-md rounded-lg"
    >
      {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
    </Button>
  );

  // Sidebar content
  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center space-x-2 overflow-hidden">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Plane className="w-4 h-4 text-white" />
          </div>
          {(!collapsed || isMobile) && (
            <span className="text-lg font-bold text-gray-900 dark:text-white whitespace-nowrap">
              TravelFlow
            </span>
          )}
        </div>
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto flex-shrink-0"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>

      {/* Menu Items */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
                  collapsed && !isMobile && 'justify-center px-2'
                )}
                title={collapsed && !isMobile ? item.title : undefined}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {(!collapsed || isMobile) && <span className="font-medium">{item.title}</span>}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <MobileMenuButton />

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-transform duration-300 md:hidden w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent isMobile={true} />
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden md:block fixed left-0 top-0 z-40 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <SidebarContent isMobile={false} />
      </aside>
    </>
  );
}
