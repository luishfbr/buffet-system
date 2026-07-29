import { Injectable, Logger } from "@nestjs/common";
import type { EmailContent } from "./mail.templates.js";

export interface SendMailInput extends EmailContent {
  to: string | string[];
}

export interface SendMailResult {
  ok: boolean;
  /** Driver que efetivamente tratou o envio — útil no log e nos testes. */
  driver: "resend" | "console";
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "Buffet System <onboarding@resend.dev>";

/**
 * Envio de e-mail transacional (RNF09).
 *
 * O driver é escolhido **na construção**: com `RESEND_API_KEY` envia de
 * verdade; sem ela, cai no driver console, que loga destinatário, assunto e o
 * corpo em texto — inclusive os links. É o que mantém reset de senha e convite
 * funcionando ponta a ponta em desenvolvimento sem obrigar ninguém a criar
 * conta em provedor.
 *
 * Não usa o SDK `resend`: é um POST para um endpoint e o Node 22 tem `fetch`
 * global. O SDK só se justificaria com batch/audiences.
 *
 * **`send()` nunca lança.** Falha de e-mail não pode derrubar um cadastro, um
 * convite ou — pior — a captação de um lead (RF18).
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly apiKey = process.env.RESEND_API_KEY?.trim();
  private readonly from = process.env.MAIL_FROM?.trim() || DEFAULT_FROM;

  /** Base pública do app, para montar links do painel nos e-mails. */
  readonly appUrl =
    process.env.APP_URL?.trim().replace(/\/$/, "") || "http://localhost:3000";

  private get driver(): "resend" | "console" {
    return this.apiKey ? "resend" : "console";
  }

  async send(input: SendMailInput): Promise<SendMailResult> {
    const to = Array.isArray(input.to) ? input.to : [input.to];
    if (to.length === 0) return { ok: false, driver: this.driver };

    if (this.driver === "console") {
      this.logConsole(to, input);
      return { ok: true, driver: "console" };
    }

    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to,
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        this.logger.error(
          `Falha ao enviar "${input.subject}" para ${to.join(", ")}: ${res.status} ${detail}`
        );
        return { ok: false, driver: "resend" };
      }
      return { ok: true, driver: "resend" };
    } catch (err) {
      // Rede fora, DNS, timeout: loga e segue. Quem chamou não pode quebrar.
      this.logger.error(
        `Erro de rede ao enviar "${input.subject}": ${String(err)}`
      );
      return { ok: false, driver: "resend" };
    }
  }

  /**
   * Driver de desenvolvimento: o e-mail vai para o terminal da API. O corpo em
   * texto é impresso inteiro de propósito — é dele que se copia o link de reset.
   */
  private logConsole(to: string[], input: SendMailInput): void {
    this.logger.log(
      [
        "",
        "──────────── E-MAIL (driver console) ────────────",
        `Para:     ${to.join(", ")}`,
        `De:       ${this.from}`,
        `Assunto:  ${input.subject}`,
        "",
        input.text,
        "─────────────────────────────────────────────────",
        "Defina RESEND_API_KEY no .env para enviar de verdade.",
        "",
      ].join("\n")
    );
  }
}
