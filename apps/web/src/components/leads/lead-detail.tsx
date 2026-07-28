"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { FormError } from "@/components/ui/form-error";
import { Alert } from "@/components/ui/alert";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  formatBRL,
  type LeadStatus,
} from "@buffet/shared";
import type { LeadDetail, Package } from "@/lib/types";
import { useRole } from "@/lib/use-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SkeletonList } from "@/components/ui/skeleton";
import { SchedulePanel } from "@/components/finance/schedule-panel";
import { NoteTimeline } from "@/components/leads/note-timeline";

/** Slice an ISO datetime to the `yyyy-MM-dd` a date input expects. */
function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export function LeadDetailForm({
  leadId,
  packages,
  onSaved,
  onCancel,
}: {
  leadId: string;
  packages: Package[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { isOwner } = useRole();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [packageId, setPackageId] = useState("");
  const [status, setStatus] = useState<LeadStatus>("novo");
  const [lostReason, setLostReason] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const data = await api.get<LeadDetail>(`/leads/${leadId}`);
    setLead(data);
    setCustomerName(data.customerName);
    setCustomerPhone(data.customerPhone);
    setCustomerEmail(data.customerEmail ?? "");
    setEventDate(toDateInput(data.eventDate));
    setGuestCount(data.guestCount != null ? String(data.guestCount) : "");
    setPackageId(data.packageId ?? "");
    setStatus(data.status);
    setLostReason(data.lostReason ?? "");
  }, [leadId]);

  useEffect(() => {
    load().catch(() => setError("Erro ao carregar negociação"));
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.patch(`/leads/${leadId}`, {
        customerName,
        customerPhone,
        customerEmail: customerEmail || null,
        // Send a full-day ISO datetime; the API stores it as a date.
        eventDate: eventDate ? `${eventDate}T00:00:00.000Z` : null,
        guestCount: guestCount ? Number(guestCount) : null,
        packageId: packageId || null,
        status,
        lostReason: status === "perdido" ? lostReason || null : null,
        // `notes` (coluna legada do RF20) não é mais escrita pela UI: o
        // histórico virou append-only em `lead_notes` (RF35). O valor antigo
        // fica preservado no banco justamente por não ir no payload.
      });
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  async function copyProposal() {
    try {
      const { text } = await api.get<{ text: string }>(
        `/leads/${leadId}/proposal`
      );
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Não foi possível copiar a proposta");
    }
  }

  if (!lead) {
    return <SkeletonList rows={4} label="Carregando negociação" />;
  }

  return (
    <div className="flex flex-col gap-5">
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* RF21: alerta visual de overbooking — nunca bloqueia o salvamento.
          Usa os tokens oklch do tema (antes eram cores `amber-*` cruas) e leva
          à agenda (RF31), em vez de terminar num aviso sem saída. */}
      {lead.conflictCount > 0 && (
        <Alert variant="warning" title="Conflito de agenda">
          Já {lead.conflictCount === 1 ? "existe" : "existem"}{" "}
          {lead.conflictCount}{" "}
          {lead.conflictCount === 1 ? "outro evento" : "outros eventos"} nesta
          data.{" "}
          {lead.eventDate && (
            <Link
              href={`/dashboard/agenda?date=${lead.eventDate.slice(0, 10)}`}
              className="font-medium text-foreground underline underline-offset-4"
            >
              Ver na agenda
            </Link>
          )}
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="customerName">Cliente</Label>
          <Input
            id="customerName"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="customerPhone">WhatsApp</Label>
          <Input
            id="customerPhone"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="customerEmail">E-mail</Label>
          <Input
            id="customerEmail"
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="eventDate">Data do evento</Label>
          <Input
            id="eventDate"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="guestCount">Convidados</Label>
          <Input
            id="guestCount"
            inputMode="numeric"
            value={guestCount}
            onChange={(e) => setGuestCount(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="packageId">Pacote</Label>
          <select
            id="packageId"
            value={packageId}
            onChange={(e) => setPackageId(e.target.value)}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">Sem pacote</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatBRL(p.pricePerPerson)}/pessoa
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as LeadStatus)}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {status === "perdido" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="lostReason">Motivo da perda</Label>
          <Input
            id="lostReason"
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            placeholder="Ex: preço acima do orçamento"
          />
        </div>
      )}

      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
        Valor total estimado:{" "}
        <strong>{lead.totalValue ? formatBRL(lead.totalValue) : "—"}</strong>
      </div>

      <FormError error={error} />

      <div className="flex flex-wrap justify-between gap-2">
        {/* RF22: copy the textual proposal for WhatsApp/Word. */}
        <Button type="button" variant="outline" onClick={copyProposal}>
          {copied ? "Copiado!" : "Copiar proposta"}
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </form>

    {/* RF35: histórico de interações. Fora do form da negociação — ele tem
        form próprio, e form aninhado é HTML inválido (mesmo motivo do
        SchedulePanel abaixo). Cada anotação é uma linha: dois funcionários
        podem registrar ao mesmo tempo sem se sobrescrever. */}
    <div className="flex flex-col gap-2 border-t pt-4">
      <NoteTimeline leadId={lead.id} />
    </div>

    {/* RF23/RF24: financial schedule — owner-only (RNF04). Kept outside the
        form so its buttons don't submit the negotiation. Uses the saved status,
        so approve + save before generating the schedule. */}
    {isOwner && (
      <div className="flex flex-col gap-2 border-t pt-4">
        <h3 className="text-sm font-semibold">Financeiro</h3>
        <SchedulePanel
          budgetId={lead.id}
          leadStatus={lead.status}
          totalValue={lead.totalValue}
        />
      </div>
    )}
    </div>
  );
}
