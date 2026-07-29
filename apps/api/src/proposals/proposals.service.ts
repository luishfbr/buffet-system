import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { asc, eq, inArray } from "drizzle-orm";
import { schema, type Database } from "@buffet/db";
import {
  PricingError,
  applyAdjustments,
  computeLinePrice,
  computeProposalTotals,
  isTerminalLeadStatus,
  sumMoney,
  type LeadStatus,
  type ProposalAdjustmentView,
  type ProposalLineView,
  type ProposalView,
  type PutProposalInput,
  type PricingType,
} from "@buffet/shared";
import { DB } from "../database/database.module.js";
import { scopedWhere } from "../common/tenant.js";

/**
 * Compositor da proposta (RF-V2-09 / RF-V2-10): pacote base + serviços avulsos
 * com quantidade + descontos e taxas.
 *
 * O rascunho vive em `budget_line_items` / `budget_adjustments`; congelar em
 * snapshot é da próxima sprint (RF-V2-05). Aqui o total é sempre **recalculado
 * do catálogo atual** — é justamente essa volatilidade que a v2 vai resolver ao
 * enviar a proposta.
 */
@Injectable()
export class ProposalsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async get(orgId: string, leadId: string): Promise<ProposalView> {
    const lead = await this.getLeadOwnedOrThrow(orgId, leadId);

    const [lines, adjustments] = await Promise.all([
      this.db
        .select()
        .from(schema.budgetLineItems)
        .where(eq(schema.budgetLineItems.budgetId, leadId))
        .orderBy(asc(schema.budgetLineItems.sortOrder)),
      this.db
        .select()
        .from(schema.budgetAdjustments)
        .where(eq(schema.budgetAdjustments.budgetId, leadId))
        .orderBy(asc(schema.budgetAdjustments.sortOrder)),
    ]);

    const catalog = await this.loadCatalog(orgId, lines);

