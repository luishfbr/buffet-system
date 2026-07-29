"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { FormError } from "@/components/ui/form-error";
import { Alert } from "@/components/ui/alert";
import { formatBRL } from "@buffet/shared";
import type { LeadDetail, Package } from "@/lib/types";
import { useRole } from "@/lib/use-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SkeletonList } from "@/components/ui/skeleton";
import { SchedulePanel } from "@/components/finance/schedule-panel";
import { LeadTimeline } from "@/components/leads/lead-timeline";
import { StatusStrip } from "@/components/leads/status-strip";

/** Slice an ISO datetime to the `yyyy-MM-dd` a date input expects. */
function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export function LeadDetailForm({
  leadId,
  packages,
  onSaved,
  onChanged,
  onCancel,
}: {
  leadId: string;
  packages: Package[];
  /** Salvou os dados e terminou: o pai fecha o modal. */
  onSaved: () => void;
  /**
   * Algo mudou mas o trabalho continua — o pai só rebusca a lista. É o caso da
   * transição de estado: fechar o modal aqui esconderia justamente o histórico
   * que a mudança acabou de escrever.
   */
  onChanged: () => void;
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
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  /**
   * Incrementa a cada transição para a linha do tempo rebuscar o log de
   * auditoria. É um **token**, não uma `key` de remontagem: remontar descartaria
   * a anotação que o usuário estivesse digitando — perder o texto por clicar em
   * "Enviar proposta" seria uma armadilha silenciosa.
   */
  const [statusLogToken, setStatusLogToken] = useState(0);

  const load = useCallback(async () => {
    const data = await api.get<LeadDetail>(`/leads/${leadId}`);
    setLead(data);
    setCustomerName(data.customerName);
    setCustomerPhone(data.customerPhone);
    setCustomerEmail(data.customerEmail ?? "");
    setEventDate(toDateInput(data.eventDate));
    setGuestCount(data.guestCount != null ? String(data.guestCount) : "");
    setPackageId(data.packageId ?? "");
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
        // Status e motivo não passam por aqui (RF-V2-02): mudar de estado é uma
        // operação própria, na faixa acima, com auditoria. O `updateLeadSchema`
        // nem aceita mais os campos.
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
    {/* RF-V2-02: a faixa de estado fica FORA do form e acima dele, de propósito.
        Cada ação dela dispara uma transição na hora — não é um campo que o
        "Salvar" grava, e não deve parecer um. Também não pode estar dentro do
        <form>: seus botões submeteriam a negociação. */}
    <StatusStrip
      leadId={lead.id}
      status={lead.status}
      lostReason={lead.lostReason}
      onTransitioned={(updated) => {
        // Só o `lead` é substituído; os campos do formulário ficam como o
        // usuário deixou. Uma transição não altera dados do cliente, e um
        // refetch aqui apagaria uma edição em andamento.
        setLead(updated);
        setStatusLogToken((n) => n + 1);
        onChanged();
      }}
    />

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
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
    </form>

    {/* RF35 + RF-V2-04: histórico de interações e de mudanças de estado, numa
        linha do tempo só. Fora do form da negociação — ele tem form próprio, e
        form aninhado é HTML inválido (mesmo motivo do SchedulePanel abaixo). */}
    <div className="flex flex-col gap-2 border-t pt-4">
      <LeadTimeline leadId={lead.id} statusLogToken={statusLogToken} />
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
