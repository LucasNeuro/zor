"use client";

import { crmListPillStyle } from "@/lib/crm/crm-list-pill-styles";

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
          type="button"
          onClick={() => onChange(p.id)}
          style={crmListPillStyle(active === p.id)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
