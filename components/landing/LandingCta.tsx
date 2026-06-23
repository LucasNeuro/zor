import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ScrollReveal } from "@/components/landing/ScrollReveal";

export function LandingCta({ brandNome }: { brandNome: string }) {
  return (
    <ScrollReveal>
      <section className="waje-cta-block relative mx-4 mb-20 overflow-hidden rounded-3xl px-6 py-14 text-center md:mx-auto md:max-w-4xl md:px-10 md:py-16">
        <div className="pointer-events-none absolute -left-16 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(146,255,0,0.2),transparent_70%)]" />
        <div className="pointer-events-none absolute -right-12 bottom-0 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(63,152,72,0.15),transparent_70%)]" />
        <p className="waje-section-label relative mb-2">Comece hoje</p>
        <h2 className="waje-heading relative text-3xl font-extrabold md:text-4xl">Pronto para evoluir sua operação?</h2>
        <p className="waje-subheading relative mx-auto mt-3 max-w-lg text-base">
          Configure em minutos, integre o WhatsApp e deixe a IA trabalhar com você.
        </p>
        <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/cadastro" className="waje-btn-glow inline-flex min-h-12 items-center gap-2 rounded-full px-8 text-[15px] font-semibold">
            Criar conta na {brandNome}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className="waje-btn-ghost inline-flex min-h-12 items-center rounded-full px-7 text-[15px] font-semibold">
            Já tenho acesso
          </Link>
        </div>
      </section>
    </ScrollReveal>
  );
}
