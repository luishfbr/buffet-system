"use client";

import { useEffect, useRef } from "react";
import { authClient, useSession } from "./auth-client";

/**
 * `authClient.useActiveOrganization()` com auto-cura do cache.
 *
 * O hook do Better-Auth (1.6.23, `dist/client/query.mjs`) é um átomo nanostores
 * **singleton de módulo**: ele busca uma única vez por carregamento de página
 * (`if (!isInitialized)`) e, ao desmontar, faz `unbind` de todos os sinais. Como
 * os `atomListeners` do plugin de organização só reagem a `/sign-out` e
 * `/organization*`, um `/sign-in/email` não o redispara — sair e entrar de novo
 * sem F5 deixava o átomo travado em `{ data: null, isPending: false }`, e todo
 * consumidor passava a achar que o usuário não tem buffet nenhum.
 *
 * Aqui, quando a sessão diz que há organização ativa mas o átomo está vazio,
 * pedimos **um** refetch. O `useRef` é o que impede o laço: se o servidor
 * insistir em não devolver a organização, tentamos uma vez e paramos.
 *
 * Use este hook em vez de chamar `authClient.useActiveOrganization()` direto.
 * Para decisão de rota, prefira `useWorkspace()` (`lib/workspace.ts`), que não
 * depende de átomo nenhum.
 */
export function useActiveOrg() {
  const { data: session } = useSession();
  const result = authClient.useActiveOrganization();
  const { data: activeOrg, isPending, refetch } = result;
  const healed = useRef(false);

  const sessionOrgId = session?.session.activeOrganizationId ?? null;

  useEffect(() => {
    if (healed.current) return;
    if (isPending || activeOrg || !sessionOrgId) return;
    healed.current = true;
    refetch?.();
  }, [isPending, activeOrg, sessionOrgId, refetch]);

  return result;
}
