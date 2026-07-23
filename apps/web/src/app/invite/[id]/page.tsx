"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient, useSession } from "@/lib/auth-client";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

export default function AcceptInvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAccept() {
    setError(null);
    setLoading(true);
    try {
      const res = await authClient.organization.acceptInvitation({
        invitationId: id,
      });
      if (res.error) throw new Error(res.error.message);
      await authClient.organization.setActive({
        organizationId: res.data!.invitation.organizationId,
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao aceitar convite");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Convite de equipe"
      title="Você foi convidado para uma equipe."
      subtitle="Aceite para gerenciar orçamentos, funil e financeiro junto ao time."
    >
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Convite para equipe
        </h1>
        <p className="text-sm text-muted-foreground">
          Você foi convidado para participar de uma organização.
        </p>
      </div>
      <div className="mt-6 flex flex-col gap-4">
        {isPending ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : session ? (
          <>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button
              onClick={handleAccept}
              variant="brand"
              size="lg"
              disabled={loading}
            >
              {loading ? "Entrando..." : "Aceitar convite"}
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Faça{" "}
            <Link href="/login" className="text-brand hover:underline">
              login
            </Link>{" "}
            ou{" "}
            <Link href="/signup" className="text-brand hover:underline">
              crie uma conta
            </Link>{" "}
            com o e-mail convidado e volte a este link para aceitar.
          </p>
        )}
      </div>
    </AuthShell>
  );
}
