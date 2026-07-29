import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { createAuth, type AuthMailPort } from "@buffet/auth";
import { type Database } from "@buffet/db";
import { DB } from "../database/database.module.js";
import { MailerService } from "../mail/mail.service.js";
import { invitationEmail, passwordResetEmail } from "../mail/mail.templates.js";
import { AUTH } from "./auth.constants.js";
import { AuthGuard } from "./auth.guard.js";
import { RolesGuard } from "./roles.guard.js";

/**
 * Adaptador da porta de e-mail do `@buffet/auth` (RNF09): traduz os hooks do
 * Better-Auth para os templates + o mailer desta app.
 */
function mailAdapter(mailer: MailerService): AuthMailPort {
  return {
    async sendPasswordReset({ to, name, url }) {
      await mailer.send({ to, ...passwordResetEmail({ name, url }) });
    },
    async sendInvitation({ to, orgName, inviterName, url }) {
      await mailer.send({
        to,
        ...invitationEmail({ orgName, inviterName, url }),
      });
    },
  };
}

/**
 * Wires Better-Auth into Nest as the single source of truth for auth.
 *
 * - `AUTH` provides the Better-Auth instance (also mounted as an HTTP handler
 *   in main.ts for the `/api/auth/*` routes).
 * - Two global guards run in order: AuthGuard (populates req.auth) then
 *   RolesGuard (enforces @Roles).
 */
@Global()
@Module({
  providers: [
    {
      provide: AUTH,
      inject: [DB, MailerService],
      useFactory: (db: Database, mailer: MailerService) =>
        createAuth({
          db,
          secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret",
          baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3333",
          trustedOrigins: (process.env.TRUSTED_ORIGINS ?? "http://localhost:3000")
            .split(",")
            .map((o) => o.trim()),
          appUrl: mailer.appUrl,
          mail: mailAdapter(mailer),
        }),
    },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AUTH],
})
export class AuthModule {}
