"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { authClient, useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

const NAV: { href: string; label: string; ownerOnly?: boolean }[] = [
  { href: "/dashboard", label: "Visão geral" },
  { href: "/dashboard/catalog", label: "Catálogo" },
  { href: "/dashboard/leads", label: "Negociações" },
  // Owner-only: members cannot see billing (RNF04).
  { href: "/dashboard/finance", label: "Financeiro", ownerOnly: true },
  { href: "/dashboard/members", label: "Membros" },
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
  const isOwner =
    activeOrg?.members?.find((m) => m.userId === session?.user.id)?.role ===
    "owner";

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      router.replace("/login");
    } else if (!orgPending && !activeOrg) {
      // Sessão sem organização ativa → onboarding guiado (cria a org).
      router.replace("/onboarding");
    }
  }, [isPending, session, orgPending, activeOrg, router]);

  if (isPending || !session || (!orgPending && !activeOrg)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
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
        <nav className="flex gap-1 overflow-x-auto border-b p-2 sm:w-52 sm:flex-col sm:border-b-0 sm:border-r">
          {NAV.filter((item) => !item.ownerOnly || isOwner).map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-secondary font-medium text-secondary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {item.label}
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
