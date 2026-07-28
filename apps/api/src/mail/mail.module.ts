import { Global, Module } from "@nestjs/common";
import { MailerService } from "./mail.service.js";

// @Global: o mailer é usado pelo factory do Better-Auth (reset de senha e
// convite) e pelo endpoint público (aviso de novo lead), sem reimportar o
// módulo — mesmo padrão do UploadsModule.
@Global()
@Module({
  providers: [MailerService],
  exports: [MailerService],
})
export class MailModule {}
