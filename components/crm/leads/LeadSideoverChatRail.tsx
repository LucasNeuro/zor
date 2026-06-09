"use client";

import { MessageSquare, X } from "lucide-react";
import { LeadChatTab } from "@/components/crm/leads/LeadChatTab";
import {
  RF_ACCENT,
  RF_BG_DEEP,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

type Props = {
  open: boolean;
  onClose: () => void;
  leadId: string;
  leadNome: string;
  metadata?: unknown;
};

/** Mini-sidebar de conversas dentro do sideover do lead (padrão drawer de cargos). */
export function LeadSideoverChatRail({ open, onClose, leadId, leadNome, metadata }: Props) {
  if (!open) return null;

  return (
    <aside
      className="flex min-h-0 shrink-0 flex-col"
      style={{
        width: "clamp(300px, 38%, 420px)",
        borderLeft: `1px solid ${RF_BORDER_STRONG}`,
        background: RF_BG_DEEP,
      }}
      aria-label="Painel de conversas"
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 px-4 py-3"
        style={{ borderBottom: `1px solid ${RF_BORDER}`, background: "rgba(6, 13, 8, 0.85)" }}
      >
        <div className="min-w-0">
          <p
            className="m-0 text-[10px] font-bold uppercase tracking-[0.08em]"
            style={{ color: RF_TEXT_MUTED }}
          >
            Atendimento
          </p>
          <p
            className="m-0 mt-0.5 truncate text-sm font-bold"
            style={{ color: RF_TEXT_PRIMARY }}
            title={leadNome}
          >
            {leadNome}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar conversas"
          title="Fechar conversas"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{
            border: `1px solid ${RF_BORDER_STRONG}`,
            background: "rgba(6, 13, 8, 0.6)",
            color: RF_TEXT_MUTED,
          }}
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        <LeadChatTab leadId={leadId} leadNome={leadNome} metadata={metadata} interactive />
      </div>
    </aside>
  );
}

export function LeadSideoverChatToggle({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? "Fechar conversas" : "Abrir conversas"}
      title={active ? "Fechar conversas" : "Abrir conversas"}
      className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[11px] font-bold"
      style={{
        border: `1px solid ${active ? RF_ACCENT : RF_BORDER_STRONG}`,
        background: active ? "rgba(146, 255, 0, 0.12)" : "rgba(6, 13, 8, 0.6)",
        color: active ? RF_ACCENT : RF_TEXT_PRIMARY,
      }}
    >
      <MessageSquare size={15} />
      Conversas
    </button>
  );
}
