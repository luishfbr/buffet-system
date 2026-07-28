"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ConciergeBell,
  Package as PackageIcon,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { formatBRL, type ItemType } from "@buffet/shared";
import type { Item, Package } from "@/lib/types";
import { useRole } from "@/lib/use-role";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { DataTable, type Column } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonTable } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { ItemForm } from "@/components/catalog/item-form";
import { PackageForm } from "@/components/catalog/package-form";

type Tab = ItemType | "packages";
const TABS: { key: Tab; label: string; singular: string; icon: LucideIcon }[] = [
  { key: "dish", label: "Pratos", singular: "prato", icon: UtensilsCrossed },
  { key: "drink", label: "Bebidas", singular: "bebida", icon: Wine },
  { key: "service", label: "Serviços", singular: "serviço", icon: ConciergeBell },
  { key: "packages", label: "Pacotes", singular: "pacote", icon: PackageIcon },
];

/** Alvo do diálogo de exclusão: o que apagar e como se referir a ele. */
type DeleteTarget = { path: string; label: string };

function isTab(value: string | null): value is Tab {
  return TABS.some((t) => t.key === value);
}

/** Boundary exigido pelo App Router para o `useSearchParams` do deep link. */
export default function CatalogPage() {
  return (
    <Suspense
      fallback={<SkeletonTable rows={5} cols={4} label="Carregando catálogo" />}
    >
      <CatalogView />
    </Suspense>
  );
}

function CatalogView() {
  const { isOwner } = useRole();
  const toast = useToast();
  // ?tab=dish|drink|service|packages — usado pelo checklist da home (RF30).
  const tabParam = useSearchParams().get("tab");
  const [tab, setTab] = useState<Tab>(isTab(tabParam) ? tabParam : "dish");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [toDelete, setToDelete] = useState<DeleteTarget | null>(null);
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
    load().catch((err) => {
      setLoading(false);
      toast.error(errorMessage(err, "Não foi possível carregar o catálogo."));
    });
  }, [load, toast]);

  async function toggle(resource: "items" | "packages", row: Item | Package) {
    try {
      await api.patch(`/${resource}/${row.id}`, { isActive: !row.isActive });
      toast.success(row.isActive ? "Item inativado." : "Item reativado.");
      await load();
    } catch (err) {
      toast.error(errorMessage(err, "Não foi possível alterar o status."));
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.del(toDelete.path);
      setToDelete(null);
      toast.success(`${toDelete.label} excluído.`);
      await load();
    } catch (err) {
      // A API bloqueia exclusão do que está em uso e explica o porquê
      // ("Inative-o em vez de excluir") — a mensagem dela é melhor que a nossa.
      toast.error(errorMessage(err, "Não foi possível excluir."));
      setToDelete(null);
    } finally {
      setDeleting(false);
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

  const emptyState = (
    <EmptyState
      icon={active.icon}
      title={
        q
          ? "Nenhum resultado para a busca"
          : `Nenhum ${active.singular} cadastrado ainda`
      }
      description={
        q
          ? "Ajuste os termos e tente de novo."
          : `Os ${active.label.toLowerCase()} que você cadastrar aqui ficam disponíveis para montar pacotes e orçamentos.`
      }
      action={
        q
          ? { label: "Limpar busca", onClick: () => setQuery("") }
          : { label: `Novo ${active.singular}`, onClick: createActive }
      }
    />
  );

  const itemColumns: Column<Item>[] = [
    { key: "name", header: "Nome", cell: (it) => it.name },
    ...(tab === "dish"
      ? [
          {
            key: "category",
            header: "Categoria",
            cell: (it: Item) => it.category ?? "—",
          },
        ]
      : []),
    { key: "price", header: "Preço", cell: (it) => formatBRL(it.basePrice) },
    {
      key: "status",
      header: "Status",
      cell: (it) => <StatusBadge active={it.isActive} />,
    },
  ];

  const packageColumns: Column<Package>[] = [
    { key: "name", header: "Nome", cell: (p) => p.name },
    {
      key: "price",
      header: "Preço/convidado",
      cell: (p) => formatBRL(p.pricePerPerson),
    },
    {
      key: "status",
      header: "Status",
      cell: (p) => <StatusBadge active={p.isActive} />,
    },
  ];

  /** Editar / Inativar / Excluir — as mesmas três ações para item e pacote. */
  function rowActions(
    resource: "items" | "packages",
    row: Item | Package,
    onEdit: () => void
  ) {
    return (
      <>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Editar
        </Button>
        <Button variant="ghost" size="sm" onClick={() => toggle(resource, row)}>
          {row.isActive ? "Inativar" : "Ativar"}
        </Button>
        {/* Exclusão física é owner-only (RF04/RF08/RF12/RF16). */}
        {isOwner && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() =>
              setToDelete({ path: `/${resource}/${row.id}`, label: row.name })
            }
          >
            Excluir
          </Button>
        )}
      </>
    );
  }

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
        <SkeletonTable rows={5} cols={4} label="Carregando catálogo" />
      ) : tab === "packages" ? (
        <DataTable
          rows={visiblePackages}
          columns={packageColumns}
          rowKey={(p) => p.id}
          caption="Pacotes do catálogo"
          empty={emptyState}
          actions={(p) =>
            rowActions("packages", p, () => setModal({ kind: "package", pkg: p }))
          }
        />
      ) : (
        <DataTable
          rows={visibleItems}
          columns={itemColumns}
          rowKey={(it) => it.id}
          caption={`${active.label} do catálogo`}
          empty={emptyState}
          actions={(it) =>
            rowActions("items", it, () =>
              setModal({ kind: "item", type: it.type, item: it })
            )
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
              toast.success("Item salvo.");
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
              toast.success("Pacote salvo.");
              load();
            }}
            onCancel={() => setModal(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title={`Excluir ${toDelete?.label ?? ""}?`}
        description="Esta ação não pode ser desfeita. Se o item já foi usado em um orçamento, prefira inativá-lo — assim o histórico continua íntegro."
        confirmLabel="Excluir definitivamente"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
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
