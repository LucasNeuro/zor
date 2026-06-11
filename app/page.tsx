import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Waje | Plataforma de IA para Atendimento e CRM",
  description:
    "A Waje centraliza atendimento WhatsApp, CRM e agentes de IA com operação humana assistida para PMEs e profissionais autônomos.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Waje | IA para atendimento e CRM",
    description:
      "Atenda mais rápido com IA, sua equipe no controle e gestão de várias empresas em uma plataforma.",
    url: "/",
    siteName: "Waje",
    type: "website",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Waje | IA para atendimento e CRM",
    description: "Plataforma de atendimento com agentes de IA, WhatsApp e CRM para PMEs.",
  },
};

const faqItems = [
  {
    question: "A Waje substitui totalmente o atendimento humano?",
    answer: "Não. A Waje acelera a operação com IA e mantém o humano no ciclo para decisões críticas.",
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

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Waje",
      url: "https://waje.com.br",
      description: "Plataforma de atendimento com IA, CRM e operação com equipe humana no controle.",
    },
    {
      "@type": "SoftwareApplication",
      name: "Waje",
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

export default function HomePage() {
  return (
    <main className="waje-landing-bg min-h-screen overflow-x-hidden">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <LandingNav />
      <LandingHero />
      <LandingMarquee />
      <LandingChatDemo />
      <LandingFeatureGrid />
      <LandingAgentCarousel />
      <LandingEcosystem />
      <LandingStats />
      <LandingFaq items={faqItems} />
      <LandingCta />
      <FloatingWajeAssistant />

      <footer className="border-t border-[#dce7d8] px-4 py-8 text-center text-xs text-[#8aa892]">
        © {new Date().getFullYear()} Waje · Escritório Virtual
      </footer>
    </main>
  );
}
