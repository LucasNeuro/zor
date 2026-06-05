import { BRAND_GREEN, BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";

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

/**
 * Wordmark "waje" — estilo wake: minúsculas + traço verde no j.
 */
export function WajeWordmark({ className = "", size = "md", tone = "brand" }: WajeWordmarkProps) {
  const baseColor = tone === "brand" ? BRAND_TEXT_DARK : "#f8fcf6";
  const accent = tone === "brand" ? BRAND_GREEN : BRAND_GREEN_BRIGHT;
  const slashW = size === "lg" ? 5 : size === "md" ? 4 : 3;

  return (
    <span
      className={`inline-flex items-baseline font-extrabold lowercase leading-none tracking-tight ${sizes[size]} ${className}`}
      aria-label="waje"
    >
      <span style={{ color: baseColor }}>wa</span>
      <span className="relative inline-block" style={{ color: baseColor }}>
        j
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[28deg] rounded-full"
          style={{
            width: slashW,
            height: "1.15em",
            background: accent,
            boxShadow: `0 0 12px ${accent}55`,
          }}
          aria-hidden
        />
      </span>
      <span style={{ color: baseColor }}>e</span>
    </span>
  );
}
