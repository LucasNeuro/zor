import { ScrollReveal } from "@/components/landing/ScrollReveal";

export function LandingStats() {
  return (
    <section className="px-4 py-8 md:py-12">
      <ScrollReveal>
        <div className="waje-stats-block mx-auto max-w-5xl overflow-hidden rounded-3xl p-8 md:p-12">
          <div className="grid gap-10 text-center sm:grid-cols-3">
            {[
              { n: "3×", label: "Mais velocidade no atendimento", sub: "Vs. operação manual" },
              { n: "85%", label: "Interações resolvidas com IA", sub: "Com handoff quando necessário" },
              { n: "100%", label: "Rastreabilidade operacional", sub: "Cada decisão registrada" },
            ].map(({ n, label, sub }) => (
              <div key={label} className="waje-stat-pulse">
                <span className="text-5xl font-extrabold tracking-tight text-[#3f9848] md:text-6xl">{n}</span>
                <p className="mt-2 text-sm font-semibold text-[#0b1f10]">{label}</p>
                <p className="mt-1 text-xs text-[#6b8570]">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
