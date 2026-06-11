/** Fundo animado — estrelas + anéis orbitais (estilo InBot, cores Waje). */
export function LandingStarfield() {
  return (
    <div className="waje-starfield pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="waje-starfield-glow waje-starfield-glow-a" />
      <div className="waje-starfield-glow waje-starfield-glow-b" />
      <div className="waje-orbit-ring waje-orbit-ring-1" />
      <div className="waje-orbit-ring waje-orbit-ring-2" />
      <div className="waje-orbit-ring waje-orbit-ring-3" />
      {Array.from({ length: 48 }).map((_, i) => (
        <span
          key={i}
          className="waje-star"
          style={{
            left: `${(i * 17 + 7) % 100}%`,
            top: `${(i * 23 + 11) % 100}%`,
            animationDelay: `${(i % 12) * 0.35}s`,
            opacity: 0.15 + (i % 5) * 0.12,
          }}
        />
      ))}
    </div>
  );
}
