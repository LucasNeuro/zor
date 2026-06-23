import { ScrollReveal } from "@/components/landing/ScrollReveal";

function buildSteps(brandNome: string) {
  return [
    {
      num: 1,
      title: "Agentes IA",
      desc: "Criação e gestão de assistentes de IA e roteiros de atendimento para cada operação.",
      accent: "var(--platform-brand-accent, #92ff00)",
      titleColor: "var(--platform-brand-primary, #3f9848)",
    },
    {
      num: 2,
      title: `CRM ${brandNome}`,
      desc: "Leads, funil e histórico estruturados para alimentar jornadas, dashboards e decisões da IA.",
      accent: "var(--platform-brand-primary, #3f9848)",
      titleColor: "var(--platform-brand-primary, #3f9848)",
    },
    {
      num: 3,
      title: "Atendimento híbrido",
      desc: "Humano integrado à automação, com contexto, histórico e transição inteligente entre IA e equipe.",
      accent: "var(--platform-brand-accent, #61c900)",
      titleColor: "var(--platform-brand-primary, #3f9848)",
    },
  ];
}

export function LandingEcosystem({ brandNome }: { brandNome: string }) {
  const steps = buildSteps(brandNome);

  return (
    <section id="ecossistema" className="px-4 py-16 md:py-24">
      <div className="mx-auto max-w-3xl">
        <ScrollReveal>
          <h2 className="waje-heading mb-14 text-center text-3xl font-extrabold md:text-4xl">
            Um ecossistema{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #0b1f10, var(--platform-brand-primary, #3f9848))",
              }}
            >
              totalmente integrado
            </span>
          </h2>
        </ScrollReveal>
        <div className="relative space-y-6">
          <div
            className="absolute bottom-4 left-[1.35rem] top-4 hidden w-px md:block"
            style={{
              backgroundImage:
                "linear-gradient(to bottom, color-mix(in srgb, var(--platform-brand-accent, #92ff00) 60%, transparent), color-mix(in srgb, var(--platform-brand-primary, #3f9848) 30%, transparent), transparent)",
            }}
          />
          {steps.map(({ num, title, desc, accent, titleColor }, i) => (
            <ScrollReveal key={title} delay={i * 120}>
              <div className="relative flex gap-4 md:gap-6">
                <div
                  className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-[#061008] shadow-[0_4px_16px_rgba(146,255,0,0.35)]"
                  style={{ backgroundColor: accent }}
                >
                  {num}
                </div>
                <div className="waje-eco-pill flex-1 rounded-full border border-[#dce7d8] bg-white px-5 py-4 text-left shadow-[0_6px_28px_rgba(20,48,28,0.06)] transition hover:shadow-[0_10px_36px_rgba(20,48,28,0.1)] sm:px-6 sm:py-5">
                  <h3 className="text-base font-bold sm:text-lg" style={{ color: titleColor }}>
                    {title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#506a54]">{desc}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
