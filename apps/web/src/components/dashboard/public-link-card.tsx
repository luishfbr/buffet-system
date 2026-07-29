"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { appHost, publicUrl } from "@/lib/onboarding";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Link público da organização (RF17), pronto para copiar e divulgar.
 *
 * Extraído porque o mesmo bloco existia duplicado no fim do onboarding e na
 * home do painel — dois lugares para corrigir quando a copy mudasse.
 *
 * `layout="stacked"` é a versão do onboarding (botões em coluna, texto
 * centralizado); `"inline"` é a da home (link à esquerda, botões à direita).
 */
export function PublicLinkCard({
  slug,
  layout = "inline",
}: {
  slug: string | undefined;
  layout?: "inline" | "stacked";
}) {
  const [copied, setCopied] = useState(false);
  const url = slug ? publicUrl(slug) : "";

  async function copy() {
    if (!slug) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard indisponível — o link fica visível para cópia manual.
    }
  }

  const stacked = layout === "stacked";

  return (
    <div
      className={cn(
        "rounded-xl border border-brand/30 bg-brand/5",
        stacked ? "w-full p-4" : "p-5"
      )}
    >
      <div
        className={cn(
          stacked
            ? "flex flex-col"
            : "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        )}
      >
        <div className="min-w-0">
          <span className="font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
            Sua página pública
          </span>
          <p
            className={cn(
              "mt-1 font-mono text-sm",
              stacked ? "break-all" : "truncate"
            )}
          >
            <span className="text-muted-foreground">{appHost()}/</span>
            <span className="font-semibold text-brand">{slug ?? "..."}</span>
          </p>
        </div>

        <div
          className={cn(
            "flex gap-2",
            stacked ? "mt-4 flex-col sm:flex-row" : "shrink-0"
          )}
        >
          <Button
            type="button"
            variant="brand"
            onClick={copy}
            disabled={!slug}
            className={stacked ? "flex-1" : undefined}
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
          {slug && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir página pública em nova aba"
              className={cn(
                buttonVariants({ variant: "outline" }),
                stacked && "flex-1"
              )}
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              <span className={stacked ? undefined : "hidden sm:inline"}>
                {stacked ? "Abrir página" : "Abrir"}
              </span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
