import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // Point at the compiled schema so relative NodeNext ".js" imports resolve;
  // run `pnpm --filter @buffet/db build` before generate/migrate.
  schema: "./dist/schema.js",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
