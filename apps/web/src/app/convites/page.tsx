"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail } from "lucide-react";
import { MEMBER_ROLE_LABELS, type WorkspaceInvitation } from "@buffet/shared";
import { authClient, useSession } from "@/lib/auth-client";
import { errorMessage } from "@/lib/api";
import { switchOrganization, useWorkspace } from "@/lib/workspace";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

/**
 * Primeiro acesso de quem foi convidado (RF34). É para onde o portão do painel
 * manda um usuário sem buffet mas com convite esperando — antes ele caía no
 * onboarding e era convidado a criar um buffet que não queria.
 *
 * Aceitar não é o único caminho: um funcionário também pode ter o buffet dele,
 * então a saída para o onboarding fica sempre visível.
 */
export default function InvitationsPage() {
  const router = useRouter();
  const toast = useToast();
  const { data: session, isPending: sessionPending } = useSession();
  const { workspace, loading, reload } = useWorkspace();
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<WorkspaceInvitation | null>(null);

  useEffect(() => {
    if (!sessionPending && !session) router.replace("/login");
  }, [sessionPending, session, router]);

  async function handleAccept(invitation: WorkspaceInvitation) {
    setBusy(invitation.id);
    try {
      const res = await authClient.organization.acceptInvitation({
        invitationId: invitation.id,
      });
      if (res.error) throw new Error(res.error.message);
      // Ativa o buffet e recarrega o painel num documento novo.
      await switchOrganization(invitation.organizationId);
    } catch (err) {
      setBusy(null);
      toast.error(errorMessage(err, "Não foi possível aceitar o convite."));
    }
  }

  async function handleReject() {
    const invitation = rejecting;
    if (!invitation) return;
    setBusy(invitation.id);
    try {
      const res = await authClient.organization.rejectInvitation({
        invitationId: invitation.id,
      });
      if (res.error) throw new Error(res.error.message);
      setRejecting(null);
      toast.success(`Convite de ${invitation.organizationName} recusado.`);
      await reload();
    } catch (err) {
      toast.error(errorMessage(err, "Não foi possível recusar o convite."));
    } finally {
      setBusy(null);
    }
  }

  const invitations = workspace?.invitations ?? [];

  return (
    <AuthShell
      eyebrow="Convite de equipe"
      title="Você foi convidado para uma equipe."
      subtitle="Aceite para gerenciar orçamentos, funil e financeiro junto ao time."
    >
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Seus convites
        </h1>
        <p className="text-sm text-muted-foreground">
          Entre na equipe de um buffet que já existe.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {sessionPending || loading ? (
          <p
            role="status"
            aria-live="polite"
            className="text-sm text-muted-foreground"
          >
            Carregando...
          </p>
        ) : invitations.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="Nenhum convite pendente"
            description="Convites expiram. Peça um novo a quem administra o buffet, ou monte o seu."
            action={{ label: "Criar meu buffet", href: "/onboarding?novo=1" }}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-col gap-3 rounded-lg border p-4"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-display font-semibold">
                    {invitation.organizationName}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {invitation.inviterName
                      ? `Convite de ${invitation.inviterName}`
                      : "Convite de equipe"}{" "}
                    · {MEMBER_ROLE_LABELS[invitation.role]}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="brand"
                    onClick={() => void handleAccept(invitation)}
                    disabled={busy !== null}
                  >
                    {busy === invitation.id ? "Entrando..." : "Aceitar convite"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setRejecting(invitation)}
                    disabled={busy !== null}
                  >
                    Recusar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {invitations.length > 0 && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Prefere montar seu próprio buffet?{" "}
          <Link
            href="/onboarding?novo=1"
            className="text-brand hover:underline"
          >
            Criar meu buffet
          </Link>
        </p>
      )}

      <ConfirmDialog
        open={rejecting !== null}
        title="Recusar convite"
        description={
          rejecting
            ? `O convite de ${rejecting.organizationName} some da sua lista. Para entrar depois, peça um novo.`
            : undefined
        }
        confirmLabel="Recusar convite"
        loading={busy !== null}
        onConfirm={() => void handleReject()}
        onCancel={() => setRejecting(null)}
      />
    </AuthShell>
  );
}
