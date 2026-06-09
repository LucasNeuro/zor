"use client";

import { useEffect, useMemo, useState } from "react";
import { LeadChatTab } from "@/components/crm/leads/LeadChatTab";
import type { CrmResumoLead } from "@/lib/crm/cliente-crm-resumo-types";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

type Props = {
  leads: CrmResumoLead[];
  loading?: boolean;
};

export function CadastroClienteAtendimentosTab({ leads, loading }: Props) {
  const [leadId, setLeadId] = useState<string | null>(null);

  useEffect(() => {
    if (leads.length === 0) {
      setLeadId(null);
      return;
    }
    if (!leadId || !leads.some((l) => l.id === leadId)) {
      setLeadId(leads[0].id);
    }
  }, [leads, leadId]);

  const leadAtivo = useMemo(
    () => leads.find((l) => l.id === leadId) ?? leads[0] ?? null,
    [leads, leadId]
  );

  if (loading) {
    return (
      <p style={{ color: RF_TEXT_MUTED, fontSize: 12, textAlign: "center", padding: "24px 0" }}>
        A carregar atendimentos…
      </p>
    );
  }

  if (leads.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "28px 12px",
          borderRadius: 12,
          border: `1px dashed ${RF_BORDER}`,
          color: RF_TEXT_MUTED,
          fontSize: 12,
        }}
      >
        Nenhum lead ou conversa associada a este cadastro.
      </div>
    );
  }

  return (
    <div>
      {leads.length > 1 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginBottom: 12,
          }}
        >
          {leads.map((l) => {
            const active = l.id === leadAtivo?.id;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setLeadId(l.id)}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "5px 10px",
                  borderRadius: 999,
                  border: `1px solid ${active ? RF_ACCENT : RF_BORDER_STRONG}`,
                  background: active ? "rgba(146, 255, 0, 0.12)" : "transparent",
                  color: active ? RF_ACCENT : RF_TEXT_MUTED,
                  cursor: "pointer",
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={l.nome}
              >
                {l.nome}
              </button>
            );
          })}
        </div>
      ) : leadAtivo ? (
        <p style={{ margin: "0 0 12px", fontSize: 11, color: RF_TEXT_MUTED }}>
          Conversas do lead{" "}
          <span style={{ color: RF_TEXT_PRIMARY, fontWeight: 700 }}>{leadAtivo.nome}</span>
        </p>
      ) : null}

      {leadAtivo ? (
        <LeadChatTab leadId={leadAtivo.id} leadNome={leadAtivo.nome} metadata={leadAtivo.metadata} interactive={false} />
      ) : null}
    </div>
  );
}
