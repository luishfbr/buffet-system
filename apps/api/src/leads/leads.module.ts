import { Module } from "@nestjs/common";
import { ProposalsModule } from "../proposals/proposals.module.js";
import { LeadsController } from "./leads.controller.js";
import { LeadsService } from "./leads.service.js";

@Module({
  // O envio da proposta congela a composição numa revisão (RF-V2-05).
  imports: [ProposalsModule],
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
