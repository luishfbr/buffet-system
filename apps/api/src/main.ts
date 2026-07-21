import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  // The Next.js web app is the only trusted browser origin; credentials are
  // required so Better-Auth session cookies flow across the api <-> web split.
  const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim());
  app.enableCors({ origin: trustedOrigins, credentials: true });

  // Validation is handled per-route via Zod pipes (see @buffet/shared DTOs).

  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port);
  console.log(`[api] listening on http://localhost:${port}`);
}

void bootstrap();
