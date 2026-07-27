# CLAUDE.md — apps/web (frontend Next.js)

Convenções do frontend. **Leia antes o [`CLAUDE.md` da raiz](../../CLAUDE.md)** — UUIDv7,
dinheiro-como-string, enums/DTOs de `@buffet/shared`, copy pt-BR e datas em UTC valem aqui e **não**
se repetem neste arquivo.

Next.js 15 (App Router, React 19), Tailwind v4, shadcn/ui ("new-york"). Todo o código sob `src/`.

## Skills de design (padrão do frontend)

Toda feature de frontend — **criar UI nova ou reformular uma existente** — usa estas duas skills
(instaladas em `.claude/skills/`, symlink de `.agents/skills/`) como padrão:

- **`frontend-design`** — **antes** de escrever a UI: direção estética, tipografia e escolhas
  visuais deliberadas (não-templatadas). Rode ao iniciar uma página/tela/componente visual.
- **`web-design-guidelines`** — **ao fechar** a UI: revisa o código contra as Web Interface
  Guidelines (acessibilidade, UX, semântica). Rode como checagem final do diff visual.

As escolhas de ambas devem respeitar o contrato existente desta app (Tailwind v4 via `@theme` em
`globals.css`, tokens oklch, shadcn "new-york", `Modal` custom) e a copy pt-BR / datas UTC da raiz.

## Estrutura

**Sem route groups `(...)`, sem `middleware.ts`, sem pasta `hooks/`** (hooks moram em `lib/`).

```
src/
  app/
    layout.tsx            RootLayout (lang pt-BR, globals.css)
    page.tsx              landing pública (/)
    login/ signup/        auth (client) — vestem o AuthShell (components/auth/)
    onboarding/           criação guiada de org pós-signup (client)
    invite/[id]/          aceitar convite de org (client)
    [slug]/page.tsx       PÚBLICO — fetch + metadata (RF17/RF18) — SERVER component
    dashboard/
      layout.tsx          guarda de auth + shell de navegação (client)
      page.tsx  catalog/  leads/  finance/  members/  pagina/
  components/{ui,auth,marketing,onboarding,catalog,leads,finance,public}/
    public/templates/     os 3 layouts da página pública (RF26)
  lib/                    api.ts · auth-client.ts · use-role.ts · types.ts · slug.ts · utils.ts ·
                          image.ts · use-package-selection.ts
```

## Client-first; server só para dados públicos

`"use client"` é o **padrão** em quase todo componente. **Server Components ficam reservados para
páginas públicas de dados** — hoje só [`app/[slug]/page.tsx`](src/app/[slug]/page.tsx), que faz o
único fetch server-side (`cache: "no-store"`, `notFound()` se a org não existe). O dashboard inteiro
é client-rendered.

Params dinâmicos do Next 15: `await params` (server) ou `use(params)` (client).

## Chamadas à API

**Um único wrapper** em [`src/lib/api.ts`](src/lib/api.ts) — `api.get/post/patch/del`. **Sem React
Query, SWR ou server actions.**

```ts
// credentials: "include" envia o cookie do Better-Auth cross-origin (web:3000 → api:3333)
const data = await api.get<Item[]>("/items?includeInactive=true");
```

- Erros viram `ApiError` (`status`, `message`, `errors?: Record<string,string[]>`).
- **Padrão de carregamento** (em toda página client): `useCallback load()` + `useEffect` + `useState`,
  com `.catch(() => setLoading(false))`:
  ```ts
  const load = useCallback(async () => {
    setLoading(true);
    const [i, p] = await Promise.all([api.get<Item[]>("/items?includeInactive=true"),
                                      api.get<Package[]>("/packages?includeInactive=true")]);
    setItems(i); setPackages(p); setLoading(false);
  }, []);
  useEffect(() => { load().catch(() => setLoading(false)); }, [load]);
  ```
- **Mutações** são handlers `async` inline que chamam `api.post/patch/del` e depois re-executam
  `load()` (ou o callback `onSaved()` do form filho). **Sem cache — toda mutação refaz o fetch.**
- Tipos de resposta ficam em [`src/lib/types.ts`](src/lib/types.ts) (datas e dinheiro como `string`).

## Auth no cliente

Singleton em [`src/lib/auth-client.ts`](src/lib/auth-client.ts)
(`createBuffetAuthClient` de `@buffet/auth/client`). Hooks: `useSession()` e
`authClient.useActiveOrganization()`.

- **Papel do usuário:** derive **sempre via `useRole()`** ([`src/lib/use-role.ts`](src/lib/use-role.ts))
  → `{ role, isOwner }`. Algumas páginas ainda reinlinam essa derivação (`activeOrg.members.find(...)`)
  — ao mexer nelas, **padronize para o hook**.
