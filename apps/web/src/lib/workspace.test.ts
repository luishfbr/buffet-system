import { describe, it, expect } from "vitest";
import type { Workspace, WorkspaceInvitation } from "@buffet/shared";
import { resolveEntryRoute, safeNextPath } from "./workspace";

const invitation: WorkspaceInvitation = {
  id: "inv-1",
  organizationId: "org-1",
  organizationName: "Casa Bela",
  role: "member",
  inviterName: "Maria",
  expiresAt: "2026-08-01T12:00:00.000Z",
};

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
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
