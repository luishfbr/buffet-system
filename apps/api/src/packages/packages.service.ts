import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { asc, desc, eq, inArray } from "drizzle-orm";
import {
  schema,
  type Database,
  type Package,
  type PackageImage,
} from "@buffet/db";
import {
  MAX_PACKAGE_IMAGES,
  type CreatePackageInput,
  type UpdatePackageInput,
} from "@buffet/shared";
import { DB } from "../database/database.module.js";
import { scopedWhere } from "../common/tenant.js";
import { UploadsService } from "../uploads/uploads.service.js";

/**
 * RF26/RNF05: a nova ordem só vale se não repetir ids e se **todos** eles
 * tiverem sido encontrados dentro da organização — um id de outro tenant some
 * na query escopada e derruba a contagem.
 */
export function isValidOrder(ids: string[], ownedCount: number): boolean {
  return new Set(ids).size === ids.length && ownedCount === ids.length;
}

@Injectable()
export class PackagesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly uploads: UploadsService
  ) {}

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

  /** A package with the ids of its composing items and its gallery (RF28). */
  async getWithItems(orgId: string, id: string) {
    const pkg = await this.getOwnedOrThrow(orgId, id);
    const [rows, images] = await Promise.all([
      this.db
        .select({ itemId: schema.packageItems.itemId })
        .from(schema.packageItems)
        .where(eq(schema.packageItems.packageId, id)),
      this.listImages(id),
    ]);
    return { ...pkg, itemIds: rows.map((r) => r.itemId), images };
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
          sortOrder: input.sortOrder ?? 0,
          isFeatured: input.isFeatured ?? false,
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
          ...(input.sortOrder !== undefined
            ? { sortOrder: input.sortOrder }
            : {}),
          ...(input.isFeatured !== undefined
            ? { isFeatured: input.isFeatured }
            : {}),
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

  /**
   * RF26: a ordem dos pacotes na vitrine pública é do proprietário. Recebe os
   * ids na sequência desejada e grava a posição de cada um — mesma mecânica da
   * galeria de fotos, aplicada aos pacotes ativos.
   */
  async reorder(orgId: string, ids: string[]): Promise<Package[]> {
    const owned = await this.db
      .select({ id: schema.packages.id })
      .from(schema.packages)
      .where(scopedWhere(schema.packages, orgId, inArray(schema.packages.id, ids)));

    if (!isValidOrder(ids, owned.length)) {
      throw new BadRequestException("Ordem inválida");
    }

    await this.db.transaction(async (tx) => {
      for (const [index, id] of ids.entries()) {
        await tx
          .update(schema.packages)
          .set({ sortOrder: index })
          .where(scopedWhere(schema.packages, orgId, eq(schema.packages.id, id)));
      }
    });
    return this.list(orgId, true);
  }

  // ==========================================
  // Galeria de fotos do pacote (RF28)
  // ==========================================

  /**
   * `package_images` não tem organizationId — o isolamento vem de resolver o
   * pacote pai com `getOwnedOrThrow` antes de qualquer operação (RNF05).
   */
  async addImage(
    orgId: string,
    packageId: string,
    url: string
  ): Promise<PackageImage> {
    await this.getOwnedOrThrow(orgId, packageId);
    // RNF07: a imagem tem que estar no bucket, no prefixo desta organização.
    this.uploads.assertOwnedAssetUrl(orgId, url);

    const existing = await this.listImages(packageId);
    if (existing.length >= MAX_PACKAGE_IMAGES) {
      throw new ConflictException(
        `Máximo de ${MAX_PACKAGE_IMAGES} fotos por pacote. Remova uma para adicionar outra.`
      );
    }

    const [row] = await this.db
      .insert(schema.packageImages)
      .values({
        packageId,
        url,
        // Entra no fim da fila; a de sortOrder 0 é a capa.
        sortOrder: existing.length,
      })
      .returning();
    return row!;
  }

  async removeImage(
    orgId: string,
    packageId: string,
    imageId: string
  ): Promise<void> {
    await this.getOwnedOrThrow(orgId, packageId);
    const [image] = await this.db
      .select()
      .from(schema.packageImages)
      .where(eq(schema.packageImages.id, imageId))
      .limit(1);
    if (!image || image.packageId !== packageId) {
      throw new NotFoundException("Foto não encontrada");
    }

    await this.db
      .delete(schema.packageImages)
      .where(eq(schema.packageImages.id, imageId));

    // O objeto órfão no bucket não quebra nada, mas ocupa espaço à toa.
    await this.uploads.remove(orgId, image.url).catch(() => undefined);
  }

  /** Reordena a galeria; a primeira da lista vira a capa do pacote. */
  async reorderImages(
    orgId: string,
    packageId: string,
    ids: string[]
  ): Promise<PackageImage[]> {
    await this.getOwnedOrThrow(orgId, packageId);
    const current = await this.listImages(packageId);
    const currentIds = new Set(current.map((i) => i.id));
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length || ids.some((id) => !currentIds.has(id))) {
      throw new BadRequestException("Ordem inválida");
    }
    if (ids.length !== current.length) {
      throw new BadRequestException("Informe todas as fotos na nova ordem");
    }

    await this.db.transaction(async (tx) => {
      for (const [index, id] of ids.entries()) {
        await tx
          .update(schema.packageImages)
          .set({ sortOrder: index })
          .where(eq(schema.packageImages.id, id));
      }
    });
    return this.listImages(packageId);
  }

  private async listImages(packageId: string): Promise<PackageImage[]> {
    return this.db
      .select()
      .from(schema.packageImages)
      .where(eq(schema.packageImages.packageId, packageId))
      .orderBy(asc(schema.packageImages.sortOrder));
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
