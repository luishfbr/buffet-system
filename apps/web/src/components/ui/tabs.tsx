import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabItem<K extends string> = {
  key: K;
  label: string;
  icon?: LucideIcon;
  count?: number;
};

/**
 * Segmented control (seletor de modo). Controlado por props — sem estado interno.
 * Container em `bg-muted` com a aba ativa em pílula clara (`bg-card`), evitando o
 * padrão de sublinhado com margin negativa que causava scroll/sobreposição.
 */
export function Tabs<K extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Rótulo acessível do grupo (ex.: "Tipo de item"). */
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1 sm:w-auto",
        className
      )}
    >
      {items.map((item) => {
        const active = item.key === value;
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.key)}
            className={cn(
              "flex flex-1 shrink-0 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {Icon && <Icon className="size-4" aria-hidden />}
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  "rounded px-1.5 text-xs tabular-nums",
                  active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
