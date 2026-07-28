import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AlertVariant = "info" | "warning" | "destructive" | "success";

/**
 * Aviso estático dentro do fluxo (RNF08). Usa os tokens oklch de `globals.css`
 * — nada de cor Tailwind crua, senão o aviso escapa do tema da marca.
 *
 * `role="alert"` só em `warning`/`destructive`: são os casos em que interromper
 * o leitor de tela se justifica. `info`/`success` ficam silenciosos, porque
 * costumam já estar na tela quando ela é lida.
 */
const variants: Record<
  AlertVariant,
  { box: string; icon: LucideIcon; iconClass: string }
> = {
  info: {
    box: "border-border bg-muted/50 text-foreground",
    icon: Info,
    iconClass: "text-muted-foreground",
  },
  success: {
    box: "border-brand/30 bg-brand/5 text-foreground",
    icon: CheckCircle2,
    iconClass: "text-brand",
  },
  warning: {
    box: "border-brand/40 bg-brand/10 text-foreground",
    icon: AlertTriangle,
    iconClass: "text-brand",
  },
  destructive: {
    box: "border-destructive/40 bg-destructive/10 text-foreground",
    icon: XCircle,
    iconClass: "text-destructive",
  },
};

export function Alert({
  variant = "info",
  title,
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
  title?: string;
}) {
  const { box, icon: Icon, iconClass } = variants[variant];
  const assertive = variant === "warning" || variant === "destructive";

  return (
    <div
      role={assertive ? "alert" : undefined}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4 text-sm",
        box,
        className
      )}
      {...props}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconClass)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && (
          <div className={cn(title && "mt-1", "text-muted-foreground")}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
