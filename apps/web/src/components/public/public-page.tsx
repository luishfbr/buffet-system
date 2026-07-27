import { BRAND_PRESETS, type PublicPageData } from "@buffet/shared";
import { VitrineTemplate } from "@/components/public/templates/vitrine";
import { EleganteTemplate } from "@/components/public/templates/elegante";
import { DiretoTemplate } from "@/components/public/templates/direto";
import { cn } from "@/lib/utils";

const TEMPLATES = {
  vitrine: VitrineTemplate,
  elegante: EleganteTemplate,
  direto: DiretoTemplate,
} as const;

/**
 * A página pública inteira a partir do payload da API (RF25–RF28). Recebe os
 * dados prontos — nada de fetch aqui — para servir tanto a rota `/{slug}`
 * quanto qualquer prévia do editor.
 */
export function PublicPage({
  data,
  preview = false,
}: {
  data: PublicPageData;
  /** Modo prévia do editor: renderiza tudo, mas sem captar lead de verdade. */
  preview?: boolean;
}) {
  const { settings } = data;
  const Template = TEMPLATES[settings.template];
  const palette = BRAND_PRESETS[settings.brandColor][settings.theme];

  return (
    // RF25: a marca do buffet entra pelos mesmos tokens do design system —
    // sobrescrever --brand recolore botões, foco e destaques de uma vez.
    <div
      className={cn("min-h-screen bg-background", settings.theme === "dark" && "dark")}
      style={
        {
          "--brand": palette.brand,
          "--brand-foreground": palette.foreground,
          "--ring": palette.brand,
          // Faz o date picker e o select nativos acompanharem o tema da página.
          colorScheme: settings.theme,
        } as React.CSSProperties
      }
    >
      <Template data={data} preview={preview} />
    </div>
  );
}
