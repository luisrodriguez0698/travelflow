'use client';

import { useSidebar } from '@/components/sidebar-context';
import { cn } from '@/lib/utils';

export function DashboardContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div
      className={cn(
        'transition-all duration-300',
        collapsed ? 'md:pl-16' : 'md:pl-64'
      )}
    >
      {children}
    </div>
  );
}
