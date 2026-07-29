"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DATE_AVAILABILITY_LABELS,
  DEFAULT_DATE_AVAILABILITY,
  PUBLIC_AVAILABILITY_DAYS,
  type DateAvailabilityStatus,
  type DateAvailabilityView,
} from "@buffet/shared";
import { AVAILABILITY_STYLE, availabilityIndex } from "@/lib/availability";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

/** Próximos N dias como `YYYY-MM-DD` UTC — mesma convenção do resto do app. */
function nextDays(count: number): string[] {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function dayNumber(iso: string): string {
  return iso.slice(8, 10);
}

function monthLabel(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    month: "short",
  });
}

/**
 * Calendário de disponibilidade no portal público (RF-V2-14).
 *
 * **Informativo, nunca bloqueante.** Uma data vermelha continua clicável e o
 * formulário continua enviável: o buffet pode abrir exceção, e transformar um
 * aviso em trava faria o site recusar um cliente que o dono aceitaria. Clicar
 * preenche a data no formulário; escolher uma indisponível mostra um aviso e
 * segue.
 *
 * Faixa horizontal em vez de grade mensal: são 60 dias corridos a partir de
 * hoje, e o cliente está decidindo "quando", não navegando um calendário. A
 * grade obrigaria controles de mês numa tela que é, antes de tudo, um
 * formulário.
 */
export function AvailabilityCalendar({
  slug,
  value,
  onSelect,
  preview = false,
}: {
  slug: string;
  /** Data escolhida no formulário, para o calendário refletir a seleção. */
  value: string;
  onSelect: (date: string) => void;
  /** Na prévia do editor não há rede: mostra tudo disponível. */
  preview?: boolean;
}) {
  const [rows, setRows] = useState<DateAvailabilityView[] | null>(
    preview ? [] : null
  );

  useEffect(() => {
    if (preview) return;
    let alive = true;
    fetch(`${API_URL}/public/orgs/${slug}/availability`)
      .then((r) => (r.ok ? r.json() : []))
      // Falha de rede não pode derrubar o formulário: sem dado, o calendário
      // some e o campo de data continua funcionando sozinho.
      .catch(() => [])
      .then((data: DateAvailabilityView[]) => {
        if (alive) setRows(data);
      });
    return () => {
      alive = false;
    };
  }, [slug, preview]);

  const index = useMemo(() => availabilityIndex(rows ?? []), [rows]);
  const days = useMemo(() => nextDays(PUBLIC_AVAILABILITY_DAYS), []);

  if (rows === null) return null;

  const selectedStatus: DateAvailabilityStatus =
    index.get(value) ?? DEFAULT_DATE_AVAILABILITY;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">Datas disponíveis</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {(["disponivel", "quase_cheio", "indisponivel"] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1">
              <span
                aria-hidden
                className={cn("size-1.5 rounded-full", AVAILABILITY_STYLE[s].dot)}
              />
              {DATE_AVAILABILITY_LABELS[s]}
            </span>
          ))}
        </span>
      </div>

      <ul
        // Rolagem horizontal: 60 dias não cabem, e paginar por mês pediria
        // controles que competiriam com o formulário.
        className="flex gap-1.5 overflow-x-auto pb-1"
      >
        {days.map((iso, i) => {
          const status = index.get(iso) ?? DEFAULT_DATE_AVAILABILITY;
          const selected = iso === value;
          const first = i === 0 || dayNumber(iso) === "01";
          return (
            <li key={iso} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(iso)}
                aria-pressed={selected}
                aria-label={`${dayNumber(iso)} de ${monthLabel(iso)} — ${
                  DATE_AVAILABILITY_LABELS[status]
                }`}
                className={cn(
                  "flex w-12 flex-col items-center gap-1 rounded-md border px-1 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "border-brand bg-brand/10 font-medium"
                    : "hover:bg-accent/50"
                )}
              >
                <span className="text-[0.6rem] uppercase text-muted-foreground">
                  {first ? monthLabel(iso) : " "}
                </span>
                <span className="tabular-nums">{dayNumber(iso)}</span>
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 rounded-full",
                    AVAILABILITY_STYLE[status].dot
                  )}
                />
              </button>
            </li>
          );
        })}
      </ul>

      {selectedStatus !== "disponivel" && (
        <p className={cn("text-xs", AVAILABILITY_STYLE[selectedStatus].text)}>
          {selectedStatus === "indisponivel"
            ? "Esta data está bloqueada na nossa agenda, mas você pode pedir o orçamento mesmo assim — entramos em contato para confirmar."
            : "Já temos evento nesta data. Ainda dá para encaixar — peça o orçamento e confirmamos."}
        </p>
      )}
    </div>
  );
}
