import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { and, asc, eq, lt, sql } from "drizzle-orm";
import { schema, type Database } from "@buffet/db";
import { DB } from "../database/database.module.js";
import { LeadsService, SYSTEM_ACTOR } from "./leads.service.js";

/**
 * Teto por ciclo (RNF-V2-03). O que sobrar entra no ciclo seguinte, uma hora
 * depois — uma proposta expirar com um pouco de atraso não machuca ninguém, e o
 * teto impede que um acúmulo (uma migração, um buffet grande voltando do ar)
 * vire uma transação de milhares de linhas.
 */
const BATCH_SIZE = 100;

/**
 * Chave do advisory lock. Constante arbitrária, mas **fixa**: é o que faz duas
 * instâncias da API concordarem sobre quem roda o ciclo.
 */
const LOCK_KEY = 0x62756666; // "buff"

/**
 * Expiração automática de propostas vencidas (RF-V2-08).
 *
 * Primeira infra de cron do projeto. Três decisões que valem a leitura:
 *
 * 1. **Advisory lock, não `FOR UPDATE SKIP LOCKED`.** Atrás de um load balancer
 *    há mais de uma instância, e todas acordariam na mesma hora. O lock faz uma
 *    só trabalhar; as outras saem em silêncio. `SKIP LOCKED` resolveria o
 *    problema oposto (repartir o trabalho), que aqui não existe — o lote é
 *    pequeno e a corrida real é entre ciclos, não dentro de um.
 *
 * 2. **A expiração passa pela máquina de estados**, não por um `UPDATE` direto.
 *    É o que garante log de auditoria, transação e o mesmo caminho de código que
 *    o usuário percorre. Um `UPDATE status = 'expirado'` seria três linhas mais
 *    curto e deixaria o histórico mentindo.
 *
 * 3. **Idempotência vem de graça** (RNF-V2-03): o compare-and-swap do
 *    `transition` exige `status = 'proposta_enviada'`. Uma segunda passada sobre
 *    a mesma negociação não encontra a linha e não duplica nada.
 */
@Injectable()
export class ExpirationService {
  private readonly logger = new Logger(ExpirationService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly leads: LeadsService
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron(): Promise<void> {
    await this.run();
  }

  /**
   * Exposto para teste e para um disparo manual. Devolve quantas expirou, para
   * quem chamar poder afirmar o resultado.
   */
  async run(): Promise<number> {
    // `execute` do driver `pg` devolve o QueryResult inteiro, não as linhas.
    const lock = await this.db.execute<{ locked: boolean }>(
      sql`select pg_try_advisory_lock(${LOCK_KEY}) as locked`
    );
    if (!lock.rows[0]?.locked) {
      // Outra instância está no ciclo. Não é erro nem vale log: acontece toda
      // hora, por definição.
      return 0;
    }

    try {
      const due = await this.db
        .select({
          id: schema.leadsBudgets.id,
          organizationId: schema.leadsBudgets.organizationId,
        })
        .from(schema.leadsBudgets)
        .where(
          and(
            eq(schema.leadsBudgets.status, "proposta_enviada"),
            lt(schema.leadsBudgets.validUntil, new Date())
          )
        )
        // Mais vencidas primeiro: se o lote transbordar, quem espera há mais
        // tempo sai na frente.
        .orderBy(asc(schema.leadsBudgets.validUntil))
        .limit(BATCH_SIZE);

      let expired = 0;
      for (const lead of due) {
        try {
          await this.leads.transition(
            lead.organizationId,
            lead.id,
            { to: "expirado" },
            SYSTEM_ACTOR,
            "system"
          );
          expired++;
        } catch (err) {
          /**
           * Falha **por registro**, não por ciclo: uma negociação com dado
           * inconsistente não pode segurar as outras 99. O erro vai para o log
           * da aplicação e o ciclo continua (RNF-V2-03).
           *
           * O caso esperado aqui é o 409 do compare-and-swap: um usuário aprovou
           * a proposta entre o SELECT e o UPDATE. É uma corrida legítima, e a
           * decisão do usuário ganha.
           */
          this.logger.error(
            `Falha ao expirar a negociação ${lead.id}: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
      }

      if (expired > 0 || due.length > 0) {
        this.logger.log(
          `Propostas expiradas: ${expired} de ${due.length} vencida(s)`
        );
      }
      return expired;
    } finally {
      // No `finally`: uma exceção inesperada não pode deixar o lock preso e
      // matar todos os ciclos seguintes.
      await this.db.execute(sql`select pg_advisory_unlock(${LOCK_KEY})`);
    }
  }
}
