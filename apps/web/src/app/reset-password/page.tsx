"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";
import { Alert } from "@/components/ui/alert";

const MIN_PASSWORD = 8;

/** `useSearchParams` exige boundary de Suspense no App Router. */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordView />
    </Suspense>
  );
}

function ResetPasswordView() {
  const router = useRouter();
  const params = useSearchParams();
  // A API redireciona para cá com `?token=`; se o token expirou ou já foi
  // usado, ela anexa `?error=INVALID_TOKEN` em vez do token.
  const token = params.get("token");
  const callbackError = params.get("error");

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const linkBroken = !token || callbackError;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmation) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    try {
      const res = await authClient.resetPassword({
        newPassword: password,
        token: token!,
      });
      if (res.error) throw new Error(res.error.message);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao redefinir a senha");
    } finally {
      setLoading(false);
    }
  }

  if (linkBroken) {
    return (
      <AuthShell
        title="Recupere o acesso ao seu buffet."
        subtitle="Peça um novo link para criar sua senha."
      >
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Link inválido ou expirado
        </h1>
        <Alert variant="warning" className="mt-4">
          O link de redefinição vale por 1 hora e só pode ser usado uma vez.
          Peça um novo para continuar.
        </Alert>
        <Button
          variant="brand"
          size="lg"
          className="mt-6 w-full"
          onClick={() => router.push("/forgot-password")}
        >
          Pedir novo link
        </Button>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell
        title="Pronto — sua senha foi atualizada."
        subtitle="Entre com a nova senha para voltar ao painel."
      >
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Senha redefinida
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Você já pode entrar com a nova senha.
        </p>
        <Button
          variant="brand"
          size="lg"
          className="mt-6 w-full"
          onClick={() => router.push("/login")}
        >
          Ir para o login
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Recupere o acesso ao seu buffet."
      subtitle="Escolha uma nova senha para entrar no painel."
    >
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Criar nova senha
        </h1>
        <p className="text-sm text-muted-foreground">
          Use ao menos {MIN_PASSWORD} caracteres.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Nova senha</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmation">Confirmar nova senha</Label>
          <Input
            id="confirmation"
            type="password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            required
          />
        </div>
        <FormError error={error} />
        <Button type="submit" variant="brand" size="lg" disabled={loading}>
          {loading ? "Salvando..." : "Salvar nova senha"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-brand hover:underline">
          Voltar para o login
        </Link>
      </p>
    </AuthShell>
  );
}
