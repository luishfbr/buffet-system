"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicLinkCard } from "@/components/dashboard/public-link-card";

// Passo final — reforça o resultado: o buffet agora tem uma página pública com
// URL para copiar e divulgar (RF17). O CTA leva ao painel.

export function FinishStep({
  orgName,
  slug,
  percent,
  onGoDashboard,
}: {
  orgName: string;
  slug: string;
  percent: number;
  onGoDashboard: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-6 py-12 text-center">
      <span
        className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-3xl"
        aria-hidden="true"
      >
        🎉
      </span>

      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-balance">
          Tudo pronto, {orgName}!
        </h1>
        <p className="mt-2 text-muted-foreground">
          Seu buffet está no ar com {percent}% do catálogo configurado. Compartilhe
          o link abaixo — cada visita pode virar um orçamento no seu funil.
        </p>
      </div>

      {/* Link público em destaque (RF17) — mesmo card da home do painel. */}
      <PublicLinkCard slug={slug} layout="stacked" />

      <Button
        type="button"
        size="lg"
        onClick={onGoDashboard}
        className="mt-2"
      >
        Ir para o painel
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
