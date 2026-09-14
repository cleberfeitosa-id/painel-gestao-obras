import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CONFIGURACAO_APLICACAO } from "@/lib/configuracao-aplicacao";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${CONFIGURACAO_APLICACAO.nomeAplicacao} | ${CONFIGURACAO_APLICACAO.nomeEmpresa}`,
  description: `Sistema de gestao de obras da ${CONFIGURACAO_APLICACAO.nomeEmpresa}. Gerencie projetos, tarefas e equipes em tempo real.`,
  icons: {
    icon: CONFIGURACAO_APLICACAO.faviconUrl
      ? [{ url: CONFIGURACAO_APLICACAO.faviconUrl }]
      : [
          { url: "/favicon.ico", sizes: "any" },
        ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={{
        "--branding-cor-primaria": CONFIGURACAO_APLICACAO.corPrimaria,
        "--branding-cor-destaque": CONFIGURACAO_APLICACAO.corDestaque,
      } as React.CSSProperties}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
