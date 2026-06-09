import type { NextConfig } from "next";

/**
 * distDir tem de ser relativo à raiz do projeto (Next.js não aceita path absoluto).
 * Em dev usamos `.next-dev` separado para reduzir conflito com cache antigo / OneDrive.
 */
const nextConfig: NextConfig = {
  /**
   * IPs da rede local (preenchido automaticamente por scripts/dev-insecure-tls.cjs).
   * Sem isto, abrir http://192.168.x.x:3001 bloqueia JS/CSS e o login não funciona.
   */
  allowedDevOrigins:
    process.env.NODE_ENV === "development"
      ? [
          ...new Set([
            "localhost",
            "127.0.0.1",
            ...(process.env.NEXT_DEV_ALLOWED_ORIGINS?.split(",")
              .map((s) => s.trim())
              .filter(Boolean) ?? []),
          ]),
        ]
      : undefined,
  /** Oculta o badge flutuante "N" do Next.js em dev (sobrepunha a barra mobile). */
  devIndicators: false,
  ...(process.env.NODE_ENV === "development"
    ? { distDir: process.env.NEXT_DIST_DIR?.trim() || ".next-dev" }
    : {}),
  /**
   * Mantemos bloco turbos explícito para compatibilizar Next 16 quando
   * também há customizações de webpack (usadas no modo dev --webpack).
   */
  turbopack: {},
  webpack: (config, { dev }) => {
    if (dev) {
      // Evita falhas de PackFileCacheStrategy (rename/open) em pastas sincronizadas pelo OneDrive.
      config.cache = { type: "memory" };
      config.snapshot = {
        ...config.snapshot,
        managedPaths: [],
        immutablePaths: [],
      };
    }
    return config;
  },
  async redirects() {
    return [
      {
        source: "/crm/kpis",
        destination: "/crm/analytics",
        permanent: true,
      },
      {
        source: "/crm/funis",
        destination: "/crm/leads",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
