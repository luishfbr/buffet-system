"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import {
  hasSchedule,
  splitInstallments,
  formatBRL,
  PAYMENT_METHOD_LABELS,
  type LeadStatus,
  type PaymentMethod,
} from "@buffet/shared";
import type { FinancialPayment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormError } from "@/components/ui/form-error";
import { SkeletonList } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { PayForm } from "./pay-form";

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/**
 * Owner-only payment schedule for an approved negotiation (RF23/RF24). Shows the
 * generator when no schedule exists, otherwise the installments with settle
 * (baixa) and delete actions.
 */
export function SchedulePanel({
  budgetId,
  leadStatus,
  totalValue,
}: {
  budgetId: string;
  leadStatus: LeadStatus;
  totalValue: string | null;
}) {
  const toast = useToast();
  const [payments, setPayments] = useState<FinancialPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState("3");
  const [firstDue, setFirstDue] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [toDeleteId, setToDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await api.get<FinancialPayment[]>(
      `/finance/leads/${budgetId}/payments`
    );
    setPayments(data);
    setLoading(false);
  }, [budgetId]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = Number(count);
    if (!totalValue) {
      setError("Defina o valor total da negociação antes de gerar parcelas.");
      return;
    }
    if (!Number.isInteger(n) || n < 1 || n > 60) {
      setError("Informe um número de parcelas entre 1 e 60.");
      return;
    }
    setSaving(true);
    try {
      const amounts = splitInstallments(totalValue, n);
      const base = new Date(`${firstDue}T00:00:00.000Z`);
      const installments = amounts.map((amount, i) => ({
        amount,
        dueDate: addMonths(base, i).toISOString(),
      }));
      await api.post(`/finance/leads/${budgetId}/schedule`, { installments });
      toast.success(`Cronograma gerado com ${n} parcelas.`);
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemove() {
    if (!toDeleteId) return;
    setDeleting(true);
    try {
      await api.del(`/finance/payments/${toDeleteId}`);
      setToDeleteId(null);
      toast.success("Parcela excluída.");
      await load();
    } catch (err) {
      // A API recusa excluir parcela paga (409) e diz o porquê.
      toast.error(errorMessage(err, "Não foi possível excluir a parcela."));
      setToDeleteId(null);
    } finally {
      setDeleting(false);
    }
  }

  // `hasSchedule`, não `canCreateSchedule`: fechar a negociação não pode
  // esconder o cronograma que ela já tem. Quem barra a **criação** numa
  // negociação encerrada é o servidor, com o outro predicado.
  if (!hasSchedule(leadStatus)) {
    return (
      <p className="text-sm text-muted-foreground">
        Aprove a negociação para gerar o cronograma de pagamentos.
      </p>
    );
  }

  if (loading) {
    return <SkeletonList rows={3} label="Carregando parcelas" />;
  }

  return (
    <div className="flex flex-col gap-3">
      {payments.length === 0 ? (
        <form onSubmit={generate} className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Gere parcelas mensais iguais a partir do valor total
            {totalValue ? ` (${formatBRL(totalValue)})` : ""}.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="count">Nº de parcelas</Label>
              <Input
                id="count"
                inputMode="numeric"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="w-28"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="firstDue">1º vencimento</Label>
              <Input
                id="firstDue"
                type="date"
                value={firstDue}
                onChange={(e) => setFirstDue(e.target.value)}
                className="w-44"
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Gerando..." : "Gerar cronograma"}
            </Button>
          </div>
          <FormError error={error} />
        </form>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Vencimento</th>
                <th className="px-3 py-2 font-medium">Valor</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Método</th>
                <th className="px-3 py-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2">{formatDate(p.dueDate)}</td>
                  <td className="px-3 py-2">{formatBRL(p.amount)}</td>
                  <td className="px-3 py-2">
                    <Badge variant={p.status === "pago" ? "secondary" : "muted"}>
                      {p.status === "pago" ? "Pago" : "Pendente"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    {p.paymentMethod
                      ? PAYMENT_METHOD_LABELS[p.paymentMethod as PaymentMethod]
                      : "—"}
                    {p.receiptUrl && (
                      <>
                        {" "}
                        <a
                          href={p.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline"
                        >
                          comprovante
                        </a>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      {p.status !== "pago" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPayingId(p.id)}
                          >
                            Dar baixa
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => setToDeleteId(p.id)}
                          >
                            Excluir
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {payments.length > 0 && <FormError error={error} />}

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
              toast.success("Baixa registrada.");
              load();
            }}
            onCancel={() => setPayingId(null)}
          />
        )}
      </Modal>

      {/* Aninhado dentro do Modal da negociação — daí a trava de scroll
          contada do `Modal` (RNF08). */}
      <ConfirmDialog
        open={toDeleteId !== null}
        title="Excluir esta parcela?"
        description="A parcela sai do cronograma e o valor deixa de ser cobrado. Parcelas já pagas não podem ser excluídas."
        confirmLabel="Excluir parcela"
        loading={deleting}
        onConfirm={confirmRemove}
        onCancel={() => setToDeleteId(null)}
      />
    </div>
  );
}