- **Proteção de rota é client-side** (não há middleware): [`dashboard/layout.tsx`](src/app/dashboard/layout.tsx)
  redireciona para `/login` se não houver sessão. Itens de nav owner-only são filtrados por um flag
  `ownerOnly`; a página Finance **também** bloqueia `member` no próprio componente (RNF04 em profundidade).
- **Signup** (`signup/page.tsx`): cria **só a conta** (`signUp.email`) e redireciona para
  `/onboarding`. A organização é criada no fluxo guiado (`app/onboarding/` + `components/onboarding/*`):
  `OrgStep` chama `organization.create({ name, slug })` (criador vira `owner`; em colisão de slug, retry
  com `randomSuffix()` de `lib/slug.ts`) → `organization.setActive`.
- **Telas de entrada** (`login/`, `signup/`, `invite/[id]/`): compartilham o `AuthShell`
  (`components/auth/auth-shell.tsx`) — split-screen com showcase escuro (`.dark`, âmbar `--brand`,
  `HeroPipeline`) à esquerda e o formulário no claro à direita. CTA usa `Button variant="brand"`.
- **Convites** (`members/page.tsx` + `invite/[id]/page.tsx`): `organization.inviteMember` gera um link
  copiável `${origin}/invite/${id}` (não envia e-mail — fora do escopo do MVP);
  `organization.acceptInvitation` + `setActive` no aceite.

## UI & estilo

- **shadcn/ui "new-york"**, subconjunto enxuto em [`src/components/ui/`](src/components/ui) — só
  `button`, `badge`, `card`, `input`, `label`, `modal`, `tabs`, `select`, `textarea`, `switch`,
  `image-upload`. Adicione primitives conforme a necessidade, no mesmo estilo.
- **Imagens** são `<img loading="lazy" decoding="async">` com `aspect-*` fixo no contêiner — o
  projeto **não usa `next/image`** (evita configurar `remotePatterns` por host). Upload é sempre pelo
  `ImageUpload`, que reduz o arquivo em canvas (`lib/image.ts`) e envia direto ao bucket.
- **`Modal` é custom** (não Radix Dialog): backdrop fixo, Escape para fechar, bottom-sheet no mobile /
  card centralizado em `sm:`. É o que dirige todos os fluxos de create/edit (via um state `modal`
  como discriminated union na página).
- `cn()` em [`src/lib/utils.ts`](src/lib/utils.ts) = `twMerge(clsx(...))`. `class-variance-authority`
  só em `button.tsx` (`buttonVariants`); `badge.tsx` usa um mapa de variantes manual.
- **Tailwind v4 sem `tailwind.config.js`** — tudo em [`globals.css`](src/app/globals.css) via `@theme`
  e tokens **oklch** (`:root` / `.dark`). Dark mode está definido mas ainda **sem toggle** de UI.
- **RNF02:** interface responsiva; a página pública `/{slug}` é priorizada para mobile.

## Formulários

- **Sem react-hook-form e sem zod resolver.** Cada form usa `useState` por campo, `handleSubmit(e)`
  manual com `e.preventDefault()`, booleans `saving`/`loading` e string `error`. Validação = HTML
  nativo (`required`, `type`, `minLength`, `inputMode`) + o `ApiError` do servidor. (Os schemas Zod
  vivem no backend, em `@buffet/shared`.)
- **Sem toast.** Feedback é inline (`<p className="text-sm text-destructive">{error}</p>`), swaps
  transitórios de label ("Copiado!" com `setTimeout`), e `confirm()`/`alert()` nativos em ações destrutivas.
- **Sem tanstack table.** Tabelas são `<table className="w-full text-sm">` simples (`thead` com
  `bg-muted/40`, linhas com `border-b`). O catálogo tem um helper genérico `CatalogTable<T>`; outras
  páginas inlinam a tabela.

## Padrões por feature (referência)

- **Catálogo** (`dashboard/catalog/` + `components/catalog/*-form.tsx`): página com abas
  (`dish|drink|service|packages`), state `modal` union abrindo o form certo no `Modal`. Forms são
  self-contained, recebem `onSaved`/`onCancel`, e decidem create-vs-edit pela presença de uma prop
  opcional (`item?`/`pkg?`).
- **Funil** (`dashboard/leads/` + `components/leads/*`): duas visões alternadas por um `Tabs`
  (segmented control) **Tabela / Kanban**, ambas com a mesma busca client-side (`useMemo`). A
  **Tabela** mantém o filtro por status (itera `LEAD_STATUSES`/`LEAD_STATUS_LABELS`); o **Kanban**
  (`lead-kanban.tsx`, `@dnd-kit/core`) tem uma coluna por status e arrasta o card para mudar o status
  via `PATCH /leads/:id { status }` (update otimista + `onChanged()`/refetch; reverte em erro). Como
  o `load()` do kanban busca **todos** os status (`/leads` sem filtro), o filtro por status fica só na
  Tabela. Arrastar para **"Perdido"** abre um `Modal` pedindo o motivo (`lostReason`) antes de
  confirmar. Clicar num card abre o mesmo `LeadDetailForm` da Tabela. `LeadDetailForm` mostra o banner
  de conflito de agenda (`conflictCount`, RF21, não bloqueia — só vem do `GET /leads/:id`), a textarea
  de notas (RF20), o botão "Copiar proposta" → clipboard (RF22), e embute o `SchedulePanel` do
  financeiro **se `isOwner`**.
