import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  addPackageImageSchema,
  createPackageSchema,
  reorderPackageImagesSchema,
  reorderPackagesSchema,
  updatePackageSchema,
  type AddPackageImageInput,
  type CreatePackageInput,
  type ReorderPackageImagesInput,
  type ReorderPackagesInput,
  type UpdatePackageInput,
} from "@buffet/shared";
import { ActiveOrg } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/auth.constants.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PackagesService } from "./packages.service.js";

@Controller("packages")
export class PackagesController {
  constructor(private readonly packages: PackagesService) {}

  @Get()
  list(
    @ActiveOrg() orgId: string,
    @Query("includeInactive") includeInactive?: string
  ) {
    return this.packages.list(orgId, includeInactive === "true");
  }

  @Get(":id")
  getOne(@ActiveOrg() orgId: string, @Param("id") id: string) {
    return this.packages.getWithItems(orgId, id);
  }

  // RF26: declarado antes de `:id` — senão "order" cairia na rota de update.
  @Roles("owner")
  @Patch("order")
  reorder(
    @ActiveOrg() orgId: string,
    @Body(new ZodValidationPipe(reorderPackagesSchema))
    body: ReorderPackagesInput
  ) {
    return this.packages.reorder(orgId, body.ids);
  }

  @Post()
  create(
    @ActiveOrg() orgId: string,
    @Body(new ZodValidationPipe(createPackageSchema)) body: CreatePackageInput
  ) {
    return this.packages.create(orgId, body);
  }

  @Patch(":id")
  update(
    @ActiveOrg() orgId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updatePackageSchema)) body: UpdatePackageInput
  ) {
    return this.packages.update(orgId, id, body);
  }

  // RF16: physical delete restricted to owners.
  @Roles("owner")
  @Delete(":id")
  @HttpCode(204)
  async remove(@ActiveOrg() orgId: string, @Param("id") id: string) {
    await this.packages.remove(orgId, id);
  }

  // --- Galeria de fotos (RF28) — owner-only, é conteúdo da página pública ---

  @Roles("owner")
  @Post(":id/images")
  addImage(
    @ActiveOrg() orgId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(addPackageImageSchema))
    body: AddPackageImageInput
  ) {
    return this.packages.addImage(orgId, id, body.url);
  }

  @Roles("owner")
  @Patch(":id/images/order")
  reorderImages(
    @ActiveOrg() orgId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(reorderPackageImagesSchema))
    body: ReorderPackageImagesInput
  ) {
    return this.packages.reorderImages(orgId, id, body.ids);
  }

  @Roles("owner")
  @Delete(":id/images/:imageId")
  @HttpCode(204)
  async removeImage(
    @ActiveOrg() orgId: string,
    @Param("id") id: string,
    @Param("imageId") imageId: string
  ) {
    await this.packages.removeImage(orgId, id, imageId);
  }
}
