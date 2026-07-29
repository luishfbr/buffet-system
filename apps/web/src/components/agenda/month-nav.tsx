"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { monthLabel } from "@/lib/calendar";

/** Navegação entre meses da agenda (RF31). */
export function MonthNav({
  month,
  onChange,
  onToday,
}: {
  month: Date;
  onChange: (delta: -1 | 1) => void;
  onToday: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center rounded-md border">
        <button
          type="button"
          onClick={() => onChange(-1)}
          aria-label="Mês anterior"
          className="rounded-l-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onChange(1)}
          aria-label="Próximo mês"
          className="rounded-r-md border-l p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {/* `aria-live`: quem navega pelo teclado precisa ouvir o mês mudar. */}
      <p
        aria-live="polite"
        className="min-w-40 text-lg font-semibold capitalize"
      >
        {monthLabel(month)}
      </p>
      <Button variant="outline" size="sm" onClick={onToday}>
        Hoje
      </Button>
    </div>
  );
}
