import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { schema, type Database } from "@buffet/db";
import {
  DEFAULT_PAGE_SETTINGS,
  type PublicPageSettings,
  type UpdatePageSettingsInput,
} from "@buffet/shared";
import { DB } from "../database/database.module.js";
import { UploadsService } from "../uploads/uploads.service.js";

/** Personalização da página pública `/{slug}` (RF25–RF27). */
@Injectable()
export class PageSettingsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly uploads: UploadsService
  ) {}

  /**
   * A linha só nasce no primeiro save, então uma organização que nunca
   * personalizou nada recebe os defaults — não um 404.
   */
  async get(orgId: string): Promise<PublicPageSettings> {
    const [row] = await this.db
      .select()
      .from(schema.orgPublicSettings)
      .where(eq(schema.orgPublicSettings.organizationId, orgId))
      .limit(1);
    return row ? toPublicSettings(row) : { ...DEFAULT_PAGE_SETTINGS };
  }

  async update(
    orgId: string,
    input: UpdatePageSettingsInput
  ): Promise<PublicPageSettings> {
    // RNF07: imagens só podem apontar para o prefixo da própria organização.
    if (input.logoUrl) this.uploads.assertOwnedAssetUrl(orgId, input.logoUrl);
    if (input.coverUrl) this.uploads.assertOwnedAssetUrl(orgId, input.coverUrl);

    const values = {
      ...(input.template !== undefined ? { template: input.template } : {}),
      ...(input.theme !== undefined ? { theme: input.theme } : {}),
      ...(input.brandColor !== undefined ? { brandColor: input.brandColor } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
      ...(input.coverUrl !== undefined ? { coverUrl: input.coverUrl } : {}),
      ...(input.headline !== undefined ? { headline: input.headline } : {}),
      ...(input.subheadline !== undefined
        ? { subheadline: input.subheadline }
        : {}),
      ...(input.about !== undefined ? { about: input.about } : {}),
      ...(input.ctaLabel !== undefined ? { ctaLabel: input.ctaLabel } : {}),
      ...(input.showPrices !== undefined ? { showPrices: input.showPrices } : {}),
      ...(input.whatsapp !== undefined ? { whatsapp: input.whatsapp } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.instagram !== undefined ? { instagram: input.instagram } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      updatedAt: new Date(),
    };

    const [row] = await this.db
      .insert(schema.orgPublicSettings)
      .values({ organizationId: orgId, ...values })
      .onConflictDoUpdate({
        target: schema.orgPublicSettings.organizationId,
        set: values,
      })
      .returning();

    return toPublicSettings(row!);
  }
}

/**
 * Linha do banco → contrato público. As colunas de enum são `text` no Postgres
 * (convenção do schema), então o cast acontece na borda; os valores possíveis
 * já foram validados pelo Zod na entrada.
 */
export function toPublicSettings(
  row: typeof schema.orgPublicSettings.$inferSelect
): PublicPageSettings {
  return {
    template: row.template as PublicPageSettings["template"],
    theme: row.theme as PublicPageSettings["theme"],
    brandColor: row.brandColor as PublicPageSettings["brandColor"],
    logoUrl: row.logoUrl,
    coverUrl: row.coverUrl,
    headline: row.headline,
    subheadline: row.subheadline,
    about: row.about,
    ctaLabel: row.ctaLabel,
    showPrices: row.showPrices,
    whatsapp: row.whatsapp,
    phone: row.phone,
    email: row.email,
    instagram: row.instagram,
    city: row.city,
  };
}
