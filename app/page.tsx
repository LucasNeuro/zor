import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronRight,
  MessageCircle,
  ShieldCheck,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import { TiviaBrand } from "@/components/brand/TiviaBrand";
import { ScrollReveal } from "@/components/landing/ScrollReveal";

export const metadata: Metadata = {
  title: "TIVIA | Plataforma de IA para Atendimento e CRM",
  description:
    "A TIVIA centraliza atendimento WhatsApp, CRM e agentes de IA com operação humana assistida para PMEs e profissionais autônomos.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "TIVIA | IA para atendimento e CRM",
    description:
      "Atenda mais rápido com agentes de IA, fluxo human-in-the-loop e gestão multitenant em uma única plataforma.",
    url: "/",
    siteName: "TIVIA",
    type: "website",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: "TIVIA | IA para atendimento e CRM",
    description: "Plataforma de atendimento com agentes de IA, WhatsApp e CRM para PMEs.",
  },
};

const faqItems = [
  {
    question: "A TIVIA substitui totalmente o atendimento humano?",
    answer: "Não. A TIVIA acelera a operação com IA e mantém o humano no ciclo para decisões críticas.",
  },
  {
    question: "Posso começar somente com WhatsApp?",
    answer:
      "Sim. O fluxo pode iniciar no WhatsApp e evoluir para CRM e automações conforme o crescimento.",
  },
  {
    question: "A plataforma suporta múltiplas empresas no mesmo ambiente?",
    answer:
      "Sim. A arquitetura é multitenant, com isolamento de dados, regras e agentes por tenant.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "TIVIA",
      url: "https://tivia.app",
      description: "Plataforma de atendimento com agentes de IA, CRM e operação human-in-the-loop.",
    },
    {
      "@type": "SoftwareApplication",
      name: "TIVIA",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "pt-BR",
      description: "Plataforma multitenant para atendimento WhatsApp, CRM e agentes de IA para PMEs.",
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

/* ─── SVG Illustrations ─────────────────────────────────────────────── */

function ChatIllustration() {
  return (
    <svg
      viewBox="0 0 280 210"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto w-full max-w-[260px]"
      aria-hidden="true"
    >
      {/* window */}
      <rect x="10" y="10" width="260" height="190" rx="20" fill="#f0f9ec" stroke="#c8e6c0" strokeWidth="1.5" />
      {/* header bar */}
      <rect x="10" y="10" width="260" height="54" rx="20" fill="#e4f2de" />
      <rect x="10" y="40" width="260" height="24" fill="#e4f2de" />
      {/* avatar */}
      <circle cx="48" cy="37" r="16" fill="#3f9848" />
      {/* robot face */}
      <rect x="40" y="29" width="16" height="12" rx="3.5" fill="rgba(255,255,255,0.88)" />
      <circle cx="44" cy="34" r="2" fill="#3f9848" />
      <circle cx="52" cy="34" r="2" fill="#3f9848" />
      <path d="M43 38 Q48 41 53 38" stroke="#3f9848" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      {/* antenna */}
      <rect x="46" y="22" width="4" height="8" rx="2" fill="#3f9848" />
      <circle cx="48" cy="21" r="2.5" fill="#92ff00" />
      {/* online dot */}
      <circle cx="62" cy="52" r="5" fill="#92ff00" stroke="#e4f2de" strokeWidth="1.5" />
      {/* name bars */}
      <rect x="72" y="28" width="76" height="8" rx="4" fill="#b0d8a8" />
      <rect x="72" y="40" width="52" height="7" rx="3.5" fill="#c8e6c0" />
      {/* AI badge */}
      <rect x="220" y="26" width="38" height="18" rx="9" fill="#0b1f10" />
      <rect x="228" y="32" width="22" height="6" rx="3" fill="#92ff00" opacity="0.85" />
      {/* message 1 – received */}
      <rect x="20" y="74" width="150" height="38" rx="14" fill="white" stroke="#e0ede0" strokeWidth="1" />
      <rect x="34" y="86" width="122" height="7" rx="3.5" fill="#daecd8" />
      <rect x="34" y="97" width="88" height="6" rx="3" fill="#ecf6ea" />
      {/* message 2 – sent */}
      <rect x="110" y="124" width="150" height="38" rx="14" fill="#92ff00" opacity="0.88" />
      <rect x="124" y="136" width="122" height="7" rx="3.5" fill="#1a4020" opacity="0.38" />
      <rect x="124" y="147" width="88" height="6" rx="3" fill="#1a4020" opacity="0.24" />
      {/* double tick */}
      <path d="M250 154 L253 157 L259 150" stroke="#1a4020" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
      {/* typing indicator */}
      <rect x="20" y="174" width="72" height="24" rx="12" fill="white" stroke="#e0ede0" strokeWidth="1" />
      <circle cx="42" cy="186" r="4" fill="#92ff00" />
      <circle cx="56" cy="186" r="4" fill="#92ff00" opacity="0.55" />
      <circle cx="70" cy="186" r="4" fill="#92ff00" opacity="0.25" />
      {/* sparkle top-right */}
      <path d="M252 24 L254.5 17 L257 24 L264 26.5 L257 29 L254.5 36 L252 29 L245 26.5 Z" fill="#92ff00" />
      <path d="M240 16 L241.4 12 L242.8 16 L246.8 17.4 L242.8 18.8 L241.4 23 L240 18.8 L236 17.4 Z" fill="#92ff00" opacity="0.42" />
    </svg>
  );
}

function PipelineIllustration() {
  return (
    <svg
      viewBox="0 0 280 210"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto w-full max-w-[260px]"
      aria-hidden="true"
    >
      {/* background */}
      <rect x="10" y="10" width="260" height="190" rx="20" fill="#f0f9ec" stroke="#c8e6c0" strokeWidth="1.5" />
      {/* col headers */}
      <rect x="22" y="26" width="70" height="26" rx="9" fill="#e4f2de" />
      <rect x="32" y="35" width="50" height="7" rx="3.5" fill="#a8d5a0" />
      <rect x="105" y="26" width="70" height="26" rx="9" fill="#d4eacc" />
      <rect x="115" y="35" width="50" height="7" rx="3.5" fill="#92ff00" opacity="0.6" />
      <rect x="188" y="26" width="70" height="26" rx="9" fill="#3f9848" />
      <rect x="198" y="35" width="50" height="7" rx="3.5" fill="white" opacity="0.85" />
      {/* col 1 cards */}
      <rect x="22" y="60" width="70" height="48" rx="10" fill="white" stroke="#e0ede0" strokeWidth="1" />
      <rect x="32" y="72" width="50" height="7" rx="3.5" fill="#daecd8" />
      <rect x="32" y="83" width="36" height="6" rx="3" fill="#f0f7ee" />
      <circle cx="73" cy="97" r="6" fill="#f0f7ee" stroke="#c8e6c0" strokeWidth="1" />
      <rect x="22" y="116" width="70" height="48" rx="10" fill="white" stroke="#e0ede0" strokeWidth="1" />
      <rect x="32" y="128" width="50" height="7" rx="3.5" fill="#daecd8" />
      <rect x="32" y="139" width="36" height="6" rx="3" fill="#f0f7ee" />
      <circle cx="73" cy="153" r="6" fill="#f0f7ee" stroke="#c8e6c0" strokeWidth="1" />
      {/* arrows col 1 → 2 */}
      <path d="M94 84 L103 84" stroke="#92ff00" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 2.5" />
      <path d="M99 80 L103 84 L99 88" stroke="#92ff00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M94 140 L103 140" stroke="#92ff00" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 2.5" />
      <path d="M99 136 L103 140 L99 144" stroke="#92ff00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* col 2 card */}
      <rect x="105" y="60" width="70" height="48" rx="10" fill="white" stroke="#b8d8b2" strokeWidth="1.5" />
      <rect x="115" y="72" width="50" height="7" rx="3.5" fill="#b8d8b2" />
      <rect x="115" y="83" width="36" height="6" rx="3" fill="#dcefd8" />
      <circle cx="156" cy="97" r="6" fill="#d8ecd4" stroke="#b8d8b2" strokeWidth="1" />
      {/* arrow col 2 → 3 */}
      <path d="M177 84 L186 84" stroke="#3f9848" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 2.5" />
      <path d="M182 80 L186 84 L182 88" stroke="#3f9848" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* col 3 card – success */}
      <rect x="188" y="60" width="70" height="48" rx="10" fill="#3f9848" />
      <rect x="198" y="72" width="50" height="7" rx="3.5" fill="white" opacity="0.6" />
      <rect x="198" y="83" width="36" height="6" rx="3" fill="white" opacity="0.38" />
      <circle cx="229" cy="97" r="8" fill="#92ff00" />
      <path d="M225 97 L228 100 L233 93" stroke="#0b1f10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* bottom stats */}
      <rect x="22" y="174" width="236" height="18" rx="9" fill="white" stroke="#e0ede0" strokeWidth="1" />
      <rect x="34" y="180" width="52" height="6" rx="3" fill="#e4f2de" />
      <rect x="114" y="180" width="52" height="6" rx="3" fill="#d4eacc" />
      <rect x="194" y="180" width="52" height="6" rx="3" fill="#92ff00" opacity="0.45" />
    </svg>
  );
}

function HumanLoopIllustration() {
  return (
    <svg
      viewBox="0 0 280 210"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto w-full max-w-[260px]"
      aria-hidden="true"
    >
      {/* background */}
      <rect x="10" y="10" width="260" height="190" rx="20" fill="#f0f9ec" stroke="#c8e6c0" strokeWidth="1.5" />
      {/* human circle */}
      <circle cx="72" cy="82" r="32" fill="#e4f2de" stroke="#c8e6c0" strokeWidth="1.5" />
      <circle cx="72" cy="70" r="13" fill="#3f9848" />
      <path d="M49 100 Q49 87 72 87 Q95 87 95 100" fill="#3f9848" />
      <rect x="54" y="120" width="36" height="15" rx="7.5" fill="#3f9848" />
      <rect x="62" y="126" width="20" height="5" rx="2.5" fill="white" opacity="0.85" />
      {/* AI circle */}
      <circle cx="208" cy="82" r="32" fill="#0b1f10" stroke="#3f9848" strokeWidth="1.5" />
      <rect x="196" y="65" width="24" height="22" rx="5.5" fill="#92ff00" opacity="0.9" />
      <circle cx="203" cy="74" r="2.5" fill="#0b1f10" />
      <circle cx="213" cy="74" r="2.5" fill="#0b1f10" />
      <rect x="201" y="80" width="14" height="3" rx="1.5" fill="#0b1f10" opacity="0.55" />
      <rect x="202" y="57" width="4" height="9" rx="2" fill="#92ff00" />
      <circle cx="204" cy="56" r="2.5" fill="#92ff00" opacity="0.7" />
      <rect x="192" y="70" width="5" height="3.5" rx="1.5" fill="#92ff00" opacity="0.65" />
      <rect x="219" y="70" width="5" height="3.5" rx="1.5" fill="#92ff00" opacity="0.65" />
      <rect x="190" y="120" width="36" height="15" rx="7.5" fill="#0b1f10" />
      <rect x="198" y="126" width="20" height="5" rx="2.5" fill="#92ff00" opacity="0.85" />
      {/* dashed bridge */}
      <path
        d="M106 82 L174 82"
        stroke="#92ff00"
        strokeWidth="2.5"
        strokeDasharray="6 4"
        strokeLinecap="round"
      />
      {/* arrows both ways */}
      <path d="M110 76 L104 82 L110 88" stroke="#92ff00" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M170 76 L176 82 L170 88" stroke="#92ff00" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* center decision node */}
      <circle cx="140" cy="82" r="20" fill="white" stroke="#92ff00" strokeWidth="2" />
      <path d="M132 82 L137 87 L148 75" stroke="#3f9848" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* bottom flow strip */}
      <rect x="24" y="152" width="232" height="38" rx="11" fill="white" stroke="#e0ede0" strokeWidth="1" />
      {/* step 1 */}
      <circle cx="46" cy="171" r="8" fill="#e4f2de" stroke="#c8e6c0" strokeWidth="1" />
      <path d="M43 171 L46 174 L51 166" stroke="#3f9848" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="60" y="167" width="36" height="6" rx="3" fill="#e4f2de" />
      <rect x="60" y="176" width="24" height="4" rx="2" fill="#f0f7ee" />
      {/* divider */}
      <path d="M106 163 L118 163" stroke="#d0e8cc" strokeWidth="1.5" strokeDasharray="3 2" />
      {/* step 2 */}
      <circle cx="128" cy="171" r="8" fill="#3f9848" />
      <path d="M125 171 L128 174 L133 166" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="142" y="167" width="36" height="6" rx="3" fill="#e4f2de" />
      <rect x="142" y="176" width="24" height="4" rx="2" fill="#f0f7ee" />
      {/* divider */}
      <path d="M188 163 L200 163" stroke="#d0e8cc" strokeWidth="1.5" strokeDasharray="3 2" />
      {/* step 3 */}
      <circle cx="210" cy="171" r="8" fill="#0b1f10" />
      <path d="M207 171 L210 174 L215 166" stroke="#92ff00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="224" y="167" width="24" height="6" rx="3" fill="#e4f2de" />
      <rect x="224" y="176" width="18" height="4" rx="2" fill="#f0f7ee" />
    </svg>
  );
}

