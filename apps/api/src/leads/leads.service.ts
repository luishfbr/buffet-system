import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lt,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import {
  schema,
  type BudgetStatusLog,
  type Database,
  type LeadBudget,
  type LeadNote,
} from "@buffet/db";
import {
  MAX_PROPOSAL_VALIDITY_DAYS,
  NEGATIVE_LEAD_STATUSES,
  buildProposalText,
  computeBudgetTotal,
  findTransition,
  invalidTransitionMessage,
  isNegativeLeadStatus,
  visibleTotalValue,
  type AgendaEvent,
  type AgendaRangeInput,
  type AgendaResponse,
  type CreateLeadNoteInput,
  type LeadNoteView,
  type LeadStatus,
  type LeadStatusLogView,
  type TransitionGuardKey,
  type TransitionLeadInput,
  type TransitionRole,
  type TransitionRule,
  type UpdateLeadInput,
  type UpdateValidUntilInput,
} from "@buffet/shared";
import { DB } from "../database/database.module.js";
import { scopedWhere } from "../common/tenant.js";
import { ProposalsService } from "../proposals/proposals.service.js";

/**
 * Teto de linhas do `GET /leads`. Sem paginação (o kanban precisa de todos os
 * status), mas também sem devolver a tabela inteira: acima disto, o caminho é
 * a busca por termo. Documentado no README como limitação conhecida.
 */
const LIST_LIMIT = 500;

/**
 * "Ainda é um compromisso de verdade" — o filtro que agenda (RF31), alerta de
 * conflito (RF21) e próximos eventos (RF30) compartilham.
 *
 * No MVP isso era `status <> 'perdido'`, o que bastava com cinco estados. Com os
 * oito da v2, uma negociação cancelada ou com proposta expirada continuaria
 * ocupando a data e disparando alerta de conflito contra eventos reais.
 */
export function notCancelledOrLost() {
  // Cópia mutável: o `notInArray` do Drizzle não aceita `readonly`.
  return notInArray(schema.leadsBudgets.status, [...NEGATIVE_LEAD_STATUSES]);
}

/** UTC day window `[startOfDay, nextDay)` for a date — used by conflict checks. */
export function dayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

/** `base + dias` corridos. Instante real, não data-sem-hora: a validade vence
 *  na hora exata em que foi enviada, e o cron compara com `now()`. */
function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
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

