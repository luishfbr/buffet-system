import {
  LEAD_STATUS_LABELS,
  isNegativeLeadStatus,
  type LeadStatus,
} from "@buffet/shared";
import type { BadgeVariant } from "@/components/ui/badge";

/**
 * Vocabulário visual e verbal dos estados da negociação (RF-V2-01/RF-V2-02).
 *
 * Existe para os mapas `Record<LeadStatus, ...>` não viverem espalhados por
 * tabela, quadro e detalhe — era o que fazia cada tela colorir e nomear o funil
 * do seu jeito. Aqui é lógica pura, testável sem DOM (convenção do `lib/`).
 */

interface StatusStyle {
  /** Trilho do topo da coluna do quadro. */
  railTop: string;
  /** O mesmo trilho, girado com o layout: borda esquerda da faixa de estado. */
  railLeft: string;
  /** Marcador na linha do tempo. */
  dot: string;
  badge: BadgeVariant;
}

/**
 * A escala de cor **é** informação: neutro em `novo`, esquentando até o âmbar da
 * marca em `aprovado` (o objetivo do funil), e assentando em tinta cheia no
 * `fechado` — que não é "mais quente" que aprovado, é arquivado.
 *
 * As três saídas ficam num registro separado de propósito: vermelho para a
 * perda, cinza administrativo para o cancelamento, vermelho desbotado para a
 * expiração, que ninguém decidiu — o relógio decidiu.
 *
 * As classes são escritas por extenso porque o Tailwind não enxerga classe
 * montada em template string.
 */
export const LEAD_STATUS_STYLE: Record<LeadStatus, StatusStyle> = {
  novo: {
    railTop: "border-t-border",
    railLeft: "border-l-border",
    dot: "bg-muted-foreground/50",
    badge: "default",
  },
  em_negociacao: {
    railTop: "border-t-brand/40",
    railLeft: "border-l-brand/40",
    dot: "bg-brand/60",
    badge: "secondary",
  },
  proposta_enviada: {
    railTop: "border-t-brand/70",
    railLeft: "border-l-brand/70",
    dot: "bg-brand/80",
    badge: "secondary",
  },
  aprovado: {
    railTop: "border-t-brand",
    railLeft: "border-l-brand",
    dot: "bg-brand",
    badge: "outline",
  },
  fechado: {
    railTop: "border-t-foreground/60",
    railLeft: "border-l-foreground/60",
    dot: "bg-foreground/70",
    badge: "outline",
  },
  perdido: {
    railTop: "border-t-destructive/60",
    railLeft: "border-l-destructive/60",
    dot: "bg-destructive/70",
    badge: "muted",
  },
  cancelado: {
    railTop: "border-t-muted-foreground/40",
    railLeft: "border-l-muted-foreground/40",
    dot: "bg-muted-foreground/40",
    badge: "muted",
  },
  expirado: {
    railTop: "border-t-destructive/30",
    railLeft: "border-l-destructive/30",
    dot: "bg-destructive/40",
    badge: "muted",
  },
};

/**
 * Rótulo de um estado, tolerante a valores fora do enum atual.
 *
 * O log de auditoria guarda o vocabulário da época — a migração da v2 gravou
 * `"formalizando"`, que não é mais um estado. A linha do tempo precisa mostrar
 * isso sem quebrar, então cai para o valor cru.
 */
export function statusLabel(status: string): string {
  return LEAD_STATUS_LABELS[status as LeadStatus] ?? status;
}

/**
 * O verbo da transição — o coração da mudança da v2.
 *
 * O `<select>` do MVP oferecia substantivos ("Proposta Enviada"), porque status
 * era um atributo que se escolhia. Agora é um ato que se comete e fica
 * registrado, então o botão diz o que vai acontecer quando for clicado.
 *
 * Alguns destinos têm verbos diferentes conforme a origem: chegar em
 * `em_negociacao` vindo de `novo` é começar a atender; vindo de
 * `proposta_enviada` é voltar atrás. São atos distintos e merecem nomes
 * distintos.
 */
const TRANSITION_VERBS: Record<string, string> = {
  "novo→em_negociacao": "Iniciar atendimento",
  "proposta_enviada→em_negociacao": "Retomar negociação",
};

const TARGET_VERBS: Record<LeadStatus, string> = {
  novo: "Voltar para novo",
  em_negociacao: "Mover para negociação",
  proposta_enviada: "Enviar proposta",
  aprovado: "Marcar como aprovado",
  fechado: "Fechar negociação",
  perdido: "Registrar perda",
  cancelado: "Cancelar negociação",
  expirado: "Expirar proposta",
};

export function transitionVerb(from: LeadStatus, to: LeadStatus): string {
  return TRANSITION_VERBS[`${from}→${to}`] ?? TARGET_VERBS[to];
}

/**
 * Copy do modal de motivo (RF-V2-03). Cada caminho negativo pergunta a coisa
 * certa: "por que perdemos" e "por que cancelamos" não são a mesma pergunta, e
 * "o que mudou" (ao retomar) não é sequer uma pergunta negativa.
 */
export interface ReasonPrompt {
  title: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  /** Ação destrutiva de verdade → botão vermelho. Retomar não é. */
  destructive: boolean;
}

export function reasonPrompt(from: LeadStatus, to: LeadStatus): ReasonPrompt {
  switch (to) {
    case "perdido":
      return {
        title: "Registrar perda",
        label: "Motivo da perda",
        placeholder: "Ex: preço acima do orçamento",
        confirmLabel: "Registrar perda",
        destructive: true,
      };
    case "cancelado":
      return {
        title: "Cancelar negociação",
        label: "Motivo do cancelamento",
        placeholder: "Ex: cadastro duplicado",
        confirmLabel: "Cancelar negociação",
        destructive: true,
      };
    default:
      return {
        title: transitionVerb(from, to),
        label: "O que mudou?",
        placeholder: "Ex: cliente pediu revisão do número de convidados",
        confirmLabel: transitionVerb(from, to),
        // Derivado, não repetido: um encerramento negativo novo já nasce com o
        // tratamento destrutivo em vez de passar por "próximo passo".
        destructive: isNegativeLeadStatus(to),
      };
  }
}

/**
 * Frase de estado terminal. Uma tela sem ações precisa dizer por que não tem
 * ações — some-las e deixar o espaço vazio faz o usuário procurar o botão.
 */
export function terminalStatement(status: LeadStatus): string {
  switch (status) {
    case "fechado":
      return "Negociação fechada. Este é um estado final — o histórico abaixo mostra o caminho até aqui.";
    case "perdido":
      return "Negociação encerrada sem conversão. Este é um estado final.";
    case "cancelado":
      return "Negociação cancelada internamente. Este é um estado final.";
    case "expirado":
      return "A proposta venceu sem resposta do cliente. Este é um estado final.";
    default:
      return "";
  }
}
