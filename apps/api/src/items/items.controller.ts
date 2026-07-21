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
  createItemSchema,
  updateItemSchema,
  ITEM_TYPES,
  type CreateItemInput,
  type UpdateItemInput,
  type ItemType,
} from "@buffet/shared";
import { ActiveOrg } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/auth.constants.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { ItemsService } from "./items.service.js";

@Controller("items")
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Get()
  list(
    @ActiveOrg() orgId: string,
    @Query("type") type?: string,
    @Query("includeInactive") includeInactive?: string
  ) {
    const parsedType = ITEM_TYPES.includes(type as ItemType)
      ? (type as ItemType)
      : undefined;
    return this.items.list(orgId, {
      type: parsedType,
      includeInactive: includeInactive === "true",
    });
  }

  @Post()
  create(
    @ActiveOrg() orgId: string,
    @Body(new ZodValidationPipe(createItemSchema)) body: CreateItemInput
  ) {
    return this.items.create(orgId, body);
  }

  @Patch(":id")
  update(
    @ActiveOrg() orgId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateItemSchema)) body: UpdateItemInput
  ) {
    return this.items.update(orgId, id, body);
  }

  // RF04/08/12: physical delete restricted to owners.
  @Roles("owner")
  @Delete(":id")
  @HttpCode(204)
  async remove(@ActiveOrg() orgId: string, @Param("id") id: string) {
    await this.items.remove(orgId, id);
  }
}
