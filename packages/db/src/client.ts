import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

/**
 * Shared Drizzle client backed by a node-postgres Pool.
 *
 * Consumed by the Nest API and by Better-Auth's drizzleAdapter. In production
 * DATABASE_URL points to Neon; locally it points to the Docker Postgres.
 */
export type Database = ReturnType<typeof createDb>;

export function createDb(connectionString: string) {
  const pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}

let _db: Database | undefined;

/** Lazily-initialized singleton using DATABASE_URL. */
export function getDb(): Database {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _db = createDb(url);
  }
  return _db;
}
