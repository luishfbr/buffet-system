import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import {
  deleteAssetSchema,
  presignUploadSchema,
  type DeleteAssetInput,
  type PresignUploadInput,
} from "@buffet/shared";
import { ActiveOrg } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/auth.constants.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { UploadsService } from "./uploads.service.js";

// RNF07: só quem administra o buffet sobe imagem para a página pública.
@Roles("owner")
@Controller("uploads")
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /** Devolve a URL pré-assinada para o navegador enviar o arquivo ao bucket. */
  @Post("presign")
  presign(
    @ActiveOrg() orgId: string,
    @Body(new ZodValidationPipe(presignUploadSchema)) body: PresignUploadInput
  ) {
    return this.uploads.presign(orgId, body);
  }

  /**
   * Apaga o objeto do bucket. É POST (e não DELETE) porque a URL vai no corpo —
   * ela é longa demais para caber num path param com segurança.
   */
  @Post("delete")
  @HttpCode(204)
  async remove(
    @ActiveOrg() orgId: string,
    @Body(new ZodValidationPipe(deleteAssetSchema)) body: DeleteAssetInput
  ) {
    await this.uploads.remove(orgId, body.url);
  }
}
