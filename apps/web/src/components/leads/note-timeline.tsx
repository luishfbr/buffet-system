"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { LeadNoteView } from "@buffet/shared";
import { api, errorMessage } from "@/lib/api";
import { useRole } from "@/lib/use-role";
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
 * anotação tem hora de verdade — renderizá-la em UTC mostraria 21:30 para algo
 * escrito às 18:30.
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

/**
 * Histórico de interações da negociação (RF35).
 *
 * Append-only, com autor e data. Substitui a textarea única do RF20, onde dois
 * funcionários com a mesma negociação aberta se sobrescreviam em silêncio.
 */
export function NoteTimeline({ leadId }: { leadId: string }) {
  const { isOwner } = useRole();
  const toast = useToast();
  const [notes, setNotes] = useState<LeadNoteView[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [toDelete, setToDelete] = useState<LeadNoteView | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setNotes(await api.get<LeadNoteView[]>(`/leads/${leadId}/notes`));
    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

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
        <Label htmlFor="note-body">Histórico de interações</Label>
        <Textarea
          id="note-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={5000}
          placeholder="Ligação, detalhe combinado pelo WhatsApp, ajuste de proposta..."
        />
        <FormError error={error} labels={{ body: "Anotação" }} />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={saving || !body.trim()}>
            {saving ? "Registrando..." : "Registrar anotação"}
          </Button>
        </div>
      </form>

      {loading ? (
        <SkeletonList rows={2} label="Carregando histórico" />
      ) : notes.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          Nenhuma anotação ainda. Registre o que foi combinado para a equipe
          toda acompanhar.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded-md border bg-muted/30 px-3 py-2 text-sm"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  <strong className="font-medium text-foreground">
                    {note.authorName}
                  </strong>{" "}
                  · {formatTimestamp(note.createdAt)}
                </span>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setToDelete(note)}
                    aria-label={`Excluir anotação de ${note.authorName}`}
                    className="-m-1 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap wrap-break-word">
                {note.body}
              </p>
            </li>
          ))}
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
