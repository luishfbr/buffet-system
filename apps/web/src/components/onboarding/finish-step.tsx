"use client";

import { useState } from "react";
import { ArrowRight, Copy, ExternalLink, Check } from "lucide-react";
import { publicUrl, appHost } from "@/lib/onboarding";
import { Button } from "@/components/ui/button";

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
  const [copied, setCopied] = useState(false);
  const url = publicUrl(slug);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard indisponível — o link fica visível para cópia manual.
    }
  }

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

      {/* Link público em destaque (RF17). */}
      <div className="w-full rounded-xl border border-brand/30 bg-brand/5 p-4">
        <span className="font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
          Sua página pública
        </span>
        <p className="mt-1.5 break-all font-mono text-sm">
          <span className="text-muted-foreground">{appHost()}/</span>
          <span className="font-semibold text-brand">{slug}</span>
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="brand"
            className="flex-1"
            onClick={copy}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" aria-hidden="true" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" aria-hidden="true" />
                Copiar link
              </>
            )}
          </Button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Abrir página
          </a>
        </div>
      </div>

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
