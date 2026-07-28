import { describe, it, expect } from "vitest";
import type { Workspace, WorkspaceInvitation } from "@buffet/shared";
import { ApiError } from "./api";
import { isUnauthorized, resolveEntryRoute, safeNextPath } from "./workspace";

const invitation: WorkspaceInvitation = {
  id: "inv-1",
  organizationId: "org-1",
  organizationName: "Casa Bela",
  role: "member",
  inviterName: "Maria",
  expiresAt: "2026-08-01T12:00:00.000Z",
};

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  user: { id: "user-1", name: "Luis", email: "luis@teste.com" },
  activeOrganizationId: null,
  organizations: [],
  invitations: [],
  ...over,
});

describe("resolveEntryRoute", () => {
  it("manda para o painel quem tem organização ativa", () => {
    expect(
      resolveEntryRoute(workspace({ activeOrganizationId: "org-1" }))
    ).toBe("/dashboard");
  });

  it("manda para os convites quem ainda não tem buffet mas foi convidado", () => {
    expect(resolveEntryRoute(workspace({ invitations: [invitation] }))).toBe(
      "/convites"
    );
  });

  it("manda para o onboarding quem não tem buffet nem convite", () => {
    expect(resolveEntryRoute(workspace())).toBe("/onboarding");
  });

  // Um funcionário do buffet A pode ter sido convidado para o B: o convite
  // espera no seletor, não interrompe a entrada.
  it("prioriza a organização ativa sobre o convite pendente", () => {
    expect(
      resolveEntryRoute(
        workspace({ activeOrganizationId: "org-1", invitations: [invitation] })
      )
    ).toBe("/dashboard");
  });
});

describe("isUnauthorized", () => {
  it("reconhece o 401 do servidor", () => {
    expect(isUnauthorized(new ApiError(401, "Não autenticado"))).toBe(true);
  });

  // O bug que isto existe para impedir: depois de um signOut, o átomo do
  // Better-Auth devolve `null` sem erro nenhum. Tratar "vazio" como "deslogado"
  // fazia o segundo login voltar direto para /login.
  it("não confunde ausência de dado com sessão inválida", () => {
    expect(isUnauthorized(null)).toBe(false);
    expect(isUnauthorized(undefined)).toBe(false);
  });

  // Falha de rede rejeita como TypeError e o servidor nunca respondeu — mandar
  // para o login aqui deslogaria alguém só por causa de um wi-fi ruim.
  it("não trata falha de rede como sessão inválida", () => {
    expect(isUnauthorized(new TypeError("Failed to fetch"))).toBe(false);
  });

  it("não trata outros erros da API como sessão inválida", () => {
    expect(isUnauthorized(new ApiError(403, "Sem permissão"))).toBe(false);
    expect(isUnauthorized(new ApiError(500, "Erro interno"))).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("aceita caminho relativo", () => {
    expect(safeNextPath("/invite/abc")).toBe("/invite/abc");
  });

  it("recusa ausência de valor", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath("")).toBeNull();
  });

  // Redirecionamento aberto: o login viraria trampolim para phishing.
  it("recusa destino externo", () => {
    expect(safeNextPath("https://evil.com")).toBeNull();
    expect(safeNextPath("//evil.com")).toBeNull();
    expect(safeNextPath("javascript:alert(1)")).toBeNull();
  });
});
