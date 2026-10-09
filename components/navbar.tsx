'use client';

import { useSession, signOut } from 'next-auth/react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Moon, Sun, UserCircle, LogOut, Building2, CalendarDays, Menu } from 'lucide-react';
import { useTheme } from 'next-themes';
import { NotificationPanel } from './notification-panel';
import { TripStatusPanel } from './trip-status-panel';
import Link from 'next/link';
import { HelpMenu } from './help-tour';
import { useSidebar } from './sidebar-context';
import { useCan } from '@/hooks/use-can';

function initials(name: string) {
  return name.split(' ').filter(Boolean).map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';
}

export function Navbar() {
  const { data: session } = useSession() || {};
  const { theme, setTheme } = useTheme();
  const { setMobileOpen } = useSidebar();
  const can = useCan();
  const userName = session?.user?.name || session?.user?.email || '';
  const isDark = theme === 'dark';

  return (
    // Barra fija tipo app; en iPhone instalado respeta la zona de la hora/bateria
    <header
      className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex items-center justify-between gap-2 h-14 lg:h-16 px-2 sm:px-4 lg:px-6">
        <div className="flex items-center gap-1 min-w-0">
          {/* Menu lateral (solo movil/tablet) */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden shrink-0"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-foreground truncate">
            {(session?.user as any)?.tenantName || 'TravelFlow'}
          </h2>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-2 lg:gap-3 shrink-0">
          {/* Calendario: en movil vive dentro del menu de perfil */}
          {can('ventas') && (
            <Link href="/calendar" className="hidden sm:inline-flex">
              <Button data-tour="navbar-calendar" variant="ghost" size="icon" aria-label="Calendario">
                <CalendarDays className="h-5 w-5" />
              </Button>
            </Link>
          )}

          <span data-tour="navbar-trips"><TripStatusPanel /></span>

          <span data-tour="navbar-notifications"><NotificationPanel /></span>

          {/* Tema: en movil vive dentro del menu de perfil */}
          <Button
            data-tour="navbar-theme"
            variant="ghost"
            size="icon"
            className="hidden sm:inline-flex"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label={isDark ? 'Modo claro' : 'Modo oscuro'}
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          <HelpMenu />

          {/* Perfil. modal={false}: no bloquea el scroll ni "empuja" la pagina al abrir */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button data-tour="navbar-user" variant="ghost" size="icon" className="rounded-full" aria-label="Mi cuenta">
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-xs font-semibold flex items-center justify-center">
                  {initials(userName)}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" collisionPadding={12} className="w-64 max-w-[calc(100vw-24px)]">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1 min-w-0">
                  <p className="text-sm font-medium truncate">{userName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {session?.user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/profile">
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Mi perfil</span>
                </Link>
              </DropdownMenuItem>
              {/* En movil: lo que no cabe en la barra */}
              {can('ventas') && (
                <DropdownMenuItem asChild className="cursor-pointer sm:hidden">
                  <Link href="/calendar">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    <span>Calendario</span>
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="cursor-pointer sm:hidden"
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
              >
                {isDark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                <span>{isDark ? 'Modo claro' : 'Modo oscuro'}</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="opacity-100">
                <Building2 className="mr-2 h-4 w-4" />
                <span className="truncate">{(session?.user as any)?.tenantName}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 dark:text-red-400 cursor-pointer"
                onClick={() => signOut({ callbackUrl: '/login' })}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
