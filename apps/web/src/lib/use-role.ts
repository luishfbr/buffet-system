"use client";

import { useSession } from "@/lib/auth-client";
import { useActiveOrg } from "@/lib/use-active-org";
import type { MemberRole } from "@buffet/shared";

/** Current user's role in the active organization (owner/member). */
export function useRole(): { role: MemberRole | undefined; isOwner: boolean } {
  const { data: session } = useSession();
  const { data: activeOrg } = useActiveOrg();
  const role = activeOrg?.members?.find((m) => m.userId === session?.user.id)
    ?.role as MemberRole | undefined;
  return { role, isOwner: role === "owner" };
}
