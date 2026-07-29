"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import {
  LEAD_STATUS_LABELS,
  formatBRL,
  type AgendaEvent,
} from "@buffet/shared";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { fromISODate } from "@/lib/calendar";

function longDate(iso: string): string {
  return fromISODate(iso).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

/**
 * Eventos do dia selecionado (RF31). No mobile é a visão principal — o grid de
 * 7 colunas fica escondido abaixo de `sm:` (RNF02).
 */
export function DayList({
  day,
  events,
}: {
  day: string;
  events: AgendaEvent[];
}) {
  const conflict = events.length > 1;

  return (
    <section aria-labelledby="dia-title" className="flex flex-col gap-3">
      <h2 id="dia-title" className="text-lg font-semibold capitalize">
        {longDate(day)}
      </h2>

      {/* RF21: mesma regra de conflito do detalhe da negociação — mais de um
          evento não perdido no mesmo dia. Avisa, nunca bloqueia. */}
      {conflict && (
        <Alert variant="warning" title="Conflito de agenda">
          Há {events.length} eventos nesta data. Confirme se a equipe e a
          estrutura atendem os dois.
        </Alert>
      )}

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nenhum evento neste dia"
          description="Escolha outro dia no calendário ou defina a data de uma negociação."
          action={{ label: "Ver negociações", href: "/dashboard/leads" }}
        />
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card shadow">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/dashboard/leads?open=${event.id}`}
                className="flex flex-col gap-1 p-4 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {event.customerName}
                  </span>
                  <Badge variant="muted">
                    {LEAD_STATUS_LABELS[event.status]}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {[
                    event.packageName,
                    event.guestCount ? `${event.guestCount} convidados` : null,
                    event.totalValue ? formatBRL(event.totalValue) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Sem pacote definido"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
