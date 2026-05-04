"use client";

import { useState, useEffect } from "react";
import { Alert } from "@/lib/alerts-system";

const SEV_COLOR: Record<string, string> = {
  critical: "#ef4444",
  warning: "#eab308",
  info: "#60a5fa",
};

export function LiveFeed({ feed }: { feed: Alert[] }) {
  const [tempos, setTempos] = useState<Record<string, string>>({});

  useEffect(() => {
    function calcular() {
      const novos: Record<string, string> = {};
      feed.forEach((a) => {
        const diff = Math.floor((Date.now() - a.timestamp.getTime()) / 1000);
        if (diff < 60) novos[a.id] = "agora";
        else if (diff < 3600) novos[a.id] = `${Math.floor(diff / 60)}min`;
        else novos[a.id] = `${Math.floor(diff / 3600)}h`;
      });
      setTempos(novos);
    }
    calcular();
    const id = setInterval(calcular, 30000);
    return () => clearInterval(id);
  }, [feed]);

  if (feed.length === 0) return null;

  return (
    <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
        Feed ao vivo
      </div>
      {feed.map((alert) => (
        <div key={alert.id} style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
          <span style={{ fontSize: 8, color: SEV_COLOR[alert.severity], marginTop: 2, flexShrink: 0 }}>●</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {alert.titulo}
            </span>
          </div>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>
            {tempos[alert.id] ?? "agora"}
          </span>
        </div>
      ))}
    </div>
  );
}
