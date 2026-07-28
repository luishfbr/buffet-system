import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, desc, eq, gte, ilike, isNull, lt, ne, or, sql } from "drizzle-orm";
import { schema, type Database, type LeadBudget, type LeadNote } from "@buffet/db";
import {
  buildProposalText,
  computeBudgetTotal,
  type AgendaEvent,
  type AgendaRangeInput,
  type AgendaResponse,
  type CreateLeadNoteInput,
  type LeadNoteView,
  type LeadStatus,
  type UpdateLeadInput,
} from "@buffet/shared";
import { DB } from "../database/database.module.js";
import { scopedWhere } from "../common/tenant.js";

/**
 * Teto de linhas do `GET /leads`. Sem paginação (o kanban precisa de todos os
 * status), mas também sem devolver a tabela inteira: acima disto, o caminho é
 * a busca por termo. Documentado no README como limitação conhecida.
 */
const LIST_LIMIT = 500;

/** UTC day window `[startOfDay, nextDay)` for a date — used by conflict checks. */
export function dayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

/** Linha do histórico → contrato da API (RF35). */
function toNoteView(row: LeadNote): LeadNoteView {
  return {
    id: row.id,
    body: row.body,
    authorName: row.authorName,
    createdAt: row.createdAt.toISOString(),
  };
}

/** A lead enriched with its package name and same-day conflict count (RF21). */
export interface LeadDetail extends LeadBudget {
  packageName: string | null;
  conflictCount: number;
}

