"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { isUnauthorized, useWorkspace } from "@/lib/workspace";
import { api } from "@/lib/api";
import type { Item, Package } from "@/lib/types";
import {
  catalogCounts,
  catalogPercent,
  isOnboardedLocally,
  markOnboardedLocally,
} from "@/lib/onboarding";
import {
  OnboardingStepper,
  type OnboardingStep,
} from "@/components/onboarding/onboarding-stepper";
import { OrgStep } from "@/components/onboarding/org-step";
import { CatalogStep } from "@/components/onboarding/catalog-step";
import { PackagesStep } from "@/components/onboarding/packages-step";
import { PublicPreview } from "@/components/onboarding/public-preview";
import { FinishStep } from "@/components/onboarding/finish-step";

const STEPS: readonly OnboardingStep[] = [
  { key: "org", label: "Organização" },
  { key: "dish", label: "Pratos" },
  { key: "drink", label: "Bebidas" },
  { key: "service", label: "Serviços" },
  { key: "packages", label: "Pacotes" },
];
const FINISH_INDEX = STEPS.length; // 5 — tela de conclusão

/** Boundary exigido pelo App Router para o `useSearchParams` do `?novo=1`. */
export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingView />
    </Suspense>
  );
}

function OnboardingView() {
  const router = useRouter();
  const {
    workspace,
    loading: workspaceLoading,
    error: workspaceError,
  } = useWorkspace();
  // `?novo=1` vem do seletor de organização: quem já tem um buffet e quer
  // montar outro. Sem isso, o gate abaixo devolveria essa pessoa ao painel.
  const wantsNewOrg = useSearchParams().get("novo") === "1";

  const [org, setOrg] = useState<{
    id: string;
    name: string;
    slug: string;
  } | null>(null);
  const [draft, setDraft] = useState({ name: "", slug: "" });
  const [items, setItems] = useState<Item[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const initRef = useRef(false);

  // Guarda de sessão (espelha o dashboard): só o 401 do servidor manda para o
  // login — ver o comentário em `lib/workspace.ts` sobre o átomo obsoleto.
  useEffect(() => {
    if (isUnauthorized(workspaceError)) router.replace("/login");
  }, [workspaceError, router]);

  // Bootstrap único: decide o passo inicial e retoma o catálogo já existente.
  const bootstrap = useCallback(async () => {
    if (!workspace) return;
    const activeOrg = workspace.organizations.find(
      (o) => o.id === workspace.activeOrganizationId
    );

    if (!activeOrg || wantsNewOrg) {
      // Quem chegou aqui sem buffet mas com convite esperando não deveria estar
      // montando um buffet — é o caso do funcionário no primeiro acesso.
      if (!activeOrg && workspace.invitations.length > 0) {
        router.replace("/convites");
        return;
      }
      // Começa pela criação (passo 1).
      setStepIndex(0);
      setReady(true);
      return;
    }

    setOrg({ id: activeOrg.id, name: activeOrg.name, slug: activeOrg.slug });
    const [its, pkgs] = await Promise.all([
      api.get<Item[]>("/items?includeInactive=true"),
      api.get<Package[]>("/packages?includeInactive=true"),
    ]).catch(() => [[], []] as [Item[], Package[]]);
    // Gate: já configurada (concluiu antes, ou já tem qualquer registro de
    // catálogo — itens ou pacotes) → painel. Basta um produto/serviço para
    // considerar o buffet configurado e não reexibir o onboarding.
    if (isOnboardedLocally(activeOrg.id) || its.length > 0 || pkgs.length > 0) {
      router.replace("/dashboard");
      return;
    }
    setItems(its);
    setPackages(pkgs);
    setStepIndex(1); // pula a criação da organização
    setReady(true);
  }, [workspace, wantsNewOrg, router]);

  useEffect(() => {
    if (workspaceLoading || !workspace || initRef.current) return;
    initRef.current = true;
    void bootstrap();
  }, [workspaceLoading, workspace, bootstrap]);

  // Mantém o preview vivo durante a criação da org (passo 1).
  const previewName = org?.name || draft.name;
  const previewSlug = org?.slug || draft.slug;
  const percent = catalogPercent(catalogCounts(items, packages));

  function goToFinish() {
    // `org.id` e não o do workspace: ao criar um segundo buffet, o buffet que
    // acabou de ser configurado é o recém-criado, não o que estava ativo.
    if (org) markOnboardedLocally(org.id);
    setStepIndex(FINISH_INDEX);
  }

  if (!ready) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-screen items-center justify-center text-muted-foreground"
      >
        Carregando...
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link
            href="/"
            translate="no"
            className="flex items-center gap-2 rounded-sm font-display text-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-sm text-brand-foreground"
              aria-hidden="true"
            >
              B
            </span>
            Buffet System
          </Link>
          {stepIndex < FINISH_INDEX && (
            <span className="font-mono text-xs text-muted-foreground">
              Passo {stepIndex + 1} de {STEPS.length}
            </span>
          )}
        </div>
      </header>

      {stepIndex === FINISH_INDEX ? (
        <FinishStep
          orgName={previewName || "seu buffet"}
          slug={previewSlug}
          percent={percent}
          // Documento novo, como na troca pelo seletor: a organização ativa
          // mudou no servidor e o painel precisa subir inteiro nela (RNF05).
          onGoDashboard={() => window.location.assign("/dashboard")}
        />
      ) : (
        <div className="mx-auto grid max-w-5xl gap-8 px-6 py-8 lg:grid-cols-[1fr_360px]">
          <section className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <OnboardingStepper steps={STEPS} currentIndex={stepIndex} />
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono uppercase tracking-widest text-muted-foreground">
                    Catálogo configurado
                  </span>
                  <span className="font-mono font-semibold text-brand">
                    {percent}%
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary"
                  role="progressbar"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Catálogo configurado"
                >
                  <div
                    className="h-full rounded-full bg-brand transition-[width] duration-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            </div>

            {stepIndex === 0 && (
              <OrgStep
                onDraftChange={setDraft}
                onCreated={(created) => {
                  setOrg(created);
                  setStepIndex(1);
                }}
              />
            )}
            {stepIndex === 1 && (
              <CatalogStep
                type="dish"
                title="Pratos"
                description="Cadastre os pratos do cardápio com categoria e preço base."
                items={items.filter((i) => i.type === "dish")}
                onAdd={(item) => setItems((prev) => [...prev, item])}
                onRemove={(id) =>
                  setItems((prev) => prev.filter((i) => i.id !== id))
                }
                onNext={() => setStepIndex(2)}
              />
            )}
            {stepIndex === 2 && (
              <CatalogStep
                type="drink"
                title="Bebidas"
                description="Adicione bebidas alcoólicas e não alcoólicas com preço base."
                items={items.filter((i) => i.type === "drink")}
                onAdd={(item) => setItems((prev) => [...prev, item])}
                onRemove={(id) =>
                  setItems((prev) => prev.filter((i) => i.id !== id))
                }
                onBack={() => setStepIndex(1)}
                onNext={() => setStepIndex(3)}
              />
            )}
            {stepIndex === 3 && (
              <CatalogStep
                type="service"
                title="Serviços"
                description="Serviços adicionais como garçom, decoração ou DJ."
                items={items.filter((i) => i.type === "service")}
                onAdd={(item) => setItems((prev) => [...prev, item])}
                onRemove={(id) =>
                  setItems((prev) => prev.filter((i) => i.id !== id))
                }
                onBack={() => setStepIndex(2)}
                onNext={() => setStepIndex(4)}
              />
            )}
            {stepIndex === 4 && (
              <PackagesStep
                packages={packages}
                items={items}
                onAdd={(pkg) => setPackages((prev) => [...prev, pkg])}
                onRemove={(id) =>
                  setPackages((prev) => prev.filter((p) => p.id !== id))
                }
                onBack={() => setStepIndex(3)}
                onFinish={goToFinish}
              />
            )}
          </section>

          <aside className="lg:sticky lg:top-8 lg:self-start">
            <PublicPreview
              orgName={previewName}
              slug={previewSlug}
              items={items}
              packages={packages}
            />
          </aside>
        </div>
      )}
    </main>
  );
}
