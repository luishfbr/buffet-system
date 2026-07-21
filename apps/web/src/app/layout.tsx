import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Buffet System",
  description: "Gestão de demandas e negociações para buffets",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
