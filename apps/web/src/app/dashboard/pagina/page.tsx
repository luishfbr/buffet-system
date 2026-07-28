"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { FormError } from "@/components/ui/form-error";
import { deleteImage } from "@/lib/image";
import { authClient } from "@/lib/auth-client";
import { useRole } from "@/lib/use-role";
import { publicUrl } from "@/lib/onboarding";
import {
  applyPricePolicy,
  BRAND_COLORS,
  BRAND_PRESETS,
  DEFAULT_PAGE_SETTINGS,
  PAGE_COPY_FALLBACKS,
  PUBLIC_THEMES,
  PUBLIC_THEME_LABELS,
  updatePageSettingsSchema,
  type PublicPageData,
  type PublicPageSettings,
} from "@buffet/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs } from "@/components/ui/tabs";
import { ImageUpload } from "@/components/ui/image-upload";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonCards } from "@/components/ui/skeleton";
import { TemplatePicker } from "@/components/public/template-picker";
import { PagePreview } from "@/components/public/page-preview";
import { PackageShowcase } from "@/components/catalog/package-showcase";
import { cn } from "@/lib/utils";

const PANES = [
  { key: "editar", label: "Editar" },
  { key: "previa", label: "Prévia" },
] as const;

/** RF25–RF27: o proprietário desenha a página que o cliente final vê. */
export default function PublicPageEditor() {
  const { isOwner, role } = useRole();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [settings, setSettings] = useState<PublicPageSettings | null>(null);
  // Guardado para saber quais imagens ficaram órfãs depois de salvar.
  const [saved, setSaved] = useState<PublicPageSettings | null>(null);
  // Nome, pacotes e fotos da própria organização: a moldura da prévia. Só a
  // personalização vem do rascunho — o resto se edita no catálogo.
  const [page, setPage] = useState<PublicPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [pane, setPane] = useState<(typeof PANES)[number]["key"]>("editar");

  /** Só a moldura da prévia — não encosta no rascunho em edição. */
  const loadPage = useCallback(async () => {
    setPage(await api.get<PublicPageData>("/page-settings/preview"));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [data] = await Promise.all([
        api.get<PublicPageSettings>("/page-settings"),
        loadPage(),
      ]);
      setSettings(data);
      setSaved(data);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [loadPage]);

  useEffect(() => {
    if (!isOwner) return;
    void load();
  }, [isOwner, load]);

  // O editor acumula rascunho: sair sem salvar joga tudo fora sem aviso.
  const dirty =
    settings !== null && saved !== null && !sameSettings(settings, saved);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // A prévia passa pelo mesmo schema do PATCH: assim ela mostra o texto já
  // normalizado (campo vazio vira o padrão, "@perfil" perde o @) em vez de um
  // estado intermediário que o servidor nunca vai guardar.
  const previewData = useMemo<PublicPageData | null>(() => {
    if (!page || !settings) return null;
    const parsed = updatePageSettingsSchema.safeParse(settings);
    const normalized = parsed.success
      ? { ...settings, ...parsed.data }
      : settings;
    return {
      ...page,
      settings: normalized,
      packages: applyPricePolicy(page.packages, normalized.showPrices),
    };
  }, [page, settings]);

  function set<K extends keyof PublicPageSettings>(
    key: K,
    value: PublicPageSettings[K]
  ) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    setJustSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setError(null);
    setSaving(true);
    try {
      const next = await api.patch<PublicPageSettings>(
        "/page-settings",
        settings
      );
      // Só agora o banco deixou de apontar para as imagens antigas — antes
      // disso, apagar do bucket deixaria a página com foto quebrada.
      for (const key of ["logoUrl", "coverUrl"] as const) {
        const previous = saved?.[key];
        if (previous && previous !== next[key]) {
          void deleteImage(previous).catch(() => undefined);
        }
      }
      setSettings(next);
      setSaved(next);
      setJustSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  // RNF04 em profundidade: o item de nav já é owner-only, a página também.
  if (role && !isOwner) {
    return (
      <p className="text-sm text-muted-foreground">
        Apenas o proprietário pode editar a página pública.
      </p>
    );
  }

  if (loadFailed) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Não foi possível carregar a página pública"
        description="Pode ter sido uma falha de conexão. Tente de novo — nada do que você já salvou foi perdido."
        action={{ label: "Tentar de novo", onClick: () => void load() }}
      />
    );
  }

  if (loading || !settings) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <SkeletonCards count={3} className="sm:grid-cols-1" label="Carregando editor" />
        <Skeleton className="hidden h-150 w-full lg:block" />
      </div>
    );
  }

  const slug = activeOrg?.slug;
  const orgName = activeOrg?.name ?? "seu buffet";

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Página pública</h1>
          <p className="text-sm text-muted-foreground">
            É o que o cliente vê ao abrir o seu link. Personalize e salve.
          </p>
        </div>
        {slug && (
          <a
            href={publicUrl(slug)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver página
            <ExternalLink aria-hidden className="size-3.5" />
          </a>
        )}
      </header>

      {/* Até `xl` não cabem as duas colunas: vira um alternador. */}
      <Tabs
        label="Painel"
        className="xl:hidden"
        items={[...PANES]}
        value={pane}
        onChange={setPane}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]">
        <form
          onSubmit={handleSubmit}
          className={cn(
            "flex flex-col gap-6",
            pane === "previa" && "hidden xl:flex"
          )}
        >
          <Card>
            <CardHeader>
              <CardTitle>Layout</CardTitle>
              <CardDescription>
                O mesmo conteúdo, três arranjos. Escolha o que combina com o seu
                buffet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TemplatePicker
                value={settings.template}
                onChange={(template) => set("template", template)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Identidade</CardTitle>
              <CardDescription>
                Sua marca aplicada na página: logo, imagem de capa e cor.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
                <ImageUpload
                  scope="logo"
                  label="Logo"
                  hint="Quadrada fica melhor"
                  aspectClassName="aspect-square"
                  value={settings.logoUrl}
                  onChange={(url) => set("logoUrl", url)}
                />
                <ImageUpload
                  scope="cover"
                  label="Capa"
                  hint="Uma foto do salão ou de um evento"
                  value={settings.coverUrl}
                  onChange={(url) => set("coverUrl", url)}
                />
              </div>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium">
                  Cor da marca
                </legend>
                <div className="flex flex-wrap gap-2">
                  {BRAND_COLORS.map((key) => {
                    const preset = BRAND_PRESETS[key];
                    const active = settings.brandColor === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => set("brandColor", key)}
                        aria-pressed={active}
                        title={preset.label}
                        className={cn(
                          "flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active
                            ? "border-foreground/40 bg-accent font-medium"
                            : "text-muted-foreground hover:bg-accent"
                        )}
                      >
                        <span
                          aria-hidden
                          className="flex size-5 items-center justify-center rounded-full"
                          style={{ backgroundColor: preset.light.brand }}
                        >
                          {active && (
                            <Check
                              className="size-3"
                              style={{ color: preset.light.foreground }}
                            />
                          )}
                        </span>
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium">
                  Fundo da página
                </legend>
                <div className="flex gap-2">
                  {PUBLIC_THEMES.map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      onClick={() => set("theme", theme)}
                      aria-pressed={settings.theme === theme}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        settings.theme === theme
                          ? "border-foreground/40 bg-accent font-medium"
                          : "text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {PUBLIC_THEME_LABELS[theme]}
                    </button>
                  ))}
                </div>
              </fieldset>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Textos</CardTitle>
              <CardDescription>
                Deixe em branco para usar o texto padrão.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field
                id="headline"
                label="Título"
                placeholder={orgName}
                maxLength={120}
                value={settings.headline}
                onChange={(v) => set("headline", v)}
              />
              <Field
                id="subheadline"
                label="Subtítulo"
                placeholder={PAGE_COPY_FALLBACKS.subheadline}
                maxLength={200}
                value={settings.subheadline}
                onChange={(v) => set("subheadline", v)}
              />
              <div className="flex flex-col gap-2">
                <Label htmlFor="about">Sobre o buffet</Label>
                <Textarea
                  id="about"
                  rows={4}
                  maxLength={1000}
                  placeholder="Conte em poucas linhas quem vocês são e o que fazem de melhor."
                  value={settings.about ?? ""}
                  onChange={(e) => set("about", e.target.value)}
                />
              </div>
              <Field
                id="ctaLabel"
                label="Texto do botão"
                placeholder={PAGE_COPY_FALLBACKS.ctaLabel}
                maxLength={40}
                value={settings.ctaLabel}
                onChange={(v) => set("ctaLabel", v)}
              />
              <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <span className="flex flex-col">
                  <span className="text-sm font-medium">Mostrar preços</span>
                  <span className="text-xs text-muted-foreground">
                    Desligado, o cliente vê os pacotes sem o valor por convidado.
                  </span>
                </span>
                <Switch
                  checked={settings.showPrices}
                  onCheckedChange={(v) => set("showPrices", v)}
                />
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vitrine de pacotes</CardTitle>
              <CardDescription>
                A ordem e o destaque dos pacotes na página. Salva na hora.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Grava direto na API: a prévia recarrega só os pacotes, sem
                  derrubar o que ainda não foi salvo no formulário. */}
              <PackageShowcase
                onChanged={() => void loadPage().catch(() => undefined)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contato</CardTitle>
              <CardDescription>
                Aparece no rodapé da página. Preencha só o que quiser divulgar.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field
                id="whatsapp"
                label="WhatsApp"
                placeholder="(11) 90000-0000"
                inputMode="tel"
                value={settings.whatsapp}
                onChange={(v) => set("whatsapp", v)}
              />
              <Field
                id="phone"
                label="Telefone"
                placeholder="(11) 3000-0000"
                inputMode="tel"
                value={settings.phone}
                onChange={(v) => set("phone", v)}
              />
              <Field
                id="email"
                label="E-mail"
                type="email"
                placeholder="contato@seubuffet.com.br"
                value={settings.email}
                onChange={(v) => set("email", v)}
              />
              <Field
                id="instagram"
                label="Instagram"
                placeholder="@seubuffet"
                value={settings.instagram}
                onChange={(v) => set("instagram", v)}
              />
              <Field
                id="city"
                label="Cidade"
                placeholder="São Paulo, SP"
                className="sm:col-span-2"
                value={settings.city}
                onChange={(v) => set("city", v)}
              />
            </CardContent>
          </Card>

          <FormError error={error} />

          <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t bg-background/95 py-3 backdrop-blur">
            {justSaved && (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
              >
                <Check aria-hidden className="size-4" />
                Página atualizada
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSettings(saved ?? { ...DEFAULT_PAGE_SETTINGS });
                setJustSaved(false);
              }}
              disabled={saving || !dirty}
            >
              Desfazer
            </Button>
            <Button type="submit" variant="brand" disabled={saving || !dirty}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>

        {previewData && (
          <PagePreview
            data={previewData}
            className={cn(
              // Acompanha a rolagem do formulário sem sair da tela.
              "h-[70svh] xl:sticky xl:top-6 xl:h-[calc(100svh-6rem)]",
              pane === "editar" && "hidden xl:flex"
            )}
          />
        )}
      </div>
    </div>
  );
}

/** Todos os campos são escalares, então a comparação rasa basta. */
function sameSettings(a: PublicPageSettings, b: PublicPageSettings): boolean {
  return (Object.keys(a) as (keyof PublicPageSettings)[]).every(
    (key) => a[key] === b[key]
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  className,
  ...props
}: {
  id: string;
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      />
    </div>
  );
}
