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
    onboarding/           criação guiada de org (client) — `?novo=1` força criar mais um buffet
    convites/             convites pendentes do usuário (client) — primeiro acesso do funcionário
    invite/[id]/          aceitar um convite pelo link do e-mail (client)
    [slug]/page.tsx       PÚBLICO — fetch + metadata (RF17/RF18) — SERVER component
    dashboard/
      layout.tsx          guarda de auth + shell de navegação (client)
      page.tsx  catalog/  leads/  finance/  members/  pagina/
  components/{ui,auth,marketing,onboarding,catalog,leads,finance,public}/
    public/templates/     os 3 layouts da página pública (RF26)
  lib/                    api.ts · auth-client.ts · workspace.ts · use-active-org.ts · use-role.ts ·
                          types.ts · slug.ts · utils.ts · image.ts · use-package-selection.ts
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
- **Proteção de rota é client-side** (não há middleware) e mora em
  [`dashboard/layout.tsx`](src/app/dashboard/layout.tsx). Itens de nav owner-only são filtrados por
  um flag `ownerOnly`; a página Finance **também** bloqueia `member` no próprio componente (RNF04 em
  profundidade).
- **⚠️ Nunca decida rota com os hooks do client do Better-Auth** (`useSession()`,
  `useActiveOrganization()`). São átomos nanostores **singletons de módulo** que devolvem o valor
  atual de forma **síncrona no primeiro render** e só rebuscam num `setTimeout(0)` depois de montar.
  Um `signOut` deixa o átomo em `{ data: null, isPending: false }` e nada reseta isso — o portão lia
  "não logado"/"sem organização" antes de qualquer requisição sair. Foi a causa de dois bugs: o
  segundo login voltando para `/login` e o funcionário caindo no onboarding. Três regras:
  - **Rota** sai de [`lib/workspace.ts`](src/lib/workspace.ts): `useWorkspace()` (fetch comum de
    `GET /me/workspace`) + `resolveEntryRoute(ws)` → `/dashboard` | `/convites` | `/onboarding`.
    O `dashboard/layout.tsx` é o **portão único**; login e signup só empurram para `/dashboard`.
  - **"Não está logado" é só o 401 do servidor** — `isUnauthorized(error)`. Estado de cliente vazio
    não desloga ninguém, e falha de rede (que rejeita como `TypeError`) muito menos: ela mostra uma
    tela de "Tentar de novo", não um redirect.
  - **Dados da org** saem de [`lib/use-active-org.ts`](src/lib/use-active-org.ts) — wrapper que
    auto-cura o átomo com um `refetch()` único quando a sessão tem org e ele não tem. Quem já tem o
    `workspace` em mãos (é o caso do shell) usa ele direto, inclusive para o papel.
  - `useSession()` continua válido **só para exibição** (nome, e-mail), nunca para decidir fluxo.
- **Troca de organização** (`components/dashboard/org-switcher.tsx`, raiz do breadcrumb no header):
  `switchOrganization()` chama a API e faz `window.location.assign("/dashboard")` — **reload completo
  de propósito**. Sem store global, com `load()` só na montagem e preferências chaveadas por `orgId`,
  uma navegação client-side deixaria dado do buffet anterior na tela (RNF05).
- **Signup** (`signup/page.tsx`): cria **só a conta** (`signUp.email`) e vai para `/dashboard`, que
  roteia. A organização é criada em `app/onboarding/` + `components/onboarding/*`: `OrgStep` chama
  `organization.create({ name, slug })` (criador vira `owner`; em colisão de slug, retry com
  `randomSuffix()` de `lib/slug.ts`) → `setActiveOrganization()` de `lib/workspace.ts`.
- **Telas de entrada** (`login/`, `signup/`, `convites/`, `invite/[id]/`): compartilham o `AuthShell`
  (`components/auth/auth-shell.tsx`) — split-screen com showcase escuro (`.dark`, âmbar `--brand`,
  `HeroPipeline`) à esquerda e o formulário no claro à direita. CTA usa `Button variant="brand"`.
  `login`/`signup` aceitam `?next=` (validado por `safeNextPath`, que barra destino externo).
