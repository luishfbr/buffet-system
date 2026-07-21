import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
} from "@nestjs/common";
import {
  updateLeadSchema,
  LEAD_STATUSES,
  type UpdateLeadInput,
  type LeadStatus,
} from "@buffet/shared";
import { ActiveOrg } from "../auth/current-user.decorator.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { LeadsService } from "./leads.service.js";

/**
 * Sales funnel / negotiation management (RF19–RF22). Shared across all members
 * of the org (no per-seller filter). All routes are org-scoped (RNF05).
 */
@Controller("leads")
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  // RF19: dynamic listing with an optional status filter.
  @Get()
  list(@ActiveOrg() orgId: string, @Query("status") status?: string) {
    const parsed = LEAD_STATUSES.includes(status as LeadStatus)
      ? (status as LeadStatus)
      : undefined;
    return this.leads.list(orgId, parsed);
  }

  @Get(":id")
  getOne(@ActiveOrg() orgId: string, @Param("id") id: string) {
    return this.leads.getOne(orgId, id);
  }

  // RF22: copy-ready textual proposal for WhatsApp/Word.
  @Get(":id/proposal")
  proposal(@ActiveOrg() orgId: string, @Param("id") id: string) {
    return this.leads.proposalText(orgId, id);
  }

  // RF19/RF20: status transitions, notes/history and customer/event edits.
  @Patch(":id")
  update(
    @ActiveOrg() orgId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateLeadSchema)) body: UpdateLeadInput
  ) {
    return this.leads.update(orgId, id, body);
  }
}
