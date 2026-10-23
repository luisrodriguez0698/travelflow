'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { MoreVertical, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface RowAction {
  label: string;
  icon?: LucideIcon;
  /** Navega a esta ruta */
  href?: string;
  onSelect?: () => void;
  /** Rojo (eliminar, anular…) */
  destructive?: boolean;
  /** Linea divisoria antes de esta accion */
  separator?: boolean;
  hidden?: boolean;
}

/** Menu de "tres puntitos" con las acciones de una fila de tabla. */
export function RowActions({ actions, label = 'Acciones', className }: { actions: RowAction[]; label?: string; className?: string }) {
  const visible = actions.filter((a) => !a.hidden);
  if (!visible.length) return null;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn('h-8 w-8 text-muted-foreground data-[state=open]:bg-muted', className)} aria-label={label} title={label}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {visible.map((a, i) => {
          const Icon = a.icon;
          const content = (
            <>
              {Icon && <Icon className="mr-2 h-4 w-4" />}
              {a.label}
            </>
          );
          const itemClass = a.destructive ? 'text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400' : undefined;
          return (
            <Fragment key={a.label}>
              {a.separator && i > 0 && <DropdownMenuSeparator />}
              {a.href ? (
                <DropdownMenuItem asChild className={itemClass}>
                  <Link href={a.href}>{content}</Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={a.onSelect} className={itemClass}>
                  {content}
                </DropdownMenuItem>
              )}
            </Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