- **Página pública** (`dashboard/pagina/page.tsx` + `app/[slug]/page.tsx` + `components/public/*`):
  `app/[slug]/page.tsx` só busca o payload (`cache()` do React, compartilhado com `generateMetadata`)
  e entrega ao `PublicPage` — **nenhum layout mora na rota**. `components/public/public-page.tsx` é o
  wrapper: aplica a marca sobrescrevendo `--brand`/`--brand-foreground` (de `BRAND_PRESETS` em
  `@buffet/shared`) + `.dark` + `color-scheme` no tema escuro (senão o `<input type=date>` nativo sai
  claro), e despacha para um dos três templates de `components/public/templates/` (RF26):
  - **Vitrine** — capa cheia + card por pacote com filmstrip (`package-photos.tsx`);
  - **Elegante** — serifa **Fraunces** (`font-serif`, só aqui) e pacotes como cardápio com linha
    pontilhada; o formulário fica num bloco `font-sans`;
  - **Direto** — `LeadForm layout="split"`: campos à esquerda e painel de orçamento *sticky* que
    recalcula enquanto o cliente digita.

  Regras ao mexer nos templates: eles são **client components puros** (recebem `PublicPageData`, não
  fazem fetch) — é o que faz a prévia do editor ser a página de verdade; nada de `document.getElementById`
  neles (na prévia o `document` é o do iframe), então a rolagem até o formulário sai do `budgetRef` de
  `lib/use-package-selection.ts` (o card escolhe, o formulário recebe controlado, a rolagem respeita
  `prefers-reduced-motion`); a lista de canais de contato sai de `components/public/contacts.tsx`.

  O editor é owner-only e salva tudo de uma vez em `PATCH /page-settings`; imagens antigas só são
  apagadas do bucket **depois** do save bem-sucedido. Duas partes dele fogem desse save por editarem
  outra entidade e gravarem na hora: a galeria do pacote (`components/catalog/package-gallery.tsx`,
  só em pacote já criado) e a ordem/destaque da vitrine (`components/catalog/package-showcase.tsx` →
  `PATCH /packages/order`, que avisa o editor por `onChanged` para a prévia recarregar).

  **Prévia ao vivo** (`components/public/page-preview.tsx` + `preview-frame.tsx`): o editor renderiza
  o mesmo `PublicPage` com o rascunho em memória, dentro de um `<iframe>` que recebe a árvore React
  por `createPortal` (as folhas de estilo do documento pai são clonadas para dentro dele). O iframe
  existe porque os templates usam breakpoints de viewport e `svh` — num `<div>` a prévia de celular
  mediria a janela do painel, e não os 390px simulados. A moldura de `PublicPageData` vem de
  `GET /page-settings/preview` (a mesma resposta da página pública, sempre com preço) e o rascunho
  passa pelo `updatePageSettingsSchema` antes de entrar na prévia, para ela mostrar o texto já
  normalizado. `LeadForm` recebe `preview` e não envia nada; a política de preço (RF27) é aplicada
  pelo `applyPricePolicy` de `@buffet/shared`, o mesmo que a API usa.
- **Financeiro** (`components/finance/*` + `dashboard/finance/page.tsx`): `SchedulePanel` só habilita
  em `leadStatus === "aprovado"`, gera parcelas iguais client-side com `splitInstallments(total, n)`,
  e dá baixa via `PayForm` (`PATCH /finance/payments/:id/pay`). A página Finance mostra KPIs
  **owner-only** de `/finance/summary`.

## Estado, config & testes

- **Sem store global e sem context providers** (nada de Redux/Zustand/context custom). O único estado
  "global" é o interno do Better-Auth via os hooks do `authClient`.
- **Dependências de UI enxutas:** além de shadcn/lucide, a única lib de UI é **`@dnd-kit/core`**
  (drag-and-drop do kanban do funil, com sensores de ponteiro e teclado). Prefira resolver com o que
  já existe antes de adicionar libs.
- [`next.config.ts`](next.config.ts): só `reactStrictMode`. Workspace packages já vêm compilados em
  ESM → **sem `transpilePackages`**.
- Base da API lida inline: `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333"` (em `lib/api.ts`,
  `lib/auth-client.ts`, `[slug]/page.tsx`). `tsconfig` é standalone (`moduleResolution: Bundler`,
  alias `@/* → ./src/*`) — aqui imports **não** usam extensão `.js`.
- **Sem testes no web hoje.** Se adicionar, alinhe com o setup Vitest do restante do monorepo.
