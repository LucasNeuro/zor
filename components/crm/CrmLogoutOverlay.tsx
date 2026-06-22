"use client";

import { Loader2 } from "lucide-react";

export function CrmLogoutOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      aria-busy="true"
      aria-live="polite"
      aria-label="A sair"
      role="status"
      style={{
        pointerEvents: "auto",
        background: "rgba(11,31,16,0.42)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        className="flex flex-col items-center gap-4 rounded-2xl px-8 py-7"
        style={{
          background: "#f5fbf4",
          border: "1px solid #d8edd4",
          boxShadow: "0 16px 48px rgba(11,31,16,0.18)",
        }}
      >
        <Loader2
          size={32}
          strokeWidth={2}
          className="animate-spin"
          style={{ color: "#3f9848" }}
          aria-hidden
        />
        <p className="text-sm font-semibold tracking-wide" style={{ color: "#0b2210" }}>
          A sair…
        </p>
      </div>
    </div>
  );
}
