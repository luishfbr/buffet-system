import { formatBRL } from "@buffet/shared";

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/**
 * Templates de e-mail transacional (RNF09), em pt-BR.
 *
 * HTML inline e tabela de largura fixa de propósito: cliente de e-mail não é
 * navegador — não há suporte confiável a flexbox/grid nem a folha de estilo
 * externa. Sem engine de template: são três e-mails, não um CMS.
 */
const BRAND = "#c8912f";

/**
 * Escapa valor dinâmico antes de entrar no HTML do e-mail.
 *
 * **Obrigatório em todo valor que não seja literal deste arquivo.** Sem isto,
 * o `customerName` do formulário público (anônimo, só limitado a 120 chars) e o
 * nome da organização/convidante (cadastro self-service, sem limite) viram
 * marcação: o atacante escreve um link dentro de um e-mail que sai do **seu**
 * domínio verificado, com SPF/DKIM válidos. Não é XSS — cliente de e-mail
 * remove script —, mas é phishing com remetente confiável.
 */
function esc(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!
  );
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:24px;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1917;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e7e2da;border-radius:12px;">
    <tr><td style="padding:28px;">
      <p style="margin:0 0 20px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND};font-weight:600;">Buffet System</p>
      <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;">${esc(title)}</h1>
      ${bodyHtml}
    </td></tr>
  </table>
  <p style="max-width:520px;margin:16px auto 0;font-size:12px;color:#78716c;text-align:center;">
    Você recebeu este e-mail porque usa o Buffet System.
  </p>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0;">
    <a href="${esc(href)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:15px;">${esc(label)}</a>
  </p>
  <p style="margin:0;font-size:13px;color:#78716c;word-break:break-all;">
    Se o botão não funcionar, copie este endereço: ${esc(href)}
  </p>`;
}

/** RF33 — link de redefinição de senha. */
export function passwordResetEmail(params: {
  name: string;
  url: string;
}): EmailContent {
  const greeting = params.name ? `Olá, ${esc(params.name.split(" ")[0]!)}!` : "Olá!";
  return {
    subject: "Redefinir sua senha — Buffet System",
    html: layout(
      "Redefinir sua senha",
      `<p style="margin:0 0 8px;font-size:15px;line-height:1.6;">${greeting}</p>
       <p style="margin:0;font-size:15px;line-height:1.6;">Recebemos um pedido para redefinir a senha da sua conta. O link vale por 1 hora.</p>
       ${button(params.url, "Criar nova senha")}
       <p style="margin:20px 0 0;font-size:13px;color:#78716c;">Se não foi você quem pediu, ignore este e-mail — sua senha atual continua valendo.</p>`
    ),
    text: `${greeting}

Recebemos um pedido para redefinir a senha da sua conta no Buffet System.
O link vale por 1 hora:

${params.url}

Se não foi você quem pediu, ignore este e-mail — sua senha atual continua valendo.`,
  };
}

/** RF34 — convite para entrar na organização. */
export function invitationEmail(params: {
  orgName: string;
  inviterName: string | null;
  url: string;
}): EmailContent {
  const from = params.inviterName
    ? `${esc(params.inviterName)} convidou`
    : "Você foi convidado";
  return {
    subject: `Convite para o ${params.orgName} — Buffet System`,
    html: layout(
      `Convite para o ${params.orgName}`,
      `<p style="margin:0;font-size:15px;line-height:1.6;">${from} você para trabalhar no <strong>${esc(params.orgName)}</strong> no Buffet System.</p>
       <p style="margin:12px 0 0;font-size:15px;line-height:1.6;">Como funcionário, você acompanha as negociações e o catálogo do buffet.</p>
       ${button(params.url, "Aceitar convite")}
       <p style="margin:20px 0 0;font-size:13px;color:#78716c;">Use este mesmo endereço de e-mail ao criar sua conta.</p>`
    ),
    text: `${from} você para trabalhar no ${params.orgName} no Buffet System.

Aceite o convite em:
${params.url}

Use este mesmo endereço de e-mail ao criar sua conta.`,
  };
}

/**
 * RF32 — aviso de novo lead. É o e-mail que muda o produto: sem ele, um pedido
 * de orçamento fica parado no banco até alguém abrir o painel por acaso.
 */
export function newLeadEmail(params: {
  orgName: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  eventDate: Date | null;
  guestCount: number | null;
  packageName: string | null;
  totalValue: string | null;
  leadUrl: string;
  whatsappUrl: string;
}): EmailContent {
  const date = params.eventDate
    ? params.eventDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })
    : "não informada";
  const rows: [string, string][] = [
    ["WhatsApp", params.customerPhone],
    ["E-mail", params.customerEmail ?? "não informado"],
    ["Data do evento", date],
    ["Convidados", params.guestCount ? String(params.guestCount) : "não informado"],
    ["Pacote", params.packageName ?? "não escolhido"],
    [
      "Estimativa",
      params.totalValue ? formatBRL(params.totalValue) : "a calcular",
    ],
  ];

  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:6px 12px 6px 0;font-size:14px;color:#78716c;white-space:nowrap;">${esc(label)}</td>
          <td style="padding:6px 0;font-size:14px;font-weight:500;">${esc(value)}</td>
        </tr>`
    )
    .join("");

  return {
    subject: `Novo orçamento: ${params.customerName}`,
    html: layout(
      `${params.customerName} pediu um orçamento`,
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Chegou um pedido pela página do ${esc(params.orgName)}.</p>
       <table role="presentation" cellpadding="0" cellspacing="0" border="0">${rowsHtml}</table>
       ${button(params.leadUrl, "Abrir negociação")}
       <p style="margin:20px 0 0;font-size:14px;">
         Ou fale agora: <a href="${esc(params.whatsappUrl)}" style="color:${BRAND};">chamar no WhatsApp</a>
       </p>`
    ),
    text: `${params.customerName} pediu um orçamento pela página do ${params.orgName}.

${rows.map(([label, value]) => `${label}: ${value}`).join("\n")}

Abrir negociação: ${params.leadUrl}
Falar no WhatsApp: ${params.whatsappUrl}`,
  };
}
