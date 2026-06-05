"use client";

import { useEffect, useRef, type ChangeEventHandler } from "react";
import { Check, Minus } from "lucide-react";

/** Checkbox no tema escuro CRM (sem quadrado branco do navegador). */
export function CrmCheckbox({
  checked,
  indeterminate,
  disabled,
  onChange,
  "aria-label": ariaLabel,
  size = 18,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
  "aria-label"?: string;
  size?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.indeterminate = !!indeterminate && !checked;
  }, [indeterminate, checked]);

  const parcial = !!indeterminate && !checked;
  const ativo = checked || parcial;

  return (
    <label
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        aria-label={ariaLabel}
        className="absolute inset-0 z-[1] m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span
        aria-hidden
        className="pointer-events-none flex items-center justify-center box-border transition-colors"
        style={{
          width: size,
          height: size,
          borderRadius: 5,
          border: `1px solid ${ativo ? "rgba(201, 162, 74, 0.5)" : "#dcebd8"}`,
          background: checked
            ? "rgba(0, 59, 38, 0.85)"
            : parcial
              ? "rgba(201, 162, 74, 0.14)"
              : "#ffffff",
          opacity: disabled ? 0.45 : 1,
          boxShadow: ativo ? "inset 0 0 0 1px rgba(201, 162, 74, 0.12)" : undefined,
        }}
      >
        {checked ? (
          <Check size={size - 7} strokeWidth={3} className="text-[#c9a24a]" aria-hidden />
        ) : parcial ? (
          <Minus size={size - 7} strokeWidth={3} className="text-[#c9a24a]" aria-hidden />
        ) : null}
      </span>
    </label>
  );
}
