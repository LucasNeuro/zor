import type { Metadata } from "next";
import { headers } from "next/headers";
import { LandingNav } from "@/components/landing/LandingNav";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingMarquee } from "@/components/landing/LandingMarquee";
import { LandingChatDemo } from "@/components/landing/LandingChatDemo";
import { LandingFeatureGrid } from "@/components/landing/LandingFeatureGrid";
import { LandingAgentCarousel } from "@/components/landing/LandingAgentCarousel";
import { LandingEcosystem } from "@/components/landing/LandingEcosystem";
import { LandingStats } from "@/components/landing/LandingStats";
import { LandingFaq } from "@/components/landing/LandingFaq";
import { LandingCta } from "@/components/landing/LandingCta";
import { FloatingWajeAssistant } from "@/components/landing/FloatingWajeAssistant";
import {
  hostFromHeaders,
  resolvePlatformBrand,
  toPlatformBrandPublic,
} from "@/lib/platform-brands";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const brand = toPlatformBrandPublic(await resolvePlatformBrand(hostFromHeaders(h)));
  return {
    title: `${brand.nome} | Plataforma de IA para Atendimento e CRM`,
    description: `A ${brand.nome} centraliza atendimento WhatsApp, CRM e agentes de IA com operação humana assistida para PMEs e profissionais autônomos.`,
    alternates: { canonical: "/" },
    openGraph: {
      title: `${brand.nome} | IA para atendimento e CRM`,
      description:
        "Atenda mais rápido com IA, sua equipe no controle e gestão de várias empresas em uma plataforma.",
      url: "/",
      siteName: brand.nome,
      type: "website",
      locale: "pt_BR",
    },
    twitter: {
      card: "summary_large_image",
      title: `${brand.nome} | IA para atendimento e CRM`,
      description: "Plataforma de atendimento com agentes de IA, WhatsApp e CRM para PMEs.",
    },
  };
}

function faqForBrand(brandNome: string) {
  return [
    {
      question: `A ${brandNome} substitui totalmente o atendimento humano?`,
      answer: `Não. A ${brandNome} acelera a operação com IA e mantém o humano no ciclo para decisões críticas.`,
    },
    {
      question: "Posso começar somente com WhatsApp?",
      answer: "Sim. O fluxo pode iniciar no WhatsApp e evoluir para CRM e automações conforme o crescimento.",
    },
    {
      question: "A plataforma suporta múltiplas empresas no mesmo ambiente?",
      answer: "Sim. Você pode gerir várias empresas ou marcas na mesma plataforma, cada uma com dados e regras separados.",
    },
  ];
}

export default async function HomePage() {
  const h = await headers();
  const brand = toPlatformBrandPublic(await resolvePlatformBrand(hostFromHeaders(h)));
  const faqItems = faqForBrand(brand.nome);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: brand.nome,
        url: `https://${hostFromHeaders(h) || "waje.com.br"}`,
        description: "Plataforma de atendimento com IA, CRM e operação com equipe humana no controle.",
      },
      {
        "@type": "SoftwareApplication",
        name: brand.nome,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: "pt-BR",
        description: "Plataforma para atendimento WhatsApp, CRM e assistentes de IA — ideal para PMEs.",
        offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
      },
      {
        "@type": "FAQPage",
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };

  return (
    <main className="waje-landing-bg min-h-screen overflow-x-hidden">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <LandingNav />
      <LandingHero brandNome={brand.nome} />
      <LandingMarquee />
      <LandingChatDemo brandNome={brand.nome} />
      <LandingFeatureGrid />
      <LandingAgentCarousel />
      <LandingEcosystem brandNome={brand.nome} />
      <LandingStats />
      <LandingFaq items={faqItems} />
      <LandingCta brandNome={brand.nome} />
      {brand.landingAssistantAtivo !== false ? <FloatingWajeAssistant /> : null}

      <footer className="border-t border-[#dce7d8] px-4 py-8 text-center text-xs text-[#8aa892]">
        © {new Date().getFullYear()} {brand.nome} · Escritório Virtual
      </footer>
    </main>
  );
}
