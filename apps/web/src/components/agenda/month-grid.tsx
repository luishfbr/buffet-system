"use client";

import {
  DATE_AVAILABILITY_LABELS,
  type AgendaEvent,
  type DateAvailabilityStatus,
} from "@buffet/shared";
import { AVAILABILITY_STYLE, availabilityOf } from "@/lib/availability";
import { cn } from "@/lib/utils";
import {
  WEEKDAY_LABELS,
  monthGridUTC,
  monthLabel,
  toISODate,
  todayUTC,
} from "@/lib/calendar";

/**
 * Grid mensal da agenda (RF31).
 *
 * É uma `<table>` de verdade, com `<caption>` e `<th scope="col">` — e não um
 * `role="grid"` com roving tabindex, que custaria muito mais código para pouco
 * ganho. Cada dia com evento é um `<button>` real, então funciona no teclado.
 *
 * Abaixo de `sm:` o grid some e a lista de dias assume (RNF02): 7 colunas de
 * células empilháveis num celular viram alvos pequenos demais para o dedo.
 */
export function MonthGrid({
  month,
  eventsByDay,
  availability,
  selected,
  onSelect,
}: {
  month: Date;
  eventsByDay: Map<string, AgendaEvent[]>;
  /** RF-V2-15: mesma fonte que o portal público lê — as duas visões concordam. */
  availability: Map<string, DateAvailabilityStatus>;
  selected: string | null;
  onSelect: (iso: string) => void;
}) {
  const weeks = monthGridUTC(month.getUTCFullYear(), month.getUTCMonth());
  const today = toISODate(todayUTC());
  const currentMonth = month.getUTCMonth();

  return (
    <table className="w-full table-fixed border-separate border-spacing-1">
      <caption className="sr-only">
        Agenda de {monthLabel(month)}. Dias com mais de um evento indicam
        conflito.
      </caption>
      <thead>
        <tr>
          {WEEKDAY_LABELS.map((label) => (
            <th
              key={label}
              scope="col"
              className="pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week, wi) => (
          <tr key={wi}>
            {week.map((day) => {
              const iso = toISODate(day);
              const events = eventsByDay.get(iso) ?? [];
              const outside = day.getUTCMonth() !== currentMonth;
              const conflict = events.length > 1;
              const isToday = iso === today;
              const isSelected = iso === selected;
              const status = availabilityOf(availability, iso);
              // `disponivel` é o padrão: marcar visualmente todo dia normal
              // encheria o mês de verde e apagaria o sinal dos que importam.
              const marked = status !== "disponivel";

              return (
                <td key={iso} className="p-0 align-top">
                  <button
                    type="button"
                    onClick={() => onSelect(iso)}
                    aria-current={isToday ? "date" : undefined}
                    aria-pressed={isSelected}
                    // O rótulo carrega o que a cor sozinha comunica.
                    aria-label={`${day.getUTCDate()} de ${monthLabel(day)}${
                      events.length === 0
                        ? ", sem eventos"
                        : `, ${events.length} evento${events.length > 1 ? "s" : ""}${
                            conflict ? " — conflito de agenda" : ""
                          }`
                    }${marked ? `, ${DATE_AVAILABILITY_LABELS[status]}` : ""}`}
                    className={cn(
                      "flex h-20 w-full flex-col items-start gap-1 rounded-md border p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      outside && "opacity-40",
                      isSelected
                        ? "border-brand bg-brand/10"
                        : "hover:bg-accent/50",
                      conflict && !isSelected && "border-brand/50 bg-brand/5",
                      // Anel, não fundo: o fundo já codifica conflito de agenda,
                      // e as duas informações precisam caber na mesma célula.
                      marked && `ring-2 ${AVAILABILITY_STYLE[status].ring}`
                    )}
                  >
                    <span
                      className="flex w-full items-center justify-between gap-1"
                    >
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        isToday
                          ? "flex h-5 w-5 items-center justify-center rounded-full bg-foreground font-semibold text-background"
                          : "text-muted-foreground"
                      )}
                    >
                      {day.getUTCDate()}
                    </span>
                    {marked && (
                      <span
                        aria-hidden
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          AVAILABILITY_STYLE[status].dot
                        )}
                      />
                    )}
                    </span>

                    {events.length > 0 && (
                      <span className="flex w-full flex-col gap-0.5 overflow-hidden">
                        {events.slice(0, 2).map((event) => (
                          <span
                            key={event.id}
                            className={cn(
                              "truncate rounded px-1 py-0.5 text-[0.65rem] leading-tight",
                              conflict
                                ? "bg-brand text-brand-foreground"
                                : "bg-secondary text-secondary-foreground"
                            )}
                          >
                            {event.customerName}
                          </span>
                        ))}
                        {events.length > 2 && (
                          <span className="px-1 text-[0.65rem] text-muted-foreground">
                            +{events.length - 2}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
