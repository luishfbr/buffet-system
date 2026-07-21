import { formatBRL } from "./money.js";

/**
 * Data used to interpolate the hardcoded proposal template (RF22).
 * The template is fixed and shared by every organization in the MVP; only the
 * dynamic variables below are substituted.
 */
export interface ProposalData {
  customerName: string;
  organizationName?: string | null;
  packageName?: string | null;
  eventDate?: string | Date | null;
  guestCount?: number | null;
  totalValue?: string | null;
}

/** Format a date value as pt-BR `DD/MM/AAAA`, or a dash when absent/invalid. */
function formatEventDate(value: string | Date | null | undefined): string {
  if (!value) return "a combinar";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "a combinar";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getUTCFullYear()}`;
}

/**
 * Build the textual proposal to copy into WhatsApp/Word (RF22). Fixed template
 * with the client's dynamic data interpolated.
 */
export function buildProposalText(data: ProposalData): string {
  const buffet = data.organizationName?.trim() || "nosso buffet";
  const lines: string[] = [
    `Olá, ${data.customerName}! 👋`,
    "",
    `Segue a proposta do seu evento com ${buffet}:`,
    "",
    `📦 Pacote: ${data.packageName?.trim() || "a definir"}`,
    `📅 Data do evento: ${formatEventDate(data.eventDate)}`,
    `👥 Convidados: ${data.guestCount != null ? data.guestCount : "a definir"}`,
    `💰 Valor total estimado: ${
      data.totalValue ? formatBRL(data.totalValue) : "a combinar"
    }`,
    "",
    "Valores sujeitos a confirmação. Qualquer dúvida, estamos à disposição!",
  ];
  return lines.join("\n");
}
