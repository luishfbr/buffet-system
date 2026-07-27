"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * CTA do header da landing: quem já tem sessão vai direto para o painel,
 * visitante anônimo continua vendo Entrar / Criar meu buffet.
 */
export function HeaderAuth() {
  const { data: session, isPending } = useSession();

  // Sessão só é conhecida no cliente — reserva o espaço para não deslocar a nav
  // nem piscar o CTA errado enquanto o Better-Auth resolve.
  if (isPending) {
    return (
      <div
        className="h-8 w-32 animate-pulse rounded-md bg-muted sm:w-44"
        aria-hidden="true"
      />
    );
  }

  if (session) {
    return (
      <Link
        href="/dashboard"
        className={cn(buttonVariants({ variant: "brand", size: "sm" }))}
      >
        Ir para o painel
      </Link>
    );
  }

  return (
    <>
      <Link
        href="/login"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "hidden sm:inline-flex",
        )}
      >
        Entrar
      </Link>
      <Link
        href="/signup"
        className={cn(buttonVariants({ variant: "brand", size: "sm" }))}
      >
        Criar meu buffet
      </Link>
    </>
  );
}
