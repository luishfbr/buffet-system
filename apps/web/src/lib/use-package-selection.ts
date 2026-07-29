"use client";

import { useCallback, useRef, useState } from "react";
import type { PublicPagePackage } from "@buffet/shared";

/** Âncora da seção do formulário — os três templates usam o mesmo id (RF26). */
export const BUDGET_SECTION_ID = "orcamento";

/**
 * Pacote escolhido na página pública. Fica fora do formulário porque quem
 * escolhe é a vitrine: o cliente clica no card do pacote e o formulário abaixo
 * já vem preenchido com ele.
 *
 * `budgetRef` vai na seção do formulário: a rolagem sai de uma referência, e não
 * de `document.getElementById`, porque na prévia do editor a página é renderizada
 * dentro de um iframe — o `document` ali é outro.
 */
export function usePackageSelection(packages: PublicPagePackage[]) {
  const [packageId, setPackageId] = useState(packages[0]?.id ?? "");
  const budgetRef = useRef<HTMLElement>(null);

  const choosePackage = useCallback((id: string) => {
    setPackageId(id);
    const section = budgetRef.current;
    if (!section) return;
    // Leva o teclado junto com a rolagem — quem navega por Tab continua de onde parou.
    section.focus({ preventScroll: true });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    section.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, []);

  return { packageId, setPackageId, choosePackage, budgetRef };
}
