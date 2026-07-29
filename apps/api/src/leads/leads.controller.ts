import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  agendaRangeSchema,
  createLeadNoteSchema,
  transitionLeadSchema,
  updateLeadSchema,
  LEAD_STATUSES,
  type AgendaRangeInput,
  type CreateLeadNoteInput,
  type MemberRole,
  type TransitionLeadInput,
  type UpdateLeadInput,
  type LeadStatus,
} from "@buffet/shared";
import {
  ActiveOrg,
  CurrentRole,
  CurrentUser,
} from "../auth/current-user.decorator.js";
import { Roles } from "../auth/auth.constants.js";
import type { AuthContext } from "../auth/auth.constants.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { LeadsService } from "./leads.service.js";

/**
 * Sales funnel / negotiation management (RF19–RF22). Shared across all members
 * of the org (no per-seller filter). All routes are org-scoped (RNF05).
 */
@Controller("leads")
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  // RF19: dynamic listing with an optional status filter and server-side search.
  @Get()
  list(
    @ActiveOrg() orgId: string,
    @Query("status") status?: string,
    @Query("q") q?: string
  ) {
    const parsed = LEAD_STATUSES.includes(status as LeadStatus)
      ? (status as LeadStatus)
      : undefined;
    return this.leads.list(orgId, parsed, q);
  }

  /**
   * RF31: eventos de um intervalo, para a agenda mensal.
   *
   * ⚠️ Declarada **antes** de `@Get(":id")` — senão "agenda" seria capturada
   * como um id. Mesma pegadinha do `@Patch("order")` em packages.controller.
   *
   * Primeiro uso do `ZodValidationPipe` fora de `@Body`: ele ignora o
   * `metadata`, então funciona igual em `@Query`.
   */
  @Get("agenda")
  agenda(
    @ActiveOrg() orgId: string,
    @Query(new ZodValidationPipe(agendaRangeSchema)) query: AgendaRangeInput
  ) {
    return this.leads.agenda(orgId, query);
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

  // RF35: histórico de interações, do mais recente ao mais antigo.
  @Get(":id/notes")
  listNotes(@ActiveOrg() orgId: string, @Param("id") id: string) {
    return this.leads.listNotes(orgId, id);
  }

  @Post(":id/notes")
  addNote(
    @ActiveOrg() orgId: string,
    @CurrentUser() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(createLeadNoteSchema)) body: CreateLeadNoteInput
  ) {
    return this.leads.addNote(orgId, id, body, {
      id: auth.user.id,
      name: auth.user.name,
    });
  }

  // Delete físico = owner-only, como no resto do sistema.
  @Roles("owner")
  @Delete(":id/notes/:noteId")
  @HttpCode(204)
  async removeNote(
    @ActiveOrg() orgId: string,
    @Param("id") id: string,
    @Param("noteId") noteId: string
  ): Promise<void> {
    await this.leads.removeNote(orgId, id, noteId);
  }

  // RF-V2-04: linha do tempo das mudanças de estado. Só leitura, para todo
  // membro — não há rota de escrita nem de exclusão (RNF-V2-05).
  @Get(":id/status-log")
  listStatusLog(@ActiveOrg() orgId: string, @Param("id") id: string) {
    return this.leads.listStatusLog(orgId, id);
  }

  /**
   * RF-V2-02: executa uma transição de estado.
   *
   * Sem `@Roles` aqui de propósito: o direito depende do **destino**, não do
   * endpoint — cancelar é do proprietário, mover para "Em Negociação" é de
   * qualquer um. O recorte fica no service, contra a tabela de transições, do
   * mesmo jeito que o `DashboardService` decide o bloco financeiro por papel.
   */
  @Post(":id/transitions")
  transition(
    @ActiveOrg() orgId: string,
    @CurrentUser() auth: AuthContext,
    @CurrentRole() role: MemberRole,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(transitionLeadSchema)) body: TransitionLeadInput
  ) {
    return this.leads.transition(
      orgId,
      id,
      body,
      { userId: auth.user.id, name: auth.user.name },
      role
    );
  }

  // Edita dados do cliente/evento. Status não passa por aqui (RF-V2-02).
  @Patch(":id")
  update(
    @ActiveOrg() orgId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateLeadSchema)) body: UpdateLeadInput
  ) {
    return this.leads.update(orgId, id, body);
  }
}
