"use client";

import { useEffect, useState } from "react";
import {
  crmToastTokens,
  type CrmFeedbackTheme,
  type CrmFeedbackVariant,
} from "@/lib/crm/crm-feedback-theme";

export type CrmToastItem = {
  id: string;
  title?: string;
  message: string;
  variant: CrmFeedbackVariant;
  theme: CrmFeedbackTheme;
  durationMs: number;
};

const VARIANT_LABEL: Record<CrmFeedbackVariant, string> = {
  destructive: "Erro",
  warning: "Atenção",
  info: "Info",
  success: "Sucesso",
};

function CrmToastCard({ item, onDismiss }: { item: CrmToastItem; onDismiss: (id: string) => void }) {
  const [leaving, setLeaving] = useState(false);
  const tokens = crmToastTokens(item.variant, item.theme);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLeaving(true);
      window.setTimeout(() => onDismiss(item.id), 260);
    }, item.durationMs);
    return () => window.clearTimeout(timer);
  }, [item.durationMs, item.id, onDismiss]);

  function dismissNow() {
    setLeaving(true);
    window.setTimeout(() => onDismiss(item.id), 260);
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        ...tokens.container,
        transform: leaving ? "translateX(108%)" : "translateX(0)",
        opacity: leaving ? 0 : 1,
        transition: "transform 260ms ease, opacity 260ms ease",
      }}
    >
      <div style={{ height: 3, background: tokens.accentBar, width: "100%" }} aria-hidden />
      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: item.title ? 4 : 0 }}>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: tokens.accentBar,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {VARIANT_LABEL[item.variant]}
              </span>
            </div>
            {item.title ? <div style={tokens.title}>{item.title}</div> : null}
            <div style={tokens.message}>{item.message}</div>
          </div>
          <button type="button" onClick={dismissNow} style={tokens.dismiss} aria-label="Fechar">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

export function CrmToastStack({
  items,
  onDismiss,
}: {
  items: CrmToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div
      aria-label="Notificações"
      style={{
        position: "fixed",
        top: "max(16px, env(safe-area-inset-top, 0px))",
        right: 16,
        zIndex: 400,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        pointerEvents: "none",
      }}
    >
      {items.map((item) => (
        <CrmToastCard key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
