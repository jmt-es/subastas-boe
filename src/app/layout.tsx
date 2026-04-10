import type { Metadata, Viewport } from "next";
import { EB_Garamond, JetBrains_Mono, Lato } from "next/font/google";
import "./globals.css";

const lato = Lato({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
});

const ebGaramond = EB_Garamond({
  variable: "--font-editorial",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-code",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Subasta — Inteligencia para subastas judiciales",
    template: "%s | Subasta",
  },
  description:
    "Plataforma para capturar, analizar y priorizar subastas judiciales del BOE con una interfaz editorial y capas de inteligencia artificial.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4ede1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${lato.variable} ${ebGaramond.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
