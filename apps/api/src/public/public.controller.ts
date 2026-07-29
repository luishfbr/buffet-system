import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import {
  createPublicLeadSchema,
  type CreatePublicLeadInput,
} from "@buffet/shared";
import { Public } from "../auth/auth.constants.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AvailabilityService } from "../availability/availability.service.js";
import { PublicService } from "./public.service.js";

/**
 * The only unauthenticated surface of the system. Rate-limited per IP and
 * honeypot-protected (RNF06). All routes are @Public (skip the AuthGuard).
 */
@Public()
@UseGuards(ThrottlerGuard)
@Controller("public")
export class PublicController {
  constructor(
    private readonly publicService: PublicService,
    private readonly availability: AvailabilityService
  ) {}

  @Get("orgs/:slug")
  getOrg(@Param("slug") slug: string) {
    return this.publicService.getOrgBySlug(slug);
  }

  /**
   * RF-V2-14: calendário de disponibilidade do portal, próximos 60 dias.
   *
   * Devolve **só** `{ date, status }` — a observação da data é interna e nunca
   * atravessa esta fronteira (o recorte é feito no service, não aqui).
   *
   * `Cache-Control` além do cache do servidor (RNF-V2-04): quem chama é o
   * navegador de qualquer visitante, e a resposta é a mesma para todos eles.
   */
  @Get("orgs/:slug/availability")
  @Header(
    "Cache-Control",
    `public, max-age=${AvailabilityService.publicCacheSeconds}`
  )
  async availabilityBySlug(@Param("slug") slug: string) {
    const orgId = await this.publicService.resolveOrgIdBySlug(slug);
    return this.availability.listPublic(orgId);
  }

  // Tighter limit on the write endpoint: 5 submissions/min per IP.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("leads")
  createLead(
    @Body(new ZodValidationPipe(createPublicLeadSchema))
    body: CreatePublicLeadInput
  ) {
    return this.publicService.createLead(body);
  }
}
