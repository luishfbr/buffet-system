import { Controller, Get } from "@nestjs/common";
import type {
  DashboardBadges,
  DashboardSummary,
  MemberRole,
} from "@buffet/shared";
import { ActiveOrg, CurrentRole } from "../auth/current-user.decorator.js";
import { DashboardService } from "./dashboard.service.js";

/**
 * Painel operacional (RF29/RF30). É uma *view* agregada, não um recurso — daí
 * o nome no singular, como em `finance`.
 *
 * Módulo próprio (e não uma rota dentro de `finance`) porque o
 * `FinanceController` é `@Roles("owner")` na classe inteira e a home também
 * precisa servir `member`. O recorte por papel acontece no service (RNF04).
 */
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("summary")
  summary(
    @ActiveOrg() orgId: string,
    @CurrentRole() role: MemberRole
  ): Promise<DashboardSummary> {
    return this.dashboard.summary(orgId, role);
  }

  @Get("badges")
  badges(
    @ActiveOrg() orgId: string,
    @CurrentRole() role: MemberRole
  ): Promise<DashboardBadges> {
    return this.dashboard.badges(orgId, role);
  }
}
