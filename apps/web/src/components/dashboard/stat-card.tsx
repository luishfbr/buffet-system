import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Número do painel (RF29). Quando recebe `href` vira um card clicável inteiro —
 * um KPI que não leva a lugar nenhum obriga o usuário a procurar no menu onde
 * agir sobre o que acabou de ler.
 */
export function StatCard({
  label,
  value,
  hint,
  href,
  emphasis = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  emphasis?: boolean;
}) {
  const body = (
    <>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          emphasis && "text-brand"
        )}
      >
        {value}
      </span>
      {hint && <span className="mt-1 text-xs text-muted-foreground">{hint}</span>}
    </>
  );

  const className = cn(
    "flex flex-col rounded-xl border bg-card p-5 text-card-foreground shadow",
    href &&
      "transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}
