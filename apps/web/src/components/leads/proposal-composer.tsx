"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, TriangleAlert } from "lucide-react";
import {
  ADJUSTMENT_KIND_LABELS,
  ADJUSTMENT_KINDS,
  ADJUSTMENT_MODES,
  PRICING_TYPE_LABELS,
  formatBRL,
  quantityIsEditable,
  type AdjustmentKind,
  type AdjustmentMode,
  type ProposalAdjustmentInput,
  type ProposalView,
} from "@buffet/shared";
import { api, errorMessage } from "@/lib/api";
import type { Item, Package } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { SkeletonList } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

/** Linha em edição no cliente, antes de virar payload. */
interface DraftLine {
  key: string;
  packageId: string | null;
  itemId: string | null;
  quantity: string;
}

let keySeq = 0;
const nextKey = () => `l${++keySeq}`;

/**
 * Compositor da proposta (RF-V2-09 / RF-V2-10): pacote base, serviços avulsos e
 * ajustes.
 *
 * O rascunho vive no cliente e só vai ao servidor no "Salvar proposta" — é o
 * mesmo contrato do editor da página pública, e pelo mesmo motivo: montar uma
 * proposta é uma sequência de decisões, e gravar cada tecla faria o total
 * piscar por estados que ninguém pediu.
 *
 * **O servidor é a autoridade sobre o preço.** O que aparece aqui é o último
 * cálculo que veio dele; o rascunho não salvo não mostra total, e o aviso de
 * "não salvo" é o que impede confundir intenção com número fechado.
 */
