import {
  CalendarClock,
  Globe,
  ListChecks,
  MessageSquareText,
  Wallet,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { FeatureCard } from "@/components/marketing/feature-card";
import { HeaderAuth } from "@/components/marketing/header-auth";
import { HeroPipeline } from "@/components/marketing/hero-pipeline";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#recursos", label: "Recursos" },
  { href: "#como-funciona", label: "Como funciona" },
];

// Mapa dor → solução (docs/requirements.md)
const PAINS = [
  {
    pain: "Atendimento espalhado no WhatsApp",
    fix: "Cada conversa vira um lead com histórico centralizado — nada se perde entre um chat e outro.",
  },
  {
    pain: "Orçamento difícil de reencontrar",
    fix: "Lista única com filtro por status: do primeiro contato ao contrato aprovado.",
  },
  {
    pain: "Controle financeiro na planilha",
    fix: "Cronograma de parcelas com vencimento, valor e baixa de pagamento no lugar da planilha manual.",
  },
  {
    pain: "Duas festas na mesma data",
    fix: "Alerta de conflito de agenda ao abrir a negociação, antes de fechar o evento.",
  },
];

// Passos reais do fluxo — sequência, por isso a numeração 01/02/03 (RF00→RF24)
const STEPS = [
  {
    title: "Cadastre seu buffet",
    body: "Crie sua conta e a organização em minutos. Você vira o proprietário, sem intermediário.",
  },
  {
    title: "Monte cardápio e pacotes",
    body: "Pratos, bebidas, serviços e pacotes com preço por convidado — a base dos seus orçamentos.",
  },
  {
    title: "Receba leads e feche",
    body: "Divulgue seu link, receba pré-orçamentos automáticos, avance no funil e controle as parcelas.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:text-brand-foreground"
      >
        Pular para o conteúdo
      </a>
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <nav
          className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6"
          aria-label="Principal"
        >
          <a
            href="/"
            translate="no"
            className="flex items-center gap-2 rounded-sm font-display text-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-sm text-brand-foreground"
              aria-hidden="true"
            >
              B
            </span>
            Buffet System
          </a>
          <div className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {l.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <HeaderAuth />
          </div>
        </nav>
      </header>

      <main id="conteudo" className="flex-1">
        {/* Herói (tokens escuros via .dark) */}
        <section className="dark relative overflow-hidden bg-background text-foreground">
          <div
            className="pointer-events-none absolute -top-40 left-1/2 h-128 w-lg -translate-x-1/2 rounded-full bg-brand/15 blur-[120px]"
            aria-hidden="true"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
            <div className="flex flex-col items-start gap-6">
              <span className="animate-rise-in inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
                Do formulário ao PIX, num só lugar
              </span>
              <h1
                className="animate-rise-in text-balance font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
                style={{ animationDelay: "80ms" }}
              >
                Pare de perder orçamento na{" "}
                <span className="text-brand">bagunça do WhatsApp</span>.
              </h1>
              <p
                className="animate-rise-in max-w-md text-lg text-muted-foreground"
                style={{ animationDelay: "160ms" }}
              >
                O sistema comercial do seu buffet: capte leads pela sua própria
                página, organize o funil de negociações e controle as parcelas —
                do primeiro contato ao pagamento final.
              </p>
              <div
                className="animate-rise-in flex flex-col gap-3 sm:flex-row"
                style={{ animationDelay: "240ms" }}
              >
                <a
                  href="/signup"
                  className={cn(buttonVariants({ variant: "brand", size: "xl" }))}
                >
                  Criar meu buffet
                </a>
                <a
                  href="/login"
                  className={cn(buttonVariants({ variant: "outline", size: "xl" }))}
                >
                  Entrar
                </a>
              </div>
            </div>
            <div className="lg:pl-6">
              <HeroPipeline />
            </div>
          </div>
        </section>

        {/* A dor */}
        <section className="border-b bg-muted/30">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
            <div className="max-w-2xl">
              <h2 className="text-balance font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                O atendimento começa organizado e termina espalhado.
              </h2>
              <p className="mt-3 text-muted-foreground">
                Formulário aqui, conversa ali, valor num rascunho, pagamento numa
                planilha. O Buffet System recoloca tudo em um lugar só.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PAINS.map((p) => (
                <div
                  key={p.pain}
                  className="flex flex-col gap-2 rounded-xl border bg-card p-5"
                >
                  <p className="text-sm font-semibold text-foreground">
                    {p.pain}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {p.fix}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Recursos */}
        <section id="recursos" className="scroll-mt-16">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
            <div className="max-w-2xl">
              <span className="font-mono text-xs uppercase tracking-widest text-brand">
                Recursos
              </span>
              <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                Tudo que o comercial do buffet precisa — nada que ele não use.
              </h2>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* RF17/RF18 */}
              <FeatureCard icon={Globe} title="Sua página de orçamento" featured>
                Cada buffet ganha um link público próprio. O cliente escolhe o
                pacote, informa a data e o número de convidados, e vê a estimativa
                na hora — <span className="font-medium text-foreground">preço por convidado × convidados</span>.
                O lead cai direto no seu funil.
              </FeatureCard>
              {/* RF19/RF20 */}
              <FeatureCard icon={ListChecks} title="Funil de negociações">
                Do lead novo ao contrato aprovado, com histórico de cada interação.
                Toda a equipe enxerga a mesma negociação.
              </FeatureCard>
              {/* RF21 */}
              <FeatureCard icon={CalendarClock} title="Alerta de agenda">
                Ao abrir uma negociação, o sistema avisa se já há eventos naquela
                data — antes de você fechar dois na mesma noite.
              </FeatureCard>
              {/* RF22 */}
              <FeatureCard icon={MessageSquareText} title="Proposta em 1 clique">
                Gera o texto da proposta com nome, pacote, data e valor prontos
                para copiar e colar no WhatsApp.
              </FeatureCard>
              {/* RF23/RF24 */}
              <FeatureCard icon={Wallet} title="Parcelas sob controle">
                Ao aprovar, o cronograma de pagamentos é criado. Dê baixa em cada
                parcela com método (PIX, cartão ou boleto) e comprovante.
              </FeatureCard>
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" className="scroll-mt-16 border-y bg-muted/30">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Do cadastro ao primeiro pagamento em três passos.
            </h2>
            <ol className="mt-10 grid gap-8 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex flex-col gap-3">
                  <span className="font-mono text-2xl font-semibold text-brand">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-display text-lg font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CTA final */}
        <section>
          <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
            <div className="relative overflow-hidden rounded-3xl border border-brand/30 bg-brand/10 px-6 py-14 text-center sm:px-12">
              <div
                className="pointer-events-none absolute -bottom-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand/20 blur-[100px]"
                aria-hidden="true"
              />
              <div className="relative mx-auto flex max-w-xl flex-col items-center gap-5">
                <h2 className="text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                  Comece a organizar seu buffet hoje.
                </h2>
                <p className="text-muted-foreground">
                  Crie sua conta, monte seus pacotes e receba o primeiro
                  pré-orçamento pela sua própria página. Sem intermediário.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <a
                    href="/signup"
                    className={cn(buttonVariants({ variant: "brand", size: "xl" }))}
                  >
                    Criar meu buffet
                  </a>
                  <a
                    href="/login"
                    className={cn(buttonVariants({ variant: "outline", size: "xl" }))}
                  >
                    Já tenho conta
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <span
            translate="no"
            className="flex items-center gap-2 font-display font-semibold text-foreground"
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded bg-brand text-xs text-brand-foreground"
              aria-hidden="true"
            >
              B
            </span>
            Buffet System
          </span>
          <div className="flex items-center gap-6">
            <a href="#recursos" className="transition-colors hover:text-foreground">
              Recursos
            </a>
            <a href="/login" className="transition-colors hover:text-foreground">
              Entrar
            </a>
            <a href="/signup" className="transition-colors hover:text-foreground">
              Criar conta
            </a>
          </div>
          <span>© {new Date().getFullYear()} Buffet System</span>
        </div>
      </footer>
    </div>
  );
}
