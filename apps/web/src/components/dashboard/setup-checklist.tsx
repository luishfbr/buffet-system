"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";
import type { DashboardSummary } from "@buffet/shared";
import { catalogPercent } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  href: string;
  cta: string;
}

/**
 * Checklist de configuração pós-onboarding (RF30).
 *
 * O onboarding guiado já media o progresso do catálogo, mas jogava o número
 * fora ao entregar o usuário no painel. Aqui ele volta — e reusa exatamente a
 * mesma função `catalogPercent`, para a regra do percentual ter um dono só.
 *
 * Só aparece enquanto houver pendência: um checklist 100% concluído é ruído.
 */
export function SetupChecklist({
  summary,
  isOwner,
  onDismiss,
}: {
  summary: DashboardSummary;
  isOwner: boolean;
  onDismiss: () => void;
}) {
  const { catalog, pagePublished, membersCount } = summary;

  const items: ChecklistItem[] = [
    {
      key: "dish",
      label: "Cadastrar pratos",
      done: catalog.dish > 0,
      href: "/dashboard/catalog?tab=dish",
      cta: "Cadastrar",
    },
    {
      key: "drink",
      label: "Cadastrar bebidas",
      done: catalog.drink > 0,
      href: "/dashboard/catalog?tab=drink",
      cta: "Cadastrar",
    },
    {
      key: "service",
      label: "Cadastrar serviços (garçom, decoração...)",
      done: catalog.service > 0,
      href: "/dashboard/catalog?tab=service",
      cta: "Cadastrar",
    },
    {
      key: "packages",
      label: "Montar ao menos um pacote",
      done: catalog.packages > 0,
      href: "/dashboard/catalog?tab=packages",
      cta: "Montar",
    },
    // Personalizar a página e adicionar fotos são do editor, que é owner-only.
    ...(isOwner
      ? [
          {
            key: "page",
            label: "Personalizar a página pública",
            done: pagePublished,
            href: "/dashboard/pagina",
            cta: "Personalizar",
          },
          {
            key: "photos",
            label: "Adicionar fotos aos pacotes",
            done: catalog.packagesWithPhotos > 0,
            href: "/dashboard/pagina",
            cta: "Adicionar",
          },
          {
            key: "members",
            label: "Convidar sua equipe",
            done: membersCount > 1,
            href: "/dashboard/members",
            cta: "Convidar",
          },
        ]
      : []),
  ];

  const doneCount = items.filter((i) => i.done).length;
  if (doneCount === items.length) return null;

  const percent = catalogPercent(catalog);

  return (
    <section
      aria-labelledby="checklist-title"
      className="rounded-xl border bg-card p-5 shadow"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="checklist-title" className="font-semibold">
            Termine de configurar seu buffet
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Catálogo {percent}% configurado. Quanto mais completo, melhor a
            página que o cliente vê.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dispensar checklist de configuração"
          className="-m-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4">
        <div
          role="progressbar"
          aria-valuenow={doneCount}
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-label={`${doneCount} de ${items.length} passos concluídos`}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-500"
            style={{ width: `${(doneCount / items.length) * 100}%` }}
          />
        </div>
      </div>

      <ul className="mt-4 flex flex-col divide-y">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                item.done
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-dashed"
              )}
            >
              {item.done && <Check className="h-3 w-3" />}
            </span>
            <span
              className={cn(
                "min-w-0 flex-1 text-sm",
                item.done && "text-muted-foreground line-through"
              )}
            >
              {item.label}
            </span>
            {!item.done && (
              <Link
                href={item.href}
                className="shrink-0 text-sm font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.cta}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
