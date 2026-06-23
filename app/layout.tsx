import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import dynamic from "next/dynamic";
import { headers } from "next/headers";
import { Poppins, Playfair_Display, Space_Mono } from "next/font/google";
import { PlatformBrandProvider } from "@/components/brand/PlatformBrandProvider";
import {
  hostFromHeaders,
  resolvePlatformBrand,
  toPlatformBrandPublic,
} from "@/lib/platform-brands";
import { platformBrandCssVars, platformBrandHtmlAttrs } from "@/lib/platform-brand-theme";
import "./globals.css";

/** Reservado — shell mobile Obra10 desativado; componente repassa children. */
const MobileDetector = dynamic(() => import("@/components/mobile/MobileDetector"));

const IOSInstallBanner = dynamic(() => import("@/components/IOSInstallBanner"));

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-playfair",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = hostFromHeaders(h);
  const brand = toPlatformBrandPublic(await resolvePlatformBrand(host));
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host ? `https://${host}` : "http://localhost:3001");

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: `${brand.nome} | IA para atendimento e CRM`,
      template: `%s | ${brand.nome}`,
    },
    description: `Plataforma ${brand.nome}: atendimento WhatsApp, CRM e agentes de IA com operação human-in-the-loop para PMEs.`,
    keywords: [
      brand.nome.toLowerCase(),
      "crm com ia",
      "atendimento whatsapp",
      "agente de ia",
      "human in the loop",
      "multitenant saas",
    ],
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    category: "business",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: brand.nome,
    },
    icons: brand.faviconUrl
      ? {
          icon: [{ url: brand.faviconUrl }],
          shortcut: brand.faviconUrl,
          apple: [{ url: brand.faviconUrl }],
        }
      : {
          icon: [
            { url: "/favicons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
            { url: "/favicons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
            { url: "/favicons/favicon-48x48.png", sizes: "48x48", type: "image/png" },
            { url: "/favicons/favicon-192x192.png", sizes: "192x192", type: "image/png" },
            { url: "/favicons/favicon-512x512.png", sizes: "512x512", type: "image/png" },
          ],
          shortcut: "/favicons/favicon-32x32.png",
          apple: [{ url: "/favicons/favicon-180x180.png", sizes: "180x180", type: "image/png" }],
        },
    other: {
      "mobile-web-app-capable": "yes",
      "apple-mobile-web-app-capable": "yes",
      "apple-mobile-web-app-status-bar-style": "black-translucent",
      "apple-mobile-web-app-title": brand.nome,
      "msapplication-TileColor": "#ffffff",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const h = await headers();
  const host = hostFromHeaders(h);
  const initialBrand = toPlatformBrandPublic(await resolvePlatformBrand(host));
  const htmlStyle = platformBrandCssVars(initialBrand);
  const htmlData = platformBrandHtmlAttrs(initialBrand);

  return (
    <html
      lang="pt-BR"
      className={`${poppins.variable} ${playfair.variable} ${spaceMono.variable} h-full antialiased`}
      style={htmlStyle as CSSProperties}
      {...htmlData}
    >
      <head>
        {initialBrand.faviconUrl ? (
          <link rel="icon" href={initialBrand.faviconUrl} data-platform-brand-favicon="1" />
        ) : null}
      </head>
      <body className={`${poppins.className} min-h-full flex flex-col`}>
        <PlatformBrandProvider initialBrand={initialBrand}>
          <MobileDetector>{children}</MobileDetector>
        </PlatformBrandProvider>
        <IOSInstallBanner />
      </body>
    </html>
  );
}