    return this.price(
      lines.map((line) => {
        const source = line.packageId
          ? catalog.packages.get(line.packageId)
          : catalog.items.get(line.itemId!);
        return {
          id: line.id,
          packageId: line.packageId,
          itemId: line.itemId,
          quantity: line.quantity,
          ...(source ?? MISSING_SOURCE),
        };
      }),
      adjustments.map((a) => ({
        id: a.id,
        kind: a.kind as "desconto" | "taxa",
        mode: a.mode as "fixo" | "percentual",
        value: a.value,
        label: a.label,
      })),
      lead.guestCount,
      !isTerminalLeadStatus(lead.status as LeadStatus)
    );
  }

  /**
   * Substitui a composição inteira (RF-V2-09). Escrita em bloco, numa
   * transação: o total é função do conjunto, e gravar linha a linha faria a
   * negociação passar por totais intermediários que ninguém pediu.
   */
  async put(
    orgId: string,
    leadId: string,
    input: PutProposalInput
  ): Promise<ProposalView> {
    const lead = await this.getLeadOwnedOrThrow(orgId, leadId);

    if (isTerminalLeadStatus(lead.status as LeadStatus)) {
      throw new ConflictException(
        "Esta negociação está encerrada e a proposta não pode mais ser alterada"
      );
    }

    /**
     * Mesma trava do `LeadsService.update` (RF23): com cronograma gerado, o
     * total não pode mudar por baixo dele — as parcelas foram criadas somando
     * exatamente o valor antigo e o financeiro recusa regerar.
     */
    const [scheduled] = await this.db
      .select({ id: schema.financialPayments.id })
      .from(schema.financialPayments)
      .where(eq(schema.financialPayments.budgetId, leadId))
      .limit(1);
    if (scheduled) {
      throw new ConflictException(
        "Esta negociação já tem cronograma de pagamentos. Exclua as parcelas pendentes antes de alterar a proposta."
      );
    }

    await this.assertBelongsToOrg(orgId, input);
    await this.assertPriceable(orgId, input, lead.guestCount);

    await this.db.transaction(async (tx) => {
      await tx
        .delete(schema.budgetLineItems)
        .where(eq(schema.budgetLineItems.budgetId, leadId));
      await tx
        .delete(schema.budgetAdjustments)
        .where(eq(schema.budgetAdjustments.budgetId, leadId));

      if (input.lines.length > 0) {
        await tx.insert(schema.budgetLineItems).values(
          input.lines.map((line, i) => ({
            budgetId: leadId,
            packageId: line.packageId ?? null,
            itemId: line.itemId ?? null,
            quantity: line.quantity ?? null,
            sortOrder: i,
          }))
        );
      }
      if (input.adjustments.length > 0) {
        await tx.insert(schema.budgetAdjustments).values(
          input.adjustments.map((adj, i) => ({
            budgetId: leadId,
            kind: adj.kind,
            mode: adj.mode,
            value: adj.value,
            label: adj.label ?? null,
            sortOrder: i,
          }))
        );
      }
    });

    return this.get(orgId, leadId);
  }

  /**
   * Precifica **linha a linha, tolerando falha** (ver `ProposalLineView.error`).
   * O total soma só o que pôde ser calculado.
   */
  private price(
    lines: PricedSource[],
    adjustments: StoredAdjustment[],
    guestCount: number | null,
    editable: boolean
  ): ProposalView {
    const priced: ProposalLineView[] = lines.map((line) => {
      const base = {
        id: line.id,
        packageId: line.packageId,
        itemId: line.itemId,
        name: line.name,
        pricingType: line.pricingType,
        basePrice: line.basePrice,
        minQty: line.minQty,
        maxQty: line.maxQty,
        guestsPerUnit: line.guestsPerUnit,
      };
      try {
        const computed = computeLinePrice({ ...line, guestCount });
        return { ...base, ...computed, error: null };
      } catch (err) {
        if (err instanceof PricingError) {
          return { ...base, quantity: 0, subtotal: "0.00", error: err.message };
        }
        throw err;
      }
    });

    const totals = applyAdjustments(
      sumMoney(priced.map((l) => l.subtotal)),
      adjustments
    );

    return {
      lines: priced,
      adjustments: adjustments.map((adj, i) => ({
        ...adj,
        amount: totals.breakdown[i]!.amount,
      })),
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      feeTotal: totals.feeTotal,
      total: totals.total,
      guestCount,
      editable,
    };
  }

  /**
   * Recusa a composição inteira se qualquer linha não puder ser precificada.
   *
   * Roda **antes** de qualquer escrita: gravar primeiro e validar depois deixava
   * a proposta salva num estado que nem ela mesma conseguia ler de volta.
   * Aqui a versão estrita do motor (`computeProposalTotals`) é a certa — na
   * entrada, tudo ou nada.
   */
  private async assertPriceable(
    orgId: string,
    input: PutProposalInput,
    guestCount: number | null
  ): Promise<void> {
    const catalog = await this.loadCatalog(
      orgId,
      input.lines.map((l) => ({
        packageId: l.packageId ?? null,
        itemId: l.itemId ?? null,
      }))
    );
    try {
      computeProposalTotals(
        input.lines.map((line, i) => {
          const source = line.packageId
            ? catalog.packages.get(line.packageId)
            : catalog.items.get(line.itemId!);
          return {
            id: String(i),
            ...(source ?? MISSING_SOURCE),
            guestCount,
            quantity: line.quantity ?? null,
          };
        }),
        input.adjustments
      );
    } catch (err) {
      if (err instanceof PricingError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }

  /**
   * Carrega pacote e item de uma vez só (RNF05: escopado na org). Sem isto seria
   * uma query por linha da proposta.
   */
  private async loadCatalog(
    orgId: string,
    lines: Array<{ packageId: string | null; itemId: string | null }>
  ) {
    const packageIds = lines.flatMap((l) => (l.packageId ? [l.packageId] : []));
    const itemIds = lines.flatMap((l) => (l.itemId ? [l.itemId] : []));

    const [packageRows, itemRows] = await Promise.all([
      packageIds.length
        ? this.db
            .select()
            .from(schema.packages)
            .where(
              scopedWhere(
                schema.packages,
                orgId,
                inArray(schema.packages.id, packageIds)
              )
            )
        : Promise.resolve([]),
      itemIds.length
        ? this.db
            .select()
            .from(schema.items)
            .where(
              scopedWhere(schema.items, orgId, inArray(schema.items.id, itemIds))
            )
        : Promise.resolve([]),
    ]);

    return {
      // Pacote é sempre por convidado: `pricePerPerson` é literalmente isso.
      packages: new Map(
        packageRows.map((p) => [
          p.id,
          {
            name: p.name,
            pricingType: "PER_GUEST" as PricingType,
            basePrice: p.pricePerPerson,
            minQty: null,
            maxQty: null,
            guestsPerUnit: null,
          },
        ])
      ),
      items: new Map(
        itemRows.map((i) => [
          i.id,
          {
            name: i.name,
            pricingType: i.pricingType as PricingType,
            basePrice: i.basePrice,
            minQty: i.minQty,
            maxQty: i.maxQty,
            guestsPerUnit: i.guestsPerUnit,
          },
        ])
      ),
    };
  }

  /** RNF05: pacote e item referenciados têm que ser da própria organização. */
  private async assertBelongsToOrg(
    orgId: string,
    input: PutProposalInput
  ): Promise<void> {
    const packageIds = [
      ...new Set(input.lines.flatMap((l) => (l.packageId ? [l.packageId] : []))),
    ];
    const itemIds = [
      ...new Set(input.lines.flatMap((l) => (l.itemId ? [l.itemId] : []))),
    ];

    const [packageCount, itemCount] = await Promise.all([
      packageIds.length
        ? this.db
            .select({ id: schema.packages.id })
            .from(schema.packages)
            .where(
              scopedWhere(
                schema.packages,
                orgId,
                inArray(schema.packages.id, packageIds)
              )
            )
        : Promise.resolve([]),
      itemIds.length
        ? this.db
            .select({ id: schema.items.id })
            .from(schema.items)
            .where(
              scopedWhere(schema.items, orgId, inArray(schema.items.id, itemIds))
            )
        : Promise.resolve([]),
    ]);

    if (packageCount.length !== packageIds.length) {
      throw new NotFoundException("Pacote não encontrado");
    }
    if (itemCount.length !== itemIds.length) {
      throw new NotFoundException("Item não encontrado");
    }
  }

  private async getLeadOwnedOrThrow(orgId: string, leadId: string) {
    const [lead] = await this.db
      .select({
        id: schema.leadsBudgets.id,
        status: schema.leadsBudgets.status,
        guestCount: schema.leadsBudgets.guestCount,
      })
      .from(schema.leadsBudgets)
      .where(
        scopedWhere(schema.leadsBudgets, orgId, eq(schema.leadsBudgets.id, leadId))
      )
      .limit(1);
    if (!lead) throw new NotFoundException("Negociação não encontrada");
    return lead;
  }
}

interface PricedSource {
  id: string;
  packageId: string | null;
  itemId: string | null;
  quantity: number | null;
  name: string;
  pricingType: PricingType;
  basePrice: string;
  minQty: number | null;
  maxQty: number | null;
  guestsPerUnit: number | null;
}

type StoredAdjustment = Omit<ProposalAdjustmentView, "amount">;

/**
 * A linha aponta para um pacote/item que não existe mais na org. Só é alcançável
 * por corrida (alguém excluiu do catálogo enquanto a proposta estava aberta),
 * porque o service do catálogo bloqueia a exclusão do que está em uso. Vale zero
 * e se identifica na tela, em vez de derrubar a proposta inteira.
 */
const MISSING_SOURCE = {
  name: "Item removido do catálogo",
  pricingType: "FIXED" as PricingType,
  basePrice: "0.00",
  minQty: null,
  maxQty: null,
  guestsPerUnit: null,
};
