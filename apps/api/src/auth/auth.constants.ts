import { SetMetadata } from "@nestjs/common";
import type { Auth } from "@buffet/auth";
import type { MemberRole } from "@buffet/shared";

/** DI token for the Better-Auth instance. */
export const AUTH = Symbol("AUTH");
export type { Auth };

/** Marks a route as public (skips the global AuthGuard). */
export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts a route to the given member roles (enforced by RolesGuard). */
export const ROLES_KEY = "roles";
export const Roles = (...roles: MemberRole[]) => SetMetadata(ROLES_KEY, roles);

/** Auth context attached to each request by the AuthGuard. */
export interface AuthContext {
  user: { id: string; email: string; name: string; role: string | null };
  session: { id: string; activeOrganizationId: string | null };
  /** Active-org membership, when an organization is active. */
  member: { role: MemberRole; organizationId: string } | null;
}