function DashboardIllustration() {
  return (
    <svg
      viewBox="0 0 280 210"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto w-full max-w-[260px]"
      aria-hidden="true"
    >
      {/* background */}
      <rect x="10" y="10" width="260" height="190" rx="20" fill="#f0f9ec" stroke="#c8e6c0" strokeWidth="1.5" />
      {/* top KPI row */}
      <rect x="22" y="24" width="70" height="44" rx="10" fill="white" stroke="#e0ede0" strokeWidth="1" />
      <rect x="32" y="34" width="30" height="7" rx="3.5" fill="#daecd8" />
      <rect x="32" y="45" width="50" height="12" rx="4" fill="#3f9848" />
      <rect x="36" y="49" width="28" height="4" rx="2" fill="white" opacity="0.75" />

      <rect x="105" y="24" width="70" height="44" rx="10" fill="white" stroke="#e0ede0" strokeWidth="1" />
      <rect x="115" y="34" width="30" height="7" rx="3.5" fill="#daecd8" />
      <rect x="115" y="45" width="50" height="12" rx="4" fill="#92ff00" opacity="0.85" />
      <rect x="119" y="49" width="28" height="4" rx="2" fill="#0b1f10" opacity="0.45" />

      <rect x="188" y="24" width="70" height="44" rx="10" fill="white" stroke="#e0ede0" strokeWidth="1" />
      <rect x="198" y="34" width="30" height="7" rx="3.5" fill="#daecd8" />
      <rect x="198" y="45" width="50" height="12" rx="4" fill="#0b1f10" />
      <rect x="202" y="49" width="28" height="4" rx="2" fill="#92ff00" opacity="0.7" />

      {/* chart area */}
      <rect x="22" y="78" width="236" height="84" rx="12" fill="white" stroke="#e0ede0" strokeWidth="1" />
      {/* grid lines */}
      <path d="M34 140 L256 140" stroke="#f0f7ee" strokeWidth="1" />
      <path d="M34 126 L256 126" stroke="#f0f7ee" strokeWidth="1" />
      <path d="M34 112 L256 112" stroke="#f0f7ee" strokeWidth="1" />
      <path d="M34 98 L256 98" stroke="#f0f7ee" strokeWidth="1" />
      {/* bars */}
      <rect x="42" y="122" width="22" height="18" rx="4" fill="#e4f2de" />
      <rect x="74" y="110" width="22" height="30" rx="4" fill="#c8e6c0" />
      <rect x="106" y="104" width="22" height="36" rx="4" fill="#92ff00" opacity="0.5" />
      <rect x="138" y="114" width="22" height="26" rx="4" fill="#92ff00" opacity="0.7" />
      <rect x="170" y="98" width="22" height="42" rx="4" fill="#3f9848" />
      <rect x="202" y="92" width="22" height="48" rx="4" fill="#3f9848" opacity="0.85" />
      <rect x="234" y="86" width="22" height="54" rx="4" fill="#0b1f10" />
      {/* trend line */}
      <path
        d="M53 128 L85 116 L117 110 L149 120 L181 102 L213 96 L245 88"
        stroke="#92ff00"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* dot on last point */}
      <circle cx="245" cy="88" r="4.5" fill="#92ff00" stroke="white" strokeWidth="1.5" />
      {/* legend */}
      <rect x="22" y="172" width="236" height="20" rx="8" fill="white" stroke="#e0ede0" strokeWidth="1" />
      <circle cx="38" cy="182" r="4" fill="#3f9848" />
      <rect x="46" y="179" width="36" height="5" rx="2.5" fill="#e4f2de" />
      <circle cx="104" cy="182" r="4" fill="#92ff00" />
      <rect x="112" y="179" width="36" height="5" rx="2.5" fill="#e4f2de" />
      <circle cx="170" cy="182" r="4" fill="#0b1f10" />
      <rect x="178" y="179" width="36" height="5" rx="2.5" fill="#e4f2de" />
    </svg>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <main className="tivia-landing-bg min-h-[100dvh] pb-20 text-[#1c2a1c]">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Header ────────────────────────────────────── */}
      <header className="fixed left-0 right-0 top-0 z-40 border-b border-[#dce7d8] bg-white/95 shadow-[0_4px_24px_rgba(15,40,20,0.07)] backdrop-blur-md">
        <div className="mx-auto w-full max-w-7xl px-4 py-3 md:px-6">
          <nav className="flex flex-wrap items-center justify-between gap-3">
            <TiviaBrand layout="horizontal" className="items-center text-left" />
            <div className="hidden items-center gap-7 text-sm font-medium text-[#3f5b44] md:flex">
              <a href="#produto" className="transition hover:text-[#1f3a24]">Produto</a>
              <a href="#como-funciona" className="transition hover:text-[#1f3a24]">Como funciona</a>
              <a href="#faq" className="transition hover:text-[#1f3a24]">FAQ</a>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="inline-flex min-h-9 items-center rounded-lg border border-[#c8d8c3] bg-white px-4 text-sm font-semibold text-[#1f3822] transition hover:bg-[#f2f8ef]"
              >
                Entrar
              </Link>
              <Link
                href="/cadastro"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#0b1f10] px-4 text-sm font-semibold text-[#92ff00] transition hover:bg-[#162c1c]"
              >
                Começar agora
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 pt-28 md:px-6 md:pt-32">

        {/* ── Hero (única foto da landing) ──────────────── */}
        <section className="relative overflow-hidden rounded-3xl bg-[#0a100a]">
          <img
            src="https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=2400&q=80"
            alt="Equipe em operação"
            className="h-[520px] w-full object-cover opacity-45 md:h-[640px]"
            loading="eager"
          />
          <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(6,14,8,0.84)_0%,rgba(6,14,8,0.50)_50%,rgba(6,14,8,0.68)_100%)]" />
          <div className="absolute inset-0 flex items-center">
            <div className="mx-auto w-full max-w-7xl px-6 md:px-10">
              <div className="max-w-3xl space-y-5">
                <span className="hero-badge inline-flex items-center gap-2 rounded-full border border-[#92ff00]/35 bg-[#92ff00]/12 px-3 py-1 text-xs font-semibold text-[#c8ffaa]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#92ff00]" />
                  Atendimento inteligente para PMEs
                </span>
                <h1 className="hero-title text-4xl font-extrabold leading-[1.08] tracking-tight text-white md:text-6xl">
                  Atendimento com IA e operação humana em total controle.
                </h1>
                <p className="hero-desc max-w-2xl text-base leading-relaxed text-white/80 md:text-lg">
                  A TIVIA integra WhatsApp, CRM e automações para seu time atender melhor, vender mais e manter governança operacional.
                </p>
                <div className="hero-ctas flex flex-wrap gap-3 pt-1">
                  <Link
                    href="/cadastro"
                    className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#92ff00] px-6 text-[15px] font-semibold text-[#0a1206] transition-opacity hover:opacity-90"
                  >
                    Criar minha conta
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex min-h-12 items-center rounded-xl border border-white/25 bg-white/10 px-6 text-[15px] font-semibold text-white backdrop-blur-sm transition hover:bg-white/18"
                  >
                    Ver ambiente
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features – 4 cards com ilustrações ─────────── */}
        <section id="produto" className="mt-20">
          <ScrollReveal>
            <div className="mb-10 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#3f9848]">Plataforma completa</p>
              <h2 className="text-3xl font-extrabold text-[#0b1f10] md:text-5xl">
                Tudo que sua operação precisa
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-base text-[#4f6853] md:text-lg">
                Menos ferramentas dispersas, mais clareza para crescer com qualidade.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Atendimento WhatsApp",
                desc: "Agentes de IA respondem com contexto, histórico e continuidade por canal.",
                checks: ["Triagem automática", "Contexto por conversa", "Respostas em tempo real"],
                illustration: <ChatIllustration />,
                delay: 0,
              },
              {
                label: "CRM unificado",
                desc: "Leads, funil e oportunidades em uma visão clara para seu time.",
                checks: ["Pipeline visual", "Score de oportunidades", "Rastreio completo"],
                illustration: <PipelineIllustration />,
                delay: 120,
              },
              {
                label: "Humano no ciclo",
                desc: "Decisões críticas sempre passam pelo humano, com todo o contexto pronto.",
                checks: ["Escalada automática", "Aprovação com histórico", "Controle por equipe"],
                illustration: <HumanLoopIllustration />,
                delay: 240,
              },
              {
                label: "Métricas em tempo real",
                desc: "Acompanhe desempenho, gargalos e melhorias com dados atualizados.",
                checks: ["Dashboard operacional", "Alertas inteligentes", "Relatórios exportáveis"],
                illustration: <DashboardIllustration />,
                delay: 360,
              },
            ].map(({ label, desc, checks, illustration, delay }) => (
              <ScrollReveal key={label} delay={delay}>
                <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#d7e5d3] bg-white shadow-[0_4px_20px_rgba(20,48,28,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_32px_rgba(20,48,28,0.10)]">
                  <div className="flex items-center justify-center bg-[#f5fbf2] px-6 py-8">
                    {illustration}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="mb-1.5 text-base font-bold text-[#0b1f10]">{label}</h3>
                    <p className="mb-4 text-sm leading-relaxed text-[#506a54]">{desc}</p>
                    <ul className="mt-auto space-y-1.5">
                      {checks.map((c) => (
                        <li key={c} className="flex items-center gap-2 text-xs text-[#4f6853]">
                          <Check className="h-3.5 w-3.5 shrink-0 text-[#61c900]" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* ── Como funciona – timeline ──────────────────── */}
        <section id="como-funciona" className="mt-24">
          <ScrollReveal>
            <div className="mb-12 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#3f9848]">Processo</p>
              <h2 className="text-3xl font-extrabold text-[#0b1f10] md:text-5xl">Como funciona na prática</h2>
              <p className="mx-auto mt-3 max-w-xl text-base text-[#4f6853]">
                Do primeiro contato até o fechamento, tudo rastreado e assistido.
              </p>
            </div>
          </ScrollReveal>

          <div className="relative">
            {/* connector line – desktop */}
            <div className="absolute left-0 right-0 top-[3.25rem] hidden h-px bg-gradient-to-r from-transparent via-[#c8e6c0] to-transparent lg:block" />

            <div className="grid gap-6 lg:grid-cols-4">
              {[
                {
                  step: "01",
                  icon: <MessageCircle className="h-5 w-5" />,
                  title: "Lead entra pelo WhatsApp",
                  desc: "Mensagem recebida, cliente identificado e conversa aberta automaticamente no CRM.",
                  color: "bg-[#e4f2de] text-[#3f9848]",
                  delay: 0,
                },
                {
                  step: "02",
                  icon: <Zap className="h-5 w-5" />,
                  title: "Agente IA responde",
                  desc: "Com base nos playbooks, o agente conduz a triagem, qualifica e gera contexto.",
                  color: "bg-[#0b1f10] text-[#92ff00]",
                  delay: 150,
                },
                {
                  step: "03",
                  icon: <Users className="h-5 w-5" />,
                  title: "Humano entra quando precisa",
                  desc: "Em pontos críticos, a conversa sobe para o atendente com histórico completo.",
                  color: "bg-[#3f9848] text-white",
                  delay: 300,
                },
                {
                  step: "04",
                  icon: <ShieldCheck className="h-5 w-5" />,
                  title: "Tudo rastreado",
                  desc: "Cada interação gera dados para melhoria contínua dos agentes e da operação.",
                  color: "bg-[#92ff00] text-[#0b1f10]",
                  delay: 450,
                },
              ].map(({ step, icon, title, desc, color, delay }) => (
                <ScrollReveal key={step} delay={delay}>
                  <div className="flex flex-col items-center text-center lg:items-center">
                    <div className={`relative z-10 mb-5 flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-2xl shadow-md ${color}`}>
                      {icon}
                      <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[#0b1f10] shadow-sm">
                        {step}
                      </span>
                    </div>
                    <h3 className="mb-2 text-base font-bold text-[#0b1f10]">{title}</h3>
                    <p className="text-sm leading-relaxed text-[#506a54]">{desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Stats ──────────────────────────────────────── */}
        <ScrollReveal>
          <section className="mt-20 overflow-hidden rounded-3xl border border-[#d0e8ca] bg-[linear-gradient(135deg,#0b1f10,#162c1c_50%,#0e2414)] p-8 md:p-12">
            <div className="grid gap-8 text-center sm:grid-cols-3">
              {[
                { number: "3×", label: "Mais velocidade no atendimento", sub: "Comparado à operação manual" },
                { number: "85%", label: "Das interações resolvidas com IA", sub: "Sem intervenção humana" },
                { number: "100%", label: "Rastreabilidade operacional", sub: "Toda decisão registrada" },
              ].map(({ number, label, sub }) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <span className="text-5xl font-extrabold tracking-tight text-[#92ff00] md:text-6xl">
                    {number}
                  </span>
                  <span className="mt-1 text-sm font-semibold text-white">{label}</span>
                  <span className="text-xs text-white/50">{sub}</span>
                </div>
              ))}
            </div>
          </section>
        </ScrollReveal>

        {/* ── FAQ ────────────────────────────────────────── */}
        <section id="faq" className="mt-20">
          <ScrollReveal>
            <div className="mb-10 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#3f9848]">Dúvidas</p>
              <h2 className="text-3xl font-extrabold text-[#0b1f10] md:text-4xl">Perguntas frequentes</h2>
            </div>
          </ScrollReveal>

          <div className="mx-auto max-w-2xl space-y-3">
            {faqItems.map((item, i) => (
              <ScrollReveal key={item.question} delay={i * 80}>
                <details className="group rounded-2xl border border-[#d7e5d3] bg-white shadow-[0_2px_12px_rgba(20,48,28,0.04)]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-[#0b1f10]">
                    {item.question}
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#3f9848] transition-transform duration-300 group-open:rotate-90" />
                  </summary>
                  <p className="px-5 pb-5 pt-0 text-sm leading-relaxed text-[#4f6853]">{item.answer}</p>
                </details>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* ── CTA final ──────────────────────────────────── */}
        <ScrollReveal>
          <section className="relative mt-20 overflow-hidden rounded-3xl border border-[#c6d9c2] bg-[linear-gradient(135deg,#f6fcf3,#edf8ea)] px-6 py-14 text-center md:px-10 md:py-16">
            {/* decorative orbs */}
            <div className="tivia-float pointer-events-none absolute -left-10 top-1/2 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(146,255,0,0.28),transparent_65%)]" />
            <div className="tivia-float pointer-events-none absolute -right-8 bottom-8 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(63,152,72,0.20),transparent_70%)] [animation-delay:1.4s]" />
            <div className="tivia-float pointer-events-none absolute right-1/4 top-6 h-16 w-16 rounded-full bg-[radial-gradient(circle,rgba(146,255,0,0.18),transparent_70%)] [animation-delay:0.7s]" />

            <p className="relative mb-2 text-xs font-semibold uppercase tracking-widest text-[#3f9848]">Comece hoje</p>
            <h2 className="relative text-3xl font-extrabold text-[#0b1f10] md:text-5xl">
              Pronto para evoluir sua operação?
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-base text-[#47614b] md:text-lg">
              Configure em minutos, integre o WhatsApp e deixe a IA trabalhar com você.
            </p>
            <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/cadastro"
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#0b1f10] px-7 text-[15px] font-semibold text-[#92ff00] shadow-[0_4px_18px_rgba(11,31,16,0.28)] transition hover:bg-[#162c1c]"
              >
                Criar conta na TIVIA
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex min-h-12 items-center rounded-xl border border-[#c6d9c2] bg-white px-7 text-[15px] font-semibold text-[#27412b] transition hover:bg-[#f2f8ef]"
              >
                Já tenho acesso
              </Link>
            </div>
          </section>
        </ScrollReveal>

      </div>
    </main>
  );
}
