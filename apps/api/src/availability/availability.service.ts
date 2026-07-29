import { Inject, Injectable } from "@nestjs/common";
import { eq, gte, lte } from "drizzle-orm";
import { schema, type Database } from "@buffet/db";
import {
  PUBLIC_AVAILABILITY_DAYS,
  type DateAvailabilityStatus,
  type DateAvailabilityView,
  type UpsertDateAvailabilityInput,
} from "@buffet/shared";
import { DB } from "../database/database.module.js";
import { scopedWhere } from "../common/tenant.js";

/** RNF-V2-04: janela mínima de cache do endpoint público, em ms. */
const PUBLIC_CACHE_TTL_MS = 5 * 60 * 1000;

/** Data de hoje como `YYYY-MM-DD` UTC — o mesmo vocabulário da coluna. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** `base + dias`, em `YYYY-MM-DD` UTC. */
function addDaysISO(baseISO: string, days: number): string {
  const d = new Date(`${baseISO}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Disponibilidade declarada por data (RF-V2-13 a RF-V2-15).
 *
 * Só as datas **configuradas** existem no banco; tudo o mais é `disponivel` por
 * omissão. Quem preenche as lacunas é o cliente, ao desenhar o calendário —
 * devolver 60 linhas iguais para dizer "nada mudou" seria pagar banda por nada.
 */
@Injectable()
export class AvailabilityService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Cache do endpoint público (RNF-V2-04).
   *
   * Em memória e por processo: com várias instâncias, cada uma tem a sua e uma
   * alteração pode levar até o TTL para aparecer em todas. É aceitável para
   * dado de calendário — e o alternativo (Redis) seria a primeira dependência de
   * infra do projeto para resolver um problema que ainda não existe.
   */
  private readonly publicCache = new Map<
    string,
    { data: DateAvailabilityView[]; expiresAt: number }
  >();

  /** Visão interna: inclui a observação e cobre o intervalo pedido. */
  async listForOrg(
    orgId: string,
    from: string,
    to: string
  ): Promise<DateAvailabilityView[]> {
    const rows = await this.db
      .select()
      .from(schema.dateAvailability)
      .where(
        scopedWhere(
          schema.dateAvailability,
          orgId,
          gte(schema.dateAvailability.date, from),
          lte(schema.dateAvailability.date, to)
        )
      );
    return rows.map((r) => ({
      date: r.date,
      status: r.status as DateAvailabilityStatus,
      note: r.note,
    }));
  }

  /**
   * Define o status de uma data. Upsert porque a tela pensa em "marcar esta
   * data", não em "criar ou editar" — e a PK composta já modela isso.
   *
   * Voltar para `disponivel` **apaga a linha**: o padrão não precisa de registro,
   * e guardá-lo faria o calendário acumular linhas dizendo "normal".
   */
  async upsert(
    orgId: string,
    date: string,
    input: UpsertDateAvailabilityInput
  ): Promise<DateAvailabilityView> {
    if (input.status === "disponivel" && !input.note) {
      await this.db
        .delete(schema.dateAvailability)
        .where(
          scopedWhere(
            schema.dateAvailability,
            orgId,
            eq(schema.dateAvailability.date, date)
          )
        );
      this.publicCache.delete(orgId);
      return { date, status: "disponivel", note: null };
    }

    const [row] = await this.db
      .insert(schema.dateAvailability)
      .values({
        organizationId: orgId,
        date,
        status: input.status,
        note: input.note ?? null,
      })
      .onConflictDoUpdate({
        target: [
          schema.dateAvailability.organizationId,
          schema.dateAvailability.date,
        ],
        set: {
          status: input.status,
          note: input.note ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    // RNF-V2-04: invalida na escrita, senão o portal mostraria por até 5 minutos
    // uma data que o proprietário acabou de bloquear.
    this.publicCache.delete(orgId);

    return {
      date: row!.date,
      status: row!.status as DateAvailabilityStatus,
      note: row!.note,
    };
  }

  /**
   * Visão pública (RF-V2-14): próximos 60 dias, **sem a observação interna**.
   *
   * O recorte de campos é feito aqui e não na borda: um `select` que traz `note`
   * e confia em alguém lembrar de removê-lo é um vazamento esperando acontecer.
   */
  async listPublic(orgId: string): Promise<DateAvailabilityView[]> {
    const cached = this.publicCache.get(orgId);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const from = todayISO();
    const rows = await this.db
      .select({
        date: schema.dateAvailability.date,
        status: schema.dateAvailability.status,
      })
      .from(schema.dateAvailability)
      .where(
        scopedWhere(
          schema.dateAvailability,
          orgId,
          gte(schema.dateAvailability.date, from),
          lte(schema.dateAvailability.date, addDaysISO(from, PUBLIC_AVAILABILITY_DAYS))
        )
      );

    const data = rows.map((r) => ({
      date: r.date,
      status: r.status as DateAvailabilityStatus,
    }));
    this.publicCache.set(orgId, {
      data,
      expiresAt: Date.now() + PUBLIC_CACHE_TTL_MS,
    });
    return data;
  }

  /** Segundos de cache para o header `Cache-Control` (RNF-V2-04). */
  static readonly publicCacheSeconds = PUBLIC_CACHE_TTL_MS / 1000;
}
