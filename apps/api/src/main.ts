import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { AppModule } from "./app.module.js";
import { AUTH } from "./auth/auth.constants.js";
import type { Auth } from "@buffet/auth";

async function bootstrap() {
  // bodyParser disabled globally so Better-Auth can read the raw request on its
  // routes; JSON parsing is added afterwards for the rest of the API.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  // RNF06: atrás de proxy/load balancer, `req.ip` seria sempre o IP do proxy —
  // o throttle de 5/min do formulário público viraria um balde único
  // compartilhado por todos os visitantes de todos os buffets, em vez de um por
  // IP. `TRUST_PROXY` define quantos saltos confiar (ex.: "1" atrás de um LB).
  // Fica desligado por padrão: confiar no header sem proxy na frente deixaria o
  // cliente forjar `X-Forwarded-For` e escapar do limite.
  const trustProxy = process.env.TRUST_PROXY?.trim();
  if (trustProxy) {
    app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  }

  const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim());
  app.enableCors({ origin: trustedOrigins, credentials: true });

  // Mount the Better-Auth handler for all /api/auth/* routes (before json()).
  const auth = app.get<Auth>(AUTH);
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.all("/api/auth/*splat", toNodeHandler(auth));

  // JSON body parsing for the REST endpoints.
  app.use(express.json());

  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port);
  console.log(`[api] listening on http://localhost:${port}`);
}

void bootstrap();
