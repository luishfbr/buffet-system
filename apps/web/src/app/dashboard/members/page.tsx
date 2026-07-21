"use client";

import { useState } from "react";
import { authClient, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function MembersPage() {
  const { data: session } = useSession();
  const { data: activeOrg, refetch } = authClient.useActiveOrganization();
  const role = activeOrg?.members?.find(
    (m) => m.userId === session?.user.id
  )?.role;
  const isOwner = role === "owner";

  const [email, setEmail] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInviteLink(null);
    setLoading(true);
    try {
      const res = await authClient.organization.inviteMember({
        email,
        role: "member",
      });
      if (res.error) throw new Error(res.error.message);
      // No automatic email is sent (out of MVP scope) — surface a copyable link.
      const origin = window.location.origin;
      setInviteLink(`${origin}/invite/${res.data!.id}`);
      setEmail("");
      refetch?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao convidar");
    } finally {
      setLoading(false);
    }
  }

  if (!isOwner) {
    return (
      <p className="text-muted-foreground">
        Apenas o proprietário pode gerenciar membros.
      </p>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Membros</h1>
        <p className="text-muted-foreground">
          Convide funcionários e gere um link de convite para compartilhar.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Convidar funcionário</CardTitle>
          <CardDescription>
            Geramos um link — copie e envie pelo canal de sua preferência.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-mail do funcionário</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="funcionario@email.com"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? "Gerando..." : "Gerar convite"}
            </Button>
          </form>

          {inviteLink && (
            <div className="mt-4 flex flex-col gap-2 rounded-md border bg-muted/40 p-3">
              <p className="text-sm font-medium">Link de convite</p>
              <div className="flex gap-2">
                <Input readOnly value={inviteLink} />
                <Button
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(inviteLink);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? "Copiado!" : "Copiar"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Equipe</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {activeOrg?.members?.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <span>{m.user?.email ?? m.userId}</span>
              <span className="capitalize text-muted-foreground">
                {m.role === "owner" ? "Proprietário" : "Funcionário"}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
