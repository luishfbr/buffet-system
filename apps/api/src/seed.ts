/**
 * Demo seed (Sprint 6). Creates a loginable demo owner, an organization, a small
 * catalog, leads across every funnel status and a payment schedule for the
 * approved lead. Idempotent: re-running wipes the previous demo data first.
 *
 * Usage (from repo root, with the DB up and built):
 *   set -a; . .env; set +a
 *   pnpm --filter @buffet/db build && pnpm --filter @buffet/api build
 *   pnpm db:seed
 */
import { eq, inArray } from "drizzle-orm";
import { getDb, schema, generateId } from "@buffet/db";
import { createAuth } from "@buffet/auth";
import { computeBudgetTotal, splitInstallments } from "@buffet/shared";

const DEMO_EMAIL = "demo@buffetsystem.com";
const DEMO_PASSWORD = "demo12345";
const DEMO_SLUG = "buffet-demonstracao";

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
  const [existing] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, DEMO_EMAIL))
    .limit(1);

  if (existing) {
    const memberships = await db
      .select({ organizationId: schema.member.organizationId })
      .from(schema.member)
      .where(eq(schema.member.userId, existing.id));
    const orgIds = memberships.map((m) => m.organizationId);
    if (orgIds.length > 0) {
      // Cascades to items, packages, leads_budgets and financial_payments.
      await db
        .delete(schema.organization)
        .where(inArray(schema.organization.id, orgIds));
    }
    // Cascades to account and session; member rows are already gone.
    await db.delete(schema.user).where(eq(schema.user.id, existing.id));
    console.log("• dados de demonstração anteriores removidos");
  }

  // --- Owner (via Better-Auth so the password hash is valid) -------------
  const signUp = await auth.api.signUpEmail({
    body: { name: "Dona Demonstração", email: DEMO_EMAIL, password: DEMO_PASSWORD },
  });
  const userId = signUp.user.id;

  // --- Organization + owner membership (direct inserts) ------------------
  const orgId = generateId();
  await db.insert(schema.organization).values({
    id: orgId,
    name: "Buffet Demonstração",
    slug: DEMO_SLUG,
    createdAt: new Date(),
  });
  await db.insert(schema.member).values({
    id: generateId(),
    organizationId: orgId,
    userId,
    role: "owner",
    createdAt: new Date(),
  });

  // --- Catalog: dishes, drinks, services ---------------------------------
  const itemRows = [
    { name: "Bruschetta", type: "dish", category: "entrada", basePrice: "18.00" },
    { name: "Filé ao molho madeira", type: "dish", category: "principal", basePrice: "62.00" },
    { name: "Petit gâteau", type: "dish", category: "sobremesa", basePrice: "22.00" },
    { name: "Suco natural", type: "drink", category: null, basePrice: "9.00" },
    { name: "Espumante", type: "drink", category: null, basePrice: "45.00" },
    { name: "Garçom (diária)", type: "service", category: null, basePrice: "180.00" },
    { name: "DJ", type: "service", category: null, basePrice: "900.00" },
  ];
  const items = await db
    .insert(schema.items)
    .values(itemRows.map((r) => ({ organizationId: orgId, ...r })))
    .returning({ id: schema.items.id });

  // --- Packages (fixed price per guest) ----------------------------------
  const [pkgOuro] = await db
    .insert(schema.packages)
    .values({
      organizationId: orgId,
      name: "Pacote Ouro",
      description: "Entrada, principal, sobremesa, bebidas e equipe completa.",
      pricePerPerson: "150.00",
    })
    .returning({ id: schema.packages.id });
  const [pkgPrata] = await db
    .insert(schema.packages)
    .values({
      organizationId: orgId,
      name: "Pacote Prata",
      description: "Cardápio essencial com bebidas não alcoólicas.",
      pricePerPerson: "95.00",
    })
    .returning({ id: schema.packages.id });

  await db.insert(schema.packageItems).values(
    items.map((it) => ({ packageId: pkgOuro!.id, itemId: it.id }))
  );
  await db.insert(schema.packageItems).values([
    { packageId: pkgPrata!.id, itemId: items[0]!.id },
    { packageId: pkgPrata!.id, itemId: items[1]!.id },
    { packageId: pkgPrata!.id, itemId: items[3]!.id },
  ]);

  // --- Leads across every funnel status ----------------------------------
  const day = (offset: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offset);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  };
  const leadSeeds = [
    { customerName: "Marina Alves", customerPhone: "11991110001", status: "novo", pkg: pkgOuro!.id, price: "150.00", guests: 80, eventDate: day(40) },
    { customerName: "Rafael Souza", customerPhone: "11991110002", status: "em_negociacao", pkg: pkgPrata!.id, price: "95.00", guests: 120, eventDate: day(55) },
    { customerName: "Bianca Lima", customerPhone: "11991110003", status: "formalizando", pkg: pkgOuro!.id, price: "150.00", guests: 60, eventDate: day(70) },
    { customerName: "Carlos Nunes", customerPhone: "11991110004", status: "perdido", pkg: pkgPrata!.id, price: "95.00", guests: 200, eventDate: day(30), lostReason: "Preço acima do orçamento" },
    // Two leads on the SAME date to exercise the conflict alert (RF21).
    { customerName: "Fernanda Rocha", customerPhone: "11991110005", status: "aprovado", pkg: pkgOuro!.id, price: "150.00", guests: 100, eventDate: day(90) },
    { customerName: "Otávio Dias", customerPhone: "11991110006", status: "novo", pkg: pkgPrata!.id, price: "95.00", guests: 50, eventDate: day(90) },
  ];

  let approvedLeadId: string | null = null;
  let approvedTotal = "0.00";
  for (const l of leadSeeds) {
    const total = computeBudgetTotal(l.price, l.guests);
    const [row] = await db
      .insert(schema.leadsBudgets)
      .values({
        organizationId: orgId,
        customerName: l.customerName,
        customerEmail: null,
        customerPhone: l.customerPhone,
        eventDate: l.eventDate,
        guestCount: l.guests,
        packageId: l.pkg,
        totalValue: total,
        status: l.status,
        lostReason: l.lostReason ?? null,
        notes:
          l.status === "em_negociacao"
            ? "Cliente pediu proposta por WhatsApp."
            : null,
      })
      .returning({ id: schema.leadsBudgets.id });
    if (l.status === "aprovado") {
      approvedLeadId = row!.id;
      approvedTotal = total;
    }
  }

  // --- Payment schedule for the approved lead (RF23/RF24) ----------------
  if (approvedLeadId) {
    const amounts = splitInstallments(approvedTotal, 3);
    const rows = amounts.map((amount, i) => ({
      budgetId: approvedLeadId!,
      dueDate: day(15 + i * 30),
      amount,
      // First installment already settled, to populate "recebido".
      status: i === 0 ? "pago" : "pendente",
      paymentMethod: i === 0 ? "pix" : null,
      paidAt: i === 0 ? new Date() : null,
    }));
    await db.insert(schema.financialPayments).values(rows);
  }

  console.log("\n✅ Seed concluído.");
  console.log(`   Org:   Buffet Demonstração  (/${DEMO_SLUG})`);
  console.log(`   Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`   Página pública: http://localhost:3000/${DEMO_SLUG}\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed falhou:", err);
  process.exit(1);
});
