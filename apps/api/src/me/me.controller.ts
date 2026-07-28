import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";
import {
  setActiveOrganizationSchema,
  type SetActiveOrganizationInput,
  type Workspace,
} from "@buffet/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthContext } from "../auth/auth.constants.js";
import { MeService } from "./me.service.js";

/**
 * Rotas do **usuário**, não de um tenant. É o único controller que não recebe
 * `@ActiveOrg()`: por definição ele atende também quem ainda não tem
 * organização nenhuma (funcionário recém-convidado), e `@ActiveOrg()` lança
 * `ForbiddenException` quando não há associação viva.
 *
 * `GET /me/workspace` é a fonte que o front usa para decidir o destino
 * pós-login — painel, aceitar convite ou criar buffet.
 */
@Controller("me")
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get("workspace")
  workspace(@CurrentUser() auth: AuthContext): Promise<Workspace> {
    return this.me.workspace(auth);
  }

  @Post("active-organization")
  setActiveOrganization(
    @CurrentUser() auth: AuthContext,
    @Req() req: Request,
    @Body(new ZodValidationPipe(setActiveOrganizationSchema))
    body: SetActiveOrganizationInput
  ): Promise<{ organizationId: string }> {
    // A troca é feita pelo Better-Auth, que precisa dos headers da requisição
    // para localizar a sessão a atualizar (mesmo caminho do AuthGuard).
    return this.me.setActiveOrganization(
      auth,
      fromNodeHeaders(req.headers),
      body.organizationId
    );
  }
}