/** Linha do log de auditoria → contrato da API (RF-V2-04). */
function toStatusLogView(row: BudgetStatusLog): LeadStatusLogView {
  return {
    id: row.id,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    actorName: row.actorName,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}

/** A lead enriched with its package name and same-day conflict count (RF21). */
export interface LeadDetail extends LeadBudget {
  packageName: string | null;
  conflictCount: number;
}

/** Quem executou a transição. `userId` é nulo quando o ator é o sistema. */
export interface TransitionActor {
  userId: string | null;
  name: string;
}

/** O cron da expiração (RF-V2-08) não tem usuário por trás. */
export const SYSTEM_ACTOR: TransitionActor = { userId: null, name: "Sistema" };

/** Transação do Drizzle, para os guards receberem a mesma conexão da escrita. */
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Pré-condição de banco de uma transição (RF-V2-02). */
type TransitionGuard = (tx: Tx, lead: LeadBudget) => Promise<void>;

/**
 * Decide se a transição pode acontecer e devolve a regra que a autoriza — toda
 * a máquina de estados que **não** depende do banco (RF-V2-02/RF-V2-03).
 *
 * Exportada e pura de propósito: é a parte que concentra a regra de negócio, e
 * assim ela se testa sem harness de banco, do mesmo jeito que `dayRange`.
 *
 * O RNF04 mora aqui, e não num `@Roles` do controller, porque o direito depende
 * do **destino**: cancelar é do proprietário, avançar o funil é de qualquer um,
 * e expirar não é de ninguém — é do relógio.
 */
export function assertTransitionAllowed(
  from: LeadStatus,
  to: LeadStatus,
  role: TransitionRole,
  reason: string | null
): TransitionRule {
  // Estado terminal cai aqui também: a tabela simplesmente não lista saídas.
  const rule = findTransition(from, to);
  if (!rule) {
    throw new BadRequestException(invalidTransitionMessage(from, to));
  }

  if (!rule.roles.includes(role)) {
    throw new ForbiddenException(
      rule.roles.includes("system")
        ? "A expiração da proposta é feita automaticamente pelo sistema"
        : "Seu perfil não permite executar esta mudança de estado"
    );
  }

  // RF-V2-03: caminho negativo sem motivo é bloqueado, não registrado vazio.
  if (rule.requiresReason && !reason) {
    throw new BadRequestException(
      "Informe o motivo para registrar esta mudança"
    );
  }

  return rule;
}

@Injectable()
export class LeadsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly proposals: ProposalsService
  ) {}

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

    const rows = await this.db
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

    // RF-V2-06 aplicado no service, não na tela: o valor não deve nem sair
    // daqui antes da proposta existir.
    return rows.map((lead) => ({
      ...lead,
      totalValue: visibleTotalValue(lead.status as LeadStatus, lead.totalValue),
    }));
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
            includeLost ? undefined : notCancelledOrLost()
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
            notCancelledOrLost()
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
              totalValue: visibleTotalValue(
                row.status as LeadStatus,
                row.totalValue
              ),
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

  /**
   * Log de auditoria da negociação (RF-V2-04), do mais recente ao mais antigo.
   * Só leitura: não há rota de escrita, e o banco recusa UPDATE/DELETE
   * (RNF-V2-05).
   */
  async listStatusLog(
    orgId: string,
    leadId: string
  ): Promise<LeadStatusLogView[]> {
    await this.getOwnedOrThrow(orgId, leadId);
    const rows = await this.db
      .select()
      .from(schema.budgetStatusLog)
      .where(eq(schema.budgetStatusLog.budgetId, leadId))
      .orderBy(desc(schema.budgetStatusLog.createdAt));
    return rows.map(toStatusLogView);
  }

  /**
   * Pré-condições de transição que dependem do estado no banco (RF-V2-02).
   *
   * Vazio nesta sprint porque **nenhuma regra declara guard ainda** — o
   * `revisaoAtiva` entra em `LEAD_TRANSITIONS` junto com a implementação aqui,
   * no RF-V2-11. Declarar a chave antes deixaria a tabela afirmando uma
   * pré-condição que ninguém verifica, que é pior que não ter guard nenhum.
   */
  private readonly guards: Partial<Record<TransitionGuardKey, TransitionGuard>> =
    {
      revisaoAtiva: async (tx, lead) => {
        if (!(await this.proposals.hasComposition(tx, lead.id))) {
          throw new BadRequestException(
            "Monte a proposta antes de enviá-la: adicione ao menos um pacote ou serviço na aba Proposta."
          );
        }
      },
    };

  /** RF-V2-12: revisões da negociação, com o estado de cada uma. */
  async listRevisions(orgId: string, leadId: string) {
    const lead = await this.getOwnedOrThrow(orgId, leadId);
    return this.proposals.listRevisions(
      orgId,
      leadId,
      lead.status as LeadStatus
    );
  }

  /**
   * RF-V2-07: ajusta a validade da proposta ativa.
   *
   * Só faz sentido com a proposta no ar; e o novo prazo precisa estar no
   * futuro, senão o cron expiraria a negociação no ciclo seguinte — um jeito
   * confuso de encerrar algo que tem transição própria para isso.
   */
  async updateValidUntil(
    orgId: string,
    id: string,
    input: UpdateValidUntilInput
  ): Promise<LeadDetail> {
    const lead = await this.getOwnedOrThrow(orgId, id);
    if (lead.status !== "proposta_enviada") {
      throw new ConflictException(
        "A validade só se aplica a uma proposta enviada e ainda em aberto"
      );
    }

    const validUntil = new Date(input.validUntil);
    if (validUntil.getTime() <= Date.now()) {
      throw new BadRequestException("A validade tem que ser no futuro");
    }
    const maxAllowed = addDays(new Date(), MAX_PROPOSAL_VALIDITY_DAYS);
    if (validUntil.getTime() > maxAllowed.getTime()) {
      throw new BadRequestException(
        `A validade não pode passar de ${MAX_PROPOSAL_VALIDITY_DAYS} dias a partir de hoje`
      );
    }

    const row = await this.db.transaction(async (tx) => {
      // A revisão ativa é a fonte de verdade; `leads_budgets.validUntil` é o
      // espelho que o cron varre. Mover só um dos dois faria a tela e o cron
      // discordarem sobre quando a proposta vence.
      const [active] = await tx
        .select({ id: schema.budgetRevisions.id })
        .from(schema.budgetRevisions)
        .where(eq(schema.budgetRevisions.budgetId, id))
        .orderBy(desc(schema.budgetRevisions.revisionNumber))
        .limit(1);
      if (active) {
        await tx
          .update(schema.budgetRevisions)
          .set({ validUntil })
          .where(eq(schema.budgetRevisions.id, active.id));
      }
      const [updated] = await tx
        .update(schema.leadsBudgets)
        .set({ validUntil, updatedAt: new Date() })
        .where(
          scopedWhere(schema.leadsBudgets, orgId, eq(schema.leadsBudgets.id, id))
        )
        .returning();
      return updated!;
    });

    return this.enrich(orgId, row);
  }

  /**
   * Validade padrão do tenant (RF-V2-07). A linha é criada pela migration para
   * toda org existente; o `?? 7` cobre uma org criada depois, cujo
   * `org_settings` ainda não foi escrito.
   */
  private async proposalValidityDays(tx: Tx, orgId: string): Promise<number> {
    const [row] = await tx
      .select({ days: schema.orgSettings.proposalValidityDays })
      .from(schema.orgSettings)
      .where(eq(schema.orgSettings.organizationId, orgId))
      .limit(1);
    return row?.days ?? 7;
  }

  /**
   * Executa uma transição de estado (RF-V2-02). **Único** caminho que escreve
   * `leads_budgets.status` — o `PATCH /leads/:id` não aceita mais o campo.
   *
   * Tudo em uma transação (RNF-V2-01): ou o status muda e o log é escrito, ou
   * nada acontece. Um log sem a mudança correspondente é pior que nenhum log.
   */
  async transition(
    orgId: string,
    id: string,
    input: TransitionLeadInput,
    actor: TransitionActor,
    role: TransitionRole
  ): Promise<LeadDetail> {
    const lead = await this.getOwnedOrThrow(orgId, id);
    const from = lead.status as LeadStatus;
    const reason = input.reason?.trim() || null;

    const rule = assertTransitionAllowed(from, input.to, role, reason);

    const row = await this.db.transaction(async (tx) => {
      for (const key of rule.guards ?? []) {
        const guard = this.guards[key];
        // Chave declarada sem implementação é bug de programação, não estado do
        // usuário: falhar alto é o que impede a tabela de prometer uma
        // verificação que não acontece.
        if (!guard) {
          throw new Error(`Guard de transição "${key}" não implementado`);
        }
        await guard(tx, lead);
      }

      /**
       * RF-V2-05/RF-V2-11: enviar a proposta congela a composição numa revisão
       * nova. Dentro da mesma transação porque revisão sem mudança de status
       * (ou vice-versa) descreveria algo que não aconteceu.
       */
      let snapshot: { totalValue: string; validUntil: Date } | null = null;
      if (input.to === "proposta_enviada") {
        const validUntil = addDays(
          new Date(),
          await this.proposalValidityDays(tx, orgId)
        );
        const created = await this.proposals.createRevision(
          tx,
          orgId,
          lead,
          { userId: actor.userId, name: actor.name },
          validUntil
        );
        snapshot = { totalValue: created.totalValue, validUntil };
      }

      /**
       * Compare-and-swap no `status`: a cláusula exige que a negociação ainda
       * esteja no estado que validamos. Sem isso, dois usuários arrastando o
       * mesmo card no quadro fazem last-writer-wins — o segundo grava por cima
       * de uma transição que nunca chegou a ver, e o log fica descrevendo um
       * caminho que não aconteceu. Resolve a corrida sem coluna de versão.
       */
      const updated = await tx
        .update(schema.leadsBudgets)
        .set({
          status: input.to,
          // Motivo do encerramento fica denormalizado para a listagem não ter
          // que ir ao log; nos destinos não negativos ele é limpo.
          lostReason: isNegativeLeadStatus(input.to) ? reason : null,
          // O total exibido passa a vir do snapshot, e `validUntil` alimenta o
          // índice parcial que o cron de expiração varre (RF-V2-08).
          ...(snapshot
            ? { totalValue: snapshot.totalValue, validUntil: snapshot.validUntil }
            : {}),
          updatedAt: new Date(),
        })
        .where(
          scopedWhere(
            schema.leadsBudgets,
            orgId,
            eq(schema.leadsBudgets.id, id),
            eq(schema.leadsBudgets.status, from)
          )
        )
        // Linha inteira, não só o id: ela alimenta a resposta e poupa reler do
        // banco o que acabamos de escrever.
        .returning();

      if (updated.length === 0) {
        throw new ConflictException(
          "A negociação mudou de estado enquanto esta tela estava aberta. Recarregue para ver a situação atual."
        );
      }

      await tx.insert(schema.budgetStatusLog).values({
        budgetId: id,
        fromStatus: from,
        toStatus: input.to,
        actorUserId: actor.userId,
        actorName: actor.name,
        reason,
      });

      return updated[0]!;
    });

    return this.enrich(orgId, row);
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
    return this.enrich(orgId, await this.getOwnedOrThrow(orgId, id));
  }

  /**
   * Completa uma linha já carregada com nome do pacote e conflito de data
   * (RF21). Separado do `getOne` para quem **acabou de escrever** a linha
   * (`transition`, `update`) montar a resposta sem reler do banco o que já tem
   * em mãos.
   *
   * As duas consultas não dependem uma da outra — em série custariam um RTT a
   * mais por chamada, que no Neon é o que domina o tempo.
   */
  private async enrich(orgId: string, lead: LeadBudget): Promise<LeadDetail> {
    const [pkgRows, conflictCount] = await Promise.all([
      lead.packageId
        ? this.db
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
        : Promise.resolve([]),
      lead.eventDate
        ? this.countDateConflicts(orgId, lead.eventDate, lead.id)
        : Promise.resolve(0),
    ]);
    return {
      ...lead,
      // RF-V2-06: antes do envio da proposta o painel não mostra valor.
      totalValue: visibleTotalValue(lead.status as LeadStatus, lead.totalValue),
      packageName: pkgRows[0]?.name ?? null,
      conflictCount,
    };
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
   * Edita os dados do cliente/evento de uma negociação. Recalcula `totalValue`
   * quando o pacote ou o número de convidados muda. Org-scoped (RNF05).
   *
   * **Não mexe em status** (RF-V2-02): isso é `transition()`, que valida o
   * caminho, o papel e grava auditoria.
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
        updatedAt: new Date(),
      })
      .where(
        scopedWhere(schema.leadsBudgets, orgId, eq(schema.leadsBudgets.id, id))
      )
      .returning();

    return this.enrich(orgId, row!);
  }

  /**
   * Count other saved/approved events on the same calendar day (RF21). Lost,
   * cancelled and expired leads are excluded — they are not real bookings.
   * Never blocks saving.
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
          notCancelledOrLost(),
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
