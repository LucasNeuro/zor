import type { Metadata, Viewport } from "next";
import dynamic from "next/dynamic";
import { Poppins, Playfair_Display, Space_Mono } from "next/font/google";
import "./globals.css";

/** Fora do chunk crítico app/layout.js — evita ChunkLoadError por bundle pesado (MobileShell/Supabase). */
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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"),
  title: {
    default: "Waje | IA para atendimento e CRM",
    template: "%s | Waje",
  },
  description:
    "Plataforma Waje da Onze Tecnologia: atendimento WhatsApp, CRM e agentes de IA com operação human-in-the-loop para PMEs.",
  manifest: "/manifest.json",
  keywords: [
    "waje",
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
    title: "Waje",
  },
  icons: {
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
    "apple-mobile-web-app-title": "Waje",
    "msapplication-TileColor": "#ffffff",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${poppins.variable} ${playfair.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className={`${poppins.className} min-h-full flex flex-col`}>
        <MobileDetector>{children}</MobileDetector>
        <IOSInstallBanner />
      </body>
    </html>
  );
}
