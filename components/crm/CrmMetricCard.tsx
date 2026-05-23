"use client";

type Props = {
  label: string;
  valor: string | number;
  sub?: string;
  cor?: string;
  href?: string;
  onClick?: () => void;
  loading?: boolean;
  className?: string;
};

export function CrmMetricCardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl border border-[#30363d] bg-[#161b22] p-4 ${className}`}
      aria-hidden
    >
      <div className="mb-2 h-3 w-24 rounded bg-[#21262d]" />
      <div className="h-8 w-16 rounded bg-[#21262d]" />
    </div>
  );
}

export function CrmMetricCard({
  label,
  valor,
  sub,
  cor = "#e6edf3",
  href,
  onClick,
  loading,
  className = "",
}: Props) {
  if (loading) return <CrmMetricCardSkeleton className={className} />;

  const valorDestaque =
    typeof valor === "number" ? valor !== 0 : valor !== "0" && valor !== "R$0" && valor !== "—";

  const inner = (
    <>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#8b949e] sm:text-xs">
        {label}
      </p>
      <p
        className="text-2xl font-black tabular-nums tracking-tight sm:text-[28px]"
        style={{ color: valorDestaque ? cor : "#e6edf3" }}
      >
        {valor}
      </p>
      {sub && <p className="mt-0.5 text-xs text-[#6e7681]">{sub}</p>}
    </>
  );

  const baseClass =
    `w-full rounded-xl border border-[#30363d] bg-[#161b22] p-4 text-left transition-transform hover:scale-[1.02] ${className}`;

  const style = { borderLeft: `3px solid ${cor}` };

  if (href) {
    return (
      <a href={href} className={baseClass} style={style}>
        {inner}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={baseClass} style={style}>
      {inner}
    </button>
  );
}

export function CrmSectionTitle({ children }: { children: string }) {
  return (
    <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#6e7681]">{children}</p>
  );
}
