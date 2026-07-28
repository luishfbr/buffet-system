"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { setActiveOrganization } from "@/lib/workspace";
import { slugify, randomSuffix } from "@/lib/slug";
import { appHost } from "@/lib/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";

// Passo 1 do onboarding — cria a organização (RF00). O criador vira `owner`
// e o slug gera a URL pública (RF17), prevista ao vivo enquanto se digita.

export function OrgStep({
  onDraftChange,
  onCreated,
}: {
  onDraftChange: (draft: { name: string; slug: string }) => void;
  onCreated: (org: { id: string; name: string; slug: string }) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [editingSlug, setEditingSlug] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const effectiveSlug = slugEdited ? slug : slugify(name);

  function handleName(value: string) {
    setName(value);
    const nextSlug = slugEdited ? slug : slugify(value);
    onDraftChange({ name: value, slug: nextSlug });
  }

  function handleSlug(value: string) {
    const clean = slugify(value);
    setSlug(clean);
    setSlugEdited(true);
    onDraftChange({ name, slug: clean });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      let orgSlug = effectiveSlug || `buffet-${randomSuffix()}`;
      // O criador vira `owner` automaticamente (RF00).
      let created = await authClient.organization.create({
        name,
        slug: orgSlug,
      });
      if (created.error) {
        // Provável colisão de slug — retry único com sufixo aleatório.
        orgSlug = `${orgSlug}-${randomSuffix()}`;
        created = await authClient.organization.create({
          name,
          slug: orgSlug,
        });
        if (created.error) throw new Error(created.error.message);
      }
      // Pela API (e não por `organization.setActive`) para o buffet recém-criado
      // também virar o "último usado" e ser o que reabre no próximo login.
      await setActiveOrganization(created.data!.id);
      onCreated({ id: created.data!.id, name, slug: orgSlug });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao criar organização"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-balance">
          Vamos criar seu buffet
        </h1>
        <p className="mt-1.5 text-muted-foreground">
          Comece pelo nome. Você vira o proprietário e ganha um endereço público
          próprio para receber orçamentos.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="orgName">Nome do buffet</Label>
          <Input
            id="orgName"
            name="organization"
            autoComplete="organization"
            value={name}
            onChange={(e) => handleName(e.target.value)}
            placeholder="Villa Eventos"
            required
          />
        </div>

        {/* Endereço público previsto ao vivo (RF17). */}
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-4">
          <span className="font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
            Endereço da sua página
          </span>
          <p className="font-mono text-sm break-all">
            <span className="text-muted-foreground">{appHost()}/</span>
            <span className="font-semibold text-brand">
              {effectiveSlug || "seu-buffet"}
            </span>
          </p>
          {editingSlug ? (
            <div className="mt-1 flex flex-col gap-2">
              <Label htmlFor="orgSlug" className="text-xs">
                Personalizar endereço
              </Label>
              <Input
                id="orgSlug"
                name="slug"
                autoComplete="off"
                spellCheck={false}
                value={effectiveSlug}
                onChange={(e) => handleSlug(e.target.value)}
                placeholder="villa-eventos"
                aria-describedby="slug-hint"
              />
              <span id="slug-hint" className="text-xs text-muted-foreground">
                Apenas letras minúsculas, números e hífens.
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingSlug(true)}
              className="mt-0.5 self-start rounded-sm text-xs font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Personalizar endereço
            </button>
          )}
        </div>

        <FormError error={error} />

        <Button
          type="submit"
          variant="brand"
          size="lg"
          className="self-start"
          disabled={saving || !name.trim()}
        >
          {saving ? "Criando..." : "Criar e continuar"}
        </Button>
      </form>
    </div>
  );
}
