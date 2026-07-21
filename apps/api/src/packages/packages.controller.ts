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
  createPackageSchema,
  updatePackageSchema,
  type CreatePackageInput,
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
}
