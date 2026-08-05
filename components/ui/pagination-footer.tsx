'use client';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const PAGE_SIZE_OPTIONS = [20, 30, 40, 50, 100];

interface PaginationFooterProps {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

export function PaginationFooter({ page, limit, total, totalPages, onPageChange, onLimitChange }: PaginationFooterProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 px-4 py-3 border-t">
      <p className="text-sm text-muted-foreground">
        {total === 0 ? 'Sin resultados' : `Mostrando ${(page - 1) * limit + 1}-${Math.min(page * limit, total)} de ${total}`}
      </p>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Filas por página</span>
          <Select value={String(limit)} onValueChange={(v) => onLimitChange(Number(v))}>
            <SelectTrigger className="w-[76px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground px-1 whitespace-nowrap">
            Página {page} de {totalPages || 1}
          </span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
