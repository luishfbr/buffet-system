"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Columns3, Table as TableIcon } from "lucide-react";
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
import { LeadDetailForm } from "@/components/leads/lead-detail";
import { LeadKanban } from "@/components/leads/lead-kanban";

type Filter = LeadStatus | "all";
type View = "table" | "kanban";

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

export default function LeadsPage() {
  const [view, setView] = useState<View>("table");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // O kanban precisa de todos os status; a tabela respeita o filtro ativo.
    const path =
      view === "kanban" || filter === "all"
        ? "/leads"
        : `/leads?status=${filter}`;
    const [l, p] = await Promise.all([
      api.get<Lead[]>(path),
      api.get<Package[]>("/packages?includeInactive=true"),
    ]);
    setLeads(l);
    setPackages(p);
    setLoading(false);
  }, [view, filter]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        l.customerName.toLowerCase().includes(q) ||
        l.customerPhone.includes(q) ||
        (l.customerEmail?.toLowerCase().includes(q) ?? false)
    );
  }, [leads, search]);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "Todos" },
    ...LEAD_STATUSES.map((s) => ({ key: s, label: LEAD_STATUS_LABELS[s] })),
  ];

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
        <p className="text-muted-foreground">Carregando...</p>
      ) : view === "kanban" ? (
        <LeadKanban leads={visible} onOpenLead={setOpenId} onChanged={load} />
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma negociação encontrada.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Cliente</th>
                <th className="px-4 py-2 font-medium">WhatsApp</th>
                <th className="px-4 py-2 font-medium">Data</th>
                <th className="px-4 py-2 font-medium">Convidados</th>
                <th className="px-4 py-2 font-medium">Valor</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => setOpenId(l.id)}
                  className="cursor-pointer border-b last:border-b-0 hover:bg-accent/50"
                >
                  <td className="px-4 py-2 font-medium">{l.customerName}</td>
                  <td className="px-4 py-2">{l.customerPhone}</td>
                  <td className="px-4 py-2">{formatDate(l.eventDate)}</td>
                  <td className="px-4 py-2">{l.guestCount ?? "—"}</td>
                  <td className="px-4 py-2">
                    {l.totalValue ? formatBRL(l.totalValue) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={STATUS_BADGE[l.status]}>
                      {LEAD_STATUS_LABELS[l.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
