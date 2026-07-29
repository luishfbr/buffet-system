"use client";

import { formatBRL, PAGE_COPY_FALLBACKS } from "@buffet/shared";
import { LeadForm } from "@/components/public/lead-form";
import { contactLinks } from "@/components/public/contacts";
import type { TemplateProps } from "@/components/public/template";
import { BUDGET_SECTION_ID, usePackageSelection } from "@/lib/use-package-selection";

/** Rótulos do template: caixa alta, entressoletra larga, sem serifa. */
const EYEBROW =
  "font-sans text-[11px] uppercase tracking-[0.3em] text-muted-foreground";

/**
 * Template "Elegante" (RF26) — guiado por tipografia. Os pacotes são
 * compostos como um cardápio impresso: nome à esquerda, linha pontilhada
 * conduzindo o olho e o preço à direita. Serifa (Fraunces) só aqui; foto entra
 * como um detalhe, não como argumento.
 */
export function EleganteTemplate({ data, preview }: TemplateProps) {
  const { settings, packages, name } = data;
  const { packageId, setPackageId, choosePackage, budgetRef } =
    usePackageSelection(packages);
  const links = contactLinks(settings);
  const ctaLabel = settings.ctaLabel ?? PAGE_COPY_FALLBACKS.ctaLabel;

  return (
    <main className="bg-background font-serif text-foreground">
      <div className="mx-auto flex max-w-2xl flex-col gap-16 px-6 py-16 sm:py-24">
        <header className="flex flex-col items-center gap-5 text-center">
          {settings.logoUrl && (
            <img
              src={settings.logoUrl}
              alt={name}
              width={64}
              height={64}
              decoding="async"
              className="size-16 rounded-full object-cover"
            />
          )}
          <p className={EYEBROW}>{settings.city ?? "Buffet"}</p>
          <h1 className="text-4xl leading-[1.1] text-balance sm:text-5xl">
            {settings.headline ?? name}
          </h1>
          <span aria-hidden className="h-px w-16 bg-brand" />
          <p className="max-w-md text-lg italic text-muted-foreground">
            {settings.subheadline ?? PAGE_COPY_FALLBACKS.subheadline}
          </p>
        </header>

        {settings.coverUrl && (
          <img
            src={settings.coverUrl}
            alt=""
            decoding="async"
            className="aspect-3/1 w-full object-cover"
          />
        )}

        {settings.about && (
          <p className="text-center text-lg leading-loose text-muted-foreground">
            {settings.about}
          </p>
        )}

        {packages.length > 0 && (
          <section className="flex flex-col gap-8" aria-labelledby="pacotes">
            <h2 id="pacotes" className={`text-center ${EYEBROW}`}>
              Nossos pacotes
            </h2>
            <ul className="flex flex-col">
              {packages.map((pkg) => (
                <li key={pkg.id} className="border-t py-8 first:border-t-0 first:pt-0">
                  {pkg.isFeatured && (
                    <p className="mb-2 font-sans text-[10px] uppercase tracking-[0.3em] text-brand">
                      Destaque da casa
                    </p>
                  )}

                  {/* A linha pontilhada de cardápio: nome ..... preço */}
                  <div className="flex items-baseline gap-3">
                    <h3 className="min-w-0 wrap-break-word text-2xl">{pkg.name}</h3>
                    <span
                      aria-hidden
                      className="mb-1.5 h-0 flex-1 border-b border-dotted border-muted-foreground/50"
                    />
                    {pkg.pricePerPerson && (
                      <span className="shrink-0 font-sans text-sm tabular-nums">
                        {formatBRL(pkg.pricePerPerson)}
                        <span className="text-muted-foreground">/convidado</span>
                      </span>
                    )}
                  </div>

                  {pkg.description && (
                    <p className="mt-2 italic leading-relaxed text-muted-foreground">
                      {pkg.description}
                    </p>
                  )}

                  {pkg.includedItems.length > 0 && (
                    <p className="mt-3 font-sans text-[11px] uppercase leading-relaxed tracking-[0.18em] text-muted-foreground">
                      {pkg.includedItems.join(" · ")}
                    </p>
                  )}

                  {pkg.images.length > 0 && (
                    <ul className="mt-4 flex gap-2">
                      {pkg.images.slice(0, 3).map((url, index) => (
                        <li key={url}>
                          <img
                            src={url}
                            alt={`${pkg.name} — foto ${index + 1}`}
                            width={80}
                            height={80}
                            loading="lazy"
                            decoding="async"
                            className="size-20 object-cover"
                          />
                        </li>
                      ))}
                    </ul>
                  )}

                  <button
                    type="button"
                    onClick={() => choosePackage(pkg.id)}
                    aria-label={`Escolher o pacote ${pkg.name}`}
                    className="mt-4 font-sans text-[11px] uppercase tracking-[0.2em] underline underline-offset-4 transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Escolher este pacote
                  </button>
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
          className="scroll-mt-6 border p-6 focus-visible:outline-none sm:p-8"
        >
          <h2 id="orcamento-titulo" className="mb-6 text-center text-2xl">
            {ctaLabel}
          </h2>
          <div className="font-sans">
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
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Seus dados serão usados apenas para o atendimento comercial.
            </p>
          </div>
        </section>

        {links.length > 0 && (
          <footer className="flex flex-wrap justify-center gap-x-6 gap-y-3 border-t pt-8">
            {links.map(({ key, label, href }) =>
              href ? (
                <a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className={`${EYEBROW} transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                >
                  {label}
                </a>
              ) : (
                <span key={key} className={EYEBROW}>
                  {label}
                </span>
              )
            )}
          </footer>
        )}
      </div>
    </main>
  );
}
