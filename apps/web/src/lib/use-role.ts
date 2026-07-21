"use client";

import { authClient, useSession } from "@/lib/auth-client";
import type { MemberRole } from "@buffet/shared";

/** Current user's role in the active organization (owner/member). */
export function useRole(): { role: MemberRole | undefined; isOwner: boolean } {
  const { data: session } = useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const role = activeOrg?.members?.find((m) => m.userId === session?.user.id)
    ?.role as MemberRole | undefined;
  return { role, isOwner: role === "owner" };
}
