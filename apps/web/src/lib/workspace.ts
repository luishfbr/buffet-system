"use client";

import { useCallback, useEffect, useState } from "react";
import type { Workspace } from "@buffet/shared";
import { api, ApiError } from "./api";

/** Destinos possíveis de entrada no app. */
export type EntryRoute = "/dashboard" | "/convites" | "/onboarding";

/**
 * Para onde mandar quem acabou de entrar (ou abriu o painel direto).
 *
 * Um usuário pode ser dono de um buffet **e** funcionário de outro, então "tem
 * organização" e "foi convidado" não são estados exclusivos — a ordem aqui é o
 * que importa: quem já tem um buffet ativo vai para o painel e vê os convites
 * pendentes no seletor, sem ser interrompido.
 */
export function resolveEntryRoute(workspace: Workspace): EntryRoute {
  if (workspace.activeOrganizationId) return "/dashboard";
  if (workspace.invitations.length > 0) return "/convites";
  return "/onboarding";
}

/**
 * Normaliza o `?next=` das telas de entrada. Só aceita caminho **relativo à
 * própria origem**: sem isto, `/login?next=https://…` transformaria o login num
 * redirecionador aberto para phishing.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

/**
 * Carrega o workspace do usuário (`GET /me/workspace`) — a **verdade do
 * servidor** sobre quem está logado, seus buffets e seus convites.
 *
 * Deliberadamente um `fetch` comum, e não os hooks do client do Better-Auth.
 * `useSession()` e `useActiveOrganization()` são átomos nanostores **singletons
 * de módulo** que (better-auth 1.6.23) devolvem o valor atual de forma síncrona
 * no primeiro render e só buscam de novo num `setTimeout(0)` depois de montar.
 * Um `signOut` deixa o átomo em `{ data: null, isPending: false }` e nada o
 * reseta — então o render seguinte ao **segundo** login lia "não logado" antes
 * de qualquer requisição sair. Aqui não há valor herdado: ou a resposta chegou,
 * ou `loading` ainda é `true`.
 */
export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setWorkspace(await api.get<Workspace>("/me/workspace"));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { workspace, loading, error, reload: load };
}

/**
 * O servidor recusou a sessão. **É o único sinal confiável de "não logado"** —
 * um cookie ausente ou expirado responde 401 no `/me/workspace`, enquanto o
 * átomo do client pode dizer `null` só por estar desatualizado. Nunca mande
 * ninguém ao login por causa de um estado de cliente vazio.
 */
export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/**
 * Troca a organização ativa e recarrega o painel **com um documento novo**.
 *
 * O reload completo é intencional. O app não tem store global, o `load()` de
 * cada página roda só na montagem, as preferências de sidebar são chaveadas por
 * `orgId` e os átomos do Better-Auth são singletons de módulo — uma navegação
 * client-side deixaria dado do buffet anterior na tela, que é exatamente o que
 * o isolamento por organização não pode permitir (RNF05).
 */
export async function switchOrganization(
  organizationId: string
): Promise<void> {
  await setActiveOrganization(organizationId);
  window.location.assign("/dashboard");
}

/**
 * Só ativa a organização, sem recarregar. Para fluxos que continuam na mesma
 * tela depois de trocar (o stepper do onboarding, ao criar um segundo buffet).
 */
export async function setActiveOrganization(
  organizationId: string
): Promise<void> {
  await api.post("/me/active-organization", { organizationId });
}
