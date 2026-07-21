import {
  Body,
  Controller,
  Get,
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
import { PublicService } from "./public.service.js";

/**
 * The only unauthenticated surface of the system. Rate-limited per IP and
 * honeypot-protected (RNF06). All routes are @Public (skip the AuthGuard).
 */
@Public()
@UseGuards(ThrottlerGuard)
@Controller("public")
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get("orgs/:slug")
  getOrg(@Param("slug") slug: string) {
    return this.publicService.getOrgBySlug(slug);
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
