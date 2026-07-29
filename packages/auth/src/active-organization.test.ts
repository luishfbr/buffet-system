import { describe, it, expect } from "vitest";
import { pickActiveOrganizationId } from "./active-organization.js";

const orgA = { organizationId: "org-a" };
const orgB = { organizationId: "org-b" };

describe("pickActiveOrganizationId", () => {
  it("devolve null quando o usuário não tem vínculo", () => {
    expect(pickActiveOrganizationId([], "org-a")).toBeNull();
    expect(pickActiveOrganizationId([], null)).toBeNull();
  });

  it("sem preferência, usa o vínculo mais antigo", () => {
    expect(pickActiveOrganizationId([orgA, orgB], null)).toBe("org-a");
    expect(pickActiveOrganizationId([orgA, orgB], undefined)).toBe("org-a");
  });

  it("restaura a última organização usada", () => {
    expect(pickActiveOrganizationId([orgA, orgB], "org-b")).toBe("org-b");
  });

  // Funcionário demitido: a preferência aponta para uma org da qual ele não faz
  // mais parte. Cair nela deixaria a sessão sem `member` e todo o painel em 403.
  it("ignora a preferência quando o vínculo não existe mais", () => {
    expect(pickActiveOrganizationId([orgA], "org-b")).toBe("org-a");
  });

  it("devolve null quando a preferência é o único vínculo e ele sumiu", () => {
    expect(pickActiveOrganizationId([], "org-b")).toBeNull();
  });
});
