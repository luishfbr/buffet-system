/**
 * Matemática de calendário da agenda (RF31) — **tudo em UTC**.
 *
 * `new Date(y, m, d)` é construído no fuso local: em `America/Sao_Paulo`
 * (UTC-3) o dia 1 vira 03:00 do dia anterior em UTC, e o evento aparece na
 * célula errada do grid. É a mesma razão pela qual o app inteiro renderiza
 * datas com `timeZone: "UTC"` — `eventDate` é uma data-sem-hora guardada à
 * meia-noite UTC.
 */

/** Sempre 6 linhas: senão o grid muda de altura ao navegar entre meses. */
export const WEEKS_IN_GRID = 6;
const DAYS_IN_WEEK = 7;

export const WEEKDAY_LABELS = [
  "dom",
  "seg",
  "ter",
  "qua",
  "qui",
  "sex",
  "sáb",
] as const;

/** `YYYY-MM-DD` de uma data, em UTC. É a chave de agrupamento por dia. */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Meia-noite UTC de um `YYYY-MM-DD`. */
export function fromISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Primeiro dia do mês, em UTC. */
export function startOfMonthUTC(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 1));
}

/** Soma meses preservando o dia 1 — nunca "estoura" para o mês seguinte. */
export function addMonthsUTC(date: Date, months: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)
  );
}

/**
 * Grid do mês: 6 semanas × 7 dias, começando no domingo da semana que contém
 * o dia 1. Inclui os dias vizinhos que completam a primeira e a última semana.
 */
export function monthGridUTC(year: number, month: number): Date[][] {
  const first = startOfMonthUTC(year, month);
  const gridStart = new Date(first);
  gridStart.setUTCDate(gridStart.getUTCDate() - first.getUTCDay());

  const weeks: Date[][] = [];
  for (let w = 0; w < WEEKS_IN_GRID; w++) {
    const week: Date[] = [];
    for (let d = 0; d < DAYS_IN_WEEK; d++) {
      const day = new Date(gridStart);
      day.setUTCDate(gridStart.getUTCDate() + w * DAYS_IN_WEEK + d);
      week.push(day);
    }
    weeks.push(week);
  }
  return weeks;
}

/** Mês/ano por extenso em pt-BR, para o `<caption>` da tabela. */
export function monthLabel(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

/** Hoje, normalizado para meia-noite UTC — comparável com as chaves do grid. */
export function todayUTC(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

/**
 * Agrupa eventos por dia (`YYYY-MM-DD`). Um dia com mais de um evento é um
 * conflito de agenda — a mesma regra do RF21, derivada aqui em vez de
 * recodificada no servidor.
 */
export function groupByDay<T extends { eventDate: string }>(
  events: T[]
): Map<string, T[]> {
  const byDay = new Map<string, T[]>();
  for (const event of events) {
    // `eventDate` vem como ISO UTC do servidor; os 10 primeiros caracteres já
    // são o dia UTC — nada de `new Date(...)` e getDate() local aqui.
    const key = event.eventDate.slice(0, 10);
    const list = byDay.get(key);
    if (list) list.push(event);
    else byDay.set(key, [event]);
  }
  return byDay;
}
