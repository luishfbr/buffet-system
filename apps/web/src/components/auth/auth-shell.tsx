import type { ReactNode } from "react";
import Link from "next/link";
import { HeroPipeline } from "@/components/marketing/hero-pipeline";

// Shell de apresentação das telas de entrada (login, signup, convite). Espelha a
// identidade "painel operacional" da landing: showcase escuro (.dark) + acento âmbar
// à esquerda, formulário no claro quente à direita. O HeroPipeline é a mesma
// assinatura da landing (RF17–RF24), reforçando o parentesco entre as telas.

const PROOFS = [
  "Página pública própria",
  "Estimativa instantânea",
  "Funil + financeiro num painel",
];

function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 font-display font-semibold tracking-tight ${className ?? ""}`}
    >
      <span
        className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-sm text-brand-foreground"
        translate="no"
      >
        B
      </span>
      <span translate="no">Buffet System</span>
    </Link>
  );
}

export function AuthShell({
  children,
  title,
  subtitle,
  eyebrow = "Painel operacional",
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
  eyebrow?: string;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Showcase — só em telas largas; herda o herói escuro da landing via .dark */}
      <aside className="dark relative hidden overflow-hidden bg-background p-10 text-foreground lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div
          className="pointer-events-none absolute -top-40 left-1/2 h-128 w-lg -translate-x-1/2 rounded-full bg-brand/15 blur-[120px]"
          aria-hidden="true"
        />

        <Wordmark className="relative z-10 text-lg" />

        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <span className="font-mono text-xs uppercase tracking-widest text-brand">
              {eyebrow}
            </span>
            <p className="max-w-md text-balance font-display text-3xl font-semibold leading-[1.1] tracking-tight xl:text-4xl">
              {title}
            </p>
            <p className="max-w-md text-muted-foreground">{subtitle}</p>
          </div>
          <div className="max-w-md">
            <HeroPipeline />
          </div>
        </div>

        <ul className="relative z-10 flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-xs text-muted-foreground">
          {PROOFS.map((proof) => (
            <li key={proof} className="flex items-center gap-1.5">
              <span
                className="h-1 w-1 rounded-full bg-brand"
                aria-hidden="true"
              />
              {proof}
            </li>
          ))}
        </ul>
      </aside>

      {/* Coluna do formulário — claro quente, igual ao dashboard/onboarding */}
      <main className="flex flex-col justify-center px-6 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          {/* Marca compacta para quando o showcase não aparece (mobile) */}
          <div className="mb-8 flex flex-col gap-1 lg:hidden">
            <Wordmark />
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
