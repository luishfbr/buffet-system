"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ConciergeBell,
  Package as PackageIcon,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatBRL, type ItemType } from "@buffet/shared";
import type { Item, Package } from "@/lib/types";
import { useRole } from "@/lib/use-role";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { ItemForm } from "@/components/catalog/item-form";
import { PackageForm } from "@/components/catalog/package-form";

type Tab = ItemType | "packages";
const TABS: { key: Tab; label: string; singular: string; icon: LucideIcon }[] = [
  { key: "dish", label: "Pratos", singular: "prato", icon: UtensilsCrossed },
  { key: "drink", label: "Bebidas", singular: "bebida", icon: Wine },
  { key: "service", label: "Serviços", singular: "serviço", icon: ConciergeBell },
  { key: "packages", label: "Pacotes", singular: "pacote", icon: PackageIcon },
];

export default function CatalogPage() {
  const { isOwner } = useRole();
  const [tab, setTab] = useState<Tab>("dish");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<
    | { kind: "item"; type: ItemType; item?: Item }
    | { kind: "package"; pkg?: Package }
    | null
  >(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [i, p] = await Promise.all([
      api.get<Item[]>("/items?includeInactive=true"),
      api.get<Package[]>("/packages?includeInactive=true"),
    ]);
    setItems(i);
    setPackages(p);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  async function toggleItem(it: Item) {
    await api.patch(`/items/${it.id}`, { isActive: !it.isActive });
    load();
  }
  async function togglePackage(p: Package) {
    await api.patch(`/packages/${p.id}`, { isActive: !p.isActive });
    load();
  }
  async function removeEntity(path: string) {
    if (!confirm("Excluir definitivamente? Esta ação não pode ser desfeita."))
      return;
    try {
      await api.del(path);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Erro ao excluir");
    }
  }

  const q = query.trim().toLowerCase();
  const matchesQuery = (name: string) => !q || name.toLowerCase().includes(q);

  const active = TABS.find((t) => t.key === tab)!;
  const visibleItems = useMemo(
    () => items.filter((i) => i.type === tab && matchesQuery(i.name)),
    [items, tab, q]
  );
  const visiblePackages = useMemo(
    () => packages.filter((p) => matchesQuery(p.name)),
    [packages, q]
  );

  const counts = useMemo(
    () => ({
      dish: items.filter((i) => i.type === "dish").length,
      drink: items.filter((i) => i.type === "drink").length,
      service: items.filter((i) => i.type === "service").length,
      packages: packages.length,
    }),
    [items, packages]
  );

  const createActive = () =>
    setModal(
      tab === "packages" ? { kind: "package" } : { kind: "item", type: tab }
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catálogo</h1>
          <p className="text-muted-foreground">
            Pratos, bebidas, serviços e pacotes do seu buffet.
          </p>
        </div>
        <Button onClick={createActive}>Novo {active.singular}</Button>
      </div>

      <Tabs
        items={TABS.map((t) => ({
          key: t.key,
          label: t.label,
          icon: t.icon,
          count: counts[t.key],
        }))}
        value={tab}
        onChange={setTab}
        label="Tipo de item do catálogo"
      />

      <Input
        type="search"
        aria-label="Buscar no catálogo por nome"
        placeholder="Buscar por nome..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        className="max-w-sm"
      />

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : tab === "packages" ? (
        <CatalogTable
          rows={visiblePackages}
          columns={["Nome", "Preço/convidado", "Status"]}
          render={(p) => [
            p.name,
            formatBRL(p.pricePerPerson),
            <StatusBadge key="s" active={p.isActive} />,
          ]}
          onEdit={(p) => setModal({ kind: "package", pkg: p })}
          onToggle={togglePackage}
          onDelete={isOwner ? (p) => removeEntity(`/packages/${p.id}`) : undefined}
          empty={
            <EmptyState
              searching={q.length > 0}
              singular={active.singular}
              onCreate={createActive}
            />
          }
        />
      ) : (
        <CatalogTable
          rows={visibleItems}
          columns={
            tab === "dish"
              ? ["Nome", "Categoria", "Preço", "Status"]
              : ["Nome", "Preço", "Status"]
          }
          render={(it) =>
            tab === "dish"
              ? [
                  it.name,
                  it.category ?? "—",
                  formatBRL(it.basePrice),
                  <StatusBadge key="s" active={it.isActive} />,
                ]
              : [
                  it.name,
                  formatBRL(it.basePrice),
                  <StatusBadge key="s" active={it.isActive} />,
                ]
          }
          onEdit={(it) => setModal({ kind: "item", type: it.type, item: it })}
          onToggle={toggleItem}
          onDelete={isOwner ? (it) => removeEntity(`/items/${it.id}`) : undefined}
          empty={
            <EmptyState
              searching={q.length > 0}
              singular={active.singular}
              onCreate={createActive}
            />
          }
        />
      )}

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={
          modal?.kind === "package"
            ? modal.pkg
              ? "Editar pacote"
              : "Novo pacote"
            : modal?.item
              ? "Editar item"
              : "Novo item"
        }
      >
        {modal?.kind === "item" && (
          <ItemForm
            type={modal.type}
            item={modal.item}
            onSaved={() => {
              setModal(null);
              load();
            }}
            onCancel={() => setModal(null)}
          />
        )}
        {modal?.kind === "package" && (
          <PackageForm
            pkg={modal.pkg}
            onSaved={() => {
              setModal(null);
              load();
            }}
            onCancel={() => setModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? "secondary" : "muted"}>
      {active ? "Ativo" : "Inativo"}
    </Badge>
  );
}

function EmptyState({
  searching,
  singular,
  onCreate,
}: {
  searching: boolean;
  singular: string;
  onCreate: () => void;
}) {
  if (searching)
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhum resultado para a busca. Ajuste os termos e tente de novo.
      </div>
    );
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-8 text-center">
      <p className="text-sm text-muted-foreground">
        Nenhum {singular} cadastrado ainda.
      </p>
      <Button size="sm" onClick={onCreate}>
        Novo {singular}
      </Button>
    </div>
  );
}

function CatalogTable<T extends { id: string; isActive: boolean }>({
  rows,
  columns,
  render,
  onEdit,
  onToggle,
  onDelete,
  empty,
}: {
  rows: T[];
  columns: string[];
  render: (row: T) => React.ReactNode[];
  onEdit: (row: T) => void;
  onToggle: (row: T) => void;
  onDelete?: (row: T) => void;
  empty: React.ReactNode;
}) {
  if (rows.length === 0) return <>{empty}</>;

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm tabular-nums">
        <thead className="sticky top-0 border-b bg-muted/40 text-left text-muted-foreground">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-4 py-2 font-medium">
                {c}
              </th>
            ))}
            <th className="px-4 py-2 text-right font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b transition-colors last:border-b-0 hover:bg-accent/50"
            >
              {render(row).map((cell, i) => (
                <td key={i} className="px-4 py-2">
                  {cell}
                </td>
              ))}
              <td className="px-4 py-2">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(row)}>
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggle(row)}
                  >
                    {row.isActive ? "Inativar" : "Ativar"}
                  </Button>
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => onDelete(row)}
                    >
                      Excluir
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
