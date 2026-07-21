import { Global, Module } from "@nestjs/common";
import { createDb, type Database } from "@buffet/db";

/** Injection token for the shared Drizzle database instance. */
export const DB = Symbol("DB");

export type { Database };

/**
 * Provides a single Drizzle client (backed by a pg Pool) app-wide. All modules
 * inject `DB` and must scope every business query by organizationId (RNF05).
 */
@Global()
@Module({
  providers: [
    {
      provide: DB,
      useFactory: (): Database => {
        const url = process.env.DATABASE_URL;
        if (!url) throw new Error("DATABASE_URL is not set");
        return createDb(url);
      },
    },
  ],
  exports: [DB],
})
export class DatabaseModule {}
