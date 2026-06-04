type TiviaBrandProps = {
  className?: string;
  layout?: "vertical" | "horizontal";
};

export function TiviaBrand({ className = "", layout = "vertical" }: TiviaBrandProps) {
  const isHorizontal = layout === "horizontal";

  return (
    <div
      className={`flex ${
        isHorizontal ? "flex-row items-center gap-3 text-left" : "flex-col items-center text-center"
      } ${className}`}
    >
      <div
        className={`inline-flex items-center justify-center rounded-2xl border border-[#92ff00]/40 bg-[#0b1108] shadow-[0_0_30px_rgba(146,255,0,0.20)] ${
          isHorizontal ? "h-12 w-12" : "mb-3 h-16 w-16"
        }`}
      >
        <svg viewBox="0 0 64 64" className="h-9 w-9 text-[#92ff00]" fill="none" aria-hidden>
          <circle cx="32" cy="32" r="4.5" fill="currentColor" />
          <circle cx="32" cy="12" r="3" fill="currentColor" />
          <circle cx="50" cy="22" r="3" fill="currentColor" />
          <circle cx="50" cy="42" r="3" fill="currentColor" />
          <circle cx="32" cy="52" r="3" fill="currentColor" />
          <circle cx="14" cy="42" r="3" fill="currentColor" />
          <circle cx="14" cy="22" r="3" fill="currentColor" />
          <path
            d="M32 16v11M46 24l-9 5M46 40l-9-5M32 48V37M18 40l9-5M18 24l9 5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p
        className={`font-extrabold leading-none tracking-[0.08em] text-[#92ff00] ${
          isHorizontal ? "text-[30px]" : "text-[32px]"
        }`}
      >
        TIVIA
      </p>
    </div>
  );
}
