import { Module } from "@nestjs/common";
import { FinanceModule } from "../finance/finance.module.js";
import { DashboardController } from "./dashboard.controller.js";
import { DashboardService } from "./dashboard.service.js";

// Importa o FinanceModule para reusar o agregado financeiro (RF29) — o mesmo
// que serve o `GET /finance/summary`, para os dois nunca divergirem.
@Module({
  imports: [FinanceModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
