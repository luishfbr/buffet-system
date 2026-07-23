import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  /** Marca visualmente o card com maior peso (primeira feature em destaque). */
  featured?: boolean;
}

export function FeatureCard({
  icon: Icon,
  title,
  children,
  featured = false,
}: FeatureCardProps) {
  return (
    <div
      className={cn(
        "group flex flex-col gap-4 rounded-xl border bg-card p-6 transition-colors hover:border-brand/50",
        featured && "sm:col-span-2 lg:col-span-1 lg:row-span-2 lg:justify-between",
      )}
    >
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand/12 text-brand transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
        <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-2">
        <h3 className="font-display text-lg font-semibold tracking-tight">
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {children}
        </p>
      </div>
    </div>
  );
}
