import Link from "next/link";

type Size = "sm" | "md" | "lg";

const badgeSizes: Record<Size, { box: string; text: string }> = {
  sm: { box: "h-7 w-7 text-xs", text: "text-xs" },
  md: { box: "h-8 w-8 text-sm", text: "text-sm" },
  lg: { box: "h-10 w-10 text-base", text: "text-base" },
};

/** Selo O+ (gradiente Obra10). */
export function Obra10LogoBadge({ size = "md" }: { size?: Size }) {
  const s = badgeSizes[size];
  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-lg font-black text-white ${s.box}`}
      style={{
        background: "linear-gradient(135deg, #003b26, #005c3d)",
        boxShadow: "0 0 12px rgba(0,59,38,0.45)",
      }}
      aria-hidden
    >
      O+
    </div>
  );
}

type HeaderProps = {
  size?: Size;
  /** Texto abaixo do nome (ex.: ESCRITÓRIO VIRTUAL) */
  subtitle?: string;
  titleClassName?: string;
  subtitleClassName?: string;
};

/** Marca: selo + OBRA10+ + subtítulo (uso em sidebars e headers). */
export function Obra10BrandHeader({
  size = "md",
  subtitle = "ESCRITÓRIO VIRTUAL",
  titleClassName = "",
  subtitleClassName = "",
}: HeaderProps) {
  const titleSz = size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm";
  const subSz = size === "sm" ? "text-[8px] tracking-widest" : "text-[9px] tracking-[0.1em]";
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Obra10LogoBadge size={size} />
      <div className="min-w-0">
        <p
          className={`truncate font-black leading-none tracking-wide text-white ${titleSz} ${titleClassName}`}
          style={{ letterSpacing: "0.05em" }}
        >
          OBRA10+
        </p>
        <p
          className={`truncate leading-none text-[#c9a24a] ${subSz} ${subtitleClassName}`}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}

type LinkHeaderProps = HeaderProps & {
  href: string;
  className?: string;
  title?: string;
};

export function Obra10BrandHeaderLink({ href, className = "", title, ...rest }: LinkHeaderProps) {
  return (
    <Link
      href={href}
      className={`flex min-w-0 items-center rounded-xl transition-opacity hover:opacity-90 ${className}`}
      title={title ?? "Obra10+ — início"}
    >
      <Obra10BrandHeader {...rest} />
    </Link>
  );
}
