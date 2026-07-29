import { Body, Controller, Get, Param, Put } from "@nestjs/common";
import { putProposalSchema, type PutProposalInput } from "@buffet/shared";
import { ActiveOrg } from "../auth/current-user.decorator.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { ProposalsService } from "./proposals.service.js";

/**
 * Composição da proposta de uma negociação (RF-V2-09 / RF-V2-10).
 *
 * Sob `/leads/:id` porque a proposta não existe fora da negociação. Aberto a
 * qualquer member: montar proposta é o trabalho do dia a dia; o que é
 * owner-only é o financeiro que vem depois dela.
 */
@Controller("leads/:id/proposal-composition")
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  @Get()
  get(@ActiveOrg() orgId: string, @Param("id") leadId: string) {
    return this.proposals.get(orgId, leadId);
  }

  /** Substitui linhas e ajustes de uma vez — ver `ProposalsService.put`. */
  @Put()
  put(
    @ActiveOrg() orgId: string,
    @Param("id") leadId: string,
    @Body(new ZodValidationPipe(putProposalSchema)) body: PutProposalInput
  ) {
    return this.proposals.put(orgId, leadId, body);
  }
}
