import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { LandingStarfield } from "@/components/landing/LandingStarfield";

export function LandingHero() {
  return (
    <section className="relative flex min-h-[92vh] flex-col items-center justify-center overflow-hidden px-4 pb-16 pt-32 text-center md:pt-36">
      <LandingStarfield />
      <div className="relative z-10 mx-auto max-w-4xl space-y-6">
        <span className="hero-badge waje-hero-badge inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5 text-[#3f9848]" />
          Plataforma de IA conversacional para PMEs
        </span>
        <h1 className="hero-title waje-heading text-4xl font-extrabold leading-[1.06] tracking-tight md:text-6xl lg:text-[3.65rem]">
          Sua transformação digital conversacional começa pela{" "}
          <span className="bg-gradient-to-r from-[#3f9848] via-[#61c900] to-[#92ff00] bg-clip-text text-transparent">
            estrutura
          </span>
          .
        </h1>
        <p className="hero-desc waje-subheading mx-auto max-w-2xl text-base leading-relaxed md:text-lg">
          A Waje centraliza conversas, CRM, agentes de IA e operação humana para transformar atendimento em
          operação inteligente — com controle total da sua equipe.
        </p>
        <div className="hero-ctas flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link href="/cadastro" className="waje-btn-glow inline-flex min-h-12 items-center gap-2 rounded-full px-8 text-[15px] font-semibold">
            Estruturar minha operação com IA
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className="waje-btn-ghost inline-flex min-h-12 items-center rounded-full px-7 text-[15px] font-semibold">
            Ver ambiente
          </Link>
        </div>
      </div>
    </section>
  );
}
