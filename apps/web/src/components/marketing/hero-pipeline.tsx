import { Check, Users } from "lucide-react";
import { LEAD_STATUS_LABELS, type LeadStatus, formatBRL } from "@buffet/shared";
import { cn } from "@/lib/utils";

// Assinatura da landing (RF17/RF18/RF19/RF23): traduz visualmente o arco
// "página pública → estimativa instantânea → funil → parcela paga".
// Valores estáticos ilustrativos, formatados pelos helpers reais do domínio.

const GUEST_COUNT = 120;
const PRICE_PER_PERSON = "150"; // R$ 150,00/pessoa (ex.: "Pacote Ouro")
const TOTAL = "18000"; // PRICE_PER_PERSON × GUEST_COUNT
const DEPOSIT = "6000";

const STAGES: { key: LeadStatus; done: boolean; current: boolean }[] = [
  { key: "novo", done: true, current: false },
  { key: "em_negociacao", done: true, current: false },
  { key: "aprovado", done: false, current: true },
];

export function HeroPipeline() {
  return (
    <div className="animate-rise-in rounded-2xl border bg-card p-2 shadow-2xl shadow-black/30">
      {/* Chrome — reforça que cada buffet ganha o próprio link público (RF17) */}
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
        </span>
        <span className="ml-1 font-mono text-xs text-muted-foreground">
          buffetsystem.com/villa-eventos
        </span>
      </div>

      <div className="flex flex-col gap-4 rounded-xl bg-background/60 p-4 sm:p-5">
        {/* Lead + estimativa instantânea (RF18) */}
        <div
          className="animate-rise-in flex items-center justify-between gap-4"
          style={{ animationDelay: "120ms" }}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Ana Beatriz · Casamento</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {GUEST_COUNT} convidados × {formatBRL(PRICE_PER_PERSON)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
              Estimativa
            </p>
            <p className="font-mono text-lg font-semibold text-brand sm:text-xl">
              {formatBRL(TOTAL)}
            </p>
          </div>
        </div>

        {/* Pipeline — o lead avançando no funil (RF19) */}
        <div className="relative flex items-center justify-between gap-1 pt-1">
          <span
            className="animate-grow-line absolute left-4 right-4 top-[1.35rem] h-px bg-border"
            style={{ animationDelay: "260ms" }}
            aria-hidden="true"
          />
          {STAGES.map((stage, i) => (
            <div
              key={stage.key}
              className="animate-rise-in relative z-10 flex flex-1 flex-col items-center gap-2"
              style={{ animationDelay: `${360 + i * 130}ms` }}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                  stage.current
                    ? "border-brand bg-brand text-brand-foreground"
                    : stage.done
                      ? "border-brand/40 bg-brand/10 text-brand"
                      : "bg-card text-muted-foreground",
                )}
              >
                {stage.done && !stage.current ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={cn(
                  "text-center text-[0.7rem] leading-tight",
                  stage.current
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {LEAD_STATUS_LABELS[stage.key]}
              </span>
            </div>
          ))}
        </div>

        {/* Financeiro — parcela dada como paga (RF23/RF24) */}
        <div
          className="animate-rise-in flex items-center justify-between rounded-lg border border-brand/20 bg-brand/5 px-3 py-2.5"
          style={{ animationDelay: "760ms" }}
        >
          <span className="flex items-center gap-2 text-xs font-medium">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-brand-foreground">
              <Check className="h-3 w-3" aria-hidden="true" />
            </span>
            Entrada via PIX
          </span>
          <span className="font-mono text-sm font-semibold">
            {formatBRL(DEPOSIT)}
          </span>
        </div>
      </div>
    </div>
  );
}
