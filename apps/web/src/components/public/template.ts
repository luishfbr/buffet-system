import type { PublicPageData } from "@buffet/shared";

/** Contrato dos três layouts da página pública (RF26). */
export interface TemplateProps {
  data: PublicPageData;
  /**
   * Renderizado dentro do editor: o formulário de lead não envia nada (RF18
   * continua valendo só na página publicada).
   */
  preview?: boolean;
}
