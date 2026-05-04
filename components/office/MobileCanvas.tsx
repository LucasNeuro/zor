"use client";

import { useState } from "react";

interface MobileCanvasProps {
  children: React.ReactNode;
}

export default function MobileCanvas({ children }: MobileCanvasProps) {
  const [scale, setScale] = useState(1);

  return (
    <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#0a0f1e" }}>
      <div style={{
        width: "100%",
        height: "100%",
        transform: `scale(${scale})`,
        transformOrigin: "center center",
        transition: "transform 200ms",
      }}>
        {children}
      </div>

      <div style={{
        position: "absolute",
        bottom: 16, right: 16,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}>
        {[
          { label: "+", action: () => setScale((s) => Math.min(s + 0.2, 2)) },
          { label: "⊙", action: () => setScale(1) },
          { label: "−", action: () => setScale((s) => Math.max(s - 0.2, 0.5)) },
        ].map((btn, i) => (
          <button
            key={i}
            onClick={btn.action}
            style={{
              width: 36, height: 36,
              borderRadius: 8,
              background: "rgba(15,23,42,0.9)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "white",
              fontSize: 16,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              backdropFilter: "blur(8px)",
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
