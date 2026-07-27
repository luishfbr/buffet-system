"use client";

import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatBRL } from "@buffet/shared";
import type { Item, Package } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Passo 5 do onboarding — quick-add de pacotes com preço fixo por convidado
// (RF13). Itens do catálogo já criados podem ser inclusos como chips opcionais.

export function PackagesStep({
  packages,
  items,
  onAdd,
  onRemove,
  onBack,
  onFinish,
}: {
  packages: Package[];
  items: Item[];
  onAdd: (pkg: Package) => void;
  onRemove: (id: string) => void;
  onBack: () => void;
  onFinish: () => void;
}) {
  const [name, setName] = useState("");
  const [pricePerPerson, setPricePerPerson] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const hasPackages = packages.length > 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !pricePerPerson.trim()) return;
    setError(null);
    setAdding(true);
    try {
      const created = await api.post<Package>("/packages", {
        name: name.trim(),
        pricePerPerson: pricePerPerson.trim(),
        itemIds: [...selected],
      });
      onAdd(created);
      setName("");
      setPricePerPerson("");
      setSelected(new Set());
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
      await api.del(`/packages/${id}`);
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
          Pacotes
        </h1>
        <p className="mt-1.5 text-muted-foreground">
          Cada pacote tem um preço fixo por convidado — é o que o cliente escolhe
          na sua página para ver a estimativa na hora.
        </p>
      </div>

      <form onSubmit={handleAdd} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="pkg-name">Nome do pacote</Label>
            <Input
              id="pkg-name"
              name="pkg-name"
              autoComplete="off"
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pacote Ouro"
            />
          </div>
          <div className="flex flex-col gap-2 sm:w-40">
            <Label htmlFor="pkg-price">Por convidado (R$)</Label>
            <Input
              id="pkg-price"
              name="pkg-price"
              autoComplete="off"
              inputMode="decimal"
              placeholder="150.00"
              value={pricePerPerson}
              onChange={(e) => setPricePerPerson(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            size="icon"
            aria-label="Adicionar pacote"
            disabled={adding || !name.trim() || !pricePerPerson.trim()}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Inclusão opcional de itens já cadastrados (RF13). */}
        {items.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">
              Itens inclusos{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {items.map((item) => {
                const on = selected.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(item.id)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      on
                        ? "border-brand/40 bg-brand/10 font-medium text-brand"
                        : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

      {hasPackages ? (
        <ul
          aria-live="polite"
          className="flex flex-col divide-y rounded-lg border"
        >
          {packages.map((pkg) => (
            <li
              key={pkg.id}
              className="flex items-center gap-3 px-4 py-2.5 text-sm"
            >
              <span className="min-w-0 flex-1 truncate font-medium">
                {pkg.name}
              </span>
              <span className="font-mono text-muted-foreground">
                {formatBRL(pkg.pricePerPerson)}
                <span className="text-xs">/pessoa</span>
              </span>
              <button
                type="button"
                onClick={() => handleRemove(pkg.id)}
                disabled={removingId === pkg.id}
                aria-label={`Remover ${pkg.name}`}
                className="rounded-sm p-1 text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Crie pelo menos um pacote para sua página já receber orçamentos. Você
          pode ajustar tudo depois.
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={onBack}>
          Voltar
        </Button>
        <Button type="button" variant="brand" onClick={onFinish}>
          {hasPackages ? "Concluir" : "Concluir mesmo assim"}
        </Button>
      </div>
    </div>
  );
}
