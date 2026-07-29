import {
  DEFAULT_DATE_AVAILABILITY,
  type DateAvailabilityStatus,
  type DateAvailabilityView,
} from "@buffet/shared";

/**
 * Vocabulário visual da disponibilidade (RF-V2-13 a RF-V2-15).
 *
 * Verde/âmbar/vermelho é a convenção que o requisito pede e que o cliente já
 * entende de qualquer calendário. **Não** usa o âmbar da marca: aqui a cor é
 * semáforo, não identidade — reaproveitar `--brand` faria "quase cheio" parecer
 * destaque em vez de aviso.
 */
export const AVAILABILITY_STYLE: Record<
  DateAvailabilityStatus,
  { dot: string; ring: string; text: string }
> = {
  disponivel: {
    dot: "bg-emerald-500",
    ring: "ring-emerald-500/40",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  quase_cheio: {
    dot: "bg-amber-500",
    ring: "ring-amber-500/50",
    text: "text-amber-700 dark:text-amber-400",
  },
  indisponivel: {
    dot: "bg-red-500",
    ring: "ring-red-500/50",
    text: "text-red-700 dark:text-red-400",
  },
};

/**
 * Índice `YYYY-MM-DD → status`, já com o padrão preenchido na leitura.
 *
 * A API só devolve as datas configuradas (RF-V2-13); quem consulta pergunta
 * "como está o dia X" e não deveria precisar saber dessa economia.
 */
export function availabilityIndex(
  rows: DateAvailabilityView[]
): Map<string, DateAvailabilityStatus> {
  return new Map(rows.map((r) => [r.date, r.status]));
}

export function availabilityOf(
  index: Map<string, DateAvailabilityStatus>,
  date: string
): DateAvailabilityStatus {
  return index.get(date) ?? DEFAULT_DATE_AVAILABILITY;
}