export function ProposalComposer({
  leadId,
  guestCount,
  packages,
  onSaved,
}: {
  leadId: string;
  guestCount: number | null;
  packages: Package[];
  /** A proposta mudou o total da negociação — o pai rebusca o cabeçalho. */
  onSaved: () => void;
}) {
  const toast = useToast();
  const [view, setView] = useState<ProposalView | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [adjustments, setAdjustments] = useState<
    (ProposalAdjustmentInput & { key: string })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [proposal, catalog] = await Promise.all([
      api.get<ProposalView>(`/leads/${leadId}/proposal-composition`),
      api.get<Item[]>("/items?type=service"),
    ]);
    setView(proposal);
    setItems(catalog);
    setLines(
      proposal.lines.map((l) => ({
        key: nextKey(),
        packageId: l.packageId,
        itemId: l.itemId,
        quantity: l.quantity ? String(l.quantity) : "",
      }))
    );
    setAdjustments(
      proposal.adjustments.map((a) => ({
        key: nextKey(),
        kind: a.kind,
        mode: a.mode,
        value: a.value,
        label: a.label ?? "",
      }))
    );
    setDirty(false);
    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const itemById = useMemo(
    () => new Map(items.map((i) => [i.id, i])),
    [items]
  );

  function mutate<T>(setter: (v: T) => void, value: T) {
    setter(value);
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const next = await api.put<ProposalView>(
        `/leads/${leadId}/proposal-composition`,
        {
          lines: lines.map((l) => ({
            packageId: l.packageId,
            itemId: l.itemId,
            quantity: l.quantity === "" ? null : Number(l.quantity),
          })),
          adjustments: adjustments.map(({ kind, mode, value, label }) => ({
            kind,
            mode,
            value: value || "0",
            label: label || null,
          })),
        }
      );
      setView(next);
      setDirty(false);
      toast.success("Proposta salva.");
      onSaved();
    } catch (err) {
      // O servidor explica qual linha está errada e por quê — a mensagem dele é
      // melhor que qualquer coisa que se possa montar aqui.
      toast.error(errorMessage(err, "Não foi possível salvar a proposta."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SkeletonList rows={3} label="Carregando proposta" />;
  if (!view) return null;

  const readOnly = !view.editable;

  return (
    <div className="flex flex-col gap-4">
      {readOnly && (
        <Alert variant="info" title="Proposta encerrada">
          Esta negociação chegou a um estado final. A composição fica como
          registro e não pode mais ser alterada.
        </Alert>
      )}

      {guestCount == null && (
        <Alert variant="warning" title="Sem número de convidados">
          Itens cobrados por convidado não têm como ser calculados. Informe os
          convidados nos dados da negociação.
        </Alert>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Itens da proposta</h3>
          {!readOnly && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                mutate(setLines, [
                  ...lines,
                  { key: nextKey(), packageId: null, itemId: "", quantity: "" },
                ])
              }
            >
              <Plus className="size-4" aria-hidden />
              Adicionar item
            </Button>
          )}
        </div>

        {lines.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            Nenhum item ainda. Adicione o pacote e os serviços que compõem esta
            proposta.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lines.map((line, i) => {
              const saved = view.lines[i];
              const item = line.itemId ? itemById.get(line.itemId) : undefined;
              const editableQty =
                item != null && quantityIsEditable(item.pricingType);
              return (
                <li
                  key={line.key}
                  className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex flex-1 flex-col gap-1">
                      <Label
                        htmlFor={`line-${line.key}`}
                        className="text-xs text-muted-foreground"
                      >
                        {line.packageId !== null ? "Pacote" : "Serviço"}
                      </Label>
                      <select
                        id={`line-${line.key}`}
                        disabled={readOnly}
                        value={line.packageId ?? line.itemId ?? ""}
                        onChange={(e) => {
                          const id = e.target.value;
                          const isPackage = packages.some((p) => p.id === id);
                          mutate(
                            setLines,
                            lines.map((l) =>
                              l.key === line.key
                                ? {
                                    ...l,
                                    packageId: isPackage ? id : null,
                                    itemId: isPackage ? null : id,
                                    quantity: "",
                                  }
                                : l
                            )
                          );
                        }}
                        className="h-9 rounded-md border bg-transparent px-3 text-sm disabled:opacity-60"
                      >
                        <option value="">Selecione…</option>
                        <optgroup label="Pacotes">
                          {packages.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {formatBRL(p.pricePerPerson)}/pessoa
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Serviços">
                          {items.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.name} — {PRICING_TYPE_LABELS[it.pricingType]}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    {editableQty && (
                      <div className="flex w-24 flex-col gap-1">
                        <Label
                          htmlFor={`qty-${line.key}`}
                          className="text-xs text-muted-foreground"
                        >
                          Qtd.
                        </Label>
                        <Input
                          id={`qty-${line.key}`}
                          inputMode="numeric"
                          disabled={readOnly}
                          value={line.quantity}
                          onChange={(e) =>
                            mutate(
                              setLines,
                              lines.map((l) =>
                                l.key === line.key
                                  ? { ...l, quantity: e.target.value }
                                  : l
                              )
                            )
                          }
                        />
                      </div>
                    )}

                    {!readOnly && (
                      <button
                        type="button"
                        aria-label="Remover item da proposta"
                        onClick={() =>
                          mutate(
                            setLines,
                            lines.filter((l) => l.key !== line.key)
                          )
                        }
                        className="mt-5 shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    )}
                  </div>

                  {/* Só o que veio do servidor tem preço. Uma linha recém-mexida
                      espera o "Salvar" para ganhar número. */}
                  {!dirty && saved && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      {saved.error ? (
                        <>
                          <TriangleAlert
                            className="size-3.5 shrink-0 text-destructive"
                            aria-hidden
                          />
                          {saved.error}
                        </>
                      ) : (
                        <>
                          {saved.quantity}× {formatBRL(saved.basePrice)}
                          <strong className="ml-auto tabular-nums text-foreground">
                            {formatBRL(saved.subtotal)}
                          </strong>
                        </>
                      )}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Descontos e taxas</h3>
          {!readOnly && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                mutate(setAdjustments, [
                  ...adjustments,
                  {
                    key: nextKey(),
                    kind: "desconto" as AdjustmentKind,
                    mode: "percentual" as AdjustmentMode,
                    value: "",
                    label: "",
                  },
                ])
              }
            >
              <Plus className="size-4" aria-hidden />
              Adicionar ajuste
            </Button>
          )}
        </div>

        {adjustments.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum ajuste. Descontos entram antes das taxas, e ambos os
            percentuais incidem sobre o subtotal.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {adjustments.map((adj) => (
              <li key={adj.key} className="flex items-end gap-2">
                <select
                  aria-label="Tipo de ajuste"
                  disabled={readOnly}
                  value={adj.kind}
                  onChange={(e) =>
                    mutate(
                      setAdjustments,
                      adjustments.map((a) =>
                        a.key === adj.key
                          ? { ...a, kind: e.target.value as AdjustmentKind }
                          : a
                      )
                    )
                  }
                  className="h-9 rounded-md border bg-transparent px-2 text-sm disabled:opacity-60"
                >
                  {ADJUSTMENT_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {ADJUSTMENT_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
                <Input
                  aria-label="Descrição do ajuste"
                  placeholder="Descrição"
                  disabled={readOnly}
                  value={adj.label ?? ""}
                  onChange={(e) =>
                    mutate(
                      setAdjustments,
                      adjustments.map((a) =>
                        a.key === adj.key ? { ...a, label: e.target.value } : a
                      )
                    )
                  }
                  className="flex-1"
                />
                <Input
                  aria-label="Valor do ajuste"
                  inputMode="decimal"
                  placeholder="0.00"
                  disabled={readOnly}
                  value={adj.value}
                  onChange={(e) =>
                    mutate(
                      setAdjustments,
                      adjustments.map((a) =>
                        a.key === adj.key ? { ...a, value: e.target.value } : a
                      )
                    )
                  }
                  className="w-24"
                />
                <select
                  aria-label="Forma do ajuste"
                  disabled={readOnly}
                  value={adj.mode}
                  onChange={(e) =>
                    mutate(
                      setAdjustments,
                      adjustments.map((a) =>
                        a.key === adj.key
                          ? { ...a, mode: e.target.value as AdjustmentMode }
                          : a
                      )
                    )
                  }
                  className="h-9 rounded-md border bg-transparent px-2 text-sm disabled:opacity-60"
                >
                  {ADJUSTMENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m === "fixo" ? "R$" : "%"}
                    </option>
                  ))}
                </select>
                {!readOnly && (
                  <button
                    type="button"
                    aria-label="Remover ajuste"
                    onClick={() =>
                      mutate(
                        setAdjustments,
                        adjustments.filter((a) => a.key !== adj.key)
                      )
                    }
                    className="shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-1 rounded-lg border bg-muted/20 px-4 py-3 text-sm">
        <Row label="Subtotal" value={view.subtotal} muted={dirty} />
        {view.discountTotal !== "0.00" && (
          <Row label="Descontos" value={`-${view.discountTotal}`} muted={dirty} />
        )}
        {view.feeTotal !== "0.00" && (
          <Row label="Taxas" value={view.feeTotal} muted={dirty} />
        )}
        <div className="mt-1 flex items-baseline justify-between border-t pt-2">
          <span className="font-semibold">Total</span>
          <strong
            className={`font-display text-lg tabular-nums ${dirty ? "text-muted-foreground" : ""}`}
          >
            {dirty ? "—" : formatBRL(view.total)}
          </strong>
        </div>
        {dirty && (
          <p className="text-xs text-muted-foreground">
            Salve para o servidor recalcular o total.
          </p>
        )}
      </section>

      {!readOnly && (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!dirty || saving}
            onClick={() => void load()}
          >
            Desfazer
          </Button>
          <Button type="button" disabled={!dirty || saving} onClick={save}>
            {saving ? "Salvando…" : "Salvar proposta"}
          </Button>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${muted ? "text-muted-foreground" : ""}`}>
        {muted ? "—" : formatBRL(value)}
      </span>
    </div>
  );
}
