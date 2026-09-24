import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Fonte variável: sem lista de pesos, para poder pedir os eixos SOFT e WONK,
// que dão ao serifado o carácter que o distingue de um Georgia qualquer.
const display = Fraunces({
  subsets: ["latin"],
  variable: "--fonte-display",
  axes: ["SOFT", "WONK"],
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--fonte-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Gestão de Condomínio",
    template: "%s · Gestão de Condomínio",
  },
  description:
    "Contas, quotas, relatórios e recibos do condomínio, num só sítio.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#274a43",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-PT" className={`${display.variable} ${sans.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
