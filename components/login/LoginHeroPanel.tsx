"use client";

/**
 * Hero do login — visual abstrato “premium” (gradientes, luz suave, arcos discretos).
 * Substitui o mapa estilizado que não lia bem como forma geográfica.
 */
function HeroArt() {

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1000 1200"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="hero-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.12" />
          <stop offset="38%" stopColor="#c9a24a" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#059669" stopOpacity="0.18" />
        </linearGradient>
        <linearGradient id="hero-stroke-2" x1="100%" y1="0%" x2="0%" y2="80%">
          <stop offset="0%" stopColor="#c9a24a" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#14532d" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="hero-fill-arch" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#c9a24a" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#0d1117" stopOpacity="0" />
        </linearGradient>
        <style>{`
          @keyframes hero-shimmer {
            0%, 100% { opacity: 0.22; }
            50% { opacity: 0.5; }
          }
          .hero-line-a { animation: hero-shimmer 8s ease-in-out infinite; }
          .hero-line-b { animation: hero-shimmer 8s ease-in-out infinite 2.2s; }
        `}</style>
      </defs>

      {/* Arcos amplos — leitura de “rede / alcance” sem literal mapa */}
      <path
        className="hero-line-a"
        d="M -80 280 C 280 80 620 120 1080 340"
        fill="none"
        stroke="url(#hero-stroke)"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        className="hero-line-b"
        d="M -40 620 C 320 520 520 380 1040 480"
        fill="none"
        stroke="url(#hero-stroke-2)"
        strokeWidth="0.9"
        strokeLinecap="round"
        strokeDasharray="16 24"
      />
      <path
        d="M 120 920 C 400 720 700 860 980 640"
        fill="none"
        stroke="url(#hero-stroke)"
        strokeWidth="0.75"
        strokeLinecap="round"
        strokeOpacity="0.55"
      />

      {/* Duas “órbitas” suaves */}
      <ellipse
        cx="540"
        cy="520"
        rx="420"
        ry="320"
        fill="none"
        stroke="#c9a24a"
        strokeOpacity="0.06"
        strokeWidth="1"
        transform="rotate(-12 540 520)"
      />
      <ellipse
        cx="520"
        cy="560"
        rx="340"
        ry="400"
        fill="none"
        stroke="#22c55e"
        strokeOpacity="0.05"
        strokeWidth="1"
        transform="rotate(8 520 560)"
      />

      {/* Traço arquitetônico minimalista (obras / imóvel) — só contorno */}
      <g transform="translate(620 780) scale(1.15)" opacity="0.55">
        <path
          d="M 40 120 L 40 48 L 96 16 L 152 48 L 152 120 L 96 152 Z"
          fill="url(#hero-fill-arch)"
          stroke="#c9a24a"
          strokeWidth="0.65"
          strokeOpacity="0.4"
        />
        <path
          d="M 40 48 L 96 80 L 152 48 M 96 80 L 96 152"
          fill="none"
          stroke="#34d399"
          strokeWidth="0.45"
          strokeOpacity="0.35"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

export function LoginHeroPanel() {
  return (
    <div className="relative order-1 h-48 w-full shrink-0 overflow-hidden sm:h-64 md:order-2 md:h-auto md:min-h-[100dvh] md:min-w-0 md:flex-1">
      <div className="absolute inset-0 bg-gradient-to-br from-[#050809] via-[#0d1117] to-[#070c10]" />

      <div
        className="pointer-events-none absolute -right-24 top-[12%] h-[min(65vw,520px)] w-[min(65vw,520px)] rounded-full opacity-90 blur-[100px] md:right-0 md:top-[8%] md:h-[min(50vw,640px)] md:w-[min(50vw,640px)]"
        style={{ background: "radial-gradient(circle, rgba(22,101,52,0.5) 0%, transparent 68%)" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-32 bottom-[18%] h-[min(70vw,480px)] w-[min(70vw,480px)] rounded-full opacity-80 blur-[90px] md:bottom-[12%] md:left-[-10%]"
        style={{ background: "radial-gradient(circle, rgba(201,162,74,0.2) 0%, transparent 65%)" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-[28%] h-[200px] w-[80%] max-w-2xl -translate-x-1/2 rounded-full opacity-40 blur-[80px] md:top-[22%]"
        style={{ background: "rgba(13, 75, 50, 0.35)" }}
        aria-hidden
      />

      <HeroArt />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(105deg, rgba(230,237,243,0.12) 0.5px, transparent 0.5px)",
          backgroundSize: "64px 100%",
        }}
        aria-hidden
      />

      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0d1117]/65 via-transparent to-[#0d1117]/92 md:bg-gradient-to-l md:from-[#0d1117]/45 md:via-transparent md:to-[#0d1117]/96"
        aria-hidden
      />
      <div className="pointer-events-none relative z-10 flex h-full min-h-0 flex-col items-end justify-start p-6 text-right sm:p-8 md:p-10 lg:p-12">
        <p className="ml-auto max-w-lg text-base font-medium leading-snug tracking-tight text-white/95 drop-shadow-md sm:text-lg md:text-xl lg:text-2xl">
          Operações, leads e equipe — seu escritório digital Obra10+.
        </p>
        <p className="mt-2 ml-auto max-w-md text-xs font-medium text-[var(--obra-dourado-light,#e0b86a)] drop-shadow sm:text-sm">
          Imobiliário · Obras · Parceiros
        </p>
      </div>
    </div>
  );
}
