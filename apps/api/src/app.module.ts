import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { AppController } from "./app.controller.js";
import { DatabaseModule } from "./database/database.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { ItemsModule } from "./items/items.module.js";
import { PackagesModule } from "./packages/packages.module.js";
import { PublicModule } from "./public/public.module.js";
import { LeadsModule } from "./leads/leads.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // RNF06: baseline rate limiting (tightened per-route on the public form).
    ThrottlerModule.forRoot([
      { name: "default", ttl: 60_000, limit: 100 },
    ]),
    DatabaseModule,
    AuthModule,
    ItemsModule,
    PackagesModule,
    PublicModule,
    LeadsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
