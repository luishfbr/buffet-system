import { describe, expect, it } from "vitest";
import { LEAD_STATUSES, LEAD_TRANSITIONS, type LeadStatus } from "@buffet/shared";
import {
  LEAD_STATUS_STYLE,
  reasonPrompt,
  statusLabel,
  terminalStatement,
  transitionVerb,
  validityLabel,
  validityStatus,
} from "./lead-status";

describe("LEAD_STATUS_STYLE", () => {
  it("cobre os oito estados", () => {
    for (const status of LEAD_STATUSES) {
      expect(LEAD_STATUS_STYLE[status]).toBeDefined();
    }
  });

  /**
   * As classes do Tailwind têm que estar escritas por extenso — o JIT varre o
   * fonte procurando a string literal e não enxerga classe montada em template.
   * Uma cor "dinâmica" passaria no typecheck e sumiria no build.
   */
  it("escreve as classes de trilho por extenso, com a direção embutida", () => {
    for (const status of LEAD_STATUSES) {
      const { railTop, railLeft, dot } = LEAD_STATUS_STYLE[status];
      expect(railTop.startsWith("border-t-")).toBe(true);
      expect(railLeft.startsWith("border-l-")).toBe(true);
      expect(dot.startsWith("bg-")).toBe(true);
      // O mesmo tom nas duas direções: quadro e detalhe falam a mesma cor.
      expect(railTop.replace("border-t-", "")).toBe(
        railLeft.replace("border-l-", "")
      );
    }
  });
});

describe("statusLabel", () => {
  it("traduz os estados atuais", () => {
    expect(statusLabel("proposta_enviada")).toBe("Proposta Enviada");
  });

  /**
   * O log de auditoria guarda o vocabulário da época: a migração da v2 gravou
   * `formalizando`, que não é mais um estado. A linha do tempo precisa exibir
   * isso sem quebrar.
   */
  it("cai para o valor cru em estados que não existem mais", () => {
    expect(statusLabel("formalizando")).toBe("formalizando");
  });
});

describe("transitionVerb", () => {
  it("usa verbo, não substantivo — a mudança é um ato", () => {
    expect(transitionVerb("em_negociacao", "proposta_enviada")).toBe(
      "Enviar proposta"
    );
    expect(transitionVerb("aprovado", "fechado")).toBe("Fechar negociação");
  });

  it("distingue o mesmo destino conforme a origem", () => {
    expect(transitionVerb("novo", "em_negociacao")).toBe("Iniciar atendimento");
    expect(transitionVerb("proposta_enviada", "em_negociacao")).toBe(
      "Retomar negociação"
    );
  });

  it("tem rótulo para toda transição que a máquina de estados permite", () => {
    for (const from of LEAD_STATUSES) {
      for (const rule of LEAD_TRANSITIONS[from]) {
        const verb = transitionVerb(from, rule.to);
        expect(verb).toBeTruthy();
        // Rótulo genérico de fallback não serve para o que o usuário clica.
        expect(verb).not.toBe(rule.to);
      }
    }
  });
});

describe("reasonPrompt", () => {
  it("pergunta a coisa certa em cada caminho", () => {
    expect(reasonPrompt("em_negociacao", "perdido").label).toBe(
      "Motivo da perda"
    );
    expect(reasonPrompt("novo", "cancelado").label).toBe(
      "Motivo do cancelamento"
    );
    // Retomar exige motivo mas não é destrutivo — botão vermelho ali seria mentira.
    const retomar = reasonPrompt("proposta_enviada", "em_negociacao");
    expect(retomar.label).toBe("O que mudou?");
    expect(retomar.destructive).toBe(false);
  });

  it("marca como destrutivo só perdido e cancelado", () => {
    expect(reasonPrompt("em_negociacao", "perdido").destructive).toBe(true);
    expect(reasonPrompt("aprovado", "cancelado").destructive).toBe(true);
  });
});

describe("terminalStatement", () => {
  it("explica cada estado final, em vez de deixar a área de ações vazia", () => {
    for (const status of [
      "fechado",
      "perdido",
      "cancelado",
      "expirado",
    ] as const) {
      expect(terminalStatement(status).length).toBeGreaterThan(0);
    }
  });

  it("não inventa frase para estado que ainda tem saída", () => {
    for (const status of [
      "novo",
      "em_negociacao",
      "proposta_enviada",
      "aprovado",
    ] as const satisfies readonly LeadStatus[]) {
      expect(terminalStatement(status)).toBe("");
    }
  });
});

describe("validityStatus / validityLabel (RF-V2-07)", () => {
  const inDays = (d: number) =>
    new Date(Date.now() + d * 86_400_000).toISOString();

  it("marca urgente abaixo de 2 dias, e só abaixo", () => {
    expect(validityStatus(inDays(3))?.urgent).toBe(false);
    // 2 dias exatos ainda não é urgente; 1,9 é.
    expect(validityStatus(inDays(1.9))?.urgent).toBe(true);
  });

  it("reconhece vencida", () => {
    expect(validityStatus(inDays(-1))?.expired).toBe(true);
    expect(validityLabel(inDays(-1))).toBe("Proposta vencida");
  });

  /**
   * `validUntil` é um instante, não uma data: contar em dias corridos até ele
   * evita dizer "vence em 1 dia" para algo que expira em 20 minutos.
   */
  it("conta dias corridos até o instante, sem arredondar para cima", () => {
    expect(validityLabel(inDays(0.5))).toBe("Vence hoje");
    expect(validityLabel(inDays(1.2))).toBe("Vence amanhã");
    expect(validityLabel(inDays(6.9))).toBe("Vence em 6 dias");
  });

  it("sem validade não produz rótulo", () => {
    expect(validityStatus(null)).toBeNull();
    expect(validityLabel(null)).toBe("");
  });
});
