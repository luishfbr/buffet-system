"use client";

import { useState } from "react";
import { MEMBER_ROLE_LABELS, type MemberRole } from "@buffet/shared";
import { authClient } from "@/lib/auth-client";
import { useActiveOrg } from "@/lib/use-active-org";
import { useRole } from "@/lib/use-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";
import { EmptyState } from "@/components/ui/empty-state";
import { Lock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function MembersPage() {
  const { data: activeOrg, refetch } = useActiveOrg();
  const { isOwner } = useRole();

  const [email, setEmail] = useState("");
  const [invited, setInvited] = useState<{
    email: string;
    link: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInvited(null);
    setLoading(true);
    try {
      const res = await authClient.organization.inviteMember({
        email,
        role: "member",
      });
      if (res.error) throw new Error(res.error.message);
      // RF34: a API já enviou o convite por e-mail. O link copiável continua
      // como alternativa — cobre o driver console em dev e a falha de entrega.
      setInvited({
        email,
        link: `${window.location.origin}/invite/${res.data!.id}`,
      });
      setEmail("");
      refetch?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao convidar");
    } finally {
      setLoading(false);
    }
  }

  // RNF04: só o proprietário administra a equipe.
  if (!isOwner) {
    return (
      <EmptyState
        icon={Lock}
        title="Apenas o proprietário gerencia a equipe"
        description="Peça a quem criou o buffet para convidar novos funcionários."
        action={{ label: "Voltar à visão geral", href: "/dashboard" }}
      />
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
            Enviamos o convite por e-mail. Se preferir, você também pode copiar
            o link e mandar pelo canal que quiser.
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
            <FormError error={error} />
            <Button type="submit" disabled={loading}>
              {loading ? "Enviando..." : "Enviar convite"}
            </Button>
          </form>

          {invited && (
            <div className="mt-4 flex flex-col gap-2 rounded-md border bg-muted/40 p-3">
              <p className="text-sm font-medium">
                Convite enviado para {invited.email}
              </p>
              <p className="text-sm text-muted-foreground">
                Se preferir, copie o link e mande você mesmo:
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={invited.link}
                  aria-label="Link do convite"
                />
                <Button
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(invited.link);
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
              <span className="text-muted-foreground">
                {MEMBER_ROLE_LABELS[m.role as MemberRole] ?? m.role}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
