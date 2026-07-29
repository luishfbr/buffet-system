import { cn } from "@/lib/utils";

/**
 * Placeholder de carregamento (RNF08). Substitui o `<p>Carregando...</p>` nas
 * telas do painel: o esqueleto tem o formato do conteúdo que vai chegar, então
 * o layout não pula quando os dados aparecem.
 *
 * O contêiner é sempre `aria-hidden` + `role="status"` no wrapper — o leitor de
 * tela anuncia "Carregando", não 12 caixas vazias.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

function LoadingRegion({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

export function SkeletonTable({
  rows = 5,
  cols = 4,
  label = "Carregando dados",
}: {
  rows?: number;
  cols?: number;
  label?: string;
}) {
  return (
    <LoadingRegion label={label}>
      <div className="overflow-hidden rounded-lg border">
        <div className="flex gap-4 border-b bg-muted/40 p-3">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 border-b p-3 last:border-b-0">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function SkeletonCards({
  count = 3,
  className,
  label = "Carregando",
}: {
  count?: number;
  className?: string;
  label?: string;
}) {
  return (
    <LoadingRegion label={label}>
      <div className={cn("grid gap-4 sm:grid-cols-3", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-6 shadow">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-32" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

/** Bloco de linhas soltas — para listas simples (parcelas, membros, notas). */
export function SkeletonList({
  rows = 4,
  label = "Carregando",
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <LoadingRegion label={label}>
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