@Injectable()
export class LeadsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Dynamic listing, optionally filtered by status (RF19). Org-scoped.
   *
   * `q` busca no **servidor** por nome, telefone ou e-mail. Antes a busca era
   * só client-side sobre o que já tinha sido baixado — o que, com o teto de
   * `LIST_LIMIT`, deixaria de encontrar registros antigos.
   *
   * Não há paginação de propósito: o kanban precisa de todos os status de uma
   * vez. O teto protege a resposta; passar dele é sinal de que a busca é o
   * caminho, não a rolagem.
   */
  async list(
    orgId: string,
    status?: LeadStatus,
    q?: string
  ): Promise<LeadBudget[]> {
    const term = q?.trim();
    const search = term
      ? or(
          ilike(schema.leadsBudgets.customerName, `%${term}%`),
          ilike(schema.leadsBudgets.customerPhone, `%${term}%`),
          ilike(schema.leadsBudgets.customerEmail, `%${term}%`)
        )
      : undefined;

    return this.db
      .select()
      .from(schema.leadsBudgets)
      .where(
        scopedWhere(
          schema.leadsBudgets,
          orgId,
          status ? eq(schema.leadsBudgets.status, status) : undefined,
          search
        )
      )
      .orderBy(desc(schema.leadsBudgets.createdAt))
      .limit(LIST_LIMIT);
  }

  /**
   * Eventos de um intervalo de datas, para a agenda mensal (RF31).
   *
   * Devolve lista plana: quem agrupa por dia (e portanto decide o que é
   * conflito) é o cliente, usando a mesma regra do RF21 — mais de um evento não
   * perdido no mesmo dia UTC. Usa o índice `leads_org_eventdate_idx`.
   */
  async agenda(
    orgId: string,
    range: AgendaRangeInput
  ): Promise<AgendaResponse> {
    // `to` é inclusivo para quem chama, então o limite superior é o dia
    // seguinte, exclusivo — mesma convenção do `dayRange` do RF21.
    const start = new Date(`${range.from}T00:00:00.000Z`);
    const endExclusive = new Date(`${range.to}T00:00:00.000Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    const includeLost = range.includeLost === "true";

    const [rows, [undated]] = await Promise.all([
      this.db
        .select({
          id: schema.leadsBudgets.id,
          customerName: schema.leadsBudgets.customerName,
          eventDate: schema.leadsBudgets.eventDate,
          guestCount: schema.leadsBudgets.guestCount,
          status: schema.leadsBudgets.status,
          totalValue: schema.leadsBudgets.totalValue,
          packageName: schema.packages.name,
        })
        .from(schema.leadsBudgets)
        .leftJoin(
          schema.packages,
          eq(schema.leadsBudgets.packageId, schema.packages.id)
        )
        .where(
          scopedWhere(
            schema.leadsBudgets,
            orgId,
            gte(schema.leadsBudgets.eventDate, start),
            lt(schema.leadsBudgets.eventDate, endExclusive),
            includeLost
              ? undefined
              : ne(schema.leadsBudgets.status, "perdido")
          )
        )
        .orderBy(asc(schema.leadsBudgets.eventDate)),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.leadsBudgets)
        .where(
          scopedWhere(
            schema.leadsBudgets,
            orgId,
            isNull(schema.leadsBudgets.eventDate),
            ne(schema.leadsBudgets.status, "perdido")
          )
        ),
    ]);

    const events: AgendaEvent[] = rows.flatMap((row) =>
      row.eventDate
        ? [
            {
              id: row.id,
              customerName: row.customerName,
              eventDate: row.eventDate.toISOString(),
              guestCount: row.guestCount,
              status: row.status as LeadStatus,
              totalValue: row.totalValue,
              packageName: row.packageName,
            },
          ]
        : []
    );

    return { events, undatedCount: undated?.count ?? 0 };
  }

  /**
   * Histórico de interações da negociação (RF35), do mais recente ao mais
   * antigo. Sem `organizationId` na tabela: o dono é validado antes, e a linha
   * só é alcançável pelo lead pai (RNF05).
   */
  async listNotes(orgId: string, leadId: string): Promise<LeadNoteView[]> {
    await this.getOwnedOrThrow(orgId, leadId);
    const rows = await this.db
      .select()
      .from(schema.leadNotes)
      .where(eq(schema.leadNotes.budgetId, leadId))
      .orderBy(desc(schema.leadNotes.createdAt));
    return rows.map(toNoteView);
  }

  /**
   * Registra uma anotação (RF35). Append-only: cada registro é uma linha, então
   * dois members anotando a mesma negociação ao mesmo tempo não se sobrescrevem
   * — que era exatamente o que acontecia com a coluna `notes` do RF20.
   */
  async addNote(
    orgId: string,
    leadId: string,
    input: CreateLeadNoteInput,
    author: { id: string; name: string }
  ): Promise<LeadNoteView> {
    await this.getOwnedOrThrow(orgId, leadId);
    const [row] = await this.db
      .insert(schema.leadNotes)
      .values({
        budgetId: leadId,
        authorUserId: author.id,
        // Snapshot do nome no momento da escrita.
        authorName: author.name,
        body: input.body,
      })
      .returning();
    // `updatedAt` do lead acompanha a interação, para o funil ordenar por
    // atividade recente.
    await this.db
      .update(schema.leadsBudgets)
      .set({ updatedAt: new Date() })
      .where(
        scopedWhere(schema.leadsBudgets, orgId, eq(schema.leadsBudgets.id, leadId))
      );
    return toNoteView(row!);
  }

  /** Remove uma anotação (RF35). Owner-only, como todo delete físico. */
  async removeNote(
    orgId: string,
    leadId: string,
    noteId: string
  ): Promise<void> {
    await this.getOwnedOrThrow(orgId, leadId);
    const [row] = await this.db
      .select({ id: schema.leadNotes.id })
      .from(schema.leadNotes)
      .where(
        and(
          eq(schema.leadNotes.id, noteId),
          eq(schema.leadNotes.budgetId, leadId)
        )
      )
      .limit(1);
    if (!row) throw new NotFoundException("Anotação não encontrada");
    await this.db
      .delete(schema.leadNotes)
      .where(eq(schema.leadNotes.id, noteId));
  }

  /** A single negotiation with package name and date-conflict count (RF21). */
  async getOne(orgId: string, id: string): Promise<LeadDetail> {
    const lead = await this.getOwnedOrThrow(orgId, id);
    const [pkg] = lead.packageId
      ? await this.db
          .select({ name: schema.packages.name })
          .from(schema.packages)
          .where(
            scopedWhere(
              schema.packages,
              orgId,
              eq(schema.packages.id, lead.packageId)
            )
          )
          .limit(1)
      : [];
    const conflictCount = lead.eventDate
      ? await this.countDateConflicts(orgId, lead.eventDate, lead.id)
      : 0;
    return { ...lead, packageName: pkg?.name ?? null, conflictCount };
  }

  /** Generate the copy-ready proposal text for a negotiation (RF22). */
  async proposalText(orgId: string, id: string): Promise<{ text: string }> {
    const lead = await this.getOwnedOrThrow(orgId, id);
    const [org] = await this.db
      .select({ name: schema.organization.name })
      .from(schema.organization)
      .where(eq(schema.organization.id, orgId))
      .limit(1);
    const [pkg] = lead.packageId
      ? await this.db
          .select({ name: schema.packages.name })
          .from(schema.packages)
          .where(
            scopedWhere(
              schema.packages,
              orgId,
              eq(schema.packages.id, lead.packageId)
            )
          )
          .limit(1)
      : [];
    return {
      text: buildProposalText({
        customerName: lead.customerName,
        organizationName: org?.name ?? null,
        packageName: pkg?.name ?? null,
        eventDate: lead.eventDate,
        guestCount: lead.guestCount,
        totalValue: lead.totalValue,
      }),
    };
  }

  /**
   * Update a negotiation: status transitions (RF19), notes/history (RF20),
   * lost reason, and customer/event edits. Recomputes totalValue when the
   * package or guest count changes. Org-scoped (RNF05).
   */
  async update(
    orgId: string,
    id: string,
    input: UpdateLeadInput
  ): Promise<LeadDetail> {
    const current = await this.getOwnedOrThrow(orgId, id);

    // Resolve the effective package (may change) and validate ownership.
    let packageId = current.packageId;
    let pricePerPerson: string | null = null;
    if (input.packageId !== undefined) {
      packageId = input.packageId || null;
    }
    if (packageId) {
      const [pkg] = await this.db
        .select({ pricePerPerson: schema.packages.pricePerPerson })
        .from(schema.packages)
        .where(
          scopedWhere(schema.packages, orgId, eq(schema.packages.id, packageId))
        )
        .limit(1);
      if (!pkg) {
        throw new NotFoundException("Pacote não encontrado");
      }
      pricePerPerson = pkg.pricePerPerson;
    }

    const guestCount =
      input.guestCount !== undefined ? input.guestCount : current.guestCount;

    // Recompute the total whenever the inputs to it are touched.
    const recompute =
      input.packageId !== undefined || input.guestCount !== undefined;
    const totalValue = recompute
      ? pricePerPerson && guestCount
        ? computeBudgetTotal(pricePerPerson, guestCount)
        : null
      : current.totalValue;

    /**
     * Com cronograma gerado (RF23), o total não pode mudar por baixo dele: as
     * parcelas foram criadas somando exatamente o valor antigo, e o `POST
     * /finance/leads/:id/schedule` recusa regerar (409). Sem esta trava, editar
     * convidados ou pacote deixava o financeiro contradizendo a negociação em
     * definitivo. Trocar o pacote exige excluir as parcelas pendentes antes.
     */
    if (recompute && totalValue !== current.totalValue) {
      const [scheduled] = await this.db
        .select({ id: schema.financialPayments.id })
        .from(schema.financialPayments)
        .where(eq(schema.financialPayments.budgetId, id))
        .limit(1);
      if (scheduled) {
        throw new ConflictException(
          "Esta negociação já tem cronograma de pagamentos. Exclua as parcelas pendentes antes de alterar o pacote ou o número de convidados."
        );
      }
    }

    const eventDate =
      input.eventDate !== undefined
        ? input.eventDate
          ? new Date(input.eventDate)
          : null
        : current.eventDate;

    const [row] = await this.db
      .update(schema.leadsBudgets)
      .set({
        ...(input.customerName !== undefined
          ? { customerName: input.customerName }
          : {}),
        ...(input.customerEmail !== undefined
          ? { customerEmail: input.customerEmail || null }
          : {}),
        ...(input.customerPhone !== undefined
          ? { customerPhone: input.customerPhone }
          : {}),
        ...(input.eventDate !== undefined ? { eventDate } : {}),
        ...(input.guestCount !== undefined ? { guestCount } : {}),
        ...(input.packageId !== undefined ? { packageId } : {}),
        ...(recompute ? { totalValue } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
        // lostReason only makes sense on a "perdido" lead; clear it otherwise.
        ...(input.status !== undefined && input.status !== "perdido"
          ? { lostReason: null }
          : input.lostReason !== undefined
            ? { lostReason: input.lostReason || null }
            : {}),
        updatedAt: new Date(),
      })
      .where(
        scopedWhere(schema.leadsBudgets, orgId, eq(schema.leadsBudgets.id, id))
      )
      .returning();

    return this.getOne(orgId, row!.id);
  }

  /**
   * Count other saved/approved events on the same calendar day (RF21). Lost
   * leads are excluded — they are not real bookings. Never blocks saving.
   */
  private async countDateConflicts(
    orgId: string,
    eventDate: Date,
    excludeId: string
  ): Promise<number> {
    const { start, end } = dayRange(eventDate);
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.leadsBudgets)
      .where(
        scopedWhere(
          schema.leadsBudgets,
          orgId,
          ne(schema.leadsBudgets.id, excludeId),
          ne(schema.leadsBudgets.status, "perdido"),
          gte(schema.leadsBudgets.eventDate, start),
          lt(schema.leadsBudgets.eventDate, end)
        )
      );
    return row?.count ?? 0;
  }

  private async getOwnedOrThrow(
    orgId: string,
    id: string
  ): Promise<LeadBudget> {
    const [row] = await this.db
      .select()
      .from(schema.leadsBudgets)
      .where(
        scopedWhere(schema.leadsBudgets, orgId, eq(schema.leadsBudgets.id, id))
      )
      .limit(1);
    if (!row) throw new NotFoundException("Negociação não encontrada");
    return row;
  }
}
