import { formatBRL } from "@buffet/shared";
import type { Item, Package } from "@/lib/types";
import { appHost, catalogCounts } from "@/lib/onboarding";

// Assinatura do onboarding: uma prévia da página pública que se monta enquanto
// o buffet é configurado — reifica "você já tem uma página pública" (RF17/RF18)
// desde o primeiro passo. Reusa o "browser chrome" do HeroPipeline da landing.

export function PublicPreview({
  orgName,
  slug,
  items,
  packages,
}: {
  orgName: string;
  slug: string;
  items: Item[];
  packages: Package[];
}) {
  const counts = catalogCounts(items, packages);
  const menuParts = [
    counts.dish > 0 && `${counts.dish} pratos`,
    counts.drink > 0 && `${counts.drink} bebidas`,
    counts.service > 0 && `${counts.service} serviços`,
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
        Prévia da sua página
      </span>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-xl shadow-black/5">
        {/* Chrome do navegador — reforça o link público próprio (RF17). */}
        <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          </span>
          <span className="ml-1 truncate font-mono text-xs">
            <span className="text-muted-foreground">{appHost()}/</span>
            <span className="font-semibold text-brand">
              {slug || "seu-buffet"}
            </span>
          </span>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div>
            <p className="font-display text-lg font-semibold tracking-tight">
              {orgName || "Seu buffet"}
            </p>
            <p className="text-sm text-muted-foreground">
              Monte seu orçamento
            </p>
            {menuParts.length > 0 && (
              <p className="mt-1 font-mono text-[0.7rem] text-muted-foreground">
                {menuParts.join(" · ")}
              </p>
            )}
          </div>

          {packages.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {packages.map((pkg) => (
                <li
                  key={pkg.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2"
                >
                  <span className="min-w-0 truncate text-sm font-medium">
                    {pkg.name}
                  </span>
                  <span className="whitespace-nowrap font-mono text-sm font-semibold text-brand">
                    {formatBRL(pkg.pricePerPerson)}
                    <span className="text-[0.7rem] font-normal">/pessoa</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed px-3 py-5 text-center text-xs text-muted-foreground">
              Seus pacotes aparecem aqui conforme você cria.
            </p>
          )}

          {/* Botão ilustrativo do formulário público (RF18). */}
          <span
            className="rounded-md bg-primary/90 px-3 py-2 text-center text-xs font-medium text-primary-foreground opacity-70"
            aria-hidden="true"
          >
            Solicitar orçamento
          </span>
        </div>
      </div>
    </div>
  );
}
