"use client";

import { useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { computeBudgetTotal, formatBRL } from "@buffet/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PublicPackage {
  id: string;
  name: string;
  description: string | null;
  pricePerPerson: string;
}

export function LeadForm({
  slug,
  orgName,
  packages,
}: {
  slug: string;
  orgName: string;
  packages: PublicPackage[];
}) {
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [packageId, setPackageId] = useState(packages[0]?.id ?? "");
  const [website, setWebsite] = useState(""); // honeypot
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const selectedPkg = packages.find((p) => p.id === packageId);
  const estimate = useMemo(() => {
    const guests = parseInt(guestCount, 10);
    if (!selectedPkg || !guests || guests <= 0) return null;
    return computeBudgetTotal(selectedPkg.pricePerPerson, guests);
  }, [selectedPkg, guestCount]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center">
        <div className="text-4xl">🎉</div>
        <h2 className="text-xl font-semibold">Pedido enviado!</h2>
        <p className="text-muted-foreground">
          Recebemos sua solicitação. A equipe do {orgName} entrará em contato
          pelo WhatsApp em breve.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-xl border bg-card p-6"
    >
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

      {packages.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="package">Pacote de interesse</Label>
          <select
            id="package"
            value={packageId}
            onChange={(e) => setPackageId(e.target.value)}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatBRL(p.pricePerPerson)}/pessoa
              </option>
            ))}
          </select>
        </div>
      )}

      {estimate && (
        <div className="rounded-lg bg-secondary p-4 text-center">
          <p className="text-sm text-secondary-foreground/70">
            Estimativa para {guestCount} convidados
          </p>
          <p className="text-2xl font-bold">{formatBRL(estimate)}</p>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" disabled={submitting}>
        {submitting ? "Enviando..." : "Solicitar orçamento"}
      </Button>
    </form>
  );
}
