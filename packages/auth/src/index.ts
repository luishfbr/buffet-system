import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, admin } from "better-auth/plugins";
import { type Database, schema, generateId } from "@buffet/db";

export interface CreateAuthConfig {
  db: Database;
  secret: string;
  /** Base URL where the Better-Auth handler is mounted (the Nest API). */
  baseURL: string;
  /** Origins allowed to call auth endpoints (e.g. the Next.js web app). */
  trustedOrigins: string[];
}

/**
 * Builds the Better-Auth instance. Instantiated inside the Nest API and mounted
 * as an HTTP handler, making the API the single source of truth for sessions
 * and roles (consumed by Nest guards and by the Next.js client).
 */
export function createAuth(config: CreateAuthConfig) {
  const options = {
    secret: config.secret,
    baseURL: config.baseURL,
    trustedOrigins: config.trustedOrigins,
    database: drizzleAdapter(config.db, {
      provider: "pg",
      schema,
    }),
    // All ids across the system are application-generated UUIDv7.
    advanced: {
      database: {
        generateId: () => generateId(),
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [
      // Multi-tenancy: self-service org creation, member = 'owner' on create.
      organization(),
      // Platform-level admin role (enabled only; no dedicated UI in MVP).
      admin(),
    ],
  } satisfies BetterAuthOptions;

  return betterAuth(options);
}

export type Auth = ReturnType<typeof createAuth>;
