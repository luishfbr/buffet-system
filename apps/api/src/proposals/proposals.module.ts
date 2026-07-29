import { Module } from "@nestjs/common";
import { ProposalsController } from "./proposals.controller.js";
import { ProposalsService } from "./proposals.service.js";

@Module({
  controllers: [ProposalsController],
  providers: [ProposalsService],
  // Exportado para o RF-V2-05 congelar o snapshot a partir da mesma regra.
  exports: [ProposalsService],
})
export class ProposalsModule {}
