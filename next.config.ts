import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Oculta o badge flutuante "N" do Next.js em dev (sobrepunha a barra mobile). */
  devIndicators: false,
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
