import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { schema, type Database, type Item } from "@buffet/db";
import type {
  CreateItemInput,
  UpdateItemInput,
  ItemType,
} from "@buffet/shared";
import { DB } from "../database/database.module.js";
import { scopedWhere } from "../common/tenant.js";

@Injectable()
export class ItemsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** List items for the org, optionally filtered by type/active (RF01/05/09). */
  async list(
    orgId: string,
    opts: { type?: ItemType; includeInactive?: boolean } = {}
  ): Promise<Item[]> {
    const conditions = [
      opts.type ? eq(schema.items.type, opts.type) : undefined,
      opts.includeInactive ? undefined : eq(schema.items.isActive, true),
    ];
    return this.db
      .select()
      .from(schema.items)
      .where(scopedWhere(schema.items, orgId, ...conditions))
      .orderBy(desc(schema.items.createdAt));
  }

  async create(orgId: string, input: CreateItemInput): Promise<Item> {
    const [row] = await this.db
      .insert(schema.items)
      .values({
        organizationId: orgId,
        name: input.name,
        type: input.type,
        category: input.category ?? null,
        basePrice: input.basePrice,
        isActive: input.isActive ?? true,
      })
      .returning();
    return row!;
  }

  /** Edit / inactivate an item (RF02/03/06/07/10/11). */
  async update(
    orgId: string,
    id: string,
    input: UpdateItemInput
  ): Promise<Item> {
    await this.getOwnedOrThrow(orgId, id);
    const [row] = await this.db
      .update(schema.items)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.basePrice !== undefined
          ? { basePrice: input.basePrice }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      })
      .where(scopedWhere(schema.items, orgId, eq(schema.items.id, id)))
      .returning();
    return row!;
  }

  /**
   * Physical delete (RF04/08/12) — owner-only (enforced at controller).
   * Blocked when the item is used in any package.
   */
  async remove(orgId: string, id: string): Promise<void> {
    await this.getOwnedOrThrow(orgId, id);

    const [dep] = await this.db
      .select({ packageId: schema.packageItems.packageId })
      .from(schema.packageItems)
      .where(eq(schema.packageItems.itemId, id))
      .limit(1);
    if (dep) {
      throw new ConflictException(
        "Item vinculado a um pacote. Inative-o em vez de excluir."
      );
    }

    await this.db
      .delete(schema.items)
      .where(scopedWhere(schema.items, orgId, eq(schema.items.id, id)));
  }

  private async getOwnedOrThrow(orgId: string, id: string): Promise<Item> {
    const [row] = await this.db
      .select()
      .from(schema.items)
      .where(scopedWhere(schema.items, orgId, eq(schema.items.id, id)))
      .limit(1);
    if (!row) throw new NotFoundException("Item não encontrado");
    return row;
  }
}
