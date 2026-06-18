"use client";

type Variant = "ativo" | "inativo" | "pendente" | "pago" | "atrasado" | "neutral";

const STYLES: Record<Variant, { bg: string; color: string; label: string }> = {
  ativo: { bg: "rgba(63,185,80,0.14)", color: "#1e6b32", label: "Ativo" },
  inativo: { bg: "rgba(248,81,73,0.12)", color: "#9d2f2f", label: "Inativo" },
  pendente: { bg: "rgba(245,158,11,0.14)", color: "#92400e", label: "Pendente" },
  pago: { bg: "rgba(63,185,80,0.14)", color: "#1e6b32", label: "Pago" },
  atrasado: { bg: "rgba(248,81,73,0.12)", color: "#9d2f2f", label: "Atrasado" },
  neutral: { bg: "#eef4ec", color: "#5d7a67", label: "—" },
};

export function OpsStatusBadge({ variant, label }: { variant: Variant; label?: string }) {
  const s = STYLES[variant] ?? STYLES.neutral;
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      style={{ background: s.bg, color: s.color }}
    >
      {label ?? s.label}
    </span>
  );
}
