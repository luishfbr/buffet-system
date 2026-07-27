import { Module } from "@nestjs/common";
import { PublicModule } from "../public/public.module.js";
import { PageSettingsController } from "./page-settings.controller.js";
import { PageSettingsService } from "./page-settings.service.js";

@Module({
  imports: [PublicModule],
  controllers: [PageSettingsController],
  providers: [PageSettingsService],
  exports: [PageSettingsService],
})
export class PageSettingsModule {}
