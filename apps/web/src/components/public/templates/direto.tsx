"use client";

import { PAGE_COPY_FALLBACKS } from "@buffet/shared";
import { LeadForm } from "@/components/public/lead-form";
import { ContactFooter } from "@/components/public/contacts";
import type { TemplateProps } from "@/components/public/template";
import { BUDGET_SECTION_ID, usePackageSelection } from "@/lib/use-package-selection";

/**
 * Template "Direto" (RF26) — guiado por conversão. Sem capa de página inteira e
 * sem seção de vitrine: o formulário abre a página e o painel de orçamento ao
 * lado recalcula o total enquanto o cliente digita.
 */
export function DiretoTemplate({ data, preview }: TemplateProps) {
  const { settings, packages, name } = data;
  const { packageId, setPackageId, budgetRef } = usePackageSelection(packages);

  return (
    <main className="bg-background text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-8 sm:py-12">
        {settings.coverUrl && (
          <img
            src={settings.coverUrl}
            alt=""
            decoding="async"
            className="h-28 w-full rounded-xl object-cover sm:h-36"
          />
        )}

        <header className="flex flex-wrap items-center gap-4 border-b pb-6">
          {settings.logoUrl && (
            <img
              src={settings.logoUrl}
              alt={name}
              width={56}
              height={56}
              decoding="async"
              className="size-14 rounded-lg object-cover"
            />
          )}
          <div className="min-w-56 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              {settings.headline ?? name}
            </h1>
            <p className="text-muted-foreground">
              {settings.subheadline ?? PAGE_COPY_FALLBACKS.subheadline}
            </p>
          </div>
        </header>

        <section
          ref={budgetRef}
          id={BUDGET_SECTION_ID}
          tabIndex={-1}
          aria-labelledby="orcamento-titulo"
          className="scroll-mt-6 focus-visible:outline-none"
        >
          <h2 id="orcamento-titulo" className="sr-only">
            {settings.ctaLabel ?? PAGE_COPY_FALLBACKS.ctaLabel}
          </h2>
          <LeadForm
            slug={data.slug}
            orgName={name}
            packages={packages}
            ctaLabel={settings.ctaLabel}
            whatsapp={settings.whatsapp}
            packageId={packageId}
            onPackageChange={setPackageId}
            layout="split"
            preview={preview}
          />
        </section>

        {settings.about && (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {settings.about}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Seus dados serão usados apenas para o atendimento comercial.
        </p>

        <ContactFooter settings={settings} />
      </div>
    </main>
  );
}
