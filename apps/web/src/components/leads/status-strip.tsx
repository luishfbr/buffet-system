"use client";

import { Fragment, useEffect, useState } from "react";
import { Lock } from "lucide-react";
import {
  availableTransitions,
  isNegativeLeadStatus,
  isTerminalLeadStatus,
  type LeadStatus,
} from "@buffet/shared";
import { api, errorMessage } from "@/lib/api";
import { useRole } from "@/lib/use-role";
import type { LeadDetail } from "@/lib/types";
import {
  LEAD_STATUS_STYLE,
  reasonPrompt,
  statusLabel,
  terminalStatement,
  transitionVerb,
} from "@/lib/lead-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

/**
 * Faixa de estado da negociação (RF-V2-02).
 *
 * Substitui o `<select>` de status do MVP, e a diferença não é cosmética: no
 * MVP o status era um **atributo** que se escolhia e só ia para o servidor no
 * "Salvar" do formulário. Agora é um **ato** — cada botão dispara uma transição
 * na hora, validada contra a máquina de estados e registrada no log.
 *
 * Por isso a faixa não se parece com um campo de formulário: fica num bloco
 * próprio, acima dos campos, com o trilho de cor do estado na borda esquerda —
 * o mesmo trilho que o quadro usa na borda superior das colunas, girado junto
 * com o layout. Se parecesse com o resto do form, o usuário esperaria poder
 * desfazer no "Cancelar", e não pode.
 *
 * As ações saem de `availableTransitions` (`@buffet/shared`), a mesma tabela que
 * o servidor usa para decidir — o cliente nunca reimplementa a regra, só a lê.
 */
export function StatusStrip({
  leadId,
  status,
  lostReason,
  onTransitioned,
}: {
  leadId: string;
  status: LeadStatus;
  lostReason: string | null;
  /** Recebe a negociação já atualizada — o pai não precisa rebuscar. */
  onTransitioned: (lead: LeadDetail) => void;
}) {
  const { role } = useRole();
  const toast = useToast();
  const [pending, setPending] = useState<LeadStatus | null>(null);
  const [running, setRunning] = useState<LeadStatus | null>(null);

  const style = LEAD_STATUS_STYLE[status];
  // Sem papel resolvido ainda, não ofereça ação nenhuma: melhor a faixa aparecer
  // sem botões por um instante do que oferecer um que o servidor vai recusar.
  const transitions = role ? availableTransitions(status, role) : [];
  const terminal = isTerminalLeadStatus(status);

  async function run(to: LeadStatus, reason?: string) {
    setRunning(to);
    try {
      // A resposta já traz a negociação atualizada e enriquecida: usá-la evita
      // um GET redundante logo em seguida — e, mais importante, evita que um
      // refetch sobrescreva edições ainda não salvas nos campos do formulário.
      const lead = await api.post<LeadDetail>(`/leads/${leadId}/transitions`, {
        to,
        ...(reason ? { reason } : {}),
      });
      toast.success(`Negociação movida para "${statusLabel(to)}".`);
      onTransitioned(lead);
    } catch (err) {
      // Conflito de estado e falta de permissão são erros de operação, não de
      // validação de campo — vão para o toast (RNF08).
      toast.error(errorMessage(err, "Não foi possível mudar o estado."));
    } finally {
      setRunning(null);
    }
  }

  return (
    <section
      aria-label="Estado da negociação"
      className={`flex flex-col gap-3 rounded-lg border border-l-4 ${style.railLeft} bg-muted/20 px-4 py-3`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-2">
          <span
            className={`size-2 shrink-0 rounded-full ${style.dot}`}
            aria-hidden
          />
          <h3 className="font-display text-sm font-semibold tracking-tight">
            {statusLabel(status)}
          </h3>
        </div>
        {terminal && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="size-3" aria-hidden />
            Estado final
          </span>
        )}
      </div>

      {lostReason && (
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground">Motivo:</span> {lostReason}
        </p>
      )}

      {terminal ? (
        <p className="text-sm text-muted-foreground">
          {terminalStatement(status)}
        </p>
      ) : transitions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Seu perfil não permite mudar o estado desta negociação.
        </p>
      ) : (
        <div
          className="flex flex-wrap items-center gap-2"
          aria-busy={running !== null}
        >
          {transitions.map((rule, i) => {
            const negative = isNegativeLeadStatus(rule.to);
            // As saídas ficam depois de um separador: são portas para fora do
            // funil, não o próximo passo dele.
            const showSeparator =
              i > 0 && negative && !isNegativeLeadStatus(transitions[i - 1]!.to);
            return (
              <Fragment key={rule.to}>
                {showSeparator && (
                  <span
                    aria-hidden
                    className="mx-1 hidden h-5 w-px bg-border sm:block"
                  />
                )}
                <Button
                  type="button"
                  size="sm"
                  variant={negative ? "ghost" : i === 0 ? "brand" : "outline"}
                  disabled={running !== null}
                  onClick={() =>
                    rule.requiresReason ? setPending(rule.to) : run(rule.to)
                  }
                  className={
                    negative
                      ? "text-muted-foreground hover:text-destructive"
                      : undefined
                  }
                >
                  {running === rule.to
                    ? "Aplicando…"
                    : transitionVerb(status, rule.to)}
                </Button>
              </Fragment>
            );
          })}
        </div>
      )}

      <ReasonModal
        from={status}
        to={pending}
        onCancel={() => setPending(null)}
        onConfirm={(reason) => {
          if (pending) void run(pending, reason);
          setPending(null);
        }}
      />
    </section>
  );
}

/**
 * Motivo obrigatório (RF-V2-03). Generalização do antigo `LossReasonModal` do
 * quadro: a pergunta muda com o destino — "por que perdemos" e "por que
 * cancelamos" não são a mesma pergunta, e "o que mudou" (ao retomar uma
 * proposta) não é sequer negativa.
 */
function ReasonModal({
  from,
  to,
  onCancel,
  onConfirm,
}: {
  from: LeadStatus;
  to: LeadStatus | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => setReason(""), [to]);

  const prompt = reasonPrompt(from, to ?? "perdido");
  const trimmed = reason.trim();

  return (
    <Modal
      open={to !== null}
      onClose={onCancel}
      title={prompt.title}
      description="O motivo fica registrado no histórico da negociação e não pode ser editado depois."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed) onConfirm(trimmed);
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="transition-reason">{prompt.label}</Label>
          <Input
            id="transition-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={prompt.placeholder}
            maxLength={500}
            autoComplete="off"
            required
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Voltar
          </Button>
          <Button
            type="submit"
            variant={prompt.destructive ? "destructive" : "default"}
            disabled={!trimmed}
          >
            {prompt.confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
