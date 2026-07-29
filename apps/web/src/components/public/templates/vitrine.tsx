"use client";

import { formatBRL, PAGE_COPY_FALLBACKS } from "@buffet/shared";
import { LeadForm } from "@/components/public/lead-form";
import { PackagePhotos } from "@/components/public/package-photos";
import { ContactFooter } from "@/components/public/contacts";
import type { TemplateProps } from "@/components/public/template";
import { BUDGET_SECTION_ID, usePackageSelection } from "@/lib/use-package-selection";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Template "Vitrine" (RF26) — guiado por fotos: capa de página inteira e um card
 * por pacote com a galeria (RF28) em primeiro plano. Para o buffet que tem boas
 * imagens do salão e dos pratos.
 */
export function VitrineTemplate({ data, preview }: TemplateProps) {
  const { settings, packages, name } = data;
  const { packageId, setPackageId, choosePackage, budgetRef } =
    usePackageSelection(packages);
  const ctaLabel = settings.ctaLabel ?? PAGE_COPY_FALLBACKS.ctaLabel;

  return (
    <main className="bg-background text-foreground">
      <header className="relative isolate overflow-hidden">
        {settings.coverUrl ? (
          <>
            <img
              src={settings.coverUrl}
              alt=""
              // Acima da dobra: carrega junto com o resto do herói.
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 size-full object-cover"
            />
            {/* Escurece o pé da capa para o texto se sustentar sobre qualquer foto. */}
            <div className="absolute inset-0 bg-linear-to-t from-background via-background/85 to-background/20" />
          </>
        ) : (
          <div className="absolute inset-0 bg-brand/15" />
        )}

        <div
          className={cn(
            "relative mx-auto flex max-w-4xl flex-col justify-end gap-5 px-5 pb-12 pt-24",
            settings.coverUrl ? "min-h-[78svh]" : "min-h-[45svh]"
          )}
        >
          {settings.logoUrl && (
            <img
              src={settings.logoUrl}
              alt={name}
              width={80}
              height={80}
              decoding="async"
              className="size-16 rounded-full object-cover ring-2 ring-background sm:size-20"
            />
          )}
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-6xl">
            {settings.headline ?? name}
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            {settings.subheadline ?? PAGE_COPY_FALLBACKS.subheadline}
          </p>
          <a
            href={`#${BUDGET_SECTION_ID}`}
            className={cn(buttonVariants({ variant: "brand", size: "lg" }), "self-start")}
          >
            {ctaLabel}
          </a>
        </div>
      </header>

      <div className="mx-auto flex max-w-4xl flex-col gap-14 px-5 py-14">
        {settings.about && (
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {settings.about}
          </p>
        )}

        {packages.length > 0 && (
          <section className="flex flex-col gap-6" aria-labelledby="pacotes">
            <h2
              id="pacotes"
              className="font-display text-2xl font-semibold tracking-tight"
            >
              Pacotes
            </h2>
            <ul className="grid gap-6 sm:grid-cols-2">
              {packages.map((pkg) => (
                <li
                  key={pkg.id}
                  className={cn(
                    "flex flex-col gap-4 rounded-xl border bg-card p-4",
                    pkg.isFeatured && "border-brand ring-1 ring-brand/40"
                  )}
                >
                  <PackagePhotos images={pkg.images} name={pkg.name} />

                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 wrap-break-word font-display text-xl font-semibold tracking-tight">
                      {pkg.name}
                    </h3>
                    {pkg.isFeatured && (
                      <span className="shrink-0 rounded-md bg-brand px-2 py-0.5 text-xs font-medium text-brand-foreground">
                        Destaque
                      </span>
                    )}
                  </div>

                  {pkg.pricePerPerson && (
                    <p className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold tabular-nums text-brand">
                        {formatBRL(pkg.pricePerPerson)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        por convidado
                      </span>
                    </p>
                  )}

                  {pkg.description && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {pkg.description}
                    </p>
                  )}

                  {pkg.includedItems.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                      {pkg.includedItems.slice(0, 6).map((item) => (
                        <li
                          key={item}
                          className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                        >
                          {item}
                        </li>
                      ))}
                      {pkg.includedItems.length > 6 && (
                        <li className="px-1 py-0.5 text-xs text-muted-foreground">
                          +{pkg.includedItems.length - 6} itens
                        </li>
                      )}
                    </ul>
                  )}

                  <Button
                    type="button"
                    variant={pkg.isFeatured ? "brand" : "outline"}
                    className="mt-auto"
                    aria-label={`Escolher o pacote ${pkg.name}`}
                    onClick={() => choosePackage(pkg.id)}
                  >
                    Escolher este pacote
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section
          ref={budgetRef}
          id={BUDGET_SECTION_ID}
          tabIndex={-1}
          aria-labelledby="orcamento-titulo"
          className="flex scroll-mt-6 flex-col gap-4 focus-visible:outline-none"
        >
          <h2
            id="orcamento-titulo"
            className="font-display text-2xl font-semibold tracking-tight"
          >
            {ctaLabel}
          </h2>
          <LeadForm
            slug={data.slug}
            orgName={name}
            packages={packages}
            ctaLabel={settings.ctaLabel}
            whatsapp={settings.whatsapp}
            packageId={packageId}
            onPackageChange={setPackageId}
            preview={preview}
          />
          <p className="text-xs text-muted-foreground">
            Seus dados serão usados apenas para o atendimento comercial.
          </p>
        </section>

        <ContactFooter settings={settings} />
      </div>
    </main>
  );
}
