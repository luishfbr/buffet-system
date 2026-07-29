import type { Metadata } from "next";
import { Space_Grotesk, Geist, Geist_Mono, Fraunces } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

// Serifa do template "Elegante" da página pública (RF26) — só ela usa.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Buffet System — o sistema comercial do seu buffet, num só lugar",
  description:
    "Do formulário de orçamento ao PIX: capte leads pela sua página, gerencie o funil de negociações e controle as parcelas do seu buffet sem se perder no WhatsApp.",
  openGraph: {
    title: "Buffet System — do primeiro contato ao pagamento final",
    description:
      "Sua página pública de orçamento, funil de negociações e controle financeiro num só lugar. Feito para donos de buffet.",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${geistSans.variable} ${geistMono.variable} ${fraunces.variable}`}
    >
      <body className="min-h-screen antialiased">
        {/* Único context provider do app (RNF08) — ver apps/web/CLAUDE.md. */}
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
