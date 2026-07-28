"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@buffet/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";

const FIELD_LABELS = {
  paymentMethod: "Método de pagamento",
  receiptUrl: "Link do comprovante",
};

/** Settle an installment: pick a method and optionally paste a receipt link (RF24). */
export function PayForm({
  paymentId,
  onDone,
  onCancel,
}: {
  paymentId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.patch(`/finance/payments/${paymentId}/pay`, {
        paymentMethod: method,
        receiptUrl: receiptUrl || "",
      });
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="method">Método de pagamento</Label>
        <select
          id="method"
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="receiptUrl">Link do comprovante (opcional)</Label>
        <Input
          id="receiptUrl"
          type="url"
          placeholder="https://..."
          value={receiptUrl}
          onChange={(e) => setReceiptUrl(e.target.value)}
        />
      </div>
      <FormError error={error} labels={FIELD_LABELS} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Confirmar baixa"}
        </Button>
      </div>
    </form>
  );
}
