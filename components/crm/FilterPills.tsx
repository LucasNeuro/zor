"use client";

export type Pill = { id: string; label: string };

type Props = {
  pills: Pill[];
  active: string;
  onChange: (id: string) => void;
};

export function FilterPills({ pills, active, onChange }: Props) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {pills.map((p) => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          style={{
            padding: "4px 14px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            border: active === p.id ? "1px solid #c9a24a" : "1px solid #dcebd8",
            background: active === p.id ? "#c9a24a22" : "transparent",
            color: active === p.id ? "#c9a24a" : "#5d7a67",
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
