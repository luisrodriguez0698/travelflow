'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, X, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { cn } from '@/lib/utils';

export interface MultiSelectOption {
  id: string;
  label: string;
  /** Texto extra para el buscador (telefono, etc.) */
  keywords?: string;
  count?: number;
}

/**
 * Filtro de seleccion multiple con buscador (mismo estilo que "Creado por").
 * value vacio = todos.
 */
export function MultiSelectFilter({
  options,
  value,
  onChange,
  label,
  icon: Icon,
  placeholder = 'Buscar…',
  emptyText = 'Sin resultados',
}: {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  label: string;
  icon: LucideIcon;
  placeholder?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  const selected = options.filter((o) => value.includes(o.id));

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn('h-9 w-full justify-between font-normal sm:w-auto sm:min-w-[170px]', value.length > 0 && 'border-blue-500 bg-blue-50 dark:bg-blue-950/20')}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="max-w-[160px] truncate">
              {value.length === 0 ? label : value.length === 1 ? selected[0]?.label ?? label : `${label}: ${value.length}`}
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
              <X className="h-3.5 w-3.5" />
            </span>
          ) : (
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__todos__" onSelect={() => onChange([])}>
                <Check className={cn('mr-2 h-4 w-4', value.length === 0 ? 'opacity-100' : 'opacity-0')} />
                Todos
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.id} value={`${o.label} ${o.keywords ?? ''} ${o.id}`} onSelect={() => toggle(o.id)}>
                  <Check className={cn('mr-2 h-4 w-4', value.includes(o.id) ? 'opacity-100' : 'opacity-0')} />
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.count !== undefined && <span className="ml-2 text-xs text-muted-foreground">{o.count}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
