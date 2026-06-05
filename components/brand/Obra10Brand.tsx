import Link from "next/link";

// ─── tokens ──────────────────────────────────────────────
const BADGE_BG    = "#1a3528";
const GREEN_FULL  = "#5d9e72";
const GOLD        = "#c9a24a";

type Size = "sm" | "md" | "lg";

const sizes: Record<Size, {
  box: string;
  radius: string;
  gap: string;
  padding: string;
  cellRadius: string;
  gridGap: string;
  titleSize: string;
  subSize: string;
  brandGap: string;
}> = {
  sm: {
    box: "h-7 w-7",        radius: "rounded-[7px]",
    gap: "gap-2",          padding: "p-[5px]",
    cellRadius: "rounded-[1.5px]", gridGap: "gap-[2.5px]",
    titleSize: "text-[11.5px]",    subSize: "text-[8px]",
    brandGap: "gap-2",
  },
  md: {
    box: "h-9 w-9",        radius: "rounded-[9px]",
    gap: "gap-2.5",        padding: "p-[7px]",
    cellRadius: "rounded-[2px]",   gridGap: "gap-[3px]",
    titleSize: "text-[13.5px]",    subSize: "text-[9px]",
    brandGap: "gap-2.5",
  },
  lg: {
    box: "h-11 w-11",      radius: "rounded-[11px]",
    gap: "gap-3",          padding: "p-2",
    cellRadius: "rounded-[2.5px]", gridGap: "gap-1",
    titleSize: "text-base",        subSize: "text-[10px]",
    brandGap: "gap-3",
  },
};

// ─── grade 2×2 (4 blocos de construção) ──────────────────
const cells = [
  { color: GREEN_FULL, opacity: 1    },  // topo-esq  — verde cheio
  { color: GREEN_FULL, opacity: 0.5  },  // topo-dir  — verde médio
  { color: GOLD,       opacity: 0.85 },  // baixo-esq — dourado (destaque "10")
  { color: GREEN_FULL, opacity: 0.3  },  // baixo-dir — verde tênue
];

export function Obra10LogoBadge({ size = "md" }: { size?: Size }) {
  const s = sizes[size];
  return (
    <div
      aria-hidden
      className={`grid grid-cols-2 shrink-0 ${s.box} ${s.radius} ${s.padding} ${s.gridGap}`}
      style={{ background: BADGE_BG }}
    >
      {cells.map((c, i) => (
        <div
          key={i}
          className={`w-full h-full ${s.cellRadius}`}
          style={{ background: c.color, opacity: c.opacity }}
        />
      ))}
    </div>
  );
}

// ─── brand header ─────────────────────────────────────────
type HeaderProps = {
  size?: Size;
  subtitle?: string;
  theme?: "dark" | "light";
  titleClassName?: string;
  subtitleClassName?: string;
};

export function Obra10BrandHeader({
  size = "md",
  subtitle = "ESCRITÓRIO VIRTUAL",
  theme = "dark",
  titleClassName = "",
  subtitleClassName = "",
}: HeaderProps) {
  const s = sizes[size];
  const nameColor     = theme === "light" ? "#0b2018" : "#ffffff";
  const subtitleColor = theme === "light" ? "#8a6820" : GOLD;

  return (
    <div className={`flex min-w-0 items-center ${s.brandGap}`}>
      <Obra10LogoBadge size={size} />
      <div className="min-w-0">
        <p
          className={`truncate font-bold leading-none tracking-[0.04em] ${s.titleSize} ${titleClassName}`}
          style={{ color: nameColor }}
        >
          Waje
        </p>
        <p
          className={`truncate leading-none tracking-[0.1em] ${s.subSize} ${subtitleClassName}`}
          style={{ color: subtitleColor, marginTop: "2px" }}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}

// ─── brand header link ────────────────────────────────────
type LinkHeaderProps = HeaderProps & {
  href: string;
  className?: string;
  title?: string;
};

export function Obra10BrandHeaderLink({
  href,
  className = "",
  title,
  ...rest
}: LinkHeaderProps) {
  return (
    <Link
      href={href}
      title={title ?? "Waje — início"}
      className={`flex min-w-0 items-center rounded-xl transition-opacity hover:opacity-80 active:opacity-60 ${className}`}
    >
      <Obra10BrandHeader {...rest} />
    </Link>
  );
}