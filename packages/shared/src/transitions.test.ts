import { describe, expect, it } from "vitest";
import { LEAD_STATUSES, type LeadStatus, type MemberRole } from "./domain.js";
import {
  LEAD_TRANSITIONS,
  TERMINAL_LEAD_STATUSES,
  availableTransitions,
  findTransition,
  invalidTransitionMessage,
} from "./transitions.js";

/**
 * A tabela do RF-V2-02, transcrita à mão. É de propósito uma segunda cópia: se
 * alguém mexer em `LEAD_TRANSITIONS` sem passar pelo requisito, o teste quebra
 * em vez de acompanhar a mudança.
 */
const SPEC: ReadonlyArray<
  [LeadStatus, LeadStatus, readonly MemberRole[], boolean]
> = [
  ["novo", "em_negociacao", ["member", "owner"], false],
  ["novo", "cancelado", ["owner"], true],
  ["em_negociacao", "proposta_enviada", ["member", "owner"], false],
  ["em_negociacao", "perdido", ["member", "owner"], true],
  ["em_negociacao", "cancelado", ["owner"], true],
  ["proposta_enviada", "aprovado", ["member", "owner"], false],
  ["proposta_enviada", "em_negociacao", ["member", "owner"], true],
  ["proposta_enviada", "perdido", ["member", "owner"], true],
  ["proposta_enviada", "cancelado", ["owner"], true],
  ["aprovado", "fechado", ["member", "owner"], false],
  ["aprovado", "cancelado", ["owner"], true],
];

describe("LEAD_TRANSITIONS", () => {
  it.each(SPEC)(
    "%s → %s: papéis %j, motivo obrigatório %s",
    (from, to, roles, requiresReason) => {
      const rule = findTransition(from, to);
      expect(rule).toBeDefined();
      expect([...rule!.roles].sort()).toEqual([...roles].sort());
      expect(rule!.requiresReason).toBe(requiresReason);
    }
  );

  it("não permite nenhuma transição fora da tabela do RF-V2-02", () => {
    const permitidas = new Set(SPEC.map(([from, to]) => `${from}→${to}`));
    // A expiração é a única linha que não está no SPEC porque não é acionável
    // por usuário — é coberta pelo teste da expiração, abaixo.
    permitidas.add("proposta_enviada→expirado");

    const encontradas: string[] = [];
    for (const from of LEAD_STATUSES) {
      for (const rule of LEAD_TRANSITIONS[from]) {
        encontradas.push(`${from}→${rule.to}`);
      }
    }
    expect(encontradas.filter((t) => !permitidas.has(t))).toEqual([]);
    expect(encontradas.length).toBe(permitidas.size);
  });

  it.each(TERMINAL_LEAD_STATUSES)(
    "%s é terminal: nenhuma saída, para nenhum papel",
    (status) => {
      expect(LEAD_TRANSITIONS[status]).toEqual([]);
      expect(availableTransitions(status, "owner")).toEqual([]);
      expect(availableTransitions(status, "member")).toEqual([]);
    }
  );

  it("nenhuma transição aponta para si mesma", () => {
    for (const from of LEAD_STATUSES) {
      expect(LEAD_TRANSITIONS[from].map((r) => r.to)).not.toContain(from);
    }
  });

  it("todo destino é um estado conhecido e não se repete na mesma origem", () => {
    for (const from of LEAD_STATUSES) {
      const destinos = LEAD_TRANSITIONS[from].map((r) => r.to);
      for (const to of destinos) expect(LEAD_STATUSES).toContain(to);
      expect(new Set(destinos).size).toBe(destinos.length);
    }
  });
});

describe("cancelamento", () => {
  it("é sempre owner-only e sempre exige motivo", () => {
    for (const from of LEAD_STATUSES) {
      const rule = findTransition(from, "cancelado");
      if (!rule) continue;
      expect(rule.roles).toEqual(["owner"]);
      expect(rule.requiresReason).toBe(true);
    }
  });

  it("está disponível em todo estado não terminal", () => {
    const vivos = LEAD_STATUSES.filter(
      (s) => !(TERMINAL_LEAD_STATUSES as readonly LeadStatus[]).includes(s)
    );
    for (const from of vivos) {
      expect(findTransition(from, "cancelado")).toBeDefined();
    }
  });
});

describe("availableTransitions", () => {
  it("esconde do member as transições owner-only", () => {
    const destinos = availableTransitions("novo", "member").map((r) => r.to);
    expect(destinos).toEqual(["em_negociacao"]);
    expect(availableTransitions("novo", "owner").map((r) => r.to)).toEqual([
      "em_negociacao",
      "cancelado",
    ]);
  });

  it("nunca oferece a expiração, nem para o owner", () => {
    for (const role of ["member", "owner"] as const) {
      const destinos = availableTransitions("proposta_enviada", role).map(
        (r) => r.to
      );
      expect(destinos).not.toContain("expirado");
    }
  });
});

describe("expiração (RF-V2-08)", () => {
  it("só existe saindo de proposta_enviada, e só para o sistema", () => {
    const rule = findTransition("proposta_enviada", "expirado");
    expect(rule?.roles).toEqual(["system"]);

    for (const from of LEAD_STATUSES) {
      if (from === "proposta_enviada") continue;
      expect(findTransition(from, "expirado")).toBeUndefined();
    }
  });
});

describe("guards", () => {
  /**
   * A implementação vive na API (precisa do banco) e o service **falha alto** se
   * uma chave declarada aqui não tiver implementação — declarar sem implementar
   * faria a tabela afirmar uma pré-condição que ninguém verifica.
   */
  it("enviar proposta exige revisão ativa, e é a única com pré-condição", () => {
    const comGuard = LEAD_STATUSES.flatMap((from) =>
      LEAD_TRANSITIONS[from]
        .filter((r) => r.guards?.length)
        .map((r) => `${from}→${r.to}`)
    );
    expect(comGuard).toEqual(["em_negociacao→proposta_enviada"]);
    expect(findTransition("em_negociacao", "proposta_enviada")?.guards).toEqual([
      "revisaoAtiva",
    ]);
  });
});

describe("estados terminais derivados da tabela", () => {
  /**
   * `TERMINAL_LEAD_STATUSES` sai de `LEAD_TRANSITIONS`, e não de uma segunda
   * lista: "não tem saída" e "é terminal" têm que ser a mesma afirmação, senão
   * um estado novo sem arestas apareceria na tela como falta de permissão.
   */
  it("é exatamente o conjunto de estados sem arestas de saída", () => {
    expect([...TERMINAL_LEAD_STATUSES].sort()).toEqual(
      LEAD_STATUSES.filter((s) => LEAD_TRANSITIONS[s].length === 0).sort()
    );
    expect([...TERMINAL_LEAD_STATUSES].sort()).toEqual(
      ["cancelado", "expirado", "fechado", "perdido"].sort()
    );
  });
});

describe("invalidTransitionMessage", () => {
  it("usa os rótulos pt-BR, não as chaves do enum", () => {
    expect(invalidTransitionMessage("novo", "aprovado")).toBe(
      'Não é possível mover a negociação de "Novo (Lead)" para "Aprovado"'
    );
  });
});
