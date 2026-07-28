"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarDays, Users } from "lucide-react";
import { api } from "@/lib/api";
import { FormError } from "@/components/ui/form-error";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  formatBRL,
  type LeadStatus,
} from "@buffet/shared";
import type { Lead } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";

/**
 * Funil como quadro kanban (RF19): cada coluna é um estágio de `LEAD_STATUSES` e
 * arrastar um card muda o status via `PATCH /leads/:id { status }`.
 *
 * Assinatura visual: um trilho superior por coluna que esquenta em direção ao
 * âmbar de marca em "Aprovado" (o objetivo do funil), com "Perdido" apartado em
 * vermelho — encoda a progressão do pipeline, não decora.
 */
const STATUS_RAIL: Record<LeadStatus, string> = {
  novo: "border-t-border",
  em_negociacao: "border-t-brand/40",
  formalizando: "border-t-brand/70",
  aprovado: "border-t-brand",
  perdido: "border-t-destructive/60",
};

/** Fatia uma data ISO para dd/mm/aaaa em UTC (convenção do app). */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function LeadKanban({
  leads,
  onOpenLead,
  onChanged,
}: {
  leads: Lead[];
  onOpenLead: (id: string) => void;
  onChanged: () => void;
}) {
  // Cópia local para movimento otimista; o pai (page) segue como fonte de
  // verdade e re-hidrata via `onChanged` → nova prop → resync abaixo.
  const [board, setBoard] = useState<Lead[]>(leads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingLoss, setPendingLoss] = useState<Lead | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => setBoard(leads), [leads]);

  // Kanban é uma melhoria para ponteiro: 8px de folga faz um clique curto abrir
  // o detalhe e só arrastar ao mover. O caminho por teclado é a visão Tabela +
  // o `<select>` de status no `LeadDetailForm` (aberto via Enter no card).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const byStatus = useMemo(() => {
    const groups = Object.fromEntries(
      LEAD_STATUSES.map((s) => [s, [] as Lead[]])
    ) as Record<LeadStatus, Lead[]>;
    for (const lead of board) groups[lead.status]?.push(lead);
    return groups;
  }, [board]);

  const activeLead = activeId
    ? board.find((l) => l.id === activeId) ?? null
    : null;

  /** Persiste a mudança de status; reverte o board local em caso de erro. */
  async function persist(lead: Lead, status: LeadStatus, lostReason?: string) {
    const previous = board;
    setError(null);
    setBoard((prev) =>
      prev.map((l) =>
        l.id === lead.id
          ? { ...l, status, lostReason: lostReason ?? null }
          : l
      )
    );
    try {
      await api.patch(`/leads/${lead.id}`, {
        status,
        ...(status === "perdido" ? { lostReason: lostReason || null } : {}),
      });
      onChanged();
    } catch (err) {
      setBoard(previous);
      setError(err);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const target = over.id as LeadStatus;
    const lead = board.find((l) => l.id === active.id);
    if (!lead || lead.status === target) return;

    // Perdido pede o motivo antes de confirmar; os demais movem direto.
    if (target === "perdido") {
      setPendingLoss(lead);
      return;
    }
    persist(lead, target);
  }

  return (
    <div className="flex flex-col gap-3">
      <FormError error={error} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex gap-4 overflow-x-auto overscroll-x-contain pb-2">
          {LEAD_STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              leads={byStatus[status]}
              onOpenLead={onOpenLead}
            />
          ))}
        </div>

        <DragOverlay>
          {activeLead ? <Card lead={activeLead} overlay /> : null}
        </DragOverlay>
      </DndContext>

      <LossReasonModal
        lead={pendingLoss}
        onCancel={() => setPendingLoss(null)}
        onConfirm={(reason) => {
          if (pendingLoss) persist(pendingLoss, "perdido", reason);
          setPendingLoss(null);
        }}
      />
    </div>
  );
}

function Column({
  status,
  leads,
  onOpenLead,
}: {
  status: LeadStatus;
  leads: Lead[];
  onOpenLead: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={LEAD_STATUS_LABELS[status]}
      className={`flex w-72 shrink-0 flex-col gap-3 rounded-lg border border-t-2 ${STATUS_RAIL[status]} p-3 transition-colors ${
        isOver ? "bg-accent/60 ring-2 ring-ring" : "bg-muted/30"
      }`}
    >
      <header className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold">{LEAD_STATUS_LABELS[status]}</h2>
        <span className="rounded bg-secondary px-1.5 text-xs font-medium tabular-nums text-secondary-foreground">
          {leads.length}
        </span>
      </header>

      <div className="flex min-h-24 flex-col gap-2">
        {leads.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
            Solte um card aqui
          </p>
        ) : (
          leads.map((lead) => (
            <DraggableCard
              key={lead.id}
              lead={lead}
              onOpen={() => onOpenLead(lead.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function DraggableCard({
  lead,
  onOpen,
}: {
  lead: Lead;
  onOpen: () => void;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: lead.id,
    data: { status: lead.status },
  });
  // dnd-kit dá role="button"/tabIndex via `attributes`; complementamos com o
  // teclado para abrir o detalhe (Enter/Espaço), já que não há KeyboardSensor.
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`cursor-grab touch-none select-none rounded-md border bg-card p-3 text-left shadow-sm transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <Card lead={lead} />
    </div>
  );
}

/** Conteúdo do card, compartilhado entre a coluna e o `DragOverlay`. */
function Card({ lead, overlay = false }: { lead: Lead; overlay?: boolean }) {
  const body = (
    <>
      <p className="font-medium leading-tight">{lead.customerName}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="size-3.5" aria-hidden />
          {formatDate(lead.eventDate)}
        </span>
        {lead.guestCount != null && (
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden />
            {lead.guestCount}
          </span>
        )}
      </div>
      {lead.totalValue && (
        <p className="mt-2 text-sm font-semibold tabular-nums">
          {formatBRL(lead.totalValue)}
        </p>
      )}
    </>
  );
  if (!overlay) return body;
  return (
    <div className="w-72 cursor-grabbing rounded-md border bg-card p-3 shadow-lg">
      {body}
    </div>
  );
}

function LossReasonModal({
  lead,
  onCancel,
  onConfirm,
}: {
  lead: Lead | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  // Zera o campo a cada nova negociação aberta.
  useEffect(() => setReason(""), [lead?.id]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onConfirm(reason.trim());
  }

  return (
    <Modal
      open={lead !== null}
      onClose={onCancel}
      title="Marcar como perdido"
      description={
        lead ? `Registre por que a negociação com ${lead.customerName} foi perdida.` : ""
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="lossReason">Motivo da perda</Label>
          <Input
            id="lossReason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: preço acima do orçamento"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" variant="destructive">
            Marcar como perdido
          </Button>
        </div>
      </form>
    </Modal>
  );
}
