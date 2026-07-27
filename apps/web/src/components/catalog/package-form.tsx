"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Item, Package, PackageWithItems } from "@/lib/types";
import { formatBRL } from "@buffet/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PackageGallery } from "./package-gallery";

export function PackageForm({
  pkg,
  onSaved,
  onCancel,
}: {
  pkg?: Package;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(pkg?.name ?? "");
  const [description, setDescription] = useState(pkg?.description ?? "");
  const [pricePerPerson, setPricePerPerson] = useState(
    pkg?.pricePerPerson ?? ""
  );
  const [isFeatured, setIsFeatured] = useState(pkg?.isFeatured ?? false);
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Item[]>("/items").then(setItems).catch(() => setItems([]));
    if (pkg) {
      api
        .get<PackageWithItems>(`/packages/${pkg.id}`)
        .then((p) => setSelected(new Set(p.itemIds)))
        .catch(() => {});
    }
  }, [pkg]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const payload = {
      name,
      description: description || undefined,
      pricePerPerson,
      itemIds: [...selected],
      isFeatured,
    };
    try {
      if (pkg) await api.patch(`/packages/${pkg.id}`, payload);
      else await api.post("/packages", payload);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="pname">Nome do pacote</Label>
        <Input
          id="pname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Pacote Ouro"
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="price">Preço por convidado (R$)</Label>
        <Input
          id="price"
          inputMode="decimal"
          placeholder="150.00"
          value={pricePerPerson}
          onChange={(e) => setPricePerPerson(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="desc">Descrição (opcional)</Label>
        <Input
          id="desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Itens inclusos</Label>
        <div className="max-h-48 overflow-y-auto rounded-md border">
          {items.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">
              Cadastre itens no catálogo primeiro.
            </p>
          )}
          {items.map((it) => (
            <label
              key={it.id}
              className="flex cursor-pointer items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-accent"
            >
              <input
                type="checkbox"
                checked={selected.has(it.id)}
                onChange={() => toggle(it.id)}
              />
              <span className="flex-1">{it.name}</span>
              <span className="text-muted-foreground">
                {formatBRL(it.basePrice)}
              </span>
            </label>
          ))}
        </div>
      </div>
      <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
        <span className="flex flex-col">
          <span className="text-sm font-medium">Destacar na página pública</span>
          <span className="text-xs text-muted-foreground">
            O pacote ganha selo e borda na cor da marca. A ordem da vitrine você
            define em Página pública.
          </span>
        </span>
        <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
      </label>

      {/* RF28: a galeria salva na hora, então precisa de um pacote já criado. */}
      {pkg ? (
        <PackageGallery packageId={pkg.id} />
      ) : (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          Salve o pacote para adicionar fotos.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
