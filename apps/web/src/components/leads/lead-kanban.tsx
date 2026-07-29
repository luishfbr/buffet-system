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
import { api, errorMessage } from "@/lib/api";
import {
  LEAD_BOARD_STATUSES,
  LEAD_STATUS_LABELS,
  availableTransitions,
  formatBRL,
  type LeadStatus,
} from "@buffet/shared";
import type { Lead } from "@/lib/types";
import { useRole } from "@/lib/use-role";
import { LEAD_STATUS_STYLE } from "@/lib/lead-status";
import { useToast } from "@/components/ui/toast";

/**
 * Funil como quadro kanban (RF19): arrastar um card executa uma transição de
 * estado via `POST /leads/:id/transitions`.
 *
 * **Só os cinco estados de trabalho viram coluna** (`LEAD_BOARD_STATUSES`).
 * Perdido, cancelado e expirado ficam de fora de propósito: são encerramentos,
 * e colunas de encerramento só crescem — espremeriam justamente as colunas onde
 * o trabalho acontece. Encerrar é uma ação do detalhe, onde cabe o motivo
 * obrigatório (RF-V2-03), e a tabela continua filtrando por esses estados.
 *
 * O trilho superior de cada coluna vem de `LEAD_STATUS_STYLE`, o mesmo
 * vocabulário de cor que a faixa de estado do detalhe usa na borda esquerda.
 */

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
  const { role } = useRole();
  const toast = useToast();
  // Cópia local para movimento otimista; o pai (page) segue como fonte de
  // verdade e re-hidrata via `onChanged` → nova prop → resync abaixo.
  const [board, setBoard] = useState<Lead[]>(leads);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => setBoard(leads), [leads]);

  // Kanban é uma melhoria para ponteiro: 8px de folga faz um clique curto abrir
  // o detalhe e só arrastar ao mover. O caminho por teclado é a visão Tabela +
  // as ações da faixa de estado no `LeadDetailForm` (aberto via Enter no card).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const byStatus = useMemo(() => {
    const groups = Object.fromEntries(
      LEAD_BOARD_STATUSES.map((s) => [s, [] as Lead[]])
    ) as Record<LeadStatus, Lead[]>;
    // Encerradas não têm coluna: ficam fora do quadro, não somem do sistema.
    for (const lead of board) groups[lead.status]?.push(lead);
    return groups;
  }, [board]);

  const activeLead = activeId
    ? board.find((l) => l.id === activeId) ?? null
    : null;

  /**
   * Colunas que aceitam o card em movimento, lidas da mesma tabela de transições
   * que o servidor consulta (RF-V2-02) — o quadro nunca reimplementa a regra.
   *
   * Transições que exigem motivo também ficam de fora: o arraste é um gesto
   * único, e interrompê-lo com um modal obrigatório no meio é pior que oferecer
   * a ação onde ela cabe, no detalhe.
   */
  const dropTargets = useMemo(() => {
    if (!activeLead || !role) return new Set<LeadStatus>();
    return new Set(
      availableTransitions(activeLead.status, role)
        .filter(
          (rule) =>
            !rule.requiresReason &&
            (LEAD_BOARD_STATUSES as readonly LeadStatus[]).includes(rule.to)
        )
        .map((rule) => rule.to)
    );
  }, [activeLead, role]);

  /** Executa a transição; reverte o board local em caso de erro. */
  async function persist(lead: Lead, status: LeadStatus) {
    const previous = board;
    setBoard((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, status } : l))
    );
    try {
      await api.post(`/leads/${lead.id}/transitions`, { to: status });
      onChanged();
    } catch (err) {
      setBoard(previous);
      // Conflito de estado, permissão ou rede — erro de operação vai no toast.
      toast.error(errorMessage(err, "Não foi possível mover a negociação."));
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const lead = activeLead;
    setActiveId(null);
    const { over } = event;
    if (!over || !lead) return;
    const target = over.id as LeadStatus;
    // O drop já é recusado pelo `disabled` do droppable; a checagem aqui fecha
    // a porta contra um alvo que tenha mudado no meio do arraste.
    if (lead.status === target || !dropTargets.has(target)) return;
    void persist(lead, target);
  }

  return (
    <div className="flex flex-col gap-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(event: DragStartEvent) =>
          setActiveId(String(event.active.id))
        }
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex gap-4 overflow-x-auto overscroll-x-contain pb-2">
          {LEAD_BOARD_STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              leads={byStatus[status]!}
              droppable={dropTargets.has(status)}
              // A regra do "recuo" mora aqui, junto com quem tem os dois fatos
              // que a definem — a coluna só recebe o resultado.
              blocked={
                activeLead !== null &&
                activeLead.status !== status &&
                !dropTargets.has(status)
              }
              onOpenLead={onOpenLead}
            />
          ))}
        </div>

        <DragOverlay>
          {activeLead ? <Card lead={activeLead} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

/**
 * Uma coluna do quadro. Durante o arraste, as colunas que a máquina de estados
 * não permite recuam (`blocked`): esmaecem e param de reagir ao ponteiro. É a
 * diferença entre "solte e receba um erro" e "esta porta não existe daqui" — a
 * regra vira algo que se vê antes de tentar, não uma mensagem depois.
 */
function Column({
  status,
  leads,
  droppable,
  blocked,
  onOpenLead,
}: {
  status: LeadStatus;
  leads: Lead[];
  droppable: boolean;
  blocked: boolean;
  onOpenLead: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !droppable });

  return (
    <section
      ref={setNodeRef}
      aria-label={LEAD_STATUS_LABELS[status]}
      className={`flex w-72 shrink-0 flex-col gap-3 rounded-lg border border-t-2 ${
        LEAD_STATUS_STYLE[status].railTop
      } p-3 transition-[opacity,background-color,box-shadow] ${
        blocked ? "pointer-events-none opacity-40" : ""
      } ${
        isOver
          ? "bg-accent/60 ring-2 ring-ring"
          : `bg-muted/30 ${droppable ? "ring-1 ring-brand/30" : ""}`
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
            {droppable ? "Solte um card aqui" : "Nenhuma negociação"}
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

