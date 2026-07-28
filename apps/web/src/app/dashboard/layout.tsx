"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  BookOpen,
  Handshake,
  CalendarDays,
  Globe,
  Wallet,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { DashboardBadges } from "@buffet/shared";
import { api } from "@/lib/api";
import { authClient, useSession, signOut } from "@/lib/auth-client";
import { useRole } from "@/lib/use-role";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type BadgeKey = keyof DashboardBadges;

const NAV: {
  href: string;
  label: string;
  icon: LucideIcon;
  ownerOnly?: boolean;
  badge?: BadgeKey;
}[] = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/dashboard/catalog", label: "Catálogo", icon: BookOpen },
  // Badge de leads aguardando atendimento (RF29): sem ele, um lead que chega
  // pela página pública fica invisível até alguém abrir a lista.
  {
    href: "/dashboard/leads",
    label: "Negociações",
    icon: Handshake,
    badge: "newLeads",
  },
  // Visível para owner e member: a agenda não expõe dado financeiro.
  { href: "/dashboard/agenda", label: "Agenda", icon: CalendarDays },
  // Owner-only: a página pública é a vitrine do buffet (RF25–RF27).
  {
    href: "/dashboard/pagina",
    label: "Página pública",
    icon: Globe,
    ownerOnly: true,
  },
  // Owner-only: members cannot see billing (RNF04).
  {
    href: "/dashboard/finance",
    label: "Financeiro",
    icon: Wallet,
    ownerOnly: true,
    badge: "overduePayments",
  },
  { href: "/dashboard/members", label: "Membros", icon: Users },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const { data: activeOrg, isPending: orgPending } =
    authClient.useActiveOrganization();
  const { isOwner } = useRole();
  const [badges, setBadges] = useState<DashboardBadges | null>(null);

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      router.replace("/login");
    } else if (!orgPending && !activeOrg) {
      // Sessão sem organização ativa → onboarding guiado (cria a org).
      router.replace("/onboarding");
    }
  }, [isPending, session, orgPending, activeOrg, router]);

  const loadBadges = useCallback(async () => {
    if (!activeOrg) return;
    // Endpoint próprio (duas contagens) em vez do /dashboard/summary: o shell
    // envolve todas as páginas e recarregaria a agregação pesada a cada rota.
    setBadges(await api.get<DashboardBadges>("/dashboard/badges"));
  }, [activeOrg]);

  // `pathname` na dependência: navegar entre páginas revalida os contadores,
  // que é quando eles podem ter mudado (ex.: acabei de atender um lead).
  useEffect(() => {
    loadBadges().catch(() => setBadges(null));
  }, [loadBadges, pathname]);

  if (isPending || !session || (!orgPending && !activeOrg)) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-screen items-center justify-center text-muted-foreground"
      >
        Carregando...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">
            {activeOrg?.name ?? "Buffet System"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {session.user.email}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await signOut();
              router.replace("/login");
            }}
          >
            Sair
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col sm:flex-row">
        <nav
          aria-label="Seções do painel"
          className="flex gap-1 overflow-x-auto border-b p-2 sm:w-52 sm:flex-col sm:border-b-0 sm:border-r"
        >
          {NAV.filter((item) => !item.ownerOnly || isOwner).map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const count = item.badge ? (badges?.[item.badge] ?? 0) : 0;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-secondary font-medium text-secondary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                {count > 0 && (
                  <Badge
                    variant="default"
                    className="shrink-0 bg-brand text-brand-foreground"
                  >
                    {count}
                    <span className="sr-only"> aguardando atenção</span>
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>
        {/* min-w-0: permite ao main encolher abaixo do conteúdo, contendo o
            scroll-x de áreas largas (ex.: o kanban) dentro delas em vez de
            empurrar o layout inteiro. */}
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
