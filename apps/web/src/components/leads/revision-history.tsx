"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatBRL, type RevisionView } from "@buffet/shared";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { SkeletonList } from "@/components/ui/skeleton";
import type { BadgeVariant } from "@/components/ui/badge";

const STATE_BADGE: Record<RevisionView["state"], BadgeVariant> = {
  ativa: "default",
  expirada: "muted",
  superada: "outline",
};

const STATE_LABEL: Record<RevisionView["state"], string> = {
  ativa: "Ativa",
  expirada: "Expirada",
  superada: "Superada",
};

/** Carimbo de tempo real → horário local (mesma exceção da linha do tempo). */
function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Histórico de revisões da proposta (RF-V2-12).
 *
 * Cada revisão é o que o cliente **recebeu**, com os preços daquele momento —
 * por isso os itens vêm do snapshot e não do catálogo. Reajustar um pacote hoje
 * não pode reescrever o que foi enviado semana passada.
 *
 * Colapsadas por padrão: o que interessa de relance é a sequência de valores e
 * qual está valendo; o detalhamento é consulta pontual, quando o cliente
 * pergunta "o que mudou da v1 para a v2".
 */
export function RevisionHistory({
  leadId,
  refreshToken = 0,
}: {
  leadId: string;
  /** Incrementado pelo pai quando uma transição pode ter criado revisão. */
  refreshToken?: number;
}) {
  const [revisions, setRevisions] = useState<RevisionView[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRevisions(await api.get<RevisionView[]>(`/leads/${leadId}/revisions`));
  }, [leadId]);

  useEffect(() => {
    load().catch(() => setRevisions([]));
  }, [load, refreshToken]);

  if (revisions === null) {
    return <SkeletonList rows={2} label="Carregando revisões" />;
  }
  // Sem revisão a seção some inteira: uma negociação que nunca enviou proposta
  // não tem histórico a explicar, e um vazio aqui só ocuparia espaço.
  if (revisions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Revisões da proposta</h3>
      <ol className="flex flex-col gap-2">
        {revisions.map((r) => {
          const expanded = open === r.id;
          return (
            <li key={r.id} className="rounded-md border bg-muted/20">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : r.id)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="font-display font-semibold">
                  v{r.revisionNumber}
                </span>
                <Badge variant={STATE_BADGE[r.state]}>
                  {STATE_LABEL[r.state]}
                </Badge>
                <span className="ml-auto tabular-nums font-medium">
                  {formatBRL(r.totalValue)}
                </span>
                <ChevronDown
                  className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                    expanded ? "rotate-180" : ""
                  }`}
                  aria-hidden
                />
              </button>

              <p className="px-3 pb-2 text-xs text-muted-foreground">
                {r.authorName} · {formatMoment(r.createdAt)} · vale até{" "}
                {formatMoment(r.validUntil)}
              </p>

              {expanded && (
                <div className="border-t px-3 py-2 text-sm">
                  <ul className="flex flex-col gap-1">
                    {r.items.map((i) => (
                      <li key={i.id} className="flex justify-between gap-3">
                        <span className="text-muted-foreground">
                          {i.name}{" "}
                          <span className="tabular-nums">
                            {i.quantity}× {formatBRL(i.basePrice)}
                          </span>
                        </span>
                        <span className="tabular-nums">
                          {formatBRL(i.subtotal)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {r.adjustments.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1 border-t pt-2">
                      {r.adjustments.map((a, i) => (
                        <li key={i} className="flex justify-between gap-3">
                          <span className="text-muted-foreground">
                            {a.label || (a.kind === "desconto" ? "Desconto" : "Taxa")}
                          </span>
                          <span className="tabular-nums">
                            {a.kind === "desconto" ? "−" : "+"}
                            {formatBRL(a.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 flex justify-between border-t pt-2 font-medium">
                    <span>Total</span>
                    <span className="tabular-nums">
                      {formatBRL(r.totalValue)}
                    </span>
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
