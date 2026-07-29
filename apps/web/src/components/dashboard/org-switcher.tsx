"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Mail, Plus } from "lucide-react";
import { MEMBER_ROLE_LABELS, type Workspace } from "@buffet/shared";
import { switchOrganization } from "@/lib/workspace";
import { errorMessage } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/menu";
import { cn } from "@/lib/utils";

/**
 * Raiz do breadcrumb do painel: o nome do buffet ativo, que também troca de
 * buffet. Um usuário pode ser dono de um e funcionário de outro (RNF05).
 *
 * Quando há um buffet só e nenhum convite, vira texto puro — abrir um menu de
 * um item só seria oferecer uma escolha que não existe.
 */
export function OrgSwitcher({ workspace }: { workspace: Workspace }) {
  const router = useRouter();
  const toast = useToast();
  const [switching, setSwitching] = useState<string | null>(null);

  const active = workspace.organizations.find(
    (org) => org.id === workspace.activeOrganizationId
  );
  const name = active?.name ?? "Buffet System";
  const hasChoices =
    workspace.organizations.length > 1 || workspace.invitations.length > 0;

  if (!hasChoices) {
    return (
      <span className="truncate font-display text-lg font-semibold">
        {name}
      </span>
    );
  }

  async function handleSwitch(organizationId: string) {
    if (organizationId === workspace.activeOrganizationId) return;
    setSwitching(organizationId);
    try {
      // Recarrega o documento inteiro — ver o comentário em lib/workspace.ts.
      await switchOrganization(organizationId);
    } catch (err) {
      setSwitching(null);
      toast.error(errorMessage(err, "Não foi possível trocar de buffet."));
    }
  }

  const pending = workspace.invitations.length;

  return (
    <Menu
      // O ponto âmbar é `aria-hidden`; sem contá-lo aqui, quem usa leitor de
      // tela não saberia que há convite esperando sem abrir o menu.
      label={
        pending > 0
          ? `Buffet ativo: ${name}. Trocar de buffet. ${pending} convite(s) pendente(s)`
          : `Buffet ativo: ${name}. Trocar de buffet`
      }
      triggerClassName="-mx-2 px-2 py-1 hover:bg-accent"
      trigger={
        <>
          <span className="truncate font-display text-lg font-semibold">
            {name}
          </span>
          <ChevronDown
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          {pending > 0 && (
            // Mesmo vocabulário do badge da navegação: âmbar = tem algo seu
            // esperando. Sem isto, um convite ficaria escondido dentro do menu.
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
            />
          )}
        </>
      }
    >
      <MenuLabel>Seus buffets</MenuLabel>
      {workspace.organizations.map((org) => {
        const isActive = org.id === workspace.activeOrganizationId;
        return (
          <MenuItem
            key={org.id}
            onSelect={() => void handleSwitch(org.id)}
            disabled={switching !== null}
            aria-current={isActive ? "true" : undefined}
            className="relative pl-3.5"
          >
            {/* "Você está aqui" como um traço âmbar na borda, não um ✓: o mesmo
                sinal que a navegação lateral usa, e sobra espaço para o papel. */}
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-y-1.5 left-0 w-0.5 rounded-full",
                isActive && "bg-brand"
              )}
            />
            {/* `min-w-0`: `flex-1` sozinho não deixa o item encolher abaixo do
                conteúdo, e o `truncate` de um nome longo não valeria. */}
            <span className="min-w-0 flex-1 truncate">{org.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {switching === org.id
                ? "Trocando..."
                : MEMBER_ROLE_LABELS[org.role]}
            </span>
          </MenuItem>
        );
      })}

      <MenuSeparator />

      {pending > 0 && (
        <MenuItem onSelect={() => router.push("/convites")}>
          <Mail className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
          <span className="flex-1">
            {pending === 1
              ? "1 convite pendente"
              : `${pending} convites pendentes`}
          </span>
        </MenuItem>
      )}
      <MenuItem onSelect={() => router.push("/onboarding?novo=1")}>
        <Plus
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="flex-1">Criar novo buffet</span>
      </MenuItem>
    </Menu>
  );
}
