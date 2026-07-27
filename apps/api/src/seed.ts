/**
 * Demo seed (Sprint 6). Creates loginable demo users (an owner and a staff
 * member), an organization, a full catalog, leads across every funnel status
 * and payment schedules covering paid/pending/overdue installments — enough
 * data to see every screen populated. Idempotent: re-running wipes the
 * previous demo data first.
 *
 * Usage (from repo root, with the DB up and built):
 *   set -a; . .env; set +a
 *   pnpm --filter @buffet/db build && pnpm --filter @buffet/api build
 *   pnpm db:seed
 */
import { inArray } from "drizzle-orm";
import { getDb, schema, generateId } from "@buffet/db";
import { createAuth } from "@buffet/auth";
import { computeBudgetTotal, splitInstallments } from "@buffet/shared";

const DEMO_EMAIL = "demo@buffetsystem.com";
const STAFF_EMAIL = "joana@buffetsystem.com";
const DEMO_PASSWORD = "demo12345";
const DEMO_SLUG = "buffet-demonstracao";
const INVITE_EMAIL = "novo.funcionario@buffetsystem.com";

/** Midnight UTC, `offset` days from today (negative = past). */
function day(offset: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function main() {
  const db = getDb();
  const auth = createAuth({
    db,
    secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret",
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3333",
    trustedOrigins: (process.env.TRUSTED_ORIGINS ?? "http://localhost:3000")
      .split(",")
      .map((o) => o.trim()),
  });

  // --- Idempotency: remove any previous demo data ------------------------
  const existing = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(inArray(schema.user.email, [DEMO_EMAIL, STAFF_EMAIL]));

  if (existing.length > 0) {
    const userIds = existing.map((u) => u.id);
    const memberships = await db
      .select({ organizationId: schema.member.organizationId })
      .from(schema.member)
      .where(inArray(schema.member.userId, userIds));
    const orgIds = [...new Set(memberships.map((m) => m.organizationId))];
    if (orgIds.length > 0) {
      // Cascades to items, packages, leads_budgets, financial_payments and invitations.
      await db
        .delete(schema.organization)
        .where(inArray(schema.organization.id, orgIds));
    }
    // Cascades to account and session; member rows are already gone.
    await db.delete(schema.user).where(inArray(schema.user.id, userIds));
    console.log("• dados de demonstração anteriores removidos");
  }

  // --- Users (via Better-Auth so the password hashes are valid) ----------
  const ownerSignUp = await auth.api.signUpEmail({
    body: { name: "Dona Demonstração", email: DEMO_EMAIL, password: DEMO_PASSWORD },
  });
  const ownerId = ownerSignUp.user.id;

  const staffSignUp = await auth.api.signUpEmail({
    body: { name: "Joana Ferreira", email: STAFF_EMAIL, password: DEMO_PASSWORD },
  });
  const staffId = staffSignUp.user.id;

  // --- Organization + memberships (direct inserts) -----------------------
  const orgId = generateId();
  await db.insert(schema.organization).values({
    id: orgId,
    name: "Buffet Demonstração",
    slug: DEMO_SLUG,
    createdAt: new Date(),
  });
  await db.insert(schema.member).values([
    {
      id: generateId(),
      organizationId: orgId,
      userId: ownerId,
      role: "owner",
      createdAt: new Date(),
    },
    // RNF04: a "member" to check the owner-only screens from the other side.
    {
      id: generateId(),
      organizationId: orgId,
      userId: staffId,
      role: "member",
      createdAt: new Date(),
    },
  ]);

  // Pending invitation, so /invite/[id] has something to accept.
  const invitationId = generateId();
  await db.insert(schema.invitation).values({
    id: invitationId,
    organizationId: orgId,
    email: INVITE_EMAIL,
    role: "member",
    status: "pending",
    expiresAt: day(7),
    inviterId: ownerId,
    createdAt: new Date(),
  });

  // --- Catalog: dishes, drinks, services (some inactive) -----------------
  const itemRows = [
    // Entradas
    { name: "Bruschetta de tomate e manjericão", type: "dish", category: "entrada", basePrice: "18.00", isActive: true },
    { name: "Canapés variados", type: "dish", category: "entrada", basePrice: "24.00", isActive: true },
    { name: "Mini quiche de alho-poró", type: "dish", category: "entrada", basePrice: "20.00", isActive: true },
    { name: "Carpaccio de carne", type: "dish", category: "entrada", basePrice: "32.00", isActive: false },
    // Principais
    { name: "Filé ao molho madeira", type: "dish", category: "principal", basePrice: "62.00", isActive: true },
    { name: "Salmão grelhado com risoto de limão", type: "dish", category: "principal", basePrice: "78.00", isActive: true },
    { name: "Risoto de funghi", type: "dish", category: "principal", basePrice: "54.00", isActive: true },
    { name: "Frango recheado com ervas", type: "dish", category: "principal", basePrice: "46.00", isActive: true },
    { name: "Bacalhau à portuguesa", type: "dish", category: "principal", basePrice: "92.00", isActive: false },
    // Sobremesas
    { name: "Petit gâteau", type: "dish", category: "sobremesa", basePrice: "22.00", isActive: true },
    { name: "Pudim de leite condensado", type: "dish", category: "sobremesa", basePrice: "14.00", isActive: true },
    { name: "Torta de limão", type: "dish", category: "sobremesa", basePrice: "17.00", isActive: true },
    { name: "Mesa de doces finos", type: "dish", category: "sobremesa", basePrice: "38.00", isActive: true },
    // Bebidas
    { name: "Água mineral", type: "drink", category: null, basePrice: "4.00", isActive: true },
    { name: "Refrigerante", type: "drink", category: null, basePrice: "6.00", isActive: true },
    { name: "Suco natural", type: "drink", category: null, basePrice: "9.00", isActive: true },
    { name: "Cerveja artesanal", type: "drink", category: null, basePrice: "16.00", isActive: true },
    { name: "Espumante", type: "drink", category: null, basePrice: "45.00", isActive: true },
    { name: "Open bar de drinks", type: "drink", category: null, basePrice: "68.00", isActive: false },
    // Serviços
    { name: "Garçom (diária)", type: "service", category: null, basePrice: "180.00", isActive: true },
    { name: "Copeira (diária)", type: "service", category: null, basePrice: "150.00", isActive: true },
    { name: "DJ", type: "service", category: null, basePrice: "900.00", isActive: true },
    { name: "Cerimonial", type: "service", category: null, basePrice: "1200.00", isActive: true },
    { name: "Decoração floral", type: "service", category: null, basePrice: "750.00", isActive: true },
    { name: "Fotografia e vídeo", type: "service", category: null, basePrice: "1800.00", isActive: true },
    { name: "Segurança (diária)", type: "service", category: null, basePrice: "320.00", isActive: false },
  ];
  const items = await db
    .insert(schema.items)
    .values(itemRows.map((r) => ({ organizationId: orgId, ...r })))
    .returning({ id: schema.items.id, name: schema.items.name });
  const itemId = (name: string) => items.find((i) => i.name === name)!.id;

  // --- Packages (fixed price per guest) ----------------------------------
  const packageRows = [
    {
      name: "Pacote Ouro",
      description: "Entrada, principal, sobremesa, bebidas e equipe completa.",
      pricePerPerson: "150.00",
      isActive: true,
      items: [
        "Canapés variados",
        "Filé ao molho madeira",
        "Salmão grelhado com risoto de limão",
        "Mesa de doces finos",
        "Petit gâteau",
        "Espumante",
        "Suco natural",
        "Água mineral",
        "Garçom (diária)",
        "Cerimonial",
        "DJ",
        "Decoração floral",
      ],
    },
    {
      name: "Pacote Prata",
      description: "Cardápio essencial com bebidas não alcoólicas.",
      pricePerPerson: "95.00",
      isActive: true,
      items: [
        "Bruschetta de tomate e manjericão",
        "Frango recheado com ervas",
        "Pudim de leite condensado",
        "Suco natural",
        "Refrigerante",
        "Garçom (diária)",
      ],
    },
    {
      name: "Pacote Bronze",
      description: "Opção enxuta para eventos menores e informais.",
      pricePerPerson: "68.00",
      isActive: true,
      items: [
        "Mini quiche de alho-poró",
        "Risoto de funghi",
        "Torta de limão",
        "Refrigerante",
        "Água mineral",
      ],
    },
    {
      name: "Pacote Corporativo",
      description: "Coffee break reforçado + almoço executivo para empresas.",
      pricePerPerson: "120.00",
      isActive: true,
      items: [
        "Canapés variados",
        "Filé ao molho madeira",
        "Torta de limão",
        "Suco natural",
        "Água mineral",
        "Garçom (diária)",
        "Copeira (diária)",
      ],
    },
    {
      name: "Pacote Verão (encerrado)",
      description: "Menu sazonal — mantido inativo para histórico.",
      pricePerPerson: "88.00",
      isActive: false,
      items: ["Bruschetta de tomate e manjericão", "Suco natural"],
    },
  ];

  const packages = await db
    .insert(schema.packages)
    .values(
      packageRows.map((p) => ({
        organizationId: orgId,
        name: p.name,
        description: p.description,
        pricePerPerson: p.pricePerPerson,
        isActive: p.isActive,
      }))
    )
    .returning({
      id: schema.packages.id,
      name: schema.packages.name,
      pricePerPerson: schema.packages.pricePerPerson,
    });
  const pkg = (name: string) => packages.find((p) => p.name === name)!;

  await db.insert(schema.packageItems).values(
    packageRows.flatMap((p) =>
      p.items.map((itemName) => ({
        packageId: pkg(p.name).id,
        itemId: itemId(itemName),
      }))
    )
  );

  // --- Leads across every funnel status ----------------------------------
  const leadSeeds: Array<{
    customerName: string;
    customerEmail: string | null;
    customerPhone: string;
    status: string;
    pkg: string | null;
    guests: number | null;
    eventDate: Date | null;
    createdAt: Date;
    notes?: string;
    lostReason?: string;
  }> = [
    // Novos
    { customerName: "Marina Alves", customerEmail: "marina.alves@email.com", customerPhone: "11991110001", status: "novo", pkg: "Pacote Ouro", guests: 80, eventDate: day(40), createdAt: day(-1) },
    { customerName: "Juliana Prado", customerEmail: "juliana.prado@empresa.com.br", customerPhone: "11991110002", status: "novo", pkg: "Pacote Corporativo", guests: 150, eventDate: day(25), createdAt: day(-2), notes: "Confraternização da empresa; precisa de nota fiscal." },
    { customerName: "Ricardo Menezes", customerEmail: null, customerPhone: "11991110003", status: "novo", pkg: "Pacote Bronze", guests: 40, eventDate: day(120), createdAt: day(-3) },
    { customerName: "Tatiane Moraes", customerEmail: "tatiane.moraes@email.com", customerPhone: "11991110004", status: "novo", pkg: null, guests: null, eventDate: null, createdAt: day(-4), notes: "Pediu orçamento pelo site, ainda sem data definida." },
    // Duas negociações na MESMA data, para exercitar o alerta de conflito (RF21).
    { customerName: "Otávio Dias", customerEmail: null, customerPhone: "11991110005", status: "novo", pkg: "Pacote Prata", guests: 50, eventDate: day(90), createdAt: day(-5) },

    // Em negociação
    { customerName: "Rafael Souza", customerEmail: "rafael.souza@email.com", customerPhone: "11991110006", status: "em_negociacao", pkg: "Pacote Prata", guests: 120, eventDate: day(55), createdAt: day(-8), notes: "Cliente pediu proposta por WhatsApp." },
    { customerName: "Camila Andrade", customerEmail: "camila.andrade@email.com", customerPhone: "11991110007", status: "em_negociacao", pkg: "Pacote Ouro", guests: 90, eventDate: day(65), createdAt: day(-10), notes: "Comparando com outro buffet; retornar na segunda-feira." },
    { customerName: "Eduardo Lopes", customerEmail: "eduardo.lopes@empresa.com.br", customerPhone: "11991110008", status: "em_negociacao", pkg: "Pacote Corporativo", guests: 200, eventDate: day(48), createdAt: day(-12), notes: "Quer incluir DJ e prolongar o open bar até 1h." },
    { customerName: "Patrícia Gomes", customerEmail: null, customerPhone: "11991110009", status: "em_negociacao", pkg: "Pacote Bronze", guests: 70, eventDate: day(100), createdAt: day(-14) },

    // Formalizando
    { customerName: "Bianca Lima", customerEmail: "bianca.lima@email.com", customerPhone: "11991110010", status: "formalizando", pkg: "Pacote Ouro", guests: 60, eventDate: day(70), createdAt: day(-18), notes: "Aguardando confirmação do número final de convidados." },
    { customerName: "Henrique Barros", customerEmail: "henrique.barros@email.com", customerPhone: "11991110011", status: "formalizando", pkg: "Pacote Prata", guests: 110, eventDate: day(58), createdAt: day(-20), notes: "Contrato enviado, aguardando assinatura." },
    { customerName: "Sofia Ramalho", customerEmail: "sofia.ramalho@empresa.com.br", customerPhone: "11991110012", status: "formalizando", pkg: "Pacote Corporativo", guests: 180, eventDate: day(35), createdAt: day(-22) },

    // Aprovados (todos com cronograma de pagamento abaixo)
    { customerName: "Fernanda Rocha", customerEmail: "fernanda.rocha@email.com", customerPhone: "11991110013", status: "aprovado", pkg: "Pacote Ouro", guests: 100, eventDate: day(90), createdAt: day(-30), notes: "Casamento — cerimônia às 17h, festa até 2h." },
    { customerName: "Gustavo Peixoto", customerEmail: "gustavo.peixoto@email.com", customerPhone: "11991110014", status: "aprovado", pkg: "Pacote Prata", guests: 130, eventDate: day(45), createdAt: day(-45) },
    { customerName: "Larissa Fontes", customerEmail: "larissa.fontes@empresa.com.br", customerPhone: "11991110015", status: "aprovado", pkg: "Pacote Corporativo", guests: 160, eventDate: day(20), createdAt: day(-50), notes: "Evento corporativo anual; pagamento via boleto." },
    { customerName: "Antônio Vieira", customerEmail: null, customerPhone: "11991110016", status: "aprovado", pkg: "Pacote Bronze", guests: 75, eventDate: day(-15), createdAt: day(-70), notes: "Evento já realizado e quitado." },

    // Perdidos
    { customerName: "Carlos Nunes", customerEmail: null, customerPhone: "11991110017", status: "perdido", pkg: "Pacote Prata", guests: 200, eventDate: day(30), createdAt: day(-25), lostReason: "Preço acima do orçamento" },
    { customerName: "Vanessa Duarte", customerEmail: "vanessa.duarte@email.com", customerPhone: "11991110018", status: "perdido", pkg: "Pacote Ouro", guests: 55, eventDate: day(12), createdAt: day(-33), lostReason: "Fechou com outro buffet" },
    { customerName: "Marcelo Pires", customerEmail: null, customerPhone: "11991110019", status: "perdido", pkg: "Pacote Bronze", guests: 90, eventDate: day(-5), createdAt: day(-60), lostReason: "Evento adiado sem nova data" },
  ];

  const leadIds = new Map<string, string>();
  const leadTotals = new Map<string, string>();
  for (const l of leadSeeds) {
    const price = l.pkg ? pkg(l.pkg).pricePerPerson : null;
    const total =
      price && l.guests ? computeBudgetTotal(price, l.guests) : null;
    const [row] = await db
      .insert(schema.leadsBudgets)
      .values({
        organizationId: orgId,
        customerName: l.customerName,
        customerEmail: l.customerEmail,
        customerPhone: l.customerPhone,
        eventDate: l.eventDate,
        guestCount: l.guests,
        packageId: l.pkg ? pkg(l.pkg).id : null,
        totalValue: total,
        status: l.status,
        lostReason: l.lostReason ?? null,
        notes: l.notes ?? null,
        createdAt: l.createdAt,
        updatedAt: l.createdAt,
      })
      .returning({ id: schema.leadsBudgets.id });
    leadIds.set(l.customerName, row!.id);
    if (total) leadTotals.set(l.customerName, total);
  }

  // --- Payment schedules for the approved leads (RF23/RF24) --------------
  // Covers every state the finance screen renders: pago, pendente, vencido,
  // e os três métodos de pagamento.
  const scheduleSeeds: Array<{
    customer: string;
    installments: Array<{
      due: number;
      status: string;
      method?: string;
      paidOffset?: number;
    }>;
  }> = [
    {
      customer: "Fernanda Rocha", // 3x — uma paga, uma vencida, uma a vencer
      installments: [
        { due: -20, status: "pago", method: "pix", paidOffset: -20 },
        { due: -3, status: "pendente" },
        { due: 30, status: "pendente" },
      ],
    },
    {
      customer: "Gustavo Peixoto", // 4x — metade quitada
      installments: [
        { due: -40, status: "pago", method: "boleto", paidOffset: -39 },
        { due: -10, status: "pago", method: "cartao", paidOffset: -10 },
        { due: 20, status: "pendente" },
        { due: 50, status: "pendente" },
      ],
    },
    {
      customer: "Larissa Fontes", // 3x — entrada paga, parcela vencida ontem
      installments: [
        { due: -25, status: "pago", method: "pix", paidOffset: -25 },
        { due: -1, status: "pendente" },
        { due: 15, status: "pendente" },
      ],
    },
    {
      customer: "Antônio Vieira", // 2x — totalmente quitado
      installments: [
        { due: -45, status: "pago", method: "pix", paidOffset: -45 },
        { due: -18, status: "pago", method: "cartao", paidOffset: -18 },
      ],
    },
  ];

  for (const s of scheduleSeeds) {
    const budgetId = leadIds.get(s.customer)!;
    const total = leadTotals.get(s.customer)!;
    const amounts = splitInstallments(total, s.installments.length);
    await db.insert(schema.financialPayments).values(
      s.installments.map((inst, i) => ({
        budgetId,
        dueDate: day(inst.due),
        amount: amounts[i]!,
        status: inst.status,
        paymentMethod: inst.method ?? null,
        paidAt: inst.paidOffset != null ? day(inst.paidOffset) : null,
      }))
    );
  }

  console.log("\n✅ Seed concluído.");
  console.log(`   Org:      Buffet Demonstração  (/${DEMO_SLUG})`);
  console.log(`   Itens:    ${items.length}  ·  Pacotes: ${packages.length}  ·  Negociações: ${leadSeeds.length}`);
  console.log(`   Owner:    ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`   Membro:   ${STAFF_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`   Convite:  http://localhost:3000/invite/${invitationId}  (${INVITE_EMAIL})`);
  console.log(`   Página pública: http://localhost:3000/${DEMO_SLUG}\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed falhou:", err);
  process.exit(1);
});
