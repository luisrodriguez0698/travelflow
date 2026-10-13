'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, UserRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { UserAvatar } from '@/components/user-avatar';
import { cn } from '@/lib/utils';

export interface CreatorOption {
  id: string; // id de usuario, o "none" (sin registro)
  name: string;
  avatar: string | null;
  count: number;
}

/** Filtro "Creado por": uno, varios o todos, con buscador. value vacio = todos. */
export function CreatorFilter({
  options,
  value,
  onChange,
  label = 'Creado por',
}: {
  options: CreatorOption[];
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  const selected = options.filter((o) => value.includes(o.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="justify-between font-normal min-w-[200px]">
          <span className="flex items-center gap-2 min-w-0">
            <UserRound className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="truncate">
              {value.length === 0 ? `${label}: todos` : value.length === 1 ? selected[0]?.name ?? '1 usuario' : `${label}: ${value.length}`}
            </span>
          </span>
          {value.length > 0 ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Quitar filtro"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              className="ml-2 rounded-full p-0.5 hover:bg-muted"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          ) : (
            <ChevronsUpDown className="ml-2 w-3.5 h-3.5 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar usuario…" />
          <CommandList>
            <CommandEmpty>Sin resultados</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__todos__" onSelect={() => onChange([])}>
                <Check className={cn('mr-2 w-4 h-4', value.length === 0 ? 'opacity-100' : 'opacity-0')} />
                Todos
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.id} value={`${o.name} ${o.id}`} onSelect={() => toggle(o.id)}>
                  <Check className={cn('mr-2 w-4 h-4', value.includes(o.id) ? 'opacity-100' : 'opacity-0')} />
                  <UserAvatar name={o.name} src={o.avatar} className="w-6 h-6 text-[9px] mr-2" />
                  <span className="flex-1 truncate">{o.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{o.count}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
