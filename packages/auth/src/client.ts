import { createAuthClient } from "better-auth/react";
import { organizationClient, adminClient } from "better-auth/client/plugins";

/**
 * Better-Auth React client for the Next.js web app. Points at the Nest API
 * where the auth handler is mounted.
 */
export function createBuffetAuthClient(baseURL: string) {
  return createAuthClient({
    baseURL,
    // The web app and API are on different origins; send session cookies.
    fetchOptions: { credentials: "include" },
    plugins: [organizationClient(), adminClient()],
  });
}

export type BuffetAuthClient = ReturnType<typeof createBuffetAuthClient>;
