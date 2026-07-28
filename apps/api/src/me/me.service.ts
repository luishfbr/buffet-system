import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { schema, type Database } from "@buffet/db";
import type {
  MemberRole,
  Workspace,
  WorkspaceInvitation,
  WorkspaceOrganization,
} from "@buffet/shared";
import { DB } from "../database/database.module.js";
import { AUTH, type Auth, type AuthContext } from "../auth/auth.constants.js";

const { member, organization, invitation, user } = schema;

/**
 * Filtro dos convites que um usuário pode aceitar agora (RF34). Exportado para
 * o teste renderizar o SQL: as três condições são fáceis de perder num refactor
 * e cada uma sozinha já é um furo — sem `status` o convite reaparece depois de
 * aceito, sem `expiresAt` um convite vencido volta a valer.
 */
export function pendingInvitationsWhere(email: string, now: Date) {
  return and(
    // O e-mail do convite é digitado à mão pelo proprietário; comparar cru
    // deixaria "Func@Teste.com" fora do resultado.
    sql`lower(${invitation.email}) = lower(${email})`,
    eq(invitation.status, "pending"),
    gt(invitation.expiresAt, now)
  );
}

@Injectable()
export class MeService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(AUTH) private readonly auth: Auth
  ) {}

  /**
   * Tudo que decide para onde o usuário entra: buffets dos quais participa,
   * convites pendentes e qual org está ativa agora.
   */
  async workspace(auth: AuthContext): Promise<Workspace> {
    const [organizations, invitations] = await Promise.all([
      this.listOrganizations(auth.user.id),
      this.listPendingInvitations(auth.user.email),
    ]);

    return {
      // Da associação revalidada pelo AuthGuard, não de
      // `session.activeOrganizationId` — mesma regra do `@ActiveOrg()`: um
      // funcionário demitido continua com o id antigo na sessão.
      activeOrganizationId: auth.member?.organizationId ?? null,
      organizations,
      invitations,
    };
  }

  /**
   * Troca a organização ativa da sessão e memoriza a escolha em
   * `user.lastOrganizationId`, para o próximo login reabrir no mesmo buffet.
   */
  async setActiveOrganization(
    auth: AuthContext,
    headers: Headers,
    organizationId: string
  ): Promise<{ organizationId: string }> {
    const [membership] = await this.db
      .select({ id: member.id })
      .from(member)
      .where(
        and(
          eq(member.userId, auth.user.id),
          eq(member.organizationId, organizationId)
        )
      )
      .limit(1);

    // Checagem própria antes de delegar: o Better-Auth também valida, mas a
    // mensagem dele não é pt-BR e o front mostra o `message` cru (RNF08).
    if (!membership) {
      throw new ForbiddenException("Você não faz parte deste buffet");
    }

    // Quem grava `session.activeOrganizationId` é o próprio Better-Auth — a
    // sessão é dele. Passar pelo servidor mantém validação e memória do último
    // buffet numa transação de fluxo só, em vez de duas chamadas do navegador.
    await this.auth.api.setActiveOrganization({
      headers,
      body: { organizationId },
    });

    await this.db
      .update(user)
      .set({ lastOrganizationId: organizationId })
      .where(eq(user.id, auth.user.id));

    return { organizationId };
  }

  private async listOrganizations(
    userId: string
  ): Promise<WorkspaceOrganization[]> {
    const rows = await this.db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
        role: member.role,
      })
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(eq(member.userId, userId))
      .orderBy(asc(organization.name));

    return rows.map((row) => ({ ...row, role: row.role as MemberRole }));
  }

  /**
   * Convites pendentes endereçados ao e-mail do usuário (RF34).
   *
   * ⚠️ Não use `authClient.organization.listUserInvitations()` no lugar disto:
   * em better-auth 1.6.23 essa rota exige `user.emailVerified` **sem** respeitar
   * o `requireEmailVerificationOnInvitation: false` do projeto — e como aqui
   * ninguém verifica e-mail, ela responde 403 sempre.
   */
  private async listPendingInvitations(
    email: string
  ): Promise<WorkspaceInvitation[]> {
    const inviter = alias(user, "inviter");

    const rows = await this.db
      .select({
        id: invitation.id,
        organizationId: invitation.organizationId,
        organizationName: organization.name,
        role: invitation.role,
        inviterName: inviter.name,
        expiresAt: invitation.expiresAt,
      })
      .from(invitation)
      .innerJoin(organization, eq(invitation.organizationId, organization.id))
      .leftJoin(inviter, eq(invitation.inviterId, inviter.id))
      .where(pendingInvitationsWhere(email, new Date()))
      .orderBy(asc(invitation.createdAt));

    return rows.map((row) => ({
      ...row,
      role: row.role as MemberRole,
      expiresAt: row.expiresAt.toISOString(),
    }));
  }
}
