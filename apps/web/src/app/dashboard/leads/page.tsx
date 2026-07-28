"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Columns3, Handshake, Table as TableIcon } from "lucide-react";
import { api } from "@/lib/api";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  formatBRL,
  type LeadStatus,
} from "@buffet/shared";
import type { Lead, Package } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { SkeletonTable } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, type Column } from "@/components/ui/table";
import { LeadDetailForm } from "@/components/leads/lead-detail";
import { LeadKanban } from "@/components/leads/lead-kanban";

type Filter = LeadStatus | "all";
type View = "table" | "kanban";

function isLeadStatus(value: string | null): value is LeadStatus {
  return value !== null && (LEAD_STATUSES as readonly string[]).includes(value);
}

const STATUS_BADGE: Record<LeadStatus, "default" | "secondary" | "outline" | "muted"> = {
  novo: "default",
  em_negociacao: "secondary",
  formalizando: "secondary",
  aprovado: "outline",
  perdido: "muted",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/**
 * `useSearchParams` obriga um boundary de Suspense no App Router — sem ele o
 * `next build` falha. Os deep links vêm da home e do e-mail de novo lead.
 */
export default function LeadsPage() {
  return (
    <Suspense
      fallback={<SkeletonTable rows={6} cols={6} label="Carregando negociações" />}
    >
      <LeadsView />
    </Suspense>
  );
}

function LeadsView() {
  const params = useSearchParams();
  const statusParam = params.get("status");
  const openParam = params.get("open");

  const [view, setView] = useState<View>("table");
  // Filtro inicial vindo do deep link (?status=aprovado, vindo da home).
  const [filter, setFilter] = useState<Filter>(
    isLeadStatus(statusParam) ? statusParam : "all"
  );
  const [search, setSearch] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  // ?open=<id> abre a negociação direto — é o que faz o card da home e o link
  // do e-mail de novo lead (RF32) caírem na negociação certa.
  const [openId, setOpenId] = useState<string | null>(openParam);

  // Busca com debounce: o filtro roda no servidor (`?q=`), então disparar a
  // cada tecla seria uma requisição por caractere.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    // O kanban precisa de todos os status; a tabela respeita o filtro ativo.
    if (view === "table" && filter !== "all") params.set("status", filter);
    if (debouncedSearch) params.set("q", debouncedSearch);
    const query = params.toString();

    const [l, p] = await Promise.all([
      api.get<Lead[]>(`/leads${query ? `?${query}` : ""}`),
      api.get<Package[]>("/packages?includeInactive=true"),
    ]);
    setLeads(l);
    setPackages(p);
    setLoading(false);
  }, [view, filter, debouncedSearch]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  // A filtragem já veio do servidor; a lista é usada como está.
  const visible = leads;

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "Todos" },
    ...LEAD_STATUSES.map((s) => ({ key: s, label: LEAD_STATUS_LABELS[s] })),
  ];

  const columns: Column<Lead>[] = [
    { key: "customer", header: "Cliente", cell: (l) => l.customerName },
    { key: "phone", header: "WhatsApp", cell: (l) => l.customerPhone },
    { key: "date", header: "Data", cell: (l) => formatDate(l.eventDate) },
    { key: "guests", header: "Convidados", cell: (l) => l.guestCount ?? "—" },
    {
      key: "value",
      header: "Valor",
      cell: (l) => (l.totalValue ? formatBRL(l.totalValue) : "—"),
    },
    {
      key: "status",
      header: "Status",
      cell: (l) => (
        <Badge variant={STATUS_BADGE[l.status]}>
          {LEAD_STATUS_LABELS[l.status]}
        </Badge>
      ),
    },
  ];

  // Três vazios diferentes, três saídas diferentes — o antigo "Nenhuma
  // negociação encontrada" não dizia se o funil estava vazio ou se era a busca.
  const emptyState =
    search.trim() !== "" ? (
      <EmptyState
        icon={Handshake}
        title="Nenhum resultado para a busca"
        description="Procuramos por nome, WhatsApp e e-mail."
        action={{ label: "Limpar busca", onClick: () => setSearch("") }}
      />
    ) : filter !== "all" ? (
      <EmptyState
        icon={Handshake}
        title={`Nenhuma negociação em "${LEAD_STATUS_LABELS[filter]}"`}
        description="Nada neste estágio do funil por enquanto."
        action={{ label: "Ver todas", onClick: () => setFilter("all") }}
      />
    ) : (
      <EmptyState
        icon={Handshake}
        title="Nenhuma negociação ainda"
        description="Os leads entram sozinhos pela sua página pública: quem pede um orçamento por lá vira uma negociação aqui. Divulgue o link para começar."
        action={{ label: "Ver minha página pública", href: "/dashboard" }}
      />
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Negociações</h1>
          <p className="text-muted-foreground">
            Acompanhe seus leads do primeiro contato ao fechamento.
          </p>
        </div>
        <Tabs
          items={[
            { key: "table", label: "Tabela", icon: TableIcon },
            { key: "kanban", label: "Kanban", icon: Columns3 },
          ]}
          value={view}
          onChange={setView}
          label="Modo de visualização das negociações"
        />
      </div>

      {view === "table" && (
        <div className="flex flex-wrap gap-1 border-b">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                filter === f.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      <Input
        type="search"
        aria-label="Buscar negociações por nome, WhatsApp ou e-mail"
        placeholder="Buscar por nome, WhatsApp ou e-mail..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoComplete="off"
        className="max-w-sm"
      />

      {loading ? (
        <SkeletonTable rows={6} cols={6} label="Carregando negociações" />
      ) : view === "kanban" ? (
        <LeadKanban leads={visible} onOpenLead={setOpenId} onChanged={load} />
      ) : (
        <DataTable
          rows={visible}
          columns={columns}
          rowKey={(l) => l.id}
          caption="Negociações"
          onRowClick={(l) => setOpenId(l.id)}
          empty={emptyState}
        />
      )}

      <Modal
        open={openId !== null}
        onClose={() => setOpenId(null)}
        title="Negociação"
        description="Edite os dados, registre o histórico e gere a proposta."
      >
        {openId && (
          <LeadDetailForm
            leadId={openId}
            packages={packages}
            onSaved={() => {
              setOpenId(null);
              load();
            }}
            onCancel={() => setOpenId(null)}
          />
        )}
      </Modal>
    </div>
  );
}
