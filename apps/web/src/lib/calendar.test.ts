import { describe, it, expect } from "vitest";
import {
  addMonthsUTC,
  fromISODate,
  groupByDay,
  monthGridUTC,
  startOfMonthUTC,
  toISODate,
  WEEKS_IN_GRID,
} from "./calendar";

describe("grid do mês (RF31)", () => {
  it("tem sempre 6 semanas de 7 dias — o layout não muda de altura", () => {
    for (const [year, month] of [
      [2026, 0],
      [2026, 1],
      [2026, 7],
      [2024, 1], // fevereiro bissexto
    ] as const) {
      const grid = monthGridUTC(year, month);
      expect(grid).toHaveLength(WEEKS_IN_GRID);
      for (const week of grid) expect(week).toHaveLength(7);
    }
  });

  it("começa no domingo da semana que contém o dia 1", () => {
    const grid = monthGridUTC(2026, 8); // setembro/2026 começa numa terça
    const firstCell = grid[0]![0]!;
    expect(firstCell.getUTCDay()).toBe(0);
    expect(toISODate(firstCell)).toBe("2026-08-30");
  });

  it("posiciona o dia 1 na célula certa mesmo em fuso negativo", () => {
    // O bug clássico: `new Date(y, m, 1)` em America/Sao_Paulo (UTC-3) vira
    // 03:00Z do dia anterior, jogando o dia 1 para a célula errada.
    const grid = monthGridUTC(2026, 8);
    const flat = grid.flat().map(toISODate);
    const indexOfFirst = flat.indexOf("2026-09-01");
    expect(indexOfFirst).toBeGreaterThanOrEqual(0);
    // 1º de setembro de 2026 é terça → índice 2 na primeira semana.
    expect(indexOfFirst).toBe(2);
  });

  it("cobre o mês inteiro sem buracos", () => {
    const flat = monthGridUTC(2026, 1).flat().map(toISODate); // fevereiro/2026
    for (let day = 1; day <= 28; day++) {
      expect(flat).toContain(`2026-02-${String(day).padStart(2, "0")}`);
    }
  });

  it("mantém dias consecutivos na virada de mês", () => {
    const flat = monthGridUTC(2026, 11).flat(); // dezembro/2026 → janeiro/2027
    for (let i = 1; i < flat.length; i++) {
      const diff = flat[i]!.getTime() - flat[i - 1]!.getTime();
      expect(diff).toBe(86_400_000);
    }
  });
});

describe("navegação de mês", () => {
  it("avança e volta sem estourar para o mês seguinte", () => {
    // Dia 31 é o caso que quebra implementações com setMonth().
    const jan31 = new Date(Date.UTC(2026, 0, 31));
    expect(toISODate(addMonthsUTC(jan31, 1))).toBe("2026-02-01");
  });

  it("vira o ano nas duas direções", () => {
    const dez = startOfMonthUTC(2026, 11);
    expect(toISODate(addMonthsUTC(dez, 1))).toBe("2027-01-01");
    const jan = startOfMonthUTC(2026, 0);
    expect(toISODate(addMonthsUTC(jan, -1))).toBe("2025-12-01");
  });
});

describe("conversão de data", () => {
  it("faz ida e volta em UTC", () => {
    expect(toISODate(fromISODate("2026-09-15"))).toBe("2026-09-15");
  });

  it("usa o dia UTC, não o local, para um instante no fim do dia", () => {
    // 23:30Z de 15/09 continua sendo 15/09 — em UTC-3 seria 20:30 do dia 15,
    // mas em fusos positivos um cálculo local viraria o dia.
    expect(toISODate(new Date("2026-09-15T23:30:00.000Z"))).toBe("2026-09-15");
  });
});

describe("agrupamento por dia (regra de conflito do RF21)", () => {
  it("junta eventos do mesmo dia e separa de outros dias", () => {
    const byDay = groupByDay([
      { eventDate: "2026-09-15T00:00:00.000Z", id: "a" },
      { eventDate: "2026-09-15T00:00:00.000Z", id: "b" },
      { eventDate: "2026-09-16T00:00:00.000Z", id: "c" },
    ]);

    expect(byDay.get("2026-09-15")).toHaveLength(2);
    expect(byDay.get("2026-09-16")).toHaveLength(1);
    // Mais de um evento no mesmo dia = conflito de agenda.
    expect(byDay.get("2026-09-15")!.length > 1).toBe(true);
  });

  it("agrupa pelo dia UTC mesmo com horas diferentes", () => {
    const byDay = groupByDay([
      { eventDate: "2026-09-15T00:00:00.000Z" },
      { eventDate: "2026-09-15T03:00:00.000Z" },
    ]);
    expect(byDay.size).toBe(1);
    expect(byDay.get("2026-09-15")).toHaveLength(2);
  });
});
