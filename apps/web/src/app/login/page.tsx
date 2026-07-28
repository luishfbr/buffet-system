"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { safeNextPath } from "@/lib/workspace";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";

/** Boundary exigido pelo App Router para o `useSearchParams` do `?next=`. */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginView />
    </Suspense>
  );
}

function LoginView() {
  const router = useRouter();
  // `?next=` preserva o destino ao ser mandado para cá — sobretudo o link de
  // convite (`/invite/:id`), que antes se perdia no login.
  const next = safeNextPath(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authClient.signIn.email({ email, password });
      if (res.error) throw new Error(res.error.message);
      // Sempre para o painel: é o `dashboard/layout` que consulta o servidor e
      // decide entre painel, convites e onboarding.
      router.push(next ?? "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no login");
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Do lead público ao contrato assinado, num só painel."
      subtitle="Entre para acompanhar seus orçamentos, negociações e recebimentos."
    >
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Entrar
        </h1>
        <p className="text-sm text-muted-foreground">
          Acesse o painel do seu buffet.
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
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <Label htmlFor="password">Senha</Label>
            {/* RF33: antes desta sprint, quem esquecia a senha ficava sem saída. */}
            <Link
              href="/forgot-password"
              className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <FormError error={error} />
        <Button type="submit" variant="brand" size="lg" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Não tem conta?{" "}
        <Link
          href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
          className="text-brand hover:underline"
        >
          Criar minha conta
        </Link>
      </p>
    </AuthShell>
  );
}
