"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";
import { formatBRL, type DashboardUpcomingPayment } from "@buffet/shared";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
  });
}

/** Próximas parcelas a vencer (RF29). Só renderizado para `owner` (RNF04). */
export function UpcomingPayments({
  payments,
}: {
  payments: DashboardUpcomingPayment[];
}) {
  if (payments.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Nenhuma parcela a vencer"
        description="O cronograma de pagamentos é gerado quando você aprova uma negociação."
        action={{
          label: "Ver negociações aprovadas",
          href: "/dashboard/leads?status=aprovado",
        }}
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y rounded-xl border bg-card shadow">
      {payments.map((payment) => (
        <li key={payment.id}>
          <Link
            href={`/dashboard/leads?open=${payment.budgetId}`}
            className="flex items-center gap-4 p-4 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            <span className="w-16 shrink-0 text-sm font-medium tabular-nums">
              {formatDate(payment.dueDate)}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">
              {payment.customerName}
            </span>
            {payment.isOverdue && (
              <Badge className="shrink-0 bg-destructive/10 text-destructive">
                Vencida
              </Badge>
            )}
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {formatBRL(payment.amount)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
