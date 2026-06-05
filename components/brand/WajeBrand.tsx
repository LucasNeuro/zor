import { BRAND_MARK_BG } from "@/lib/brand";
import { WajeLogoMark } from "@/components/brand/WajeLogoMark";
import { WajeWordmark } from "@/components/brand/WajeWordmark";

type WajeBrandProps = {
  className?: string;
  layout?: "vertical" | "horizontal";
  tone?: "bright" | "brand";
  showWordmark?: boolean;
  wordmarkSize?: "sm" | "md" | "lg";
};

export function WajeBrand({
  className = "",
  layout = "vertical",
  tone = "bright",
  showWordmark = true,
  wordmarkSize = "md",
}: WajeBrandProps) {
  const isHorizontal = layout === "horizontal";

  return (
    <div
      className={`flex ${
        isHorizontal ? "flex-row items-center gap-3 text-left" : "flex-col items-center text-center"
      } ${className}`}
    >
      <div
        className={`inline-flex items-center justify-center rounded-2xl border border-[#92ff00]/40 shadow-[0_0_30px_rgba(146,255,0,0.20)] ${
          isHorizontal ? "h-12 w-12" : "mb-3 h-16 w-16"
        }`}
        style={{ background: BRAND_MARK_BG }}
      >
        <WajeLogoMark className="h-9 w-9" />
      </div>
      {showWordmark ? <WajeWordmark tone={tone} size={wordmarkSize} /> : null}
    </div>
  );
}
