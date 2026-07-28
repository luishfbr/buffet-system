"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import type { DashboardBadges } from "@buffet/shared";
import { api, errorMessage } from "@/lib/api";
import { signOut } from "@/lib/auth-client";
import {
  isUnauthorized,
  resolveEntryRoute,
  useWorkspace,
} from "@/lib/workspace";
import { isSidebarCollapsed, setSidebarCollapsed } from "@/lib/sidebar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OrgSwitcher } from "@/components/dashboard/org-switcher";

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

/**
 * A rota atual pertence a esta seção? `/dashboard` só casa exato, senão a Visão
 * geral ficaria ativa em toda página do painel.
 */
function isCurrentSection(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    workspace,
    loading: workspaceLoading,
    error: workspaceError,
    reload: reloadWorkspace,
  } = useWorkspace();
  const [badges, setBadges] = useState<DashboardBadges | null>(null);
  // Sidebar recolhida (só ícones). `hydrated` existe só para não animar a
  // largura no primeiro paint: a preferência mora no localStorage e só pode ser
  // lida depois da montagem, senão o SSR e o cliente divergem.
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const orgId = workspace?.activeOrganizationId ?? undefined;
  // Papel pela mesma fonte do resto do shell, não pelo `useRole()`: aquele hook
  // deriva do átomo de organização, que na segunda entrada chega vazio e faria
  // os itens owner-only piscarem ausentes antes de aparecer (RNF04).
  const isOwner =
    workspace?.organizations.find((org) => org.id === orgId)?.role === "owner";
  useEffect(() => {
    if (!orgId) return;
    setCollapsed(isSidebarCollapsed(orgId));
    setHydrated(true);
  }, [orgId]);

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (orgId) setSidebarCollapsed(orgId, next);
  };

  // Portão único de entrada do app, decidido **só** pelo `GET /me/workspace`.
  //
  // ⚠️ Não reintroduza `useSession()` aqui. O átomo do client do Better-Auth
  // guarda `{ data: null, isPending: false }` depois de um signOut e devolve
  // isso no primeiro render do painel — antes do refetch, que é agendado num
  // `setTimeout(0)`. Ler dali fazia o segundo login voltar direto para /login.
  // Quem diz que não há sessão é o 401 do servidor, e mais ninguém.
  useEffect(() => {
    if (workspaceLoading) return;
    if (isUnauthorized(workspaceError)) {
      router.replace("/login");
      return;
    }
    if (!workspace) return; // falha de rede — a tela abaixo oferece recarregar
    if (!workspace.activeOrganizationId) {
      // Sem vínculo vivo: aceitar um convite pendente ou criar o primeiro buffet.
      router.replace(resolveEntryRoute(workspace));
    }
  }, [workspaceLoading, workspaceError, workspace, router]);

  const loadBadges = useCallback(async () => {
    if (!orgId) return;
    // Endpoint próprio (duas contagens) em vez do /dashboard/summary: o shell
    // envolve todas as páginas e recarregaria a agregação pesada a cada rota.
    setBadges(await api.get<DashboardBadges>("/dashboard/badges"));
  }, [orgId]);

  // `pathname` na dependência: navegar entre páginas revalida os contadores,
  // que é quando eles podem ter mudado (ex.: acabei de atender um lead).
  useEffect(() => {
    loadBadges().catch(() => setBadges(null));
  }, [loadBadges, pathname]);

  // O Next reseta a rolagem da *janela* ao navegar; como quem rola aqui é o
  // <main>, sem isto a página seguinte abre na altura em que a anterior parou.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  // Seção atual, para o breadcrumb do header e para o realce da navegação.
  const section = NAV.find((item) =>
    isCurrentSection(pathname, item.href)
  )?.label;

  // Falha de rede (não 401): sem isto a tela ficaria em "Carregando..." para
  // sempre, porque não há redirect nenhum em voo para tirar o usuário daqui.
  if (!workspaceLoading && !workspace && !isUnauthorized(workspaceError)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted-foreground">
          {errorMessage(workspaceError, "Não foi possível carregar seu painel.")}
        </p>
        <Button variant="outline" onClick={() => void reloadWorkspace()}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  if (workspaceLoading || !workspace?.activeOrganizationId) {
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
    // App shell a partir de `sm:`: a altura é a da viewport e quem rola é só o
    // <main>, então header e sidebar ficam fixos. No mobile o documento rola
    // normalmente — travar o body ali impede a barra de endereço de recolher e
    // custaria ~105px permanentes de chrome numa tela pequena.
    <div className="flex min-h-dvh flex-col sm:h-dvh sm:overflow-hidden">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:shrink-0 sm:px-6">
        {/* Breadcrumb: buffet ativo (que também troca de buffet) › seção. A
            seção é `aria-hidden` — a navegação lateral já a anuncia com
            `aria-current`, e repetir vira ruído no leitor de tela. */}
        <div className="flex min-w-0 items-center gap-2">
          <OrgSwitcher workspace={workspace} />
          {section && (
            <span
              aria-hidden="true"
              className="hidden min-w-0 items-center gap-2 text-sm text-muted-foreground sm:flex"
            >
              <span className="text-border">/</span>
              <span className="truncate">{section}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {workspace.user.email}
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

      {/* `sm:min-h-0`: sem isso o filho flex adota a altura do conteúdo e o
          `overflow-y-auto` do <main> nunca chega a rolar — empurra o shell. */}
      <div className="flex flex-1 flex-col sm:min-h-0 sm:flex-row">
        {/* O recolhimento vale só a partir de `sm:`: no mobile este mesmo nav é
            a barra horizontal rolável abaixo do header, onde não há o que ganhar. */}
        <nav
          aria-label="Seções do painel"
          className={cn(
            "flex gap-1 overflow-x-auto border-b p-2 sm:flex-col sm:overflow-x-hidden sm:overflow-y-auto sm:border-b-0 sm:border-r",
            collapsed ? "sm:w-14" : "sm:w-52",
            hydrated && "sm:transition-[width]"
          )}
        >
          {NAV.filter((item) => !item.ownerOnly || isOwner).map((item) => {
            const active = isCurrentSection(pathname, item.href);
            const count = item.badge ? (badges?.[item.badge] ?? 0) : 0;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-secondary font-medium text-secondary-foreground"
                    : "text-muted-foreground hover:bg-accent",
                  collapsed && "sm:justify-center sm:gap-0 sm:px-0"
                )}
              >
                <span className="relative shrink-0">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {/* Recolhido não cabe o número: vira um ponto, e a contagem
                      segue anunciada pelo Badge em `sr-only`. */}
                  {count > 0 && collapsed && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1 -top-1 hidden h-2 w-2 rounded-full bg-brand sm:block"
                    />
                  )}
                </span>
                <span className={cn("flex-1", collapsed && "sm:sr-only")}>
                  {item.label}
                </span>
                {count > 0 && (
                  <Badge
                    variant="default"
                    className={cn(
                      "shrink-0 bg-brand text-brand-foreground",
                      collapsed && "sm:sr-only"
                    )}
                  >
                    {count}
                    <span className="sr-only"> aguardando atenção</span>
                  </Badge>
                )}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={toggleSidebar}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            className={cn(
              "mt-auto hidden shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex",
              collapsed && "sm:justify-center sm:gap-0 sm:px-0"
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span className={cn("flex-1 text-left", collapsed && "sm:sr-only")}>
              Recolher
            </span>
          </button>
        </nav>
        {/* min-w-0: permite ao main encolher abaixo do conteúdo, contendo o
            scroll-x de áreas largas (ex.: o kanban) dentro delas em vez de
            empurrar o layout inteiro.
            data-app-scroll: marca o container de rolagem para o `Modal` travar
            a rolagem de fundo aqui — o `overflow: hidden` no body não alcança
            um scroller interno. */}
        <main
          ref={mainRef}
          data-app-scroll
          className="min-w-0 flex-1 p-4 sm:overflow-y-auto sm:p-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
