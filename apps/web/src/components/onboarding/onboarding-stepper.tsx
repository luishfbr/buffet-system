import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Reusa a linguagem visual do HeroPipeline (círculo + linha + check) para o
// stepper do onboarding — mesmos estados done/current/pending.

export interface OnboardingStep {
  key: string;
  label: string;
}

export function OnboardingStepper({
  steps,
  currentIndex,
}: {
  steps: readonly OnboardingStep[];
  currentIndex: number;
}) {
  return (
    <ol
      className="relative flex items-start justify-between gap-1"
      aria-label="Progresso do onboarding"
    >
      {/* Linha de base atrás dos círculos (igual ao HeroPipeline). */}
      <span
        className="absolute left-4 right-4 top-4 h-px bg-border"
        aria-hidden="true"
      />
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        return (
          <li
            key={step.key}
            className="relative z-10 flex flex-1 flex-col items-center gap-2"
          >
            <span
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                current
                  ? "border-brand bg-brand text-brand-foreground"
                  : done
                    ? "border-brand/40 bg-brand/10 text-brand"
                    : "bg-card text-muted-foreground",
              )}
            >
              {done ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
            </span>
            <span
              className={cn(
                "hidden text-center text-[0.7rem] leading-tight sm:block",
                current
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
