"use client";

import { useMemo, useState } from "react";
import { Check, MessageCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import {
  computeBudgetTotal,
  formatBRL,
  PAGE_COPY_FALLBACKS,
  type PublicPagePackage,
} from "@buffet/shared";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { whatsappUrl } from "@/components/public/contacts";
import { cn } from "@/lib/utils";

/**
 * Captação do lead na página pública (RF18). O pacote escolhido é controlado de
 * fora (`usePackageSelection`) porque nos templates Vitrine e Elegante quem
 * escolhe é a vitrine, não o formulário.
 *
 * `layout="split"` é o formato do template Direto: campos à esquerda e um painel
 * de orçamento que recalcula enquanto o cliente digita.
 */
export function LeadForm({
  slug,
  orgName,
  packages,
  ctaLabel,
  whatsapp,
  packageId,
  onPackageChange,
  layout = "stacked",
  preview = false,
}: {
  slug: string;
  orgName: string;
  packages: PublicPagePackage[];
  /** Rótulo do botão definido pelo buffet (RF27). */
  ctaLabel?: string | null;
  /** WhatsApp do buffet (RF27) — vira atalho de contato depois do envio. */
  whatsapp?: string | null;
  packageId: string;
  onPackageChange: (id: string) => void;
  layout?: "stacked" | "split";
  /** Prévia do editor: o dono navega o formulário, mas nada é enviado. */
  preview?: boolean;
}) {
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const selectedPkg = packages.find((p) => p.id === packageId);
  const estimate = useMemo(() => {
    const guests = parseInt(guestCount, 10);
    // Sem preço publicado (RF27) não há estimativa para mostrar.
    if (!selectedPkg?.pricePerPerson || !guests || guests <= 0) return null;
    return computeBudgetTotal(selectedPkg.pricePerPerson, guests);
  }, [selectedPkg, guestCount]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Na prévia o dono está olhando o próprio formulário — não vira lead.
    if (preview) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/public/leads", {
        slug,
        customerName,
        customerEmail: customerEmail || undefined,
        customerPhone,
        eventDate: eventDate
          ? new Date(eventDate + "T00:00:00").toISOString()
          : undefined,
        guestCount: guestCount ? parseInt(guestCount, 10) : undefined,
        packageId: packageId || undefined,
        website,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao enviar");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      // role="status": o formulário some e o leitor de tela precisa saber por quê.
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-brand text-brand-foreground">
          <Check aria-hidden className="size-6" />
        </span>
        <h2 className="text-xl font-semibold">Pedido enviado</h2>
        <p className="text-muted-foreground">
          A equipe do {orgName} entra em contato pelo WhatsApp para fechar os
          detalhes.
        </p>
        {/* Resumo do que foi pedido: fecha o ciclo sem obrigar a lembrar. */}
        <OrderSummary
          pkg={selectedPkg}
          guestCount={guestCount}
          eventDate={eventDate}
          estimate={estimate}
          className="w-full max-w-xs border-t pt-4"
        />
        {whatsapp && (
          <a
            href={whatsappUrl(
              whatsapp,
              `Olá! Acabei de pedir um orçamento pelo site${
                selectedPkg ? ` (pacote ${selectedPkg.name})` : ""
              }. Meu nome é ${customerName}.`
            )}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "brand", size: "lg" }), "mt-2")}
          >
            <MessageCircle aria-hidden className="size-4" />
            Falar no WhatsApp agora
          </a>
        )}
      </div>
    );
  }

  const submitLabel = submitting
    ? "Enviando..."
    : (ctaLabel ?? PAGE_COPY_FALLBACKS.ctaLabel);

  const submitArea = (
    <>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        variant="brand"
        disabled={submitting || preview}
      >
        {submitLabel}
      </Button>
      {preview && (
        <p className="text-xs text-muted-foreground">
          Na prévia o envio fica desligado. Na página publicada, este botão abre
          uma negociação.
        </p>
      )}
    </>
  );

  const fields = (
    <>
      {/* Honeypot — visually hidden, must stay empty (RNF06). */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
        aria-hidden="true"
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Seu nome *</Label>
        <Input
          id="name"
          autoComplete="name"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">WhatsApp *</Label>
        <Input
          id="phone"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(11) 90000-0000"
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="date">Data do evento</Label>
          <Input
            id="date"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="guests">Convidados</Label>
          <Input
            id="guests"
            inputMode="numeric"
            placeholder="120"
            value={guestCount}
            onChange={(e) => setGuestCount(e.target.value)}
          />
        </div>
      </div>

      {packages.length > 0 &&
        (layout === "split" ? (
          <PackageRadios
            packages={packages}
            packageId={packageId}
            onPackageChange={onPackageChange}
          />
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="package">Pacote de interesse</Label>
            <select
              id="package"
              value={packageId}
              onChange={(e) => onPackageChange(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.pricePerPerson
                    ? `${p.name} — ${formatBRL(p.pricePerPerson)}/pessoa`
                    : p.name}
                </option>
              ))}
            </select>
          </div>
        ))}
    </>
  );

  if (layout === "split") {
    return (
      <form
        onSubmit={handleSubmit}
        className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]"
      >
        <div className="flex flex-col gap-4">{fields}</div>

        {/* A assinatura do template Direto: o orçamento acompanha a digitação. */}
        <aside className="flex flex-col gap-4 rounded-xl border bg-card p-5 lg:sticky lg:top-6">
          {selectedPkg?.images[0] && (
            <img
              src={selectedPkg.images[0]}
              alt={`${selectedPkg.name} — foto 1`}
              loading="lazy"
              decoding="async"
              className="aspect-3/2 w-full rounded-lg object-cover"
            />
          )}
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Seu orçamento
          </h3>
          {/* Sem a estimativa: ela tem o seu próprio lugar, logo abaixo. */}
          <OrderSummary
            pkg={selectedPkg}
            guestCount={guestCount}
            eventDate={eventDate}
          />
          <div className="border-t pt-4">
            {estimate ? (
              <>
                <p className="text-xs text-muted-foreground">Estimativa</p>
                <p className="font-display text-3xl font-bold tabular-nums text-brand">
                  {formatBRL(estimate)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {selectedPkg?.pricePerPerson
                  ? "Informe o número de convidados para ver o total."
                  : "O valor vem no contato da equipe."}
              </p>
            )}
          </div>

          {selectedPkg && selectedPkg.includedItems.length > 0 && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Inclui: </span>
              {selectedPkg.includedItems.slice(0, 8).join(", ")}
              {selectedPkg.includedItems.length > 8 &&
                ` e mais ${selectedPkg.includedItems.length - 8} itens`}
            </p>
          )}

          {submitArea}
          <p className="text-xs text-muted-foreground">
            É uma estimativa. O buffet confirma o valor final com você.
          </p>
        </aside>
      </form>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-xl border bg-card p-6"
    >
      {fields}

      {estimate && (
        <div className="rounded-lg bg-secondary p-4 text-center">
          <p className="text-sm text-secondary-foreground/70">
            Estimativa para {guestCount} convidados
          </p>
          <p className="text-2xl font-bold tabular-nums">{formatBRL(estimate)}</p>
        </div>
      )}

      {submitArea}
    </form>
  );
}

