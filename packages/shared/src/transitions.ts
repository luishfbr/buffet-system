import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type LeadStatus,
  type MemberRole,
} from "./domain.js";

/**
 * Máquina de estados da negociação (RF-V2-02).
 *
 * A tabela é **dado**, não uma cadeia de `if`s, por dois motivos:
 *
 * 1. o front precisa da mesma regra para saber quais botões mostrar no detalhe e
 *    quais colunas do quadro aceitam o drop — derivar de `LEAD_TRANSITIONS` é o
 *    que impede a regra de existir em dois lugares e divergir;
 * 2. um teste consegue afirmar a tabela inteira, incluindo o que **não** existe
 *    (estados terminais sem saída), que é a parte que costuma vazar.
 *
 * Quem executa a transição é `LeadsService.transition` — e só ele. Nenhum
 * `UPDATE` de `status` fora dali.
 */
/**
 * Quem dispara uma transição. `"system"` é o cron da expiração (RF-V2-08) — não
 * é um papel de organização, e por isso não cabe em `MemberRole`.
 *
 * Modelar o sistema como *mais um ator* (em vez de um flag `systemOnly` ao lado
 * da lista de papéis) é o que torna estados inválidos irrepresentáveis: não há
 * como escrever uma regra "só do sistema mas também do owner", nem uma regra
 * sem ator nenhum passar despercebida. A autorização vira um `includes` só.
 */
export type TransitionRole = MemberRole | "system";

export interface TransitionRule {
  /** Estado de destino. */
  readonly to: LeadStatus;
  /** Atores autorizados. `["system"]` = só o cron; a rota HTTP nunca alcança. */
  readonly roles: readonly TransitionRole[];
  /** Caminho negativo: bloqueia sem motivo preenchido (RF-V2-03). */
  readonly requiresReason: boolean;
  /**
   * Chaves dos guards de pré-condição rodados pelo service antes de gravar. Os
   * guards em si vivem na API (precisam do banco); aqui fica só o contrato.
   *
   * ⚠️ Declarar uma chave aqui **exige** a implementação correspondente no
   * registro do `LeadsService` — sem ela a transição falha em voz alta. Uma
   * chave declarada e não implementada seria pior que nenhuma: a tabela
   * afirmaria uma pré-condição que ninguém verifica.
   */
  readonly guards?: readonly TransitionGuardKey[];
}

/**
 * Vocabulário das pré-condições que dependem do banco. `revisaoAtiva` chega
 * junto com as revisões (RF-V2-11) — a chave existe aqui, mas **nenhuma regra a
 * declara ainda**, porque antes do snapshot não há o que verificar.
 */
export const TRANSITION_GUARD_KEYS = ["revisaoAtiva"] as const;
export type TransitionGuardKey = (typeof TRANSITION_GUARD_KEYS)[number];

const BOTH: readonly TransitionRole[] = ["member", "owner"];
const OWNER: readonly TransitionRole[] = ["owner"];
const SYSTEM: readonly TransitionRole[] = ["system"];

/** Cancelar é sempre owner-only e sempre exige motivo — some de todos os estados vivos. */
const cancelar: TransitionRule = {
  to: "cancelado",
  roles: OWNER,
  requiresReason: true,
};

export const LEAD_TRANSITIONS: Record<
  LeadStatus,
  readonly TransitionRule[]
> = {
  novo: [
    { to: "em_negociacao", roles: BOTH, requiresReason: false },
    cancelar,
  ],
  em_negociacao: [
    // RF-V2-11 acrescenta aqui `guards: ["revisaoAtiva"]`, junto com a
    // implementação do guard — não antes.
    { to: "proposta_enviada", roles: BOTH, requiresReason: false },
    { to: "perdido", roles: BOTH, requiresReason: true },
    cancelar,
  ],
  proposta_enviada: [
    { to: "aprovado", roles: BOTH, requiresReason: false },
    // Voltar para a mesa exige registrar o porquê: é o que explica, mais tarde,
    // por que existe uma revisão v2.
    { to: "em_negociacao", roles: BOTH, requiresReason: true },
    { to: "perdido", roles: BOTH, requiresReason: true },
    { to: "expirado", roles: SYSTEM, requiresReason: false },
    cancelar,
  ],
  aprovado: [
    { to: "fechado", roles: BOTH, requiresReason: false },
    cancelar,
  ],
  // Terminais (RF-V2-02): sem saída, para nenhum papel.
  fechado: [],
  perdido: [],
  cancelado: [],
  expirado: [],
};

export function findTransition(
  from: LeadStatus,
  to: LeadStatus
): TransitionRule | undefined {
  return LEAD_TRANSITIONS[from].find((rule) => rule.to === to);
}

/**
 * Transições que este papel pode disparar a partir do estado atual — é o que o
 * detalhe e o quadro usam para montar as ações disponíveis.
 *
 * As do sistema ficam de fora sem precisar de filtro extra: `"system"` não é um
 * `MemberRole`, então nenhum usuário jamais casa com elas.
 */
export function availableTransitions(
  from: LeadStatus,
  role: MemberRole
): readonly TransitionRule[] {
  return LEAD_TRANSITIONS[from].filter((rule) => rule.roles.includes(role));
}

/**
 * Estados terminais (RF-V2-02): **derivado** da tabela, não uma lista à parte.
 *
 * "Não tem saída" e "é terminal" precisam ser a mesma afirmação — mantidas como
 * duas listas, um estado novo sem arestas de saída ficaria fora da constante e a
 * tela o mostraria como problema de permissão em vez de estado final.
 */
export function isTerminalLeadStatus(status: LeadStatus): boolean {
  return LEAD_TRANSITIONS[status].length === 0;
}

export const TERMINAL_LEAD_STATUSES: readonly LeadStatus[] =
  LEAD_STATUSES.filter(isTerminalLeadStatus);

/** Mensagem única para transição inexistente — usada na API e reusada nos testes. */
export function invalidTransitionMessage(
  from: LeadStatus,
  to: LeadStatus
): string {
  return `Não é possível mover a negociação de "${LEAD_STATUS_LABELS[from]}" para "${LEAD_STATUS_LABELS[to]}"`;
}
