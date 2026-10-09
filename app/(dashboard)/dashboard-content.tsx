'use client';

import { useSidebar } from '@/components/sidebar-context';
import { cn } from '@/lib/utils';

export function DashboardContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div
      className={cn(
        // overflow-x-clip: nada puede ensanchar la pagina hacia los lados en movil
        // (clip, no hidden, para no romper la barra superior sticky)
        'transition-all duration-300 min-w-0 overflow-x-clip',
        collapsed ? 'lg:pl-16' : 'lg:pl-64'
      )}
    >
      {children}
    </div>
  );
}
