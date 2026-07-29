/**
 * Escolha da organização ativa de uma **nova sessão** (RNF05).
 *
 * Um usuário pode ser dono de um buffet e funcionário de outro; sem preferência
 * persistida, o login sempre reabriria no vínculo mais antigo e ele teria que
 * trocar de organização toda vez. `user.lastOrganizationId` guarda a última
 * escolha do seletor do painel — mas ela **não é confiável sozinha**: o vínculo
 * pode ter sido removido desde então (funcionário demitido). Por isso a
 * preferência só vale quando ainda existe a associação correspondente.
 */
export function pickActiveOrganizationId(
  /** Vínculos do usuário, **do mais antigo para o mais novo**. */
  memberships: readonly { organizationId: string }[],
  lastOrganizationId: string | null | undefined
): string | null {
  if (
    lastOrganizationId &&
    memberships.some((m) => m.organizationId === lastOrganizationId)
  ) {
    return lastOrganizationId;
  }
  return memberships[0]?.organizationId ?? null;
}
