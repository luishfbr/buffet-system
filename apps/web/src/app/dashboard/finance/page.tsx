"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatBRL } from "@buffet/shared";
import type { FinanceSummary } from "@/lib/types";
import { useRole } from "@/lib/use-role";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PayForm } from "@/components/finance/pay-form";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function isOverdue(iso: string): boolean {
  const due = new Date(iso);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

export default function FinancePage() {
  const { isOwner, role } = useRole();
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await api.get<FinanceSummary>("/finance/summary");
    setSummary(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isOwner) return;
    load().catch(() => setLoading(false));
  }, [isOwner, load]);

  // RNF04: members never see billing totals.
  if (role && !isOwner) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
        <p className="text-muted-foreground">
          Apenas o proprietário tem acesso ao módulo financeiro.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
        <p className="text-muted-foreground">
          Contas a receber, recebidas e próximos vencimentos.
        </p>
      </div>

      {loading || !summary ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardDescription>A receber</CardDescription>
                <CardTitle>{formatBRL(summary.receivable)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Recebido</CardDescription>
                <CardTitle>{formatBRL(summary.received)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Parcelas pendentes</CardDescription>
                <CardTitle>{summary.pending.length}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold">Próximos vencimentos</h2>
            {summary.pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma parcela pendente.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Cliente</th>
                      <th className="px-4 py-2 font-medium">Vencimento</th>
                      <th className="px-4 py-2 font-medium">Valor</th>
                      <th className="px-4 py-2 text-right font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.pending.map((p) => (
                      <tr key={p.id} className="border-b last:border-b-0">
                        <td className="px-4 py-2 font-medium">
                          {p.customerName}
                        </td>
                        <td className="px-4 py-2">
                          {formatDate(p.dueDate)}
                          {isOverdue(p.dueDate) && (
                            <span className="ml-2 text-xs text-destructive">
                              vencida
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">{formatBRL(p.amount)}</td>
                        <td className="px-4 py-2">
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPayingId(p.id)}
                            >
                              Dar baixa
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <Modal
        open={payingId !== null}
        onClose={() => setPayingId(null)}
        title="Dar baixa na parcela"
      >
        {payingId && (
          <PayForm
            paymentId={payingId}
            onDone={() => {
              setPayingId(null);
              load();
            }}
            onCancel={() => setPayingId(null)}
          />
        )}
      </Modal>
    </div>
  );
}
