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
      className={`animate-pulse rounded-2xl border border-[#d5e1d8] bg-[#ffffff] p-4 ${className}`}
      aria-hidden
    >
      <div className="mb-2 h-3 w-24 rounded bg-[#e8f0e6]" />
      <div className="h-8 w-16 rounded bg-[#dcebd8]" />
    </div>
  );
}

export function CrmMetricCard({
  label,
  valor,
  sub,
  cor = "#12382b",
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
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#5f7469] sm:text-xs">
        {label}
      </p>
      <p
        className="text-2xl font-black tabular-nums tracking-tight sm:text-[28px]"
        style={{ color: valorDestaque ? cor : "#12382b" }}
      >
        {valor}
      </p>
      {sub && <p className="mt-0.5 text-xs text-[#637a6f]">{sub}</p>}
    </>
  );

  const baseClass =
    `group w-full rounded-2xl border border-[#d5e1d8] bg-gradient-to-b from-[#ffffff] to-[#f5faf3] p-4 text-left shadow-[0_8px_24px_rgba(15,56,39,0.08)] transition-[border-color,box-shadow] hover:border-[#c9a24a66] hover:shadow-[0_12px_32px_rgba(15,56,39,0.12)] ${className}`;

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
    <div className="mb-3 flex items-center gap-3">
      <p className="shrink-0 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5f7469]">
        {children}
      </p>
      <span className="h-px flex-1 bg-gradient-to-r from-[#d4e0d7] to-transparent" aria-hidden />
    </div>
  );
}
