"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Convite para equipe</CardTitle>
          <CardDescription>
            Você foi convidado para participar de uma organização.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isPending ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : session ? (
            <>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button onClick={handleAccept} disabled={loading}>
                {loading ? "Entrando..." : "Aceitar convite"}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Faça{" "}
              <Link href="/login" className="text-primary hover:underline">
                login
              </Link>{" "}
              ou{" "}
              <Link href="/signup" className="text-primary hover:underline">
                crie uma conta
              </Link>{" "}
              com o e-mail convidado e volte a este link para aceitar.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
