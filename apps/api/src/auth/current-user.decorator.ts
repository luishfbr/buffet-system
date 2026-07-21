import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
} from "@nestjs/common";
import type { Request } from "express";
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
 */
export const ActiveOrg = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
    const orgId = req.auth?.session.activeOrganizationId;
    if (!orgId) {
      throw new ForbiddenException("Nenhuma organização ativa na sessão");
    }
    return orgId;
  }
);
