import { Module } from "@nestjs/common";
import { PublicController } from "./public.controller.js";
import { PublicService } from "./public.service.js";

@Module({
  controllers: [PublicController],
  providers: [PublicService],
  // O editor da página (page-settings) reusa o mesmo builder para a prévia —
  // é o que garante que prévia e página pública nunca divirjam.
  exports: [PublicService],
})
export class PublicModule {}
