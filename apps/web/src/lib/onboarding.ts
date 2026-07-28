import type { Item, Package } from "./types";

/**
 * Estado e URLs do onboarding guiado de primeira-vez (RF00–RF18).
 *
 * A conclusão é persistida em `localStorage` por organização — é o único cliente
 * que fez o cadastro, então basta para não reexibir o fluxo. Como reforço
 * cross-device, o gate também trata "org já tem ≥1 pacote" como configurada.
 */

const onboardedKey = (orgId: string) => `buffet:onboarded:${orgId}`;
const checklistDismissedKey = (orgId: string) =>
  `buffet:checklist-dismissed:${orgId}`;

/**
 * O checklist de configuração da home (RF30) pode ser dispensado — quem não
 * quer preencher tudo não deve carregar o lembrete para sempre. Mesmo idioma
 * de chave do `buffet:onboarded:{orgId}`.
 */
export function isChecklistDismissed(orgId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(checklistDismissedKey(orgId)) !== null;
  } catch {
    return false;
  }
}

export function dismissChecklist(orgId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(checklistDismissedKey(orgId), new Date().toISOString());
  } catch {
    // localStorage indisponível — o checklist reaparece, sem quebrar nada.
  }
}

export function isOnboardedLocally(orgId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(onboardedKey(orgId)) !== null;
  } catch {
    return false;
  }
}

export function markOnboardedLocally(orgId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(onboardedKey(orgId), new Date().toISOString());
  } catch {
    // localStorage indisponível (modo privado) — o gate por "já tem pacote" cobre o caso.
  }
}

/** Base do app para montar o link público /{slug} (RF17). */
export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "")
  );
}

/** URL pública completa da organização (para copiar/abrir). */
export function publicUrl(slug: string): string {
  return `${appBaseUrl().replace(/\/$/, "")}/${slug}`;
}

/** Host do app sem protocolo — para o "chrome" do preview (ex.: `buffetsystem.com`). */
export function appHost(): string {
  return appBaseUrl()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

export interface CatalogCounts {
  dish: number;
  drink: number;
  service: number;
  packages: number;
}

export function catalogCounts(
  items: Item[],
  packages: Package[],
): CatalogCounts {
  return {
    dish: items.filter((i) => i.type === "dish").length,
    drink: items.filter((i) => i.type === "drink").length,
    service: items.filter((i) => i.type === "service").length,
    packages: packages.length,
  };
}

/** % de configuração: categorias do catálogo com ≥1 registro ÷ 4 (RF01–RF16). */
export function catalogPercent(counts: CatalogCounts): number {
  const populated = [
    counts.dish,
    counts.drink,
    counts.service,
    counts.packages,
  ].filter((n) => n > 0).length;
  return Math.round((populated / 4) * 100);
}
