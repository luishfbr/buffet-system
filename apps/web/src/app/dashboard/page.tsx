"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  LEAD_STATUS_LABELS,
  formatBRL,
  type DashboardSummary,
} from "@buffet/shared";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { useActiveOrg } from "@/lib/use-active-org";
import { useRole } from "@/lib/use-role";
import { dismissChecklist, isChecklistDismissed } from "@/lib/onboarding";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCards, SkeletonList } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { PublicLinkCard } from "@/components/dashboard/public-link-card";
import { UpcomingEvents } from "@/components/dashboard/upcoming-events";
import { UpcomingPayments } from "@/components/dashboard/upcoming-payments";

/**
 * Home do painel (RF29/RF30) — responde "o que eu faço agora".
 *
 * Antes esta página não fazia nenhuma chamada à API: mostrava saudação, link
 * público e o papel do usuário, e terminava mandando o usuário "usar o menu".
 * Agora ela abre com o funil, os próximos eventos e o que está vencendo.
 */
export default function DashboardPage() {
  const { data: session } = useSession();
  const { data: activeOrg } = useActiveOrg();
  const { isOwner } = useRole();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [checklistHidden, setChecklistHidden] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await api.get<DashboardSummary>("/dashboard/summary");
    setSummary(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch((err) => {
      setError(err);
      setLoading(false);
    });
  }, [load]);

  // O "dispensado" mora no localStorage, então só pode ser lido no cliente.
  useEffect(() => {
    if (activeOrg?.id) setChecklistHidden(isChecklistDismissed(activeOrg.id));
  }, [activeOrg?.id]);

  const firstName = session?.user.name?.split(" ")[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {firstName ? `Olá, ${firstName}` : "Olá"}
        </h1>
        <p className="text-muted-foreground">
          O resumo de hoje no {activeOrg?.name ?? "seu buffet"}.
        </p>
      </div>

      {loading ? (
        <>
          <SkeletonCards count={4} className="sm:grid-cols-2 lg:grid-cols-4" />
          <SkeletonList rows={4} label="Carregando resumo" />
        </>
      ) : error || !summary ? (
        <EmptyState
          icon={AlertTriangle}
          title="Não foi possível carregar o resumo"
          description={errorMessage(error)}
          action={{ label: "Tentar de novo", onClick: () => void load() }}
        />
      ) : (
        <>
          {!checklistHidden && (
            <SetupChecklist
              summary={summary}
              isOwner={isOwner}
              onDismiss={() => {
                if (activeOrg?.id) dismissChecklist(activeOrg.id);
                setChecklistHidden(true);
              }}
            />
          )}

          {/* Funil (RF19) — cada número leva à lista já filtrada. */}
          <section aria-labelledby="funil-title">
            <h2 id="funil-title" className="mb-3 text-lg font-semibold">
              Funil de negociações
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Novos leads"
                value={summary.leads.byStatus.novo}
                hint={
                  summary.leads.newLast7Days > 0
                    ? `${summary.leads.newLast7Days} nos últimos 7 dias`
                    : "Nenhum nos últimos 7 dias"
                }
                href="/dashboard/leads?status=novo"
                emphasis={summary.leads.byStatus.novo > 0}
              />
              <StatCard
                label={LEAD_STATUS_LABELS.em_negociacao}
                value={summary.leads.byStatus.em_negociacao}
                href="/dashboard/leads?status=em_negociacao"
              />
              <StatCard
                label={LEAD_STATUS_LABELS.formalizando}
                value={summary.leads.byStatus.formalizando}
                href="/dashboard/leads?status=formalizando"
              />
              <StatCard
                label={LEAD_STATUS_LABELS.aprovado}
                value={summary.leads.byStatus.aprovado}
                href="/dashboard/leads?status=aprovado"
              />
            </div>
          </section>

          {/* RNF04: o bloco financeiro nem vem no payload para `member`. */}
          {summary.finance && (
            <section aria-labelledby="financeiro-title">
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <h2 id="financeiro-title" className="text-lg font-semibold">
                  Financeiro
                </h2>
                <Link
                  href="/dashboard/finance"
                  className="text-sm font-medium text-brand underline-offset-4 hover:underline"
                >
                  Ver tudo
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                  label="A receber"
                  value={formatBRL(summary.finance.receivable)}
                  href="/dashboard/finance"
                />
                <StatCard
                  label="Recebido"
                  value={formatBRL(summary.finance.received)}
                  href="/dashboard/finance"
                />
                <StatCard
                  label="Parcelas vencidas"
                  value={summary.finance.overdueCount}
                  hint={
                    summary.finance.overdueCount > 0
                      ? "Cobrança em atraso"
                      : "Nada em atraso"
                  }
                  href="/dashboard/finance"
                  emphasis={summary.finance.overdueCount > 0}
                />
              </div>
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="eventos-title">
              <h2 id="eventos-title" className="mb-3 text-lg font-semibold">
                Próximos eventos
              </h2>
              <UpcomingEvents events={summary.upcomingEvents} />
            </section>

            {summary.finance && (
              <section aria-labelledby="vencimentos-title">
                <h2
                  id="vencimentos-title"
                  className="mb-3 text-lg font-semibold"
                >
                  Próximos vencimentos
                </h2>
                <UpcomingPayments payments={summary.finance.nextDue} />
              </section>
            )}
          </div>

          <section aria-labelledby="divulgar-title">
            <h2 id="divulgar-title" className="mb-3 text-lg font-semibold">
              Divulgue seu buffet
            </h2>
            <PublicLinkCard slug={activeOrg?.slug} />
            <p className="mt-3 text-sm text-muted-foreground">
              Todo lead do funil entra por este link.{" "}
              {isOwner && (
                <Link
                  href="/dashboard/pagina"
                  className="font-medium text-brand underline-offset-4 hover:underline"
                >
                  Personalize a página
                </Link>
              )}
              {isOwner && " antes de divulgar."}
            </p>
          </section>
        </>
      )}
    </div>
  );
}
