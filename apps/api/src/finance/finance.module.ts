import { Module } from "@nestjs/common";
import { FinanceController } from "./finance.controller.js";
import { FinanceService } from "./finance.service.js";

// Exporta o service porque o DashboardModule reusa `FinanceService.totals()`
// (mesmo precedente do PublicModule, que exporta o PublicService).
@Module({
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
