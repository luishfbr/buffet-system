"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import {
  DISH_CATEGORIES,
  PRICING_TYPES,
  PRICING_TYPE_HINTS,
  PRICING_TYPE_LABELS,
  type ItemType,
  type PricingType,
} from "@buffet/shared";
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
  guestsPerUnit: "Convidados por unidade",
  minQty: "Quantidade mínima",
  maxQty: "Quantidade máxima",
};

/** O rótulo do preço muda com o tipo — "Preço base" sozinho não diz de quê. */
const PRICE_LABELS: Record<PricingType, string> = {
  FIXED: "Valor (R$)",
  PER_GUEST: "Preço por convidado (R$)",
  PER_UNIT: "Preço por unidade (R$)",
  PER_UNIT_AUTO: "Preço por unidade (R$)",
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
  const [pricingType, setPricingType] = useState<PricingType>(
    item?.pricingType ?? "FIXED"
  );
  const [minQty, setMinQty] = useState(item?.minQty?.toString() ?? "");
  const [maxQty, setMaxQty] = useState(item?.maxQty?.toString() ?? "");
  const [guestsPerUnit, setGuestsPerUnit] = useState(
    item?.guestsPerUnit?.toString() ?? ""
  );
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    // O servidor limpa os campos que não pertencem ao tipo escolhido; mandar
    // só os relevantes evita mandar lixo que ele teria que ignorar.
    const payload = {
      name,
      basePrice,
      pricingType,
      ...(type === "dish" ? { category } : {}),
      ...(pricingType === "PER_UNIT"
        ? {
            minQty: minQty === "" ? null : Number(minQty),
            maxQty: maxQty === "" ? null : Number(maxQty),
          }
        : {}),
      ...(pricingType === "PER_UNIT_AUTO"
        ? { guestsPerUnit: guestsPerUnit === "" ? null : Number(guestsPerUnit) }
        : {}),
    };

    try {
      if (item) {
        await api.patch(`/items/${item.id}`, payload);
      } else {
        await api.post("/items", { ...payload, type });
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
      {/* RF-V2-09: como o preço se comporta. Só serviços variam — prato e
          bebida sempre têm preço fixo, e oferecer a escolha lá seria oferecer
          uma decisão que não existe. */}
      {type === "service" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="pricingType">Como cobrar</Label>
          <select
            id="pricingType"
            value={pricingType}
            onChange={(e) => setPricingType(e.target.value as PricingType)}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            {PRICING_TYPES.map((t) => (
              <option key={t} value={t}>
                {PRICING_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            {PRICING_TYPE_HINTS[pricingType]}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="basePrice">{PRICE_LABELS[pricingType]}</Label>
        <Input
          id="basePrice"
          inputMode="decimal"
          placeholder="0.00"
          value={basePrice}
          onChange={(e) => setBasePrice(e.target.value)}
          required
        />
      </div>

      {pricingType === "PER_UNIT_AUTO" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="guestsPerUnit">Convidados por unidade</Label>
          <Input
            id="guestsPerUnit"
            inputMode="numeric"
            placeholder="20"
            value={guestsPerUnit}
            onChange={(e) => setGuestsPerUnit(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            Ex.: 20 significa 1 unidade a cada 20 convidados. A conta arredonda
            para cima — 45 convidados pedem 3 unidades.
          </p>
        </div>
      )}

      {pricingType === "PER_UNIT" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="minQty">Quantidade mínima</Label>
            <Input
              id="minQty"
              inputMode="numeric"
              placeholder="Sem mínimo"
              value={minQty}
              onChange={(e) => setMinQty(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="maxQty">Quantidade máxima</Label>
            <Input
              id="maxQty"
              inputMode="numeric"
              placeholder="Sem máximo"
              value={maxQty}
              onChange={(e) => setMaxQty(e.target.value)}
            />
          </div>
        </div>
      )}

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
