import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
} from "@nestjs/common";
import type { Request } from "express";
import type { MemberRole } from "@buffet/shared";
import type { AuthContext } from "./auth.constants.js";

/** Injects the authenticated AuthContext into a controller handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const req = ctx.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
    if (!req.auth) {
      throw new InternalServerErrorException("Auth context not populated");
    }
    return req.auth;
  }
);

/**
 * Injects the active organization id. Throws if no org is active — use only on
 * routes that operate on tenant data (RNF05).
 *
 * ⚠️ A org vem da **associação** (`member`), não de `session.activeOrganizationId`.
 * A diferença é de segurança, não de estilo: o Better-Auth só limpa o campo da
 * sessão quando o usuário se remove a si mesmo. Quando o proprietário demite um
 * funcionário, a sessão dele continua apontando para a organização — e como a
 * maioria das rotas não declara `@Roles` (o `RolesGuard` passa direto sem
 * metadata), confiar no campo da sessão manteria o acesso do ex-funcionário até
 * a sessão expirar. O `AuthGuard` já relê a linha `member` a cada requisição,
 * então a checagem aqui não custa query nenhuma.
 */
export const ActiveOrg = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
    const member = req.auth?.member;
    if (!member) {
      throw new ForbiddenException("Nenhuma organização ativa na sessão");
    }
    return member.organizationId;
  }
);

/**
 * Injects the caller's role in the active organization (RNF04). Mesma garantia
 * do `ActiveOrg`: sem associação viva, ninguém passa — evita o `member!` solto
 * nos controllers, que virava 500 em vez de 403.
 */
export const CurrentRole = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): MemberRole => {
    const req = ctx.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
    const member = req.auth?.member;
    if (!member) {
      throw new ForbiddenException("Nenhuma organização ativa na sessão");
    }
    return member.role;
  }
);
