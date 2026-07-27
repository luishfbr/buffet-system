import { Body, Controller, Get, Patch } from "@nestjs/common";
import {
  updatePageSettingsSchema,
  type UpdatePageSettingsInput,
} from "@buffet/shared";
import { ActiveOrg } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/auth.constants.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PublicService } from "../public/public.service.js";
import { PageSettingsService } from "./page-settings.service.js";

// RF25–RF27: personalização da página pública do buffet.
@Controller("page-settings")
export class PageSettingsController {
  constructor(
    private readonly settings: PageSettingsService,
    private readonly publicPage: PublicService
  ) {}

  @Get()
  get(@ActiveOrg() orgId: string) {
    return this.settings.get(orgId);
  }

  /**
   * Payload da página pública da própria organização, para a prévia ao vivo do
   * editor. Owner-only como o resto da edição, e **antes** de qualquer rota com
   * parâmetro para não ser capturada por ela.
   */
  @Roles("owner")
  @Get("preview")
  preview(@ActiveOrg() orgId: string) {
    return this.publicPage.getPreviewData(orgId);
  }

  // RNF04: só o proprietário muda a cara da página pública.
  @Roles("owner")
  @Patch()
  update(
    @ActiveOrg() orgId: string,
    @Body(new ZodValidationPipe(updatePageSettingsSchema))
    body: UpdatePageSettingsInput
  ) {
    return this.settings.update(orgId, body);
  }
}
