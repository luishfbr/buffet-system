import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { createAuth } from "@buffet/auth";
import { type Database } from "@buffet/db";
import { DB } from "../database/database.module.js";
import { AUTH } from "./auth.constants.js";
import { AuthController } from "./auth.controller.js";
import { AuthGuard } from "./auth.guard.js";
import { RolesGuard } from "./roles.guard.js";

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
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH,
      inject: [DB],
      useFactory: (db: Database) =>
        createAuth({
          db,
          secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret",
          baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3333",
          trustedOrigins: (process.env.TRUSTED_ORIGINS ?? "http://localhost:3000")
            .split(",")
            .map((o) => o.trim()),
        }),
    },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AUTH],
})
export class AuthModule {}
