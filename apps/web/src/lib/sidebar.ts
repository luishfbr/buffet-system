/**
 * Preferência de sidebar recolhida (modo só-ícone) do painel.
 *
 * Persistida em `localStorage` por organização, no mesmo idioma de chave do
 * `buffet:onboarded:{orgId}`: a **presença** da chave é o estado ligado, então
 * expandir remove em vez de gravar `"false"`.
 */

const collapsedKey = (orgId: string) => `buffet:sidebar-collapsed:${orgId}`;

export function isSidebarCollapsed(orgId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(collapsedKey(orgId)) !== null;
  } catch {
    return false;
  }
}

export function setSidebarCollapsed(orgId: string, collapsed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (collapsed) {
      localStorage.setItem(collapsedKey(orgId), new Date().toISOString());
    } else {
      localStorage.removeItem(collapsedKey(orgId));
    }
  } catch {
    // localStorage indisponível (modo privado) — a sidebar só não lembra a
    // preferência entre sessões.
  }
}
