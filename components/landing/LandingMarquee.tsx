/** Termos do carrossel — linguagem para quem contrata (PMEs), sem jargão técnico. */
const items = [
  "WhatsApp",
  "CRM integrado",
  "Atendimento com IA",
  "Equipe no controle",
  "Multiempresa",
  "Roteiros de atendimento",
  "Automações",
  "Métricas",
  "E-mail",
  "Controle total",
];

export function LandingMarquee() {
  const doubled = [...items, ...items];
  return (
    <section className="waje-marquee-band relative overflow-hidden py-5" aria-label="Capacidades da plataforma">
      <div className="waje-marquee-track flex w-max gap-12">
        {doubled.map((label, i) => (
          <span
            key={`${label}-${i}`}
            className="waje-marquee-text shrink-0 text-sm font-bold uppercase tracking-[0.2em] md:text-base"
          >
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}
