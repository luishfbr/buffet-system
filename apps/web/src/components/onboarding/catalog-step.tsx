"use client";

import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { DISH_CATEGORIES, formatBRL, type ItemType } from "@buffet/shared";
import type { Item } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Passos 2–4 do onboarding — quick-add de pratos/bebidas/serviços (RF01/RF05/RF09).
// Digita nome (+ categoria em pratos) e preço, Enter/(+) adiciona à lista ali mesmo.

export function CatalogStep({
  type,
  title,
  description,
  items,
  onAdd,
  onRemove,
  onBack,
  onNext,
}: {
  type: ItemType;
  title: string;
  description: string;
  items: Item[];
  onAdd: (item: Item) => void;
  onRemove: (id: string) => void;
  onBack?: () => void;
  onNext: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(DISH_CATEGORIES[0]);
  const [basePrice, setBasePrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const hasItems = items.length > 0;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !basePrice.trim()) return;
    setError(null);
    setAdding(true);
    try {
      const created = await api.post<Item>("/items", {
        name: name.trim(),
        type,
        basePrice: basePrice.trim(),
        ...(type === "dish" ? { category } : {}),
      });
      onAdd(created);
      setName("");
      setBasePrice("");
      nameRef.current?.focus();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao adicionar");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    setRemovingId(id);
    try {
      await api.del(`/items/${id}`);
      onRemove(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao remover");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-balance">
          {title}
        </h1>
        <p className="mt-1.5 text-muted-foreground">{description}</p>
      </div>

      <form onSubmit={handleAdd} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="item-name">Nome</Label>
            <Input
              id="item-name"
              name="item-name"
              autoComplete="off"
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                type === "dish"
                  ? "Filé ao molho madeira"
                  : type === "drink"
                    ? "Suco natural"
                    : "Garçom"
              }
            />
          </div>
          {type === "dish" && (
            <div className="flex flex-col gap-2 sm:w-40">
              <Label htmlFor="item-category">Categoria</Label>
              <select
                id="item-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-9 rounded-md border bg-transparent px-3 text-sm capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {DISH_CATEGORIES.map((c) => (
                  <option key={c} value={c} className="capitalize">
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-2 sm:w-32">
            <Label htmlFor="item-price">Preço (R$)</Label>
            <Input
              id="item-price"
              name="item-price"
              autoComplete="off"
              inputMode="decimal"
              placeholder="0.00"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            size="icon"
            aria-label={`Adicionar ${title.toLowerCase()}`}
            disabled={adding || !name.trim() || !basePrice.trim()}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

      {/* Lista do que já foi adicionado neste passo. */}
      {hasItems ? (
        <ul
          aria-live="polite"
          className="flex flex-col divide-y rounded-lg border"
        >
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 px-4 py-2.5 text-sm"
            >
              <span className="min-w-0 flex-1 truncate font-medium">
                {item.name}
              </span>
              {item.category && (
                <span className="hidden text-xs capitalize text-muted-foreground sm:inline">
                  {item.category}
                </span>
              )}
              <span className="font-mono text-muted-foreground">
                {formatBRL(item.basePrice)}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(item.id)}
                disabled={removingId === item.id}
                aria-label={`Remover ${item.name}`}
                className="rounded-sm p-1 text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum item ainda. Adicione os principais agora — dá para completar o
          resto depois pelo catálogo.
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        {onBack ? (
          <Button type="button" variant="ghost" onClick={onBack}>
            Voltar
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="button"
          variant={hasItems ? "brand" : "outline"}
          onClick={onNext}
        >
          {hasItems ? "Continuar" : "Pular por agora"}
        </Button>
      </div>
    </div>
  );
}
