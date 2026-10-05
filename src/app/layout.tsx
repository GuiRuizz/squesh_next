import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

/**
 * Layout raiz.
 *
 * `lang="pt-BR"` porque todo o texto do painel é em português — isso também
 * governa a hifenização, os algarismos e a pronúncia dos leitores de tela.
 *
 * A classe `dark` no `<html>` é redundante (o painel é dark-only e o globals.css
 * aplica a mesma paleta em `:root` e `.dark`), mas fica para que qualquer
 * variante do shadcn que dependa dela funcione sem ajuste.
 *
 * A fonte é a Geist via `--font-sans`, e não uma fonte do app: o painel é uma
 * ferramenta de leitura densa, e a tipografia do Flutter não está disponível
 * como webfont.
 */
const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Squesh Admin",
  description: "Painel administrativo da Squesh",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={cn("dark font-sans", geist.variable)}
      suppressHydrationWarning
    >
      <body className={cn("antialiased", geist.variable)}>{children}</body>
    </html>
  );
}
