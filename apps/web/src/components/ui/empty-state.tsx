import * as React from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

export interface EmptyStateAction {
  label: string;
  /** Use `href` para navegar (inclusive entre páginas) ou `onClick` para agir. */
  href?: string;
  onClick?: () => void;
}

function ActionButton({
  action,
  variant,
}: {
  action: EmptyStateAction;
  variant: "brand" | "outline";
}) {
  if (action.href) {
    return (
      <Link href={action.href} className={cn(buttonVariants({ variant }))}>
        {action.label}
      </Link>
    );
  }
  return (
    <Button type="button" variant={variant} onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

/**
 * Estado vazio com saída (RNF08). A regra: um vazio nunca é um beco sem saída —
 * ou explica o que fazer para preenchê-lo, ou oferece o caminho de volta
 * (limpar busca). Distinguir "nunca teve nada" de "o filtro não achou" é
 * responsabilidade de quem chama.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondary,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondary?: EmptyStateAction;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg border border-dashed px-6 py-12 text-center",
        className
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </div>
      )}
      <p className="font-medium">{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {(action || secondary) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action && <ActionButton action={action} variant="brand" />}
          {secondary && <ActionButton action={secondary} variant="outline" />}
        </div>
      )}
    </div>
  );
}
