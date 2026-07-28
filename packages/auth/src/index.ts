import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, admin } from "better-auth/plugins";
import { type Database, schema, generateId } from "@buffet/db";

/**
 * Porta de e-mail (RNF09). Os hooks transacionais do Better-Auth vivem aqui,
 * mas o provedor mora em `apps/api` — injetar a porta mantém `@buffet/auth`
 * agnóstico, do mesmo jeito que o `db` já é injetado. Sem isto, o pacote de
 * autenticação passaria a depender de um cliente HTTP de e-mail.
 */
export interface AuthMailPort {
  sendPasswordReset(params: {
    to: string;
    name: string;
    url: string;
  }): Promise<void>;
  sendInvitation(params: {
    to: string;
    orgName: string;
    inviterName: string | null;
    url: string;
  }): Promise<void>;
}

export interface CreateAuthConfig {
  db: Database;
  secret: string;
  /** Base URL where the Better-Auth handler is mounted (the Nest API). */
  baseURL: string;
  /** Origins allowed to call auth endpoints (e.g. the Next.js web app). */
  trustedOrigins: string[];
  /** Public base URL of the web app — builds the /invite/:id link (RF34). */
  appUrl: string;
  /** Transactional email adapter (RF33/RF34). */
  mail: AuthMailPort;
}

/** Validade do token de redefinição de senha, **em segundos** (RF33). */
const RESET_PASSWORD_TTL_SECONDS = 3600;

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
      resetPasswordTokenExpiresIn: RESET_PASSWORD_TTL_SECONDS,
      // RF33: sem este hook o Better-Auth recusa o pedido de reset com
      // "Reset password isn't enabled" — era por isso que a recuperação de
      // senha simplesmente não existia.
      sendResetPassword: async ({ user, url }) => {
        await config.mail.sendPasswordReset({
          to: user.email,
          name: user.name,
          url,
        });
      },
    },
    // Ao criar uma sessão (login incluso), define a organização ativa com a
    // primeira que o usuário pertence. Sem isto, `activeOrganizationId` fica
    // nulo após o login e o dashboard reenvia usuários já cadastrados ao
    // onboarding (RNF05 — sessão é a fonte da org ativa).
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const membership = await config.db.query.member.findFirst({
              where: (m, { eq }) => eq(m.userId, session.userId),
              orderBy: (m, { asc }) => asc(m.createdAt),
            });
            return {
              data: {
                ...session,
                activeOrganizationId: membership?.organizationId ?? null,
              },
            };
          },
        },
      },
    },
    plugins: [
      // Multi-tenancy: self-service org creation, member = 'owner' on create.
      // O convite é enviado por e-mail (RF34); o link copiável continua na tela
      // como alternativa quando o envio falha ou o driver é o console.
      organization({
        requireEmailVerificationOnInvitation: false,
        sendInvitationEmail: async (data) => {
          await config.mail.sendInvitation({
            to: data.email,
            orgName: data.organization.name,
            inviterName: data.inviter.user?.name ?? null,
            url: `${config.appUrl.replace(/\/$/, "")}/invite/${data.id}`,
          });
        },
      }),
      // Platform-level admin role (enabled only; no dedicated UI in MVP).
      admin(),
    ],
  } satisfies BetterAuthOptions;

  return betterAuth(options);
}

export type Auth = ReturnType<typeof createAuth>;
