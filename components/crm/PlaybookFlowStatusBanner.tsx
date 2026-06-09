"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, FileText, Info } from "lucide-react";
import type { PlaybookFlowUiStatus } from "@/lib/playbook/playbook-flow-ui";

type Props = {
  status: PlaybookFlowUiStatus;
  published?: boolean;
  compact?: boolean;
  theme?: "light" | "dark";
};

export function PlaybookFlowStatusBanner({
  status,
  published = false,
  compact = false,
  theme = "light",
}: Props) {
  if (status.kind === "empty") {
    return (
      <Banner
        compact={compact}
        theme={theme}
        tone="neutral"
        icon={<FileText size={14} />}
        title="Sem playbook carregado"
        body="Carregue ou escreva um playbook antes de analisar e publicar."
      />
    );
  }

  if (status.kind === "ready") {
    return (
      <Banner
        compact={compact}
        theme={theme}
        tone="success"
        icon={<CheckCircle2 size={14} />}
        title={published ? "Pronto para motor dinâmico (publicado)" : "Fluxo dinâmico válido no rascunho"}
        body={`Schema v1 detectado · entrada "${status.entryStepId}" · ${status.stepCount} passos. ${
          published
            ? "WhatsApp pode usar menus/perguntas deste playbook após publicação."
            : "Publique para activar no runtime."
        }`}
      />
    );
  }

  if (status.kind === "no_flow_block") {
    return (
      <Banner
        compact={compact}
        theme={theme}
        tone="warning"
        icon={<Info size={14} />}
        title="Só prompt narrativo (sem fluxo WA dinâmico)"
        body={status.message}
      />
    );
  }

  return (
    <Banner
      compact={compact}
      theme={theme}
      tone="danger"
      icon={<AlertTriangle size={14} />}
      title="Bloco de fluxo encontrado, mas inválido"
      body={
        status.errors.length > 0 ? (
          <ul style={{ margin: "6px 0 0", paddingLeft: 16, lineHeight: 1.45 }}>
            {status.errors.slice(0, 5).map((err, i) => (
              <li key={i}>{err}</li>
            ))}
            {status.errors.length > 5 ? (
              <li>… e mais {status.errors.length - 5} erro(s).</li>
            ) : null}
          </ul>
        ) : (
          "Corrija o JSON do bloco `obra10_playbook_flow` antes de publicar."
        )
      }
    />
  );
}

const PALETTE_LIGHT = {
  success: { bg: "#2386361a", border: "#23863655", fg: "#7ee787", title: "#aff5b4" },
  warning: { bg: "#c9a24a14", border: "#c9a24a44", fg: "#d6b976", title: "#e3c77a" },
  danger: { bg: "#f8514914", border: "#f8514944", fg: "#ffaba8", title: "#ffb4b0" },
  neutral: { bg: "#eef7eb", border: "#dcebd8", fg: "#5d7a67", title: "#6b8a76" },
} as const;

const PALETTE_DARK = {
  success: { bg: "rgba(63, 185, 80, 0.12)", border: "rgba(63, 185, 80, 0.38)", fg: "#7ee787", title: "#92ff00" },
  warning: { bg: "rgba(251, 191, 36, 0.1)", border: "rgba(251, 191, 36, 0.35)", fg: "#e3c77a", title: "#fbbf24" },
  danger: { bg: "rgba(248, 81, 73, 0.12)", border: "rgba(248, 81, 73, 0.4)", fg: "#ffaba8", title: "#ffb4b0" },
  neutral: { bg: "rgba(6, 13, 8, 0.72)", border: "rgba(63, 152, 72, 0.35)", fg: "#7a9a7e", title: "#e8f5e9" },
} as const;

function Banner({
  tone,
  icon,
  title,
  body,
  compact,
  theme = "light",
}: {
  tone: "success" | "warning" | "danger" | "neutral";
  icon: ReactNode;
  title: string;
  body: ReactNode;
  compact?: boolean;
  theme?: "light" | "dark";
}) {
  const palette = (theme === "dark" ? PALETTE_DARK : PALETTE_LIGHT)[tone];

  return (
    <div
      style={{
        padding: compact ? "8px 10px" : "10px 12px",
        borderRadius: 10,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.fg,
        fontSize: 11,
        lineHeight: 1.45,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span style={{ flexShrink: 0, marginTop: 1, color: palette.title }}>{icon}</span>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 700, color: palette.title, fontSize: compact ? 11 : 12 }}>
            {title}
          </p>
          <div style={{ marginTop: 4 }}>{body}</div>
        </div>
      </div>
    </div>
  );
}
