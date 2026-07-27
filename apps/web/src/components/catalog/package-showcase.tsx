"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Star } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatBRL } from "@buffet/shared";
import type { Package } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * RF26: ordem e destaque dos pacotes na vitrine pública. Salva na hora — cada
 * ação é uma chamada à API, independente do "Salvar" do editor da página.
 *
 * Botões (e não drag-and-drop) pelo mesmo motivo da galeria de fotos: funcionam
 * no teclado e no celular sem biblioteca nova.
 */
export function PackageShowcase({ onChanged }: { onChanged?: () => void }) {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Só os ativos: são os que a página pública publica.
    const rows = await api.get<Package[]>("/packages");
    setPackages(rows.sort(showcaseOrder));
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await load();
      // A vitrine mudou no servidor — quem embute este painel (o editor da
      // página) precisa recarregar a prévia.
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao salvar a ordem");
    }
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...packages];
    const target = index + direction;
    [next[index], next[target]] = [next[target]!, next[index]!];
    // Atualização otimista: a lista reordena na hora, o servidor confirma depois.
    setPackages(next);
    void run(() => api.patch("/packages/order", { ids: next.map((p) => p.id) }));
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando pacotes...</p>;
  }

  if (packages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum pacote ativo ainda. Crie um no{" "}
        <Link
          href="/dashboard/catalog"
          className="underline underline-offset-4 hover:text-foreground"
        >
          catálogo
        </Link>{" "}
        para ele aparecer aqui.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {packages.map((pkg, index) => (
          <li
            key={pkg.id}
            className="flex items-center gap-3 rounded-md border px-3 py-2"
          >
            <span className="w-5 text-sm tabular-nums text-muted-foreground">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {pkg.name}
            </span>
            <span className="hidden text-sm tabular-nums text-muted-foreground sm:inline">
              {formatBRL(pkg.pricePerPerson)}/pessoa
            </span>

            <button
              type="button"
              aria-pressed={pkg.isFeatured}
              aria-label={
                pkg.isFeatured
                  ? `Tirar ${pkg.name} do destaque`
                  : `Destacar ${pkg.name}`
              }
              title={pkg.isFeatured ? "Tirar do destaque" : "Destacar"}
              onClick={() =>
                void run(() =>
                  api.patch(`/packages/${pkg.id}`, {
                    isFeatured: !pkg.isFeatured,
                  })
                )
              }
              className={cn(
                "rounded p-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                pkg.isFeatured ? "text-brand" : "text-muted-foreground"
              )}
            >
              <Star
                aria-hidden
                className={cn("size-4", pkg.isFeatured && "fill-current")}
              />
            </button>

            <div className="flex">
              <OrderButton
                label={`Mover ${pkg.name} para cima`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ChevronUp aria-hidden className="size-4" />
              </OrderButton>
              <OrderButton
                label={`Mover ${pkg.name} para baixo`}
                disabled={index === packages.length - 1}
                onClick={() => move(index, 1)}
              >
                <ChevronDown aria-hidden className="size-4" />
              </OrderButton>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">
        Os pacotes aparecem na página nesta ordem. O destaque ganha selo e borda
        na cor da marca.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Mesma ordem da vitrine pública: posição definida pelo dono, depois o mais antigo. */
function showcaseOrder(a: Package, b: Package): number {
  return a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt);
}

function OrderButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
