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
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupView />
    </Suspense>
  );
}

function SignupView() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Cria só a conta (RF00). A organização é criada no onboarding guiado.
      const signup = await authClient.signUp.email({ name, email, password });
      if (signup.error) throw new Error(signup.error.message);
      // Para o painel, não direto para o onboarding: quem se cadastra com um
      // e-mail já convidado tem que cair em /convites, e quem decide isso é o
      // `dashboard/layout` consultando o servidor.
      router.push(next ?? "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no cadastro");
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Do lead público ao contrato assinado, num só painel."
      subtitle="Crie sua conta, monte seu buffet e receba uma página pública própria."
    >
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Criar minha conta
        </h1>
        <p className="text-sm text-muted-foreground">
          Em seguida você monta seu buffet e recebe uma página pública própria.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Seu nome</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        </div>
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
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <FormError error={error} />
        <Button type="submit" variant="brand" size="lg" disabled={loading}>
          {loading ? "Criando..." : "Criar conta"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="text-brand hover:underline"
        >
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}
