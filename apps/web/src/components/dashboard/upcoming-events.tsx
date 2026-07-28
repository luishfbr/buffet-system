"use client";

import Link from "next/link";
import { CalendarDays, TriangleAlert } from "lucide-react";
import {
  LEAD_STATUS_LABELS,
  type DashboardUpcomingEvent,
} from "@buffet/shared";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

/** Data do evento em pt-BR. UTC porque `eventDate` é uma data-sem-hora. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Próximos eventos confirmados ou em negociação (RF29). */
export function UpcomingEvents({
  events,
}: {
  events: DashboardUpcomingEvent[];
}) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Nenhum evento agendado"
        description="Negociações com data definida aparecem aqui, da mais próxima para a mais distante."
        action={{ label: "Ver negociações", href: "/dashboard/leads" }}
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y rounded-xl border bg-card shadow">
      {events.map((event) => (
        <li key={event.id}>
          {/* Leva direto à negociação aberta — o deep link `?open=` da página
              de negociações (RF19). */}
          <Link
            href={`/dashboard/leads?open=${event.id}`}
            className="flex items-center gap-4 p-4 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            <div className="flex w-20 shrink-0 flex-col">
              <span className="text-sm font-medium tabular-nums">
                {formatDate(event.eventDate)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{event.customerName}</p>
              <p className="truncate text-sm text-muted-foreground">
                {event.guestCount ? `${event.guestCount} convidados` : "Sem número de convidados"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="muted">{LEAD_STATUS_LABELS[event.status]}</Badge>
            </div>
          </Link>

          {/* RF21 + RF31: o aviso de conflito leva ao dia na agenda. Fica fora
              do link da negociação — link dentro de link é HTML inválido. */}
          {event.hasConflict && (
            <div className="px-4 pb-3 -mt-2">
              <Link
                href={`/dashboard/agenda?date=${event.eventDate.slice(0, 10)}`}
                className="inline-flex items-center gap-1 text-xs text-brand underline-offset-4 hover:underline"
              >
                <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                Outro evento nesta data — ver na agenda
              </Link>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
