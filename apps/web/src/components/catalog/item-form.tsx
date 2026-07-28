"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { DISH_CATEGORIES, type ItemType } from "@buffet/shared";
import type { Item } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";

const TYPE_LABELS: Record<ItemType, string> = {
  dish: "prato",
  drink: "bebida",
  service: "serviço",
};

/** Nome do campo no schema → rótulo que está na tela (RNF08). */
const FIELD_LABELS = {
  name: "Nome",
  category: "Categoria",
  basePrice: "Preço base",
};

export function ItemForm({
  type,
  item,
  onSaved,
  onCancel,
}: {
  type: ItemType;
  item?: Item;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState(item?.category ?? "entrada");
  const [basePrice, setBasePrice] = useState(item?.basePrice ?? "");
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (item) {
        await api.patch(`/items/${item.id}`, {
          name,
          basePrice,
          ...(type === "dish" ? { category } : {}),
        });
      } else {
        await api.post("/items", {
          name,
          type,
          basePrice,
          ...(type === "dish" ? { category } : {}),
        });
      }
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nome do {TYPE_LABELS[type]}</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      {type === "dish" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="category">Categoria</Label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            {DISH_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="basePrice">Preço base (R$)</Label>
        <Input
          id="basePrice"
          inputMode="decimal"
          placeholder="0.00"
          value={basePrice}
          onChange={(e) => setBasePrice(e.target.value)}
          required
        />
      </div>
      <FormError error={error} labels={FIELD_LABELS} />
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
