import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { MemberRole } from "@buffet/shared";
import { ROLES_KEY, type AuthContext } from "./auth.constants.js";

/**
 * Enforces @Roles(...) on routes. Runs after AuthGuard, so `req.auth` is set.
 * Owner-only routes (financial mutations, physical deletes, billing totals)
 * are gated here (RNF04).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<MemberRole[] | undefined>(
      ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()]
    );
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
    const role = req.auth?.member?.role;

    if (!role || !required.includes(role)) {
      throw new ForbiddenException(
        "Você não tem permissão para esta ação"
      );
    }
    return true;
  }
}
