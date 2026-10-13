'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { COUNTRIES, formatPhone, parsePhone, phoneError, type Country } from '@/lib/phone';

/**
 * Telefono con pais (bandera + clave, con buscador) y limite de digitos segun
 * el pais (Mexico: 10). Entrega el valor como "+52 9611234567".
 */
export function PhoneInput({
  value,
  onChange,
  disabled,
  id,
  placeholder,
  className,
  showError = true,
}: {
  value: string | null | undefined;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  className?: string;
  showError?: boolean;
}) {
  const [country, setCountry] = useState<Country>(() => parsePhone(value).country);
  const [open, setOpen] = useState(false);
  const national = parsePhone(value, country.code).national;

  // Si el valor cambia desde fuera (cargar un cliente), se ajusta el pais
  useEffect(() => {
    if (value?.startsWith('+')) {
      const parsed = parsePhone(value, country.code);
      if (parsed.country.dial !== country.dial) setCountry(parsed.country);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const pick = (c: Country) => {
    setCountry(c);
    setOpen(false);
    onChange(formatPhone(c, national));
  };

  // Se revisa el numero tal como esta guardado (sin recortarlo): asi un telefono
  // anterior con digitos de mas se marca desde que se abre el formulario
  const error = showError && national ? phoneError(`+${country.dial} ${national}`) : null;

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              disabled={disabled}
              className="shrink-0 w-[104px] justify-between px-2.5 font-normal"
              aria-label={`País: ${country.name}`}
            >
              <span className="flex items-center gap-1.5">
                <span className="text-lg leading-none">{country.flag}</span>
                <span className="text-sm">+{country.dial}</span>
              </span>
              <ChevronsUpDown className="w-3.5 h-3.5 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar país o clave…" />
              <CommandList>
                <CommandEmpty>Sin resultados</CommandEmpty>
                <CommandGroup>
                  {COUNTRIES.map((c) => (
                    <CommandItem key={c.code} value={`${c.name} +${c.dial} ${c.code}`} onSelect={() => pick(c)}>
                      <span className="text-lg mr-2">{c.flag}</span>
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">+{c.dial}</span>
                      <Check className={cn('ml-2 w-4 h-4', c.code === country.code ? 'opacity-100' : 'opacity-0')} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          disabled={disabled}
          value={national}
          maxLength={country.max}
          placeholder={placeholder ?? `${country.min} dígitos`}
          onChange={(e) => onChange(formatPhone(country, e.target.value.replace(/\D/g, '')))}
          className="flex-1 min-w-0"
        />
      </div>
      {error && <p className="text-xs text-amber-600 dark:text-amber-400">{error}</p>}
    </div>
  );
}
