'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  Users,
  MapPin,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plane,
  Menu,
  X,
  CalendarDays,
  Settings,
  Truck,
  Landmark,
  UserCog,
  FileText,
  Wallet,
  Hotel,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { useSidebar } from './sidebar-context';

type MenuItem = {
  title: string;
  icon: React.ElementType;
  href: string;
  module: string;
};

type MenuGroup = {
  label?: string;
  items: MenuItem[];
};

const menuGroups: MenuGroup[] = [
  {
    items: [
      { title: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', module: 'dashboard' },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { title: 'Clientes', icon: Users, href: '/clients', module: 'clientes' },
      { title: 'Ventas', icon: ShoppingCart, href: '/sales', module: 'ventas' },
      { title: 'Metas', icon: Target, href: '/sales/goals', module: 'ventas' },
      { title: 'Cotizaciones', icon: FileText, href: '/quotations', module: 'cotizaciones' },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      { title: 'Destinos', icon: MapPin, href: '/destinations', module: 'destinos' },
      { title: 'Hoteles', icon: Hotel, href: '/hotels', module: 'destinos' },
      { title: 'Temporadas', icon: CalendarDays, href: '/seasons', module: 'temporadas' },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { title: 'Proveedores', icon: Truck, href: '/suppliers', module: 'proveedores' },
      { title: 'Deudas', icon: Wallet, href: '/suppliers/debts', module: 'proveedores' },
      { title: 'Bancos', icon: Landmark, href: '/banks', module: 'bancos' },
    ],
  },
  {
    label: 'Administración',
    items: [
      { title: 'Usuarios', icon: UserCog, href: '/users', module: 'usuarios' },
      { title: 'Configuración', icon: Settings, href: '/settings', module: 'configuracion' },
    ],
  },
];

export function Sidebar() {
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar();
  const pathname = usePathname();
  const { data: session } = useSession();

  const permissions = (session?.user as any)?.permissions as string[] | undefined;
  const userRole = (session?.user as any)?.role;

  const filterItems = (items: MenuItem[]) =>
    items.filter((item) => {
      if (!permissions && userRole === 'ADMIN') return true;
      if (!permissions) return true;
      return permissions.includes(item.module);
    });

  const filteredGroups = menuGroups
    .map((group) => ({ ...group, items: filterItems(group.items) }))
    .filter((group) => group.items.length > 0);

  const allItems = filteredGroups.flatMap((g) => g.items);

  // All labeled groups start open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(menuGroups.filter((g) => g.label).map((g) => [g.label!, true])),
  );

  // Auto-open group that contains the active route
  useEffect(() => {
    menuGroups.forEach((group) => {
      if (!group.label) return;
      const hasActive = group.items.some(
        (item) => pathname === item.href || pathname?.startsWith(item.href + '/'),
      );
      if (hasActive) {
        setOpenGroups((prev) => ({ ...prev, [group.label!]: true }));
      }
    });
  }, [pathname]);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  const isItemActive = (item: MenuItem) =>
    pathname === item.href ||
    (pathname?.startsWith(item.href + '/') &&
      !allItems.some(
        (other) =>
          other.href !== item.href &&
          other.href.startsWith(item.href + '/') &&
          (pathname === other.href || pathname?.startsWith(other.href + '/')),
      ));

  const NavItem = ({ item, isMobile }: { item: MenuItem; isMobile: boolean }) => {
    const isActive = isItemActive(item);
    return (
      <Link
        href={item.href}
        className={cn(
          'flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200',
          isActive
            ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
          collapsed && !isMobile && 'justify-center px-2',
        )}
        title={collapsed && !isMobile ? item.title : undefined}
      >
        <item.icon className="w-5 h-5 flex-shrink-0" />
        {(!collapsed || isMobile) && <span className="font-medium">{item.title}</span>}
      </Link>
    );
  };

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

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => {
    const showExpanded = !collapsed || isMobile;

    return (
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center space-x-2 overflow-hidden">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Plane className="w-4 h-4 text-white" />
            </div>
            {showExpanded && (
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

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <div className="space-y-0.5">
            {filteredGroups.map((group, groupIndex) => {
              // Standalone items (no group label — e.g. Dashboard)
              if (!group.label) {
                return (
                  <div key={`standalone-${groupIndex}`} className="space-y-0.5">
                    {group.items.map((item) => (
                      <NavItem key={item.href} item={item} isMobile={isMobile} />
                    ))}
                  </div>
                );
              }

              // Collapsed sidebar: thin separator + flat icon list
              if (!showExpanded) {
                return (
                  <div key={group.label}>
                    <div className="h-px bg-gray-200 dark:bg-gray-800 mx-1 my-1.5" />
                    <div className="space-y-0.5">
                      {group.items.map((item) => (
                        <NavItem key={item.href} item={item} isMobile={isMobile} />
                      ))}
                    </div>
                  </div>
                );
              }

              // Expanded sidebar: collapsible group
              const isOpen = openGroups[group.label] ?? true;
              return (
                <div key={group.label} className="mt-3 first:mt-0">
                  <button
                    onClick={() => toggleGroup(group.label!)}
                    className="w-full flex items-center justify-between px-3 py-1.5 mb-0.5 rounded-md group/header hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors duration-150"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 group-hover/header:text-gray-700 dark:group-hover/header:text-gray-300 transition-colors duration-150">
                      {group.label}
                    </span>
                    <ChevronDown
                      className={cn(
                        'w-3.5 h-3.5 text-gray-400 dark:text-gray-500 group-hover/header:text-gray-600 dark:group-hover/header:text-gray-400 transition-all duration-200',
                        !isOpen && '-rotate-90',
                      )}
                    />
                  </button>

                  {isOpen && (
                    <div className="space-y-0.5 animate-in slide-in-from-top-1 fade-in-0 duration-150">
                      {group.items.map((item) => (
                        <NavItem key={item.href} item={item} isMobile={isMobile} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>
      </div>
    );
  };

  return (
    <>
      <MobileMenuButton />

      {/* Mobile overlay */}
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
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <SidebarContent isMobile={true} />
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden md:block fixed left-0 top-0 z-40 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        <SidebarContent isMobile={false} />
      </aside>
    </>
  );
}
