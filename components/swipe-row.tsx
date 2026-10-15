'use client';

import { useRef, useState } from 'react';
import { animate, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { Mail, MailOpen, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Fila deslizable estilo iPhone:
//  · a la derecha  -> marcar leida / no leida
//  · a la izquierda (corto) -> deja ver los botones Leida y Eliminar
//  · a la izquierda (hasta el fondo) -> elimina
// En computadora los mismos botones aparecen al pasar el mouse.

const ACTIONS_WIDTH = 148;

interface SwipeRowProps {
  read: boolean;
  onToggleRead: () => void;
  onDelete: () => void;
  onOpen: () => void;
  children: React.ReactNode;
  className?: string;
  /** Botones al pasar el mouse (computadora). */
  hoverActions?: boolean;
}

export function SwipeRow({ read, onToggleRead, onDelete, onOpen, children, className, hoverActions = true }: SwipeRowProps) {
  const x = useMotionValue(0);
  const row = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);
  const [openSide, setOpenSide] = useState<'none' | 'actions'>('none');

  // Fondos que aparecen al deslizar
  const leftBgOpacity = useTransform(x, [0, 60], [0, 1]);
  const rightBgOpacity = useTransform(x, [-60, 0], [1, 0]);
  const deleteIconScale = useTransform(x, [-220, -120], [1.25, 1]);

  const snap = (to: number) => animate(x, to, { type: 'spring', stiffness: 420, damping: 38 });

  const remove = () => {
    const width = row.current?.offsetWidth ?? 400;
    animate(x, -width, { duration: 0.2, ease: 'easeIn' }).then(onDelete);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const width = row.current?.offsetWidth ?? 400;
    const offset = info.offset.x;
    const fast = info.velocity.x;
    if (offset > 70 || fast > 600) {
      onToggleRead();
      snap(0);
      setOpenSide('none');
    } else if (offset < -width * 0.5 || fast < -1200) {
      remove();
    } else if (offset < -50) {
      snap(-ACTIONS_WIDTH);
      setOpenSide('actions');
    } else {
      snap(0);
      setOpenSide('none');
    }
    // El click que dispara el navegador al soltar no debe abrir la notificacion
    setTimeout(() => {
      dragged.current = false;
    }, 50);
  };

  return (
    <div ref={row} className={cn('group relative overflow-hidden', className)}>
      {/* Fondo al deslizar a la derecha: leida / no leida */}
      <motion.div style={{ opacity: leftBgOpacity }} className="absolute inset-0 flex items-center bg-blue-600 pl-5 text-white">
        <span className="flex items-center gap-2 text-sm font-semibold">
          {read ? <Mail className="h-5 w-5" /> : <MailOpen className="h-5 w-5" />}
          {read ? 'No leída' : 'Leída'}
        </span>
      </motion.div>

      {/* Fondo al deslizar a la izquierda: botones */}
      <motion.div style={{ opacity: rightBgOpacity }} className="absolute inset-y-0 right-0 flex w-full justify-end bg-red-600">
        <button
          type="button"
          onClick={() => {
            onToggleRead();
            snap(0);
            setOpenSide('none');
          }}
          className="flex w-[74px] flex-col items-center justify-center gap-1 bg-slate-500 text-[11px] font-semibold text-white"
        >
          {read ? <Mail className="h-5 w-5" /> : <MailOpen className="h-5 w-5" />}
          {read ? 'No leída' : 'Leída'}
        </button>
        <button type="button" onClick={remove} className="flex w-[74px] flex-col items-center justify-center gap-1 text-[11px] font-semibold text-white">
          <motion.span style={{ scale: deleteIconScale }}>
            <Trash2 className="h-5 w-5" />
          </motion.span>
          Eliminar
        </button>
      </motion.div>

      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -10000, right: 140 }}
        dragElastic={{ left: 0.9, right: 0.4 }}
        style={{ x, touchAction: 'pan-y' }}
        onDragStart={() => {
          dragged.current = true;
        }}
        onDragEnd={onDragEnd}
        onClick={() => {
          if (dragged.current) return;
          if (openSide === 'actions') {
            snap(0);
            setOpenSide('none');
            return;
          }
          onOpen();
        }}
        className="relative cursor-pointer bg-background"
      >
        {children}

        {/* Computadora: botones al pasar el mouse */}
        {hoverActions && (
        <div className="pointer-events-none absolute bottom-2.5 right-3 hidden gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 [@media(hover:hover)]:flex">
          <button
            type="button"
            title={read ? 'Marcar como no leída' : 'Marcar como leída'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleRead();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm hover:text-foreground"
          >
            {read ? <Mail className="h-3.5 w-3.5" /> : <MailOpen className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            title="Eliminar"
            onClick={(e) => {
              e.stopPropagation();
              remove();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        )}
      </motion.div>
    </div>
  );
}
