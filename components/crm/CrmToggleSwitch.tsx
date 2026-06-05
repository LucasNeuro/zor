"use client";

export function CrmToggleSwitch({
  checked,
  onCheckedChange,
  disabled,
  labelledBy,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  labelledBy?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      style={{
        width: 46,
        height: 26,
        borderRadius: 999,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        background: checked ? "linear-gradient(180deg, #3fb950 0%, #2ea043 100%)" : "#eef7eb",
        boxShadow: checked ? "inset 0 1px 0 rgba(255,255,255,0.12)" : "inset 0 1px 0 rgba(0,0,0,0.2)",
        position: "relative",
        flexShrink: 0,
        transition: "background 0.18s ease, opacity 0.15s",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 23 : 3,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#f0f6fc",
          boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
          transition: "left 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </button>
  );
}
