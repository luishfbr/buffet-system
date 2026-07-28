import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MailerService } from "./mail.service.js";
import {
  invitationEmail,
  newLeadEmail,
  passwordResetEmail,
} from "./mail.templates.js";

const originalEnv = { ...process.env };

/**
 * O driver é escolhido no construtor — instancie DEPOIS de mexer no env.
 * `delete` em vez de atribuir `undefined`: `process.env` coage o valor para a
 * string "undefined", que é truthy e escolheria o driver errado.
 */
function makeService(env: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return new MailerService();
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("MailerService (RNF09)", () => {
  it("usa o driver console quando não há RESEND_API_KEY", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const mailer = makeService({ RESEND_API_KEY: undefined });

    const result = await mailer.send({
      to: "dona@buffet.com",
      ...passwordResetEmail({ name: "Dona Demo", url: "https://x/reset?t=1" }),
    });

    expect(result).toEqual({ ok: true, driver: "console" });
    // Sem chave, nada de rede: o e-mail vai para o terminal.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posta no Resend quando há chave", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
    const mailer = makeService({
      RESEND_API_KEY: "re_test",
      MAIL_FROM: "Buffet <no-reply@buffet.com>",
    });

    const result = await mailer.send({
      to: ["a@b.com", "c@d.com"],
      subject: "Assunto",
      html: "<p>oi</p>",
      text: "oi",
    });

    expect(result).toEqual({ ok: true, driver: "resend" });
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String(init?.body));
    expect(body.to).toEqual(["a@b.com", "c@d.com"]);
    expect(body.from).toBe("Buffet <no-reply@buffet.com>");
  });

  it("não lança quando o provedor devolve erro", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("quota exceeded", { status: 429 })
    );
    const mailer = makeService({ RESEND_API_KEY: "re_test" });

    await expect(
      mailer.send({ to: "a@b.com", subject: "s", html: "h", text: "t" })
    ).resolves.toEqual({ ok: false, driver: "resend" });
  });

  it("não lança quando a rede falha — captar um lead não pode quebrar por e-mail (RF32)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    const mailer = makeService({ RESEND_API_KEY: "re_test" });

    await expect(
      mailer.send({ to: "a@b.com", subject: "s", html: "h", text: "t" })
    ).resolves.toEqual({ ok: false, driver: "resend" });
  });

  it("ignora envio sem destinatário", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const mailer = makeService({ RESEND_API_KEY: "re_test" });

    const result = await mailer.send({
      to: [],
      subject: "s",
      html: "h",
      text: "t",
    });

    expect(result.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("templates de e-mail", () => {
  it("formata o aviso de novo lead com dinheiro em BRL e link da negociação", () => {
    const mail = newLeadEmail({
      orgName: "Buffet Demo",
      customerName: "Marina Alves",
      customerPhone: "11991110001",
      customerEmail: null,
      eventDate: new Date("2026-09-15T00:00:00.000Z"),
      guestCount: 80,
      packageName: "Pacote Ouro",
      totalValue: "12000.00",
      leadUrl: "http://localhost:3000/dashboard/leads?open=lead-1",
      whatsappUrl: "https://wa.me/5511991110001",
    });

    expect(mail.subject).toBe("Novo orçamento: Marina Alves");
    expect(mail.text).toContain("R$");
    expect(mail.text).toContain("12.000,00");
    // Data do evento é date-only: renderiza em UTC, não no fuso do servidor.
    expect(mail.text).toContain("15/09/2026");
    expect(mail.html).toContain("open=lead-1");
    expect(mail.text).toContain("não informado");
  });

  it("mantém a estimativa legível quando o lead não escolheu pacote", () => {
    const mail = newLeadEmail({
      orgName: "Buffet Demo",
      customerName: "Tatiane",
      customerPhone: "11991110004",
      customerEmail: "t@e.com",
      eventDate: null,
      guestCount: null,
      packageName: null,
      totalValue: null,
      leadUrl: "http://x/y",
      whatsappUrl: "https://wa.me/55",
    });

    expect(mail.text).toContain("não informada");
    expect(mail.text).toContain("não escolhido");
    expect(mail.text).toContain("a calcular");
  });
});

describe("escape de HTML nos e-mails", () => {
  it("neutraliza marcação vinda do formulário público (anônimo)", () => {
    const payload = '<a href="https://evil.tld">Confirme o pagamento</a>';
    const mail = newLeadEmail({
      orgName: "Buffet Demo",
      customerName: payload,
      customerPhone: "11999999999",
      customerEmail: null,
      eventDate: null,
      guestCount: null,
      packageName: null,
      totalValue: null,
      leadUrl: "http://localhost:3000/dashboard/leads?open=1",
      whatsappUrl: "https://wa.me/5511999999999",
    });

    // A âncora do atacante não pode virar link clicável no e-mail do dono.
    expect(mail.html).not.toContain('<a href="https://evil.tld"');
    expect(mail.html).toContain("&lt;a href=&quot;https://evil.tld&quot;&gt;");
    // Só os links que o próprio sistema montou continuam sendo âncoras.
    expect(mail.html).toContain('<a href="http://localhost:3000/dashboard/leads?open=1"');
  });

  it("neutraliza o nome da organização e de quem convida", () => {
    const mail = invitationEmail({
      orgName: '<img src=x onerror="alert(1)">Buffet',
      inviterName: "<b>Fulano</b>",
      url: "http://localhost:3000/invite/abc",
    });

    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).not.toContain("<b>Fulano</b>");
    expect(mail.html).toContain("&lt;img src=x");
  });

  it("preserva o texto puro legível (o assunto e o corpo texto não são HTML)", () => {
    const mail = passwordResetEmail({
      name: "Dona Demonstração",
      url: "http://localhost:3333/api/auth/reset-password/tok?callbackURL=x",
    });
    expect(mail.subject).toBe("Redefinir sua senha — Buffet System");
    expect(mail.text).toContain("Olá, Dona!");
    expect(mail.text).toContain("reset-password/tok");
  });
});