/** Escolha do pacote dentro do próprio formulário (template Direto). */
function PackageRadios({
  packages,
  packageId,
  onPackageChange,
}: {
  packages: PublicPagePackage[];
  packageId: string;
  onPackageChange: (id: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">Pacote de interesse</legend>
      <div className="grid gap-2">
        {packages.map((p) => {
          const selected = p.id === packageId;
          return (
            <label
              key={p.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors",
                "focus-within:ring-2 focus-within:ring-ring hover:bg-accent/50",
                selected && "border-brand bg-brand/10"
              )}
            >
              <input
                type="radio"
                name="package"
                value={p.id}
                checked={selected}
                onChange={() => onPackageChange(p.id)}
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border",
                  selected && "border-brand bg-brand"
                )}
              >
                {selected && (
                  <span className="size-1.5 rounded-full bg-brand-foreground" />
                )}
              </span>
              <span className="flex-1 font-medium">{p.name}</span>
              {p.pricePerPerson && (
                <span className="tabular-nums text-muted-foreground">
                  {formatBRL(p.pricePerPerson)}/pessoa
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** O que o cliente escolheu até agora — no painel do Direto e no sucesso. */
function OrderSummary({
  pkg,
  guestCount,
  eventDate,
  estimate,
  className,
}: {
  pkg?: PublicPagePackage;
  guestCount: string;
  eventDate: string;
  estimate?: string | null;
  className?: string;
}) {
  return (
    <dl className={cn("flex flex-col gap-2 text-sm", className)}>
      <SummaryRow label="Pacote" value={pkg?.name ?? "A escolher"} />
      <SummaryRow
        label="Convidados"
        value={guestCount ? `${guestCount} pessoas` : "A definir"}
      />
      <SummaryRow label="Data" value={formatEventDate(eventDate)} />
      {estimate && <SummaryRow label="Estimativa" value={formatBRL(estimate)} />}
    </dl>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

/** A data chega como "YYYY-MM-DD" e é lida em UTC, como no resto do app. */
function formatEventDate(value: string): string {
  if (!value) return "A definir";
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
  });
}
