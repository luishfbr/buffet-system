import { describe, expect, it, vi } from "vitest";
import { ConflictException } from "@nestjs/common";
import { ExpirationService } from "./expiration.service.js";
import type { LeadsService } from "./leads.service.js";

/**
 * Stub mínimo do Drizzle: só a cadeia que o serviço realmente encadeia
 * (`select().from().where().orderBy().limit()`) e o `execute` do advisory lock.
 */
function fakeDb(opts: {
  locked?: boolean;
  due?: Array<{ id: string; organizationId: string }>;
}) {
  const executed: string[] = [];
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => Promise.resolve(opts.due ?? []),
  };
  return {
    executed,
    db: {
      execute: (q: unknown) => {
        // O SQL renderizado não interessa; o que importa é distinguir lock de
        // unlock, e a ordem entre eles.
        const text = JSON.stringify(q);
        executed.push(text.includes("unlock") ? "unlock" : "lock");
        return Promise.resolve({ rows: [{ locked: opts.locked ?? true }] });
      },
      select: () => chain,
    },
  };
}

function make(opts: Parameters<typeof fakeDb>[0], leads: Partial<LeadsService>) {
  const { db, executed } = fakeDb(opts);
  const service = new ExpirationService(
    db as never,
    leads as LeadsService
  );
  return { service, executed };
}

describe("ExpirationService (RF-V2-08 / RNF-V2-03)", () => {
  it("expira cada proposta vencida pela máquina de estados, como sistema", async () => {
    const transition = vi.fn().mockResolvedValue(undefined);
    const { service } = make(
      {
        due: [
          { id: "lead-1", organizationId: "org-1" },
          { id: "lead-2", organizationId: "org-2" },
        ],
      },
      { transition }
    );

    expect(await service.run()).toBe(2);
    expect(transition).toHaveBeenCalledTimes(2);

    // O ator é o sistema e o papel é "system" — é o que a tabela de transições
    // exige para `proposta_enviada → expirado`.
    const [orgId, leadId, input, actor, role] = transition.mock.calls[0]!;
    expect(orgId).toBe("org-1");
    expect(leadId).toBe("lead-1");
    expect(input).toEqual({ to: "expirado" });
    expect(actor).toEqual({ userId: null, name: "Sistema" });
    expect(role).toBe("system");
  });

  /**
   * A idempotência do RNF-V2-03 vem do compare-and-swap do `transition`: a
   * segunda passada não encontra mais a negociação em `proposta_enviada`. Aqui
   * a lista já volta vazia, que é o que o SELECT faria.
   */
  it("é idempotente: nada vencido, nada a fazer, sem erro", async () => {
    const transition = vi.fn();
    const { service } = make({ due: [] }, { transition });
    expect(await service.run()).toBe(0);
    expect(transition).not.toHaveBeenCalled();
  });

  it("uma falha não derruba o ciclo — as demais continuam", async () => {
    const transition = vi
      .fn()
      .mockRejectedValueOnce(new ConflictException("mudou no meio"))
      .mockResolvedValueOnce(undefined);
    const { service } = make(
      {
        due: [
          { id: "lead-1", organizationId: "org-1" },
          { id: "lead-2", organizationId: "org-1" },
        ],
      },
      { transition }
    );

    // A primeira perdeu a corrida para um usuário; a segunda expira normalmente.
    expect(await service.run()).toBe(1);
    expect(transition).toHaveBeenCalledTimes(2);
  });

  it("sai em silêncio quando outra instância tem o lock", async () => {
    const transition = vi.fn();
    const { service, executed } = make(
      { locked: false, due: [{ id: "x", organizationId: "o" }] },
      { transition }
    );

    expect(await service.run()).toBe(0);
    expect(transition).not.toHaveBeenCalled();
    // Sem soltar um lock que nunca foi obtido.
    expect(executed).toEqual(["lock"]);
  });

  it("solta o lock mesmo se o ciclo explodir", async () => {
    const transition = vi.fn();
    const { db, executed } = fakeDb({ due: [] });
    // Faz o SELECT falhar de um jeito que o `try` não prevê.
    db.select = () => {
      throw new Error("banco fora do ar");
    };
    const service = new ExpirationService(db as never, {
      transition,
    } as unknown as LeadsService);

    await expect(service.run()).rejects.toThrow("banco fora do ar");
    // O `finally` roda: um lock preso mataria todos os ciclos seguintes.
    expect(executed).toEqual(["lock", "unlock"]);
  });
});
