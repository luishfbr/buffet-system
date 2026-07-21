"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatBRL, type ItemType } from "@buffet/shared";
import type { Item, Package } from "@/lib/types";
import { useRole } from "@/lib/use-role";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ItemForm } from "@/components/catalog/item-form";
import { PackageForm } from "@/components/catalog/package-form";

type Tab = ItemType | "packages";
const TABS: { key: Tab; label: string }[] = [
  { key: "dish", label: "Pratos" },
  { key: "drink", label: "Bebidas" },
  { key: "service", label: "Serviços" },
  { key: "packages", label: "Pacotes" },
];

export default function CatalogPage() {
  const { isOwner } = useRole();
  const [tab, setTab] = useState<Tab>("dish");
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

  const visibleItems = items.filter((i) => i.type === tab);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catálogo</h1>
          <p className="text-muted-foreground">
            Pratos, bebidas, serviços e pacotes do seu buffet.
          </p>
        </div>
        <Button
          onClick={() =>
            setModal(
              tab === "packages"
                ? { kind: "package" }
                : { kind: "item", type: tab }
            )
          }
        >
          Novo
        </Button>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : tab === "packages" ? (
        <CatalogTable
          rows={packages}
          columns={["Nome", "Preço/convidado", "Status"]}
          render={(p) => [
            p.name,
            formatBRL(p.pricePerPerson),
            <StatusBadge key="s" active={p.isActive} />,
          ]}
          onEdit={(p) => setModal({ kind: "package", pkg: p })}
          onToggle={togglePackage}
          onDelete={isOwner ? (p) => removeEntity(`/packages/${p.id}`) : undefined}
          emptyLabel="Nenhum pacote cadastrado."
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
          emptyLabel="Nenhum item nesta categoria."
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

function CatalogTable<T extends { id: string; isActive: boolean }>({
  rows,
  columns,
  render,
  onEdit,
  onToggle,
  onDelete,
  emptyLabel,
}: {
  rows: T[];
  columns: string[];
  render: (row: T) => React.ReactNode[];
  onEdit: (row: T) => void;
  onToggle: (row: T) => void;
  onDelete?: (row: T) => void;
  emptyLabel: string;
}) {
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-left text-muted-foreground">
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
            <tr key={row.id} className="border-b last:border-b-0">
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
