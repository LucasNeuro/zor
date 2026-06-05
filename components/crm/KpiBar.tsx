"use client";

export type Kpi = { label: string; value: number | string; color?: string };

type Props = { kpis: Kpi[] };

export function KpiBar({ kpis }: Props) {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
      {kpis.map((k, i) => (
        <div
          key={i}
          style={{
            background: "#ffffff",
            border: "1px solid #dcebd8",
            borderRadius: 10,
            padding: "10px 16px",
            minWidth: 80,
          }}
        >
          <p
            style={{
              color: k.color ?? "#c9a24a",
              fontSize: 22,
              fontWeight: 800,
              margin: 0,
              lineHeight: 1,
            }}
          >
            {k.value}
          </p>
          <p style={{ color: "#5d7a67", fontSize: 11, margin: "4px 0 0", fontWeight: 500 }}>
            {k.label}
          </p>
        </div>
      ))}
    </div>
  );
}
