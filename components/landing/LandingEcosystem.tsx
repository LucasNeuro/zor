import { ScrollReveal } from "@/components/landing/ScrollReveal";

const steps = [
  {
    num: 1,
    title: "Agentes IA",
    desc: "Criação e gestão de assistentes de IA e roteiros de atendimento para cada operação.",
    accent: "#92ff00",
  },
  {
    num: 2,
    title: "CRM Waje",
    desc: "Leads, funil e histórico estruturados para alimentar jornadas, dashboards e decisões da IA.",
    accent: "#3f9848",
  },
  {
    num: 3,
    title: "Atendimento híbrido",
    desc: "Humano integrado à automação, com contexto, histórico e transição inteligente entre IA e equipe.",
    accent: "#61c900",
  },
];

export function LandingEcosystem() {
  return (
    <section id="ecossistema" className="px-4 py-16 md:py-24">
      <div className="mx-auto max-w-3xl">
        <ScrollReveal>
          <h2 className="waje-heading mb-14 text-center text-3xl font-extrabold md:text-4xl">
            Um ecossistema{" "}
            <span className="bg-gradient-to-r from-[#0b1f10] to-[#3f9848] bg-clip-text text-transparent">
              totalmente integrado
            </span>
          </h2>
        </ScrollReveal>
        <div className="relative space-y-6">
          <div className="absolute bottom-4 left-[1.35rem] top-4 hidden w-px bg-gradient-to-b from-[#92ff00]/60 via-[#3f9848]/30 to-transparent md:block" />
          {steps.map(({ num, title, desc, accent }, i) => (
            <ScrollReveal key={title} delay={i * 120}>
              <div className="relative flex gap-4 md:gap-6">
                <div
                  className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-[#061008] shadow-[0_4px_16px_rgba(146,255,0,0.35)]"
                  style={{ backgroundColor: accent }}
                >
                  {num}
                </div>
                <div className="waje-eco-pill flex-1 rounded-full border border-[#dce7d8] bg-white px-6 py-5 text-left shadow-[0_6px_28px_rgba(20,48,28,0.06)] transition hover:shadow-[0_10px_36px_rgba(20,48,28,0.1)]">
                  <h3 className="text-lg font-bold" style={{ color: accent === "#92ff00" ? "#3f9848" : accent }}>
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
