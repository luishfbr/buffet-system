"use client";

import { useEffect, useState } from "react";
import {
  DATE_AVAILABILITY_HINTS,
  DATE_AVAILABILITY_LABELS,
  DATE_AVAILABILITY_STATUSES,
  type DateAvailabilityStatus,
  type DateAvailabilityView,
} from "@buffet/shared";
import { api, errorMessage } from "@/lib/api";
import { AVAILABILITY_STYLE } from "@/lib/availability";
import { fromISODate } from "@/lib/calendar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * Edição da disponibilidade do dia selecionado (RF-V2-13 / RF-V2-15).
 *
 * Fica **na agenda**, ao lado dos eventos do dia, e não numa tela própria: a
 * pergunta "posso aceitar mais um evento neste dia?" se responde olhando o que
 * já está marcado nele. Uma tela separada obrigaria a comparar duas visões do
 * mesmo calendário.
 *
 * Owner-only, como o resto da configuração do buffet — quem filtra é a página.
 */
export function AvailabilityPanel({
  date,
  current,
  onSaved,
}: {
  date: string;
  current: DateAvailabilityView | undefined;
  onSaved: (row: DateAvailabilityView) => void;
}) {
  const toast = useToast();
  const [status, setStatus] = useState<DateAvailabilityStatus>("disponivel");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Trocar de dia recarrega o formulário: sem isto, o texto do dia anterior
  // ficaria na tela sugerindo que pertence ao novo.
  useEffect(() => {
    setStatus(current?.status ?? "disponivel");
    setNote(current?.note ?? "");
  }, [date, current?.status, current?.note]);

  const dirty =
    status !== (current?.status ?? "disponivel") ||
    note !== (current?.note ?? "");

  async function save() {
    setSaving(true);
    try {
      const saved = await api.put<DateAvailabilityView>(
        `/availability/${date}`,
        { status, note: note.trim() || null }
      );
      onSaved(saved);
      toast.success("Disponibilidade atualizada.");
    } catch (err) {
      toast.error(errorMessage(err, "Não foi possível salvar a data."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-label="Disponibilidade da data"
      className="flex flex-col gap-3 rounded-lg border p-4"
    >
      <div>
        <h2 className="text-sm font-semibold">Disponibilidade</h2>
        <p className="text-xs text-muted-foreground">
          {fromISODate(date).toLocaleDateString("pt-BR", {
            timeZone: "UTC",
            day: "2-digit",
            month: "long",
          })}{" "}
          · aparece no seu site para quem for pedir orçamento.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Status da data"
        className="flex flex-col gap-1"
      >
        {DATE_AVAILABILITY_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={status === s}
            onClick={() => setStatus(s)}
            className={cn(
              "flex items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              status === s ? "border-foreground/30 bg-accent/60" : "hover:bg-accent/30"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "mt-1.5 size-2 shrink-0 rounded-full",
                AVAILABILITY_STYLE[s].dot
              )}
            />
            <span className="flex flex-col">
              <span className="font-medium">{DATE_AVAILABILITY_LABELS[s]}</span>
              <span className="text-xs text-muted-foreground">
                {DATE_AVAILABILITY_HINTS[s]}
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="availability-note">Observação interna</Label>
        <Textarea
          id="availability-note"
          rows={2}
          maxLength={280}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ex: feriado, equipe reduzida"
        />
        <p className="text-xs text-muted-foreground">
          Só a equipe vê. O site mostra apenas a cor da data.
        </p>
      </div>

      <Button
        type="button"
        size="sm"
        className="self-end"
        disabled={!dirty || saving}
        onClick={save}
      >
        {saving ? "Salvando…" : "Salvar disponibilidade"}
      </Button>
    </section>
  );
}
