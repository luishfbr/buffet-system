"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";

/**
 * Pedido de redefinição de senha (RF33).
 *
 * ⚠️ `redirectTo` é obrigatório: o link do e-mail aponta para a **API**
 * (`/reset-password/:token?callbackURL=...`), que só redireciona para o
 * `callbackURL`. Sem ele o parâmetro vem vazio e o link morre numa tela em
 * branco. O origin precisa estar em `TRUSTED_ORIGINS` — a rota faz originCheck.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (res.error) throw new Error(res.error.message);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar o e-mail");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Recupere o acesso ao seu buffet."
      subtitle="Enviamos um link para você criar uma nova senha."
    >
      {sent ? (
        <div className="flex flex-col gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/10">
            <MailCheck className="h-5 w-5 text-brand" aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Verifique seu e-mail
            </h1>
            {/* Mensagem neutra de propósito: a API não revela se o e-mail
                existe (evita enumeração de usuários) — a UI não pode estragar
                isso confirmando o cadastro. */}
            <p className="mt-2 text-sm text-muted-foreground">
              Se <strong>{email}</strong> estiver cadastrado, enviamos um link
              para criar uma nova senha. Ele vale por 1 hora.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Não chegou? Confira a caixa de spam ou{" "}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="text-brand hover:underline"
            >
              tente com outro e-mail
            </button>
            .
          </p>
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Voltar para o login
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Esqueci minha senha
            </h1>
            <p className="text-sm text-muted-foreground">
              Informe o e-mail da sua conta e enviamos um link de redefinição.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                spellCheck={false}
                required
              />
            </div>
            <FormError error={error} />
            <Button type="submit" variant="brand" size="lg" disabled={loading}>
              {loading ? "Enviando..." : "Enviar link"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Lembrou a senha?{" "}
            <Link href="/login" className="text-brand hover:underline">
              Entrar
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
