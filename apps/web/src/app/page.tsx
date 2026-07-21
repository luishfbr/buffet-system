export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
        SaaS MVP
      </span>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Buffet System
      </h1>
      <p className="max-w-md text-muted-foreground">
        Centralize pedidos, organize o funil comercial e controle o faturamento
        do seu buffet — do primeiro lead ao pagamento final.
      </p>
      <div className="flex gap-3">
        <a
          href="/login"
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Entrar
        </a>
        <a
          href="/signup"
          className="rounded-md border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
        >
          Criar organização
        </a>
      </div>
    </main>
  );
}
