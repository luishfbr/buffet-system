"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { AgendaResponse } from "@buffet/shared";
import { api, errorMessage } from "@/lib/api";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonList } from "@/components/ui/skeleton";
import {
  addMonthsUTC,
  fromISODate,
  groupByDay,
  startOfMonthUTC,
  toISODate,
  todayUTC,
} from "@/lib/calendar";
import { MonthGrid } from "@/components/agenda/month-grid";
import { MonthNav } from "@/components/agenda/month-nav";
import { DayList } from "@/components/agenda/day-list";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Boundary exigido pelo App Router — `?date=` vem do alerta de conflito. */
export default function AgendaPage() {
  return (
    <Suspense fallback={<SkeletonList rows={5} label="Carregando agenda" />}>
      <AgendaView />
    </Suspense>
  );
}

function AgendaView() {
  // ?date=YYYY-MM-DD: o banner de conflito da negociação (RF21) e os próximos
  // eventos da home linkam para o dia exato.
  const dateParam = useSearchParams().get("date");
  const initialDay =
    dateParam && ISO_DATE.test(dateParam) ? dateParam : toISODate(todayUTC());

  const [month, setMonth] = useState(() => {
    const day = fromISODate(initialDay);
    return startOfMonthUTC(day.getUTCFullYear(), day.getUTCMonth());
  });
  const [selected, setSelected] = useState(initialDay);
  const [data, setData] = useState<AgendaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  // Busca o mês inteiro com folga de uma semana de cada lado: o grid mostra os
  // dias vizinhos que completam a primeira e a última semana.
  const range = useMemo(() => {
    const from = new Date(month);
    from.setUTCDate(from.getUTCDate() - 7);
    const to = addMonthsUTC(month, 1);
    to.setUTCDate(to.getUTCDate() + 7);
    return { from: toISODate(from), to: toISODate(to) };
  }, [month]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<AgendaResponse>(
      `/leads/agenda?from=${range.from}&to=${range.to}`
    );
    setData(res);
    setLoading(false);
  }, [range.from, range.to]);

  useEffect(() => {
    load().catch((err) => {
      setError(err);
      setLoading(false);
    });
  }, [load]);

  const eventsByDay = useMemo(
    () => groupByDay(data?.events ?? []),
    [data?.events]
  );
  const dayEvents = eventsByDay.get(selected) ?? [];

  function goToToday() {
    const today = todayUTC();
    setMonth(startOfMonthUTC(today.getUTCFullYear(), today.getUTCMonth()));
    setSelected(toISODate(today));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
          <p className="text-muted-foreground">
            Seus eventos por data. Dias em destaque têm mais de um evento.
          </p>
        </div>
        <MonthNav
          month={month}
          onChange={(delta) => setMonth((m) => addMonthsUTC(m, delta))}
          onToday={goToToday}
        />
      </div>

      {error ? (
        <EmptyState
          icon={AlertTriangle}
          title="Não foi possível carregar a agenda"
          description={errorMessage(error)}
          action={{ label: "Tentar de novo", onClick: () => void load() }}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          {/* Grid só a partir de sm: no celular, 7 colunas viram alvos
              pequenos demais — lá a lista do dia é a visão principal (RNF02). */}
          <div className="hidden sm:block">
            {loading ? (
              <Skeleton className="h-140 w-full" />
            ) : (
              <MonthGrid
                month={month}
                eventsByDay={eventsByDay}
                selected={selected}
                onSelect={setSelected}
              />
            )}
          </div>

          <div className="flex flex-col gap-4">
            {loading ? (
              <SkeletonList rows={3} label="Carregando eventos do dia" />
            ) : (
              <DayList day={selected} events={dayEvents} />
            )}

            {/* Sem data definida o lead não aparece na agenda. Dizer isso evita
                que o usuário conclua que as negociações sumiram. */}
            {!loading && data && data.undatedCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {data.undatedCount}{" "}
                {data.undatedCount === 1
                  ? "negociação está sem data"
                  : "negociações estão sem data"}{" "}
                e não aparecem aqui.{" "}
                <Link
                  href="/dashboard/leads"
                  className="font-medium text-brand underline-offset-4 hover:underline"
                >
                  Ver no funil
                </Link>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
