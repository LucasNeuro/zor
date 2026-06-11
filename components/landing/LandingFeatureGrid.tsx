import { Cpu, MessageSquare, Shield, Workflow } from "lucide-react";
import { ScrollReveal } from "@/components/landing/ScrollReveal";

const features = [
  {
    icon: MessageSquare,
    title: "Conversas que vendem",
    desc: "Respostas com contexto, histórico do cliente e tom alinhado ao seu negócio.",
  },
  {
    icon: Cpu,
    title: "Assistentes especializados",
    desc: "SDR, triagem e qualificação com regras do seu processo comercial.",
  },
  {
    icon: Workflow,
    title: "Tudo conectado",
    desc: "WhatsApp, e-mail e CRM no mesmo fluxo — sem planilhas soltas.",
  },
  {
    icon: Shield,
    title: "Controle e segurança",
    desc: "Sua equipe entra quando precisa, com histórico completo de cada conversa.",
  },
];

export function LandingFeatureGrid() {
  return (
    <section id="produto" className="px-4 py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        <ScrollReveal>
          <div className="mb-12 text-center">
            <p className="waje-section-label mb-2">Plataforma</p>
            <h2 className="waje-heading text-3xl font-extrabold md:text-4xl">Tudo que sua operação precisa</h2>
          </div>
        </ScrollReveal>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, desc }, i) => (
            <ScrollReveal key={title} delay={i * 100}>
              <article className="waje-feature-card group h-full rounded-2xl p-6 transition duration-300">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#92ff00]/18 text-[#3f9848] transition group-hover:scale-110 group-hover:bg-[#92ff00]/28">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-base font-bold text-[#0b1f10]">{title}</h3>
                <p className="text-sm leading-relaxed text-[#506a54]">{desc}</p>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
