'use client';

import { useSession } from 'next-auth/react';
import { AnimatePresence, motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { UserAvatar } from './user-avatar';
import { usePresence } from './realtime-provider';

const MAX_VISIBLE = 3;

/** Caritas de los compañeros conectados ahora mismo (sin incluirte a ti). */
export function OnlineStack() {
  const { data: session } = useSession();
  const myId = (session?.user as { id?: string } | undefined)?.id;
  const { online } = usePresence();
  const others = online.filter((u) => u.id !== myId);
  if (others.length === 0) return null;

  const visible = others.slice(0, MAX_VISIBLE);
  const extra = others.length - visible.length;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="hidden md:flex items-center -space-x-2 pr-1" aria-label={`${others.length} en línea`}>
            <AnimatePresence initial={false}>
              {visible.map((u) => (
                <motion.span
                  key={u.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  className="rounded-full ring-2 ring-card"
                >
                  <UserAvatar name={u.name} src={u.avatar} className="w-7 h-7 text-[10px]" />
                </motion.span>
              ))}
            </AnimatePresence>
            {extra > 0 && (
              <span className="w-7 h-7 rounded-full ring-2 ring-card bg-muted text-[10px] font-semibold flex items-center justify-center">
                +{extra}
              </span>
            )}
            <span className="ml-3 relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent align="end">
          <p className="font-medium mb-1">En línea ahora</p>
          {others.map((u) => (
            <p key={u.id} className="text-xs opacity-90">{u.name}</p>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
