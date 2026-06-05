import { WajeLogoMark } from "@/components/brand/WajeLogoMark";
import { WajeWordmark } from "@/components/brand/WajeWordmark";

export default function Loading() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{
        background:
          "radial-gradient(circle at 20% 10%, rgba(146,255,0,0.16), transparent 40%), linear-gradient(180deg, #f4faf1 0%, #eef7eb 46%, #f8fcf6 100%)",
      }}
    >
      <div
        className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl shadow-[0_16px_40px_rgba(20,48,28,0.18)]"
        style={{ background: "#0b1f10" }}
      >
        <WajeLogoMark size={44} />
      </div>
      <WajeWordmark size="lg" tone="brand" className="mb-1" />
      <p className="mb-7 text-sm text-[#527055]">A carregar ambiente...</p>
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-2.5 w-2.5 animate-bounce rounded-full"
            style={{ background: "#61c900", animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
    </div>
  );
}
