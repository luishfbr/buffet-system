import { describe, it, expect } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { pendingInvitationsWhere } from "./me.service.js";

const dialect = new PgDialect();
const NOW = new Date("2026-07-28T12:00:00.000Z");

const render = () =>
  dialect.sqlToQuery(pendingInvitationsWhere("A@Teste.com", NOW)!);

describe("pendingInvitationsWhere (RF34)", () => {
  it("compara o e-mail sem diferenciar maiúsculas", () => {
    const { sql, params } = render();
    expect(sql).toContain("lower(");
    expect(params).toContain("A@Teste.com");
  });

  it("só traz convite pendente", () => {
    const { sql, params } = render();
    expect(sql).toContain('"status"');
    expect(params).toContain("pending");
  });

  it("descarta convite vencido", () => {
    const { sql, params } = render();
    expect(sql).toContain('"expiresAt"');
    expect(sql).toContain(">");
    // O drizzle serializa o timestamp para o formato do Postgres antes de
    // mandar; interessa que o instante ("agora") virou parâmetro.
    expect(String(params.at(-1))).toContain("2026-07-28");
  });

  it("combina as três condições com AND", () => {
    const { sql } = render();
    expect(sql.match(/ and /g) ?? []).toHaveLength(2);
  });
});