- **Convites** (RF34): `members/page.tsx` envia por e-mail e mostra o link copiável
  `${origin}/invite/${id}` como alternativa. Quem recebe tem dois caminhos — o link direto
  (`invite/[id]/`, que leva `?next=` para o login) e a lista `convites/`, para onde o portão manda
  quem entra sem buffet mas com convite pendente. Aceite: `organization.acceptInvitation` +
  `switchOrganization()`.

## UI & estilo

- **shadcn/ui "new-york"**, subconjunto enxuto em [`src/components/ui/`](src/components/ui), **escrito
  à mão — zero Radix instalado**: `button`, `badge`, `card`, `input`, `label`, `modal`, `tabs`,
  `select`, `textarea`, `switch`, `image-upload`, `toast`, `skeleton`, `empty-state`, `alert`,
  `table`, `confirm-dialog`, `form-error`, `menu`. Adicione primitives conforme a necessidade, no
  mesmo estilo — **não** traga Radix nem outra lib de UI para resolver o que cabe em 40 linhas aqui.
- **`Menu`** ([`ui/menu.tsx`](src/components/ui/menu.tsx)) é o menu suspenso (padrão WAI-ARIA "menu
  button"): `aria-haspopup="menu"`, ↑/↓ circulares, Escape devolvendo o foco ao gatilho, `mousedown`
  fora fechando. Ao contrário do `Modal`, **não** trava scroll nem prende foco — menu não é modal, e
  Tab deve continuar a navegação da página. Painel em `z-40`, abaixo do `z-50` do `Modal`.
- **Imagens** são `<img loading="lazy" decoding="async">` com `aspect-*` fixo no contêiner — o
  projeto **não usa `next/image`** (evita configurar `remotePatterns` por host). Upload é sempre pelo
  `ImageUpload`, que reduz o arquivo em canvas (`lib/image.ts`) e envia direto ao bucket.
- **`Modal` é custom** (não Radix Dialog): `role="dialog"` + `aria-modal`, foco preso no painel e
  restaurado ao fechar, botão X, Escape fechando **só o modal do topo**, bottom-sheet no mobile /
  card centralizado em `sm:`. É o que dirige todos os fluxos de create/edit (via um state `modal`
  como discriminated union na página).
  ⚠️ A **trava de scroll é contada** por uma pilha no módulo, porque o app aninha modal dentro de
  modal (kanban → motivo da perda; negociação → excluir parcela). Um `overflow: hidden` sem contador
  destrava o body ao fechar o de cima, com o de baixo ainda aberto.
  O backdrop só fecha se o `mousedown` **começou** nele — senão arrastar uma seleção de texto para
  fora do painel descartaria o formulário.
- `cn()` em [`src/lib/utils.ts`](src/lib/utils.ts) = `twMerge(clsx(...))`. `class-variance-authority`
  só em `button.tsx` (`buttonVariants`); `badge.tsx` usa um mapa de variantes manual.
- **Tailwind v4 sem `tailwind.config.js`** — tudo em [`globals.css`](src/app/globals.css) via `@theme`
  e tokens **oklch** (`:root` / `.dark`). Dark mode está definido mas ainda **sem toggle** de UI.
- **RNF02:** interface responsiva; a página pública `/{slug}` é priorizada para mobile.

## Formulários

- **Sem react-hook-form e sem zod resolver.** Cada form usa `useState` por campo, `handleSubmit(e)`
  manual com `e.preventDefault()`, booleans `saving`/`loading` e um state `error: unknown` (guarda o
  erro **cru**, não a mensagem). Validação = HTML nativo (`required`, `type`, `minLength`,
  `inputMode`) + o `ApiError` do servidor. (Os schemas Zod vivem no backend, em `@buffet/shared`.)
- **Feedback (RNF08) — a regra de divisão:**
  - **erro de validação** (o `ApiError` traz o mapa `errors`) → **inline**, via
    `<FormError error={error} labels={FIELD_LABELS} />`. Guarde o erro cru (`setError(err)`), nunca
    `err.message` — é o objeto que carrega o erro por campo.
  - **erro de operação** (409/500/rede) e **todo sucesso** → **toast**, via `useToast()`.
  - Helpers em [`src/lib/api.ts`](src/lib/api.ts): `errorMessage(err, fallback)` (cobre também
    string crua de validação local e falha de rede, que rejeita como `TypeError`) e `fieldErrors(err)`.
- **Ações destrutivas usam `ConfirmDialog`**, nunca `confirm()`/`alert()` nativos. O foco inicial
  cai em "Cancelar" — um Enter reflexo não pode apagar dado do usuário.
- **Carregamento usa esqueleto**, não `<p>Carregando...</p>`: `SkeletonTable`/`SkeletonCards`/
  `SkeletonList` de `ui/skeleton` (já embutem `role="status"` + `sr-only`). Exceção: os gates de
  sessão de tela cheia (`dashboard/layout`, `onboarding`, `invite`) seguem com texto + `role="status"`.
- **Vazio usa `EmptyState`** com ação. Distinga sempre "nunca teve nada" (CTA de criar) de "o filtro
  não achou" (CTA de limpar busca) — são estados diferentes com saídas diferentes.
- **Sem tanstack table.** Use `DataTable<T>` de [`ui/table`](src/components/ui/table.tsx) (`columns`,
  `rowKey`, `actions`, `empty`, `onRowClick`) ou as partes compostas `Table/THead/Tr/Th/Td`.
  Em `onRowClick`, a primeira coluna vira um `<button>` de verdade — nada de `role="button"` no
  `<tr>`, que destruiria a semântica de tabela para o leitor de tela.

## Padrões por feature (referência)

- **Catálogo** (`dashboard/catalog/` + `components/catalog/*-form.tsx`): página com abas
  (`dish|drink|service|packages`), state `modal` union abrindo o form certo no `Modal`. Forms são
  self-contained, recebem `onSaved`/`onCancel`, e decidem create-vs-edit pela presença de uma prop
  opcional (`item?`/`pkg?`).
- **Funil** (`dashboard/leads/` + `components/leads/*`): duas visões alternadas por um `Tabs`
  (segmented control) **Tabela / Kanban**, ambas com a mesma busca. A **Tabela** mantém o filtro por
  status (itera `LEAD_STATUSES`); o **Kanban** (`lead-kanban.tsx`, `@dnd-kit/core`) mostra só
  `LEAD_BOARD_STATUSES` — os cinco estados de trabalho. Clicar num card abre o `LeadDetailForm`.

  **Mudar de estado é um ato, não um campo** (RF-V2-02). O `<select>` de status saiu; quem manda é o
  `StatusStrip` (`status-strip.tsx`), um bloco **fora e acima do `<form>`** cujos botões disparam
  `POST /leads/:id/transitions` na hora. Ele não pode parecer campo de formulário: o "Salvar" não o
  grava e o "Cancelar" não o desfaz. Três regras ao mexer nisso:
  - **As ações saem de `availableTransitions(status, role)` de `@buffet/shared`** — a mesma tabela
    que o servidor consulta. O cliente nunca decide sozinho o que é permitido; no máximo esconde o
    que já sabe que seria recusado.
  - **Rótulo é verbo** ("Enviar proposta"), não o nome do estado de destino, e alguns mudam conforme
    a origem. Vocabulário visual e verbal centralizado em [`lib/lead-status.ts`](src/lib/lead-status.ts)
    (`LEAD_STATUS_STYLE`, `transitionVerb`, `reasonPrompt`, `terminalStatement`), testado em
    `lead-status.test.ts` — nada de `Record<LeadStatus, ...>` solto por tela.
  - **Transição com `requiresReason` abre o `ReasonModal`**, que pergunta a coisa certa por destino.
    No quadro, essas transições **não** viram alvo de drop: interromper um arraste com modal
    obrigatório é pior que oferecer a ação onde ela cabe.

  Durante o arraste, colunas que a máquina de estados não permite ganham `opacity-40` +
  `pointer-events-none` — a regra vira algo que se vê antes de tentar. `LeadDetailForm` ainda mostra o
  banner de conflito de agenda (`conflictCount`, RF21, não bloqueia), o botão "Copiar proposta" →
  clipboard (RF22), e embute o `SchedulePanel` **se `isOwner`**. O `LeadTimeline` (`lead-timeline.tsx`)
  intercala anotações (RF35) e mudanças de estado (RF-V2-04) numa linha do tempo só: anotação é
  cartão, evento de sistema é marca na espinha vertical — e evento de sistema não tem excluir para
  papel nenhum.
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
- **Financeiro** (`components/finance/*` + `dashboard/finance/page.tsx`): `SchedulePanel` aparece
  quando `hasSchedule(leadStatus)` — `aprovado` **ou** `fechado`. São duas perguntas diferentes e
  ambas vivem em `@buffet/shared`: `canCreateSchedule` (gerar parcelas é ato sobre negociação viva,
  só `aprovado`, quem barra é o servidor) e `hasSchedule` (exibir o que já existe continua valendo
  depois de fechada). Não escreva a comparação de status à mão aqui. O painel gera parcelas iguais
  client-side com `splitInstallments(total, n)` e dá baixa via `PayForm`
  (`PATCH /finance/payments/:id/pay`). A página Finance mostra KPIs **owner-only** de
  `/finance/summary`.

## Estado, config & testes

- **Sem store global** (nada de Redux/Zustand). O estado "global" é o interno do Better-Auth via os
  hooks do `authClient`.
- **Um único context provider, e é exceção deliberada:** o `ToastProvider`
  ([`ui/toast.tsx`](src/components/ui/toast.tsx)), montado no `app/layout.tsx`. Existe porque um
  toast precisa ser disparável de qualquer profundidade da árvore sem prop drilling. **Não abra
  precedente** — para qualquer outro estado compartilhado, passe por props ou refaça o fetch.
  `useToast()` fora do provider devolve um no-op (a prévia da página pública roda dentro de um
  `<iframe>`, com árvore React própria).
- **Dependências de UI enxutas:** além de shadcn/lucide, a única lib de UI é **`@dnd-kit/core`**
  (drag-and-drop do kanban do funil, com sensores de ponteiro e teclado). Prefira resolver com o que
  já existe antes de adicionar libs.
- [`next.config.ts`](next.config.ts): só `reactStrictMode`. Workspace packages já vêm compilados em
  ESM → **sem `transpilePackages`**.
- Base da API lida inline: `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333"` (em `lib/api.ts`,
  `lib/auth-client.ts`, `[slug]/page.tsx`). `tsconfig` é standalone (`moduleResolution: Bundler`,
  alias `@/* → ./src/*`) — aqui imports **não** usam extensão `.js`.
- **Testes:** Vitest (`vitest run --passWithNoTests`), arquivos `*.test.ts` **colocados**, sem
  `vitest.config` — igual ao resto do monorepo. Hoje só
  [`lib/calendar.test.ts`](src/lib/calendar.test.ts): o alvo é **lógica pura**, testável sem DOM.
  Não há setup de testing-library; para comportamento de componente, prefira extrair a regra para
  `lib/` e testar lá.
- **Datas e fuso — a regra que mais quebra aqui:** `eventDate` é uma **data-sem-hora** guardada à
  meia-noite UTC. Todo cálculo de calendário usa `Date.UTC`/`getUTCDate`
  ([`lib/calendar.ts`](src/lib/calendar.ts)); `new Date(y, m, d)` é construído no fuso local e, em
  `America/Sao_Paulo` (UTC-3), joga o dia 1 para a célula anterior do grid. Para agrupar por dia,
  fatie a string ISO (`eventDate.slice(0, 10)`) em vez de instanciar `Date`. Os testes de
  `calendar.test.ts` rodam verde de UTC-8 a UTC+14 — rode com `TZ=...` ao mexer neles.
