import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq, inArray, type SQL } from "drizzle-orm";
import { schema, type Database } from "@buffet/db";
import {
  applyPricePolicy,
  computeBudgetTotal,
  fitsBudgetTotal,
  DEFAULT_PAGE_SETTINGS,
  type CreatePublicLeadInput,
  type PublicPageData,
  type PublicPagePackage,
} from "@buffet/shared";
import { DB } from "../database/database.module.js";
import { toPublicSettings } from "../page-settings/page-settings.service.js";
import { MailerService } from "../mail/mail.service.js";
import { newLeadEmail } from "../mail/mail.templates.js";

/** Teto de destinatários do aviso de novo lead — proprietários da org (RF32). */
const NOTIFY_RECIPIENTS_LIMIT = 5;

@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly mailer: MailerService
  ) {}

  /**
   * Tudo que a página `/{slug}` precisa para se desenhar: dados do buffet, a
   * personalização (RF25–RF27) e os pacotes ativos com galeria e itens inclusos
   * (RF28). Sem sessão — a organização é resolvida pelo slug da URL (RF17).
   */
  async getOrgBySlug(slug: string): Promise<PublicPageData> {
    return this.buildPageData(eq(schema.organization.slug, slug));
  }

  /**
   * Só o id da organização, a partir do slug (RF-V2-14).
   *
   * O calendário do portal não precisa do payload da página inteira, e montá-lo
   * para descartar tudo menos o id custaria vários joins numa rota anônima que
   * qualquer visitante dispara.
   */
  async resolveOrgIdBySlug(slug: string): Promise<string> {
    const [org] = await this.db
      .select({ id: schema.organization.id })
      .from(schema.organization)
      .where(eq(schema.organization.slug, slug))
      .limit(1);
    if (!org) throw new NotFoundException("Buffet não encontrado");
    return org.id;
  }

  /**
   * A mesma página, resolvida pela organização da sessão e **sempre com preço**
   * — é o que alimenta a prévia do editor (RF25–RF27), onde ligar e desligar
   * "mostrar preços" precisa refletir na hora, sem ida ao banco.
   */
  async getPreviewData(orgId: string): Promise<PublicPageData> {
    return this.buildPageData(eq(schema.organization.id, orgId), {
      keepPrices: true,
    });
  }

  private async buildPageData(
    orgWhere: SQL,
    { keepPrices = false } = {}
  ): Promise<PublicPageData> {
    const [org] = await this.db
      .select({
        id: schema.organization.id,
        name: schema.organization.name,
        slug: schema.organization.slug,
      })
      .from(schema.organization)
      .where(orgWhere)
      .limit(1);
    if (!org) throw new NotFoundException("Buffet não encontrado");

    const [[settingsRow], rows] = await Promise.all([
      this.db
        .select()
        .from(schema.orgPublicSettings)
        .where(eq(schema.orgPublicSettings.organizationId, org.id))
        .limit(1),
      this.db
        .select({
          id: schema.packages.id,
          name: schema.packages.name,
          description: schema.packages.description,
          pricePerPerson: schema.packages.pricePerPerson,
          isFeatured: schema.packages.isFeatured,
        })
        .from(schema.packages)
        .where(
          and(
            eq(schema.packages.organizationId, org.id),
            eq(schema.packages.isActive, true)
          )
        )
        // Ordem estável: o que o dono definiu, depois o mais antigo.
        .orderBy(asc(schema.packages.sortOrder), asc(schema.packages.createdAt)),
    ]);

    // Uma organização que nunca personalizou nada usa os defaults.
    const settings = settingsRow
      ? toPublicSettings(settingsRow)
      : { ...DEFAULT_PAGE_SETTINGS };

    const packageIds = rows.map((p) => p.id);
    // Duas queries agrupadas em memória — nunca uma query por pacote.
    const [images, includedItems] = await Promise.all([
      this.imagesByPackage(packageIds),
      this.itemNamesByPackage(packageIds),
    ]);

    const packages: PublicPagePackage[] = rows.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      pricePerPerson: p.pricePerPerson,
      isFeatured: p.isFeatured,
      images: images.get(p.id) ?? [],
      includedItems: includedItems.get(p.id) ?? [],
    }));

    return {
      ...org,
      settings,
      // RF27: o buffet pode optar por não publicar preços — então o valor nem
      // sai da API, não é só escondido na renderização.
      packages: applyPricePolicy(packages, keepPrices || settings.showPrices),
    };
  }

  private async imagesByPackage(
    packageIds: string[]
  ): Promise<Map<string, string[]>> {
    const byPackage = new Map<string, string[]>();
    if (packageIds.length === 0) return byPackage;

    const rows = await this.db
      .select({
        packageId: schema.packageImages.packageId,
        url: schema.packageImages.url,
      })
      .from(schema.packageImages)
      .where(inArray(schema.packageImages.packageId, packageIds))
      .orderBy(asc(schema.packageImages.sortOrder));

    for (const row of rows) {
      const list = byPackage.get(row.packageId);
      if (list) list.push(row.url);
      else byPackage.set(row.packageId, [row.url]);
    }
    return byPackage;
  }

  private async itemNamesByPackage(
    packageIds: string[]
  ): Promise<Map<string, string[]>> {
    const byPackage = new Map<string, string[]>();
    if (packageIds.length === 0) return byPackage;

    const rows = await this.db
      .select({
        packageId: schema.packageItems.packageId,
        name: schema.items.name,
      })
      .from(schema.packageItems)
      .innerJoin(schema.items, eq(schema.packageItems.itemId, schema.items.id))
      .where(
        and(
          inArray(schema.packageItems.packageId, packageIds),
          eq(schema.items.isActive, true)
        )
      )
      .orderBy(asc(schema.items.name));

    for (const row of rows) {
      const list = byPackage.get(row.packageId);
      if (list) list.push(row.name);
      else byPackage.set(row.packageId, [row.name]);
    }
    return byPackage;
  }

  /** Capture a pre-budget from the public form (RF18). */
  async createLead(input: CreatePublicLeadInput): Promise<{ id: string }> {
    // Honeypot: a real user never fills this (RNF06).
    if (input.website) throw new BadRequestException("Requisição inválida");

    const [org] = await this.db
      .select({ id: schema.organization.id })
      .from(schema.organization)
      .where(eq(schema.organization.slug, input.slug))
      .limit(1);
    if (!org) throw new NotFoundException("Buffet não encontrado");

    // Resolve the chosen package (must belong to the org and be active).
    let pricePerPerson: string | null = null;
    let packageId: string | null = null;
    if (input.packageId) {
      const [pkg] = await this.db
        .select({
          id: schema.packages.id,
          pricePerPerson: schema.packages.pricePerPerson,
        })
        .from(schema.packages)
        .where(
          and(
            eq(schema.packages.id, input.packageId),
            eq(schema.packages.organizationId, org.id),
            eq(schema.packages.isActive, true)
          )
        )
        .limit(1);
      if (!pkg) throw new BadRequestException("Pacote inválido");
      packageId = pkg.id;
      pricePerPerson = pkg.pricePerPerson;
    }

    // Server-authoritative estimate: pricePerPerson × guestCount.
    const totalValue =
      pricePerPerson && input.guestCount
        ? computeBudgetTotal(pricePerPerson, input.guestCount)
        : null;

    // O produto pode estourar o `numeric(12,2)` da coluna. Recusar com 400 e
    // uma mensagem legível é melhor que deixar o Postgres devolver 500 e perder
    // o lead — o visitante consegue corrigir o número de convidados.
    if (totalValue && !fitsBudgetTotal(totalValue)) {
      throw new BadRequestException(
        "O número de convidados é alto demais para este pacote. Fale com o buffet para um orçamento sob medida."
      );
    }

    const eventDate = input.eventDate ? new Date(input.eventDate) : null;
    const [lead] = await this.db
      .insert(schema.leadsBudgets)
      .values({
        organizationId: org.id,
        customerName: input.customerName,
        customerEmail: input.customerEmail || null,
        customerPhone: input.customerPhone,
        eventDate,
        guestCount: input.guestCount ?? null,
        packageId,
        totalValue,
        status: "novo",
      })
      .returning({ id: schema.leadsBudgets.id });

    // RF32: avisa o buffet **sem `await`** — quem está do outro lado é um
    // visitante esperando a confirmação do orçamento, e ele não pode pagar a
    // latência de um POST a provedor de e-mail. Falha aqui só vira log.
    void this.notifyNewLead({
      orgId: org.id,
      leadId: lead!.id,
      customerName: input.customerName,
      customerEmail: input.customerEmail || null,
      customerPhone: input.customerPhone,
      eventDate,
      guestCount: input.guestCount ?? null,
      packageId,
      totalValue,
    }).catch((err) =>
      this.logger.error(`Falha ao avisar sobre o lead ${lead!.id}: ${String(err)}`)
    );

    return { id: lead!.id };
  }

  /**
   * Aviso de novo lead aos proprietários da organização (RF32).
   *
   * Antes disto, um pedido de orçamento entrava no banco sem sinal nenhum: o
   * dono só descobria abrindo `/dashboard/leads` por conta própria.
   */
  private async notifyNewLead(lead: {
    orgId: string;
    leadId: string;
    customerName: string;
    customerEmail: string | null;
    customerPhone: string;
    eventDate: Date | null;
    guestCount: number | null;
    packageId: string | null;
    totalValue: string | null;
  }): Promise<void> {
    const [org] = await this.db
      .select({ name: schema.organization.name })
      .from(schema.organization)
      .where(eq(schema.organization.id, lead.orgId))
      .limit(1);

    // Só proprietários: o funcionário não recebe (RNF04 na mesma direção do
    // resto — quem responde comercialmente pelo buffet é o dono).
    const owners = await this.db
      .select({ email: schema.user.email })
      .from(schema.member)
      .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
      .where(
        and(
          eq(schema.member.organizationId, lead.orgId),
          eq(schema.member.role, "owner")
        )
      )
      .limit(NOTIFY_RECIPIENTS_LIMIT);
    if (owners.length === 0) return;

    const [pkg] = lead.packageId
      ? await this.db
          .select({ name: schema.packages.name })
          .from(schema.packages)
          .where(eq(schema.packages.id, lead.packageId))
          .limit(1)
      : [];

    const digits = lead.customerPhone.replace(/\D/g, "");
    const phone = digits.length <= 11 ? `55${digits}` : digits;

    await this.mailer.send({
      to: owners.map((o) => o.email),
      ...newLeadEmail({
        orgName: org?.name ?? "seu buffet",
        customerName: lead.customerName,
        customerPhone: lead.customerPhone,
        customerEmail: lead.customerEmail,
        eventDate: lead.eventDate,
        guestCount: lead.guestCount,
        packageName: pkg?.name ?? null,
        totalValue: lead.totalValue,
        // Cai direto na negociação — o `?open=` que a página de leads passou a
        // entender na Sprint 11.
        leadUrl: `${this.mailer.appUrl}/dashboard/leads?open=${lead.leadId}`,
        whatsappUrl: `https://wa.me/${phone}`,
      }),
    });
  }
}
