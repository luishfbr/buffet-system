"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Trash2 } from "lucide-react";
import type {
  LeadNoteView,
  LeadStatus,
  LeadStatusLogView,
} from "@buffet/shared";
import { api, errorMessage } from "@/lib/api";
import { useRole } from "@/lib/use-role";
import { LEAD_STATUS_STYLE, statusLabel } from "@/lib/lead-status";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/ui/form-error";
import { SkeletonList } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

/**
 * Carimbo de tempo real → **horário local**.
 *
 * Exceção deliberada à regra de `timeZone: "UTC"` do repo: aquela regra existe
 * porque `eventDate` é uma data-sem-hora guardada à meia-noite UTC. Uma
 * anotação (ou uma transição) tem hora de verdade — renderizá-la em UTC
 * mostraria 21:30 para algo feito às 18:30.
 */
function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Entry =
  | { kind: "note"; at: string; note: LeadNoteView }
  | { kind: "status"; at: string; event: LeadStatusLogView };

/**
 * Marcador centrado na espinha. O deslocamento é derivado, não chutado: o `<li>`
 * começa em `pl-5` (1.25rem) + 1px da borda, e o ponto tem 0.5rem — puxar
 * 1.5625rem para a esquerda deixa o centro dele em cima da linha.
 */
const DOT = "absolute -left-6.25 size-2 rounded-full border-2 border-background";

/**
 * Linha do tempo da negociação: anotações humanas (RF35) e mudanças de estado
 * (RF-V2-04) intercaladas em ordem cronológica.
 *
 * A distinção entre as duas é **estrutural, não decorativa**: a anotação é um
 * cartão com peso, porque alguém sentou e escreveu; o evento de sistema é uma
 * marca fina sentada na espinha vertical, porque é um fato registrado. Cartões
 * flutuam sobre a espinha, ticks se sentam nela — é o que dispensa um rótulo
 * "sistema" em cada linha.
 *
 * Intercalar (em vez de empilhar duas listas) é o que responde à pergunta real
 * da tela: *o que aconteceu nesta negociação, em ordem*.
 *
 * Eventos de estado não têm botão de excluir para nenhum papel — é o RNF-V2-05
 * aparecendo na interface, e o banco recusaria de qualquer jeito.
 */
export function LeadTimeline({
  leadId,
  statusLogToken = 0,
}: {
  leadId: string;
  /**
   * Incrementado pelo pai a cada transição. Rebusca **só o log de auditoria** —
   * uma mudança de estado não escreve em `lead_notes`, e recarregar tudo (ou
   * remontar o componente) custaria a anotação que o usuário estiver digitando.
   */
  statusLogToken?: number;
}) {
  const { isOwner } = useRole();
  const toast = useToast();
  const [notes, setNotes] = useState<LeadNoteView[]>([]);
  const [events, setEvents] = useState<LeadStatusLogView[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [toDelete, setToDelete] = useState<LeadNoteView | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [n, e] = await Promise.all([
      api.get<LeadNoteView[]>(`/leads/${leadId}/notes`),
      api.get<LeadStatusLogView[]>(`/leads/${leadId}/status-log`),
    ]);
    setNotes(n);
    setEvents(e);
    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (statusLogToken === 0) return; // carga inicial já veio do `load()`
    api
      .get<LeadStatusLogView[]>(`/leads/${leadId}/status-log`)
      .then(setEvents)
      .catch(() => undefined);
  }, [statusLogToken, leadId]);

  const entries = useMemo<Entry[]>(() => {
    const merged: Entry[] = [
      ...notes.map((note) => ({
        kind: "note" as const,
        at: note.createdAt,
        note,
      })),
      ...events.map((event) => ({
        kind: "status" as const,
        at: event.createdAt,
        event,
      })),
    ];
    // Mais recente primeiro. Comparação de string ISO basta e evita instanciar
    // Date por item só para ordenar.
    return merged.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  }, [notes, events]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    setSaving(true);
    try {
      await api.post(`/leads/${leadId}/notes`, { body });
      setBody("");
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.del(`/leads/${leadId}/notes/${toDelete.id}`);
      setToDelete(null);
      toast.success("Anotação excluída.");
      await load();
    } catch (err) {
      toast.error(errorMessage(err, "Não foi possível excluir a anotação."));
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={submit} className="flex flex-col gap-2">
        <Label htmlFor="note-body">Histórico da negociação</Label>
        <Textarea
          id="note-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={5000}
          placeholder="Ligação, detalhe combinado pelo WhatsApp, ajuste de proposta…"
        />
        <FormError error={error} labels={{ body: "Anotação" }} />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={saving || !body.trim()}>
            {saving ? "Registrando…" : "Registrar anotação"}
          </Button>
        </div>
      </form>

      {loading ? (
        <SkeletonList rows={3} label="Carregando histórico" />
      ) : entries.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          Nada registrado ainda. Anotações e mudanças de estado aparecem aqui,
          em ordem, para a equipe toda acompanhar.
        </p>
      ) : (
        // A espinha: uma hairline contínua à esquerda, que é o que faz disto uma
        // linha do tempo em vez de uma pilha de cartões.
        <ol className="relative ml-1 flex flex-col gap-3 border-l pl-5">
          {entries.map((entry) =>
            entry.kind === "note" ? (
              <NoteEntry
                key={`n-${entry.note.id}`}
                note={entry.note}
                canDelete={isOwner}
                onDelete={() => setToDelete(entry.note)}
              />
            ) : (
              <StatusEntry key={`s-${entry.event.id}`} event={entry.event} />
            )
          )}
        </ol>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir esta anotação?"
        description="O registro sai do histórico da negociação e não pode ser recuperado."
        confirmLabel="Excluir anotação"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

/** Anotação humana: cartão. Alguém escreveu isto. */
function NoteEntry({
  note,
  canDelete,
  onDelete,
}: {
  note: LeadNoteView;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <li className="relative rounded-md border bg-muted/30 px-3 py-2 text-sm">
      <span aria-hidden className={`${DOT} top-3 bg-muted-foreground/40`} />
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          <strong className="font-medium text-foreground">
            {note.authorName}
          </strong>{" "}
          · {formatTimestamp(note.createdAt)}
        </span>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Excluir anotação de ${note.authorName}`}
            className="-m-1 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="mt-1 whitespace-pre-wrap wrap-break-word">{note.body}</p>
    </li>
  );
}

/**
 * Mudança de estado: sem cartão. O conteúdo do evento é a própria seta entre os
 * dois estados — "Em Negociação → Proposta Enviada" diz tudo, e diz melhor que
 * "Status alterado de X para Y", que é o sistema falando de si mesmo.
 */
function StatusEntry({ event }: { event: LeadStatusLogView }) {
  // `toStatus` pode ser um estado que não existe mais (o log guarda o
  // vocabulário da época); cai no cinza neutro em vez de quebrar.
  const style = LEAD_STATUS_STYLE[event.toStatus as LeadStatus];
  return (
    <li className="relative py-0.5 text-sm">
      <span
        aria-hidden
        className={`${DOT} top-2 ${style?.dot ?? "bg-muted-foreground/40"}`}
      />
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="text-muted-foreground">
          {statusLabel(event.fromStatus)}
        </span>
        <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden />
        <span className="font-medium">{statusLabel(event.toStatus)}</span>
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {event.actorName} · {formatTimestamp(event.createdAt)}
      </p>
      {event.reason && (
        <p className="mt-1 border-l-2 border-border pl-2 text-xs text-muted-foreground wrap-break-word">
          {event.reason}
        </p>
      )}
    </li>
  );
}
