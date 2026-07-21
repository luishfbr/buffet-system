import { uuidv7 } from "uuidv7";

/**
 * Application-side UUIDv7 generator.
 *
 * The spec mandates UUIDv7 ids generated in the application layer. Business
 * tables use this as their Drizzle `$defaultFn`. Better-Auth is configured to
 * use the same generator so all ids across the system are time-ordered UUIDv7.
 */
export function generateId(): string {
  return uuidv7();
}
