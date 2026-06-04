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
  title: "Obra10+",
  description: "Central de operações da Obra10+ — leads, agentes e campanhas em tempo real",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Obra10+",
  },
  icons: {
    icon: [
      { url: "/icon", sizes: "512x512", type: "image/png" },
      { url: "/icon", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "Obra10+",
    "msapplication-TileColor": "#003b26",
  },
};

export const viewport: Viewport = {
  themeColor: "#003b26",
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
