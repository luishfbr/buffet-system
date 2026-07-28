"use client";

import { use, useState } from "react";
import Link from "next/link";
import { authClient, useSession } from "@/lib/auth-client";
import { switchOrganization } from "@/lib/workspace";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

export default function AcceptInvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session, isPending } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const next = encodeURIComponent(`/invite/${id}`);

  async function handleAccept() {
    setError(null);
    setLoading(true);
    try {
      const res = await authClient.organization.acceptInvitation({
        invitationId: id,
      });
      if (res.error) throw new Error(res.error.message);
      // Ativa o buffet, memoriza a escolha e recarrega o painel inteiro nele.
      await switchOrganization(res.data!.invitation.organizationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao aceitar convite");
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
          <p
            role="status"
            aria-live="polite"
            className="text-sm text-muted-foreground"
          >
            Carregando...
          </p>
        ) : session ? (
          <>
            <FormError error={error} />
            <Button
              onClick={handleAccept}
              variant="brand"
              size="lg"
              disabled={loading}
            >
              {loading ? "Entrando..." : "Aceitar convite"}
            </Button>
            {/* Link expirado ou já aceito não tem saída nesta tela — a lista
                mostra o que ainda vale para este e-mail. */}
            {error && (
              <p className="text-sm text-muted-foreground">
                <Link href="/convites" className="text-brand hover:underline">
                  Ver meus convites
                </Link>
              </p>
            )}
          </>
        ) : (
          // `?next=` traz a pessoa de volta a este convite depois de entrar —
          // sem ele, o link do e-mail se perdia no login.
          <p className="text-sm text-muted-foreground">
            Faça{" "}
            <Link
              href={`/login?next=${next}`}
              className="text-brand hover:underline"
            >
              login
            </Link>{" "}
            ou{" "}
            <Link
              href={`/signup?next=${next}`}
              className="text-brand hover:underline"
            >
              crie uma conta
            </Link>{" "}
            com o e-mail convidado para aceitar.
          </p>
        )}
      </div>
    </AuthShell>
  );
}
