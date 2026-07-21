import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { fromNodeHeaders } from "better-auth/node";
import { and, eq } from "drizzle-orm";
import type { Request } from "express";
import { schema, type Database } from "@buffet/db";
import type { MemberRole } from "@buffet/shared";
import { DB } from "../database/database.module.js";
import {
  AUTH,
  IS_PUBLIC_KEY,
  type Auth,
  type AuthContext,
} from "./auth.constants.js";

/**
 * Global guard. Resolves the Better-Auth session for every request and attaches
 * an AuthContext (user + session + active-org membership) to `req.auth`. This
 * makes the Nest API the single source of truth for sessions and roles.
 *
 * Public routes (@Public) are allowed through even without a session, but the
 * context is still populated when a session exists.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    @Inject(DB) private readonly db: Database,
    private readonly reflector: Reflector
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    const req = ctx.switchToHttp().getRequest<Request & { auth?: AuthContext }>();

    const result = await this.auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (result) {
      const activeOrganizationId =
        (result.session as { activeOrganizationId?: string | null })
          .activeOrganizationId ?? null;

      req.auth = {
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: (result.user as { role?: string | null }).role ?? null,
        },
        session: {
          id: result.session.id,
          activeOrganizationId,
        },
        member: await this.resolveMember(result.user.id, activeOrganizationId),
      };
    }

    if (isPublic) return true;
    if (!req.auth) throw new UnauthorizedException("Não autenticado");
    return true;
  }

  private async resolveMember(
    userId: string,
    organizationId: string | null
  ): Promise<AuthContext["member"]> {
    if (!organizationId) return null;
    const [row] = await this.db
      .select({ role: schema.member.role })
      .from(schema.member)
      .where(
        and(
          eq(schema.member.userId, userId),
          eq(schema.member.organizationId, organizationId)
        )
      )
      .limit(1);
    if (!row) return null;
    return { role: row.role as MemberRole, organizationId };
  }
}
