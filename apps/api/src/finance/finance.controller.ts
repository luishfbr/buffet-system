import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import {
  createScheduleSchema,
  payInstallmentSchema,
  type CreateScheduleInput,
  type PayInstallmentInput,
} from "@buffet/shared";
import { ActiveOrg } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/auth.constants.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { FinanceService } from "./finance.service.js";

/**
 * Financial module (RF23/RF24). The whole controller is owner-only (RNF04):
 * members cannot touch billing data or see totals. Isolation is enforced in the
 * service by joining `leads_budgets` (RNF05).
 */
@Roles("owner")
@Controller("finance")
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  // Owner-only billing totals (a receber / recebido / próximos vencimentos).
  @Get("summary")
  summary(@ActiveOrg() orgId: string) {
    return this.finance.summary(orgId);
  }

  @Get("leads/:budgetId/payments")
  listForLead(
    @ActiveOrg() orgId: string,
    @Param("budgetId") budgetId: string
  ) {
    return this.finance.listForLead(orgId, budgetId);
  }

  // RF23: generate the installment schedule for an approved negotiation.
  @Post("leads/:budgetId/schedule")
  createSchedule(
    @ActiveOrg() orgId: string,
    @Param("budgetId") budgetId: string,
    @Body(new ZodValidationPipe(createScheduleSchema)) body: CreateScheduleInput
  ) {
    return this.finance.createSchedule(orgId, budgetId, body);
  }

  // RF24: settle an installment (paid + method + receipt link).
  @Patch("payments/:id/pay")
  pay(
    @ActiveOrg() orgId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(payInstallmentSchema)) body: PayInstallmentInput
  ) {
    return this.finance.pay(orgId, id, body);
  }

  @Delete("payments/:id")
  @HttpCode(204)
  async remove(@ActiveOrg() orgId: string, @Param("id") id: string) {
    await this.finance.remove(orgId, id);
  }
}
