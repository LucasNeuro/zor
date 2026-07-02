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
      <WajeLogoMark size={isHorizontal ? 48 : 64} className={isHorizontal ? "" : "mb-3"} />
      {showWordmark ? <WajeWordmark tone={tone} size={wordmarkSize} /> : null}
    </div>
  );
}
