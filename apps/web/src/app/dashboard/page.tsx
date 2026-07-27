"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { authClient, useSession } from "@/lib/auth-client";
import { appHost, publicUrl } from "@/lib/onboarding";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardPage() {
  const { data: session } = useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const role = activeOrg?.members?.find(
    (m) => m.userId === session?.user.id
  )?.role;
  const slug = activeOrg?.slug;
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!slug) return;
    try {
      await navigator.clipboard.writeText(publicUrl(slug));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard indisponível — o link fica visível para cópia manual.
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Olá, {session?.user.name?.split(" ")[0] ?? "!"}
        </h1>
        <p className="text-muted-foreground">
          Bem-vindo ao painel do {activeOrg?.name ?? "seu buffet"}.
        </p>
      </div>

      {/* Página pública do buffet (RF17) — link para copiar e divulgar. */}
      <div className="rounded-xl border border-brand/30 bg-brand/5 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
              Sua página pública
            </span>
            <p className="mt-1 truncate font-mono text-sm">
              <span className="text-muted-foreground">{appHost()}/</span>
              <span className="font-semibold text-brand">
                {slug ?? "..."}
              </span>
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={copyLink}
              disabled={!slug}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  Copiar link
                </>
              )}
            </button>
            {slug && (
              <a
                href={publicUrl(slug)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir página pública em nova aba"
                className="inline-flex items-center justify-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Abrir</span>
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Organização</CardDescription>
            <CardTitle>{activeOrg?.name ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Seu papel</CardDescription>
            <CardTitle className="capitalize">
              {role === "owner"
                ? "Proprietário"
                : role === "member"
                  ? "Funcionário"
                  : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <p className="text-sm text-muted-foreground">
        Use o menu para gerenciar catálogo, negociações e financeiro.
      </p>
    </div>
  );
}
