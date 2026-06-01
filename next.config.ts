import type { NextConfig } from "next";

/**
 * distDir tem de ser relativo à raiz do projeto (Next.js não aceita path absoluto).
 * Em dev usamos `.next-dev` separado para reduzir conflito com cache antigo / OneDrive.
 */
const nextConfig: NextConfig = {
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
    ];
  },
};

export default nextConfig;
