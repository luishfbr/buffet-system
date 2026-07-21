import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { desc, eq, inArray } from "drizzle-orm";
import { schema, type Database, type Package } from "@buffet/db";
import type { CreatePackageInput, UpdatePackageInput } from "@buffet/shared";
import { DB } from "../database/database.module.js";
import { scopedWhere } from "../common/tenant.js";

@Injectable()
export class PackagesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async list(orgId: string, includeInactive = false): Promise<Package[]> {
    return this.db
      .select()
      .from(schema.packages)
      .where(
        scopedWhere(
          schema.packages,
          orgId,
          includeInactive ? undefined : eq(schema.packages.isActive, true)
        )
      )
      .orderBy(desc(schema.packages.createdAt));
  }

  /** A package with the ids of its composing items. */
  async getWithItems(orgId: string, id: string) {
    const pkg = await this.getOwnedOrThrow(orgId, id);
    const rows = await this.db
      .select({ itemId: schema.packageItems.itemId })
      .from(schema.packageItems)
      .where(eq(schema.packageItems.packageId, id));
    return { ...pkg, itemIds: rows.map((r) => r.itemId) };
  }

  async create(orgId: string, input: CreatePackageInput): Promise<Package> {
    await this.assertItemsBelongToOrg(orgId, input.itemIds);
    return this.db.transaction(async (tx) => {
      const [pkg] = await tx
        .insert(schema.packages)
        .values({
          organizationId: orgId,
          name: input.name,
          description: input.description ?? null,
          pricePerPerson: input.pricePerPerson,
          isActive: input.isActive ?? true,
        })
        .returning();
      if (input.itemIds.length > 0) {
        await tx
          .insert(schema.packageItems)
          .values(input.itemIds.map((itemId) => ({ packageId: pkg!.id, itemId })));
      }
      return pkg!;
    });
  }

  /** Edit / inactivate a package; replace composition if itemIds is provided. */
  async update(
    orgId: string,
    id: string,
    input: UpdatePackageInput
  ): Promise<Package> {
    await this.getOwnedOrThrow(orgId, id);
    if (input.itemIds) await this.assertItemsBelongToOrg(orgId, input.itemIds);

    return this.db.transaction(async (tx) => {
      const [pkg] = await tx
        .update(schema.packages)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.pricePerPerson !== undefined
            ? { pricePerPerson: input.pricePerPerson }
            : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        })
        .where(scopedWhere(schema.packages, orgId, eq(schema.packages.id, id)))
        .returning();

      if (input.itemIds) {
        await tx
          .delete(schema.packageItems)
          .where(eq(schema.packageItems.packageId, id));
        if (input.itemIds.length > 0) {
          await tx
            .insert(schema.packageItems)
            .values(input.itemIds.map((itemId) => ({ packageId: id, itemId })));
        }
      }
      return pkg!;
    });
  }

  /** Physical delete (RF16) — owner-only; blocked if used by any lead/budget. */
  async remove(orgId: string, id: string): Promise<void> {
    await this.getOwnedOrThrow(orgId, id);
    const [dep] = await this.db
      .select({ id: schema.leadsBudgets.id })
      .from(schema.leadsBudgets)
      .where(scopedWhere(schema.leadsBudgets, orgId, eq(schema.leadsBudgets.packageId, id)))
      .limit(1);
    if (dep) {
      throw new ConflictException(
        "Pacote usado em negociações. Inative-o em vez de excluir."
      );
    }
    await this.db
      .delete(schema.packages)
      .where(scopedWhere(schema.packages, orgId, eq(schema.packages.id, id)));
  }

  private async getOwnedOrThrow(orgId: string, id: string): Promise<Package> {
    const [row] = await this.db
      .select()
      .from(schema.packages)
      .where(scopedWhere(schema.packages, orgId, eq(schema.packages.id, id)))
      .limit(1);
    if (!row) throw new NotFoundException("Pacote não encontrado");
    return row;
  }

  /** Guard against cross-tenant item references (RNF05). */
  private async assertItemsBelongToOrg(
    orgId: string,
    itemIds: string[]
  ): Promise<void> {
    if (itemIds.length === 0) return;
    const rows = await this.db
      .select({ id: schema.items.id })
      .from(schema.items)
      .where(scopedWhere(schema.items, orgId, inArray(schema.items.id, itemIds)));
    if (rows.length !== new Set(itemIds).size) {
      throw new BadRequestException("Um ou mais itens são inválidos");
    }
  }
}
