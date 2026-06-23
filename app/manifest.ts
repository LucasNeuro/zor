import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import {
  hostFromHeaders,
  resolvePlatformBrand,
  toPlatformBrandPublic,
} from "@/lib/platform-brands";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const h = await headers();
  const brand = toPlatformBrandPublic(await resolvePlatformBrand(hostFromHeaders(h)));
  const icon192 = brand.faviconUrl || "/favicons/favicon-192x192.png";
  const icon512 = brand.logoUrl || brand.faviconUrl || "/favicons/favicon-512x512.png";

  return {
    name: brand.nome,
    short_name: brand.nome.length > 12 ? brand.nome.slice(0, 12) : brand.nome,
    description: `Atendimento WhatsApp, CRM e agentes de IA — ${brand.nome}`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    background_color: brand.corFundo || "#f8fcf6",
    theme_color: "#ffffff",
    orientation: "portrait-primary",
    lang: "pt-BR",
    dir: "ltr",
    categories: ["business", "productivity"],
    prefer_related_applications: false,
    icons: [
      { src: icon192, sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: icon512, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Cadastro",
        short_name: "Cadastro",
        description: "Criar conta e iniciar onboarding",
        url: "/cadastro",
        icons: [{ src: icon192, sizes: "192x192" }],
      },
      {
        name: "Login",
        short_name: "Login",
        description: "Entrar na plataforma",
        url: "/login",
        icons: [{ src: icon192, sizes: "192x192" }],
      },
    ],
  };
}
