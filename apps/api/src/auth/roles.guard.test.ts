import { describe, it, expect } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";
import { RolesGuard } from "./roles.guard.js";
import { ROLES_KEY, type AuthContext } from "./auth.constants.js";
import type { MemberRole } from "@buffet/shared";

function makeContext(
  auth: AuthContext | undefined,
  requiredRoles: MemberRole[] | undefined
): { ctx: ExecutionContext; guard: RolesGuard } {
  const reflector = new Reflector();
  // Reflector.getAllAndOverride reads metadata from handler/class; stub it.
  reflector.getAllAndOverride = ((key: string) =>
    key === ROLES_KEY ? requiredRoles : undefined) as never;

  const ctx = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ auth }) }),
  } as unknown as ExecutionContext;

  return { ctx, guard: new RolesGuard(reflector) };
}

const ownerAuth: AuthContext = {
  user: { id: "u1", email: "a@b.com", name: "A", role: "user" },
  session: { id: "s1", activeOrganizationId: "org1" },
  member: { role: "owner", organizationId: "org1" },
};

const memberAuth: AuthContext = {
  ...ownerAuth,
  member: { role: "member", organizationId: "org1" },
};

describe("RolesGuard (RNF04)", () => {
  it("allows any authenticated user when no roles are required", () => {
    const { ctx, guard } = makeContext(memberAuth, undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("allows owner on an owner-only route", () => {
    const { ctx, guard } = makeContext(ownerAuth, ["owner"]);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("blocks member on an owner-only route", () => {
    const { ctx, guard } = makeContext(memberAuth, ["owner"]);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("blocks a user with no active membership", () => {
    const { ctx, guard } = makeContext(
      { ...ownerAuth, member: null },
      ["owner"]
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
