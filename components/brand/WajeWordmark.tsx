import { BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";

type WajeWordmarkProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  /** bright = painéis escuros; brand = fundo claro */
  tone?: "bright" | "brand";
};

const sizes = {
  sm: "text-[22px]",
  md: "text-[30px]",
  lg: "text-[36px]",
};

/** Gradiente no glifo w: perna esquerda limão (#92ff00), resto preto (mesma tipografia). */
const W_LEG_GRADIENT = {
  angle: 112,
  stop: "32%",
};

/**
 * Wordmark "waje" — tipografia intacta; só a perna esquerda do w em verde.
 */
export function WajeWordmark({ className = "", size = "md", tone = "brand" }: WajeWordmarkProps) {
  const baseColor = tone === "brand" ? BRAND_TEXT_DARK : "#f8fcf6";
  const accent = BRAND_GREEN_BRIGHT;
  const { angle, stop } = W_LEG_GRADIENT;
  const wFill = `linear-gradient(${angle}deg, ${accent} 0%, ${accent} ${stop}, ${baseColor} ${stop}, ${baseColor} 100%)`;

  return (
    <span
      className={`inline-flex items-baseline font-extrabold lowercase leading-none tracking-tight ${sizes[size]} ${className}`}
      aria-label="waje"
    >
      <span
        className="inline-block"
        style={{
          backgroundImage: wFill,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
          color: "transparent",
        }}
      >
        w
      </span>
      <span style={{ color: baseColor }}>aje</span>
    </span>
  );
}
