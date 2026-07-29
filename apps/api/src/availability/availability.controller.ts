import { Body, Controller, Get, Param, Put, Query } from "@nestjs/common";
import {
  upsertDateAvailabilitySchema,
  type UpsertDateAvailabilityInput,
} from "@buffet/shared";
import { ActiveOrg } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/auth.constants.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AvailabilityService } from "./availability.service.js";

/** Formato do parâmetro `date` — o mesmo CHECK que a coluna tem. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Disponibilidade de datas na visão interna (RF-V2-13/RF-V2-15).
 *
 * A rota pública correspondente vive em `public.controller` — é lá que moram
 * todas as rotas sem autenticação, e mantê-las juntas é o que faz "o que está
 * exposto" caber numa tela.
 */
@Controller("availability")
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get()
  list(
    @ActiveOrg() orgId: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    // Intervalo inválido vira intervalo vazio em vez de 500: o calendário pede
    // o mês visível, e um parâmetro torto não deve derrubar a tela.
    if (!from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to)) {
      return [];
    }
    return this.availability.listForOrg(orgId, from, to);
  }

  /** Marcar data é decisão de negócio — owner-only, como o resto da configuração. */
  @Roles("owner")
  @Put(":date")
  upsert(
    @ActiveOrg() orgId: string,
    @Param("date") date: string,
    @Body(new ZodValidationPipe(upsertDateAvailabilitySchema))
    body: UpsertDateAvailabilityInput
  ) {
    return this.availability.upsert(orgId, date, body);
  }
}
