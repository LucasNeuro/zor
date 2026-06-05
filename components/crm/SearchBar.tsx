"use client";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
};

export function SearchBar({ value, onChange, placeholder = "Buscar..." }: Props) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: "8px 12px",
        borderRadius: 8,
        background: "#eef7eb",
        border: "1px solid #dcebd8",
        color: "#0b2210",
        fontSize: 13,
        outline: "none",
        boxSizing: "border-box",
      }}
    />
  );
}
