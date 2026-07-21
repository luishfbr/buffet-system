"use client";

import { authClient, useSession } from "@/lib/auth-client";
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <Card>
          <CardHeader>
            <CardDescription>URL pública</CardDescription>
            <CardTitle className="truncate text-base">
              /{activeOrg?.slug ?? "..."}
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
