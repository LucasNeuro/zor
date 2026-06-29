"use client";

import { X } from "lucide-react";
import { AgenteUazapiBlock, type AgenteUazapiSnapshot } from "@/components/crm/AgenteUazapiBlock";
import { CrmCanalModoCell } from "@/components/crm/CrmCanalModoCell";
import {
  RF_ACCENT,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
  rfAsideBodyStyle,
  rfAsideHeaderStyle,
  rfAsideStyle,
  rfCloseButtonStyle,
  rfOverlayStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";

export type CanalAgenteRow = {
  agente_slug: string;
  nome: string;
  modo_operacao?: string | null;
  ativo?: boolean;
  arquivado_em?: string | null;
  uazapi_instance_id?: string | null;
  uazapi_instance_name?: string | null;
  uazapi_connection_status?: string | null;
  uazapi_has_instance_token?: boolean;
  uazapi_proxy_country?: string | null;
  uazapi_proxy_state?: string | null;
  uazapi_proxy_city?: string | null;
  uazapi_snapshot_at?: string | null;
  email_from?: string | null;
  email_inbound?: string | null;
  email_ativo?: boolean;
};

type Props = {
  agente: CanalAgenteRow | null;
  onClose: () => void;
  onSnapshotPatch?: (slug: string, patch: Partial<AgenteUazapiSnapshot>) => void;
};

export function CrmCanalSideover({ agente, onClose, onSnapshotPatch }: Props) {
  if (!agente) return null;

  const modoWhatsapp =
    agente.modo_operacao === "canal_whatsapp" ||
    ((!agente.modo_operacao || agente.modo_operacao === "") &&
      ["atendente", "sdr", "gerente_atendimento", "diretor_geral_ia", "dany"].includes(agente.agente_slug));

  const snapshot: AgenteUazapiSnapshot = {
    uazapi_instance_id: agente.uazapi_instance_id ?? null,
    uazapi_instance_name: agente.uazapi_instance_name ?? null,
    uazapi_connection_status: agente.uazapi_connection_status ?? null,
    uazapi_has_instance_token: agente.uazapi_has_instance_token === true,
    uazapi_proxy_country: agente.uazapi_proxy_country ?? null,
    uazapi_proxy_state: agente.uazapi_proxy_state ?? null,
    uazapi_proxy_city: agente.uazapi_proxy_city ?? null,
  };

  return (
    <>
      <button type="button" aria-label="Fechar painel do canal" onClick={onClose} style={rfOverlayStyle(70)} />
      <aside style={rfAsideStyle("min(640px, 100vw)", 80)}>
        <header style={rfAsideHeaderStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, color: RF_ACCENT, fontSize: 11, letterSpacing: 0.8, fontWeight: 700 }}>
                CANAL
              </p>
              <h2 style={{ margin: "4px 0 0", color: RF_TEXT_PRIMARY, fontSize: 18, fontWeight: 800 }}>
                {agente.nome}
              </h2>
              <p
                style={{
                  margin: "6px 0 0",
                  color: RF_TEXT_SECONDARY,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <CrmCanalModoCell modo={agente.modo_operacao} legacyCanalWhatsapp={modoWhatsapp} variant="dark" />
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              style={{ ...rfCloseButtonStyle(), width: 36, height: 36 }}
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="panel-scroll" style={rfAsideBodyStyle()}>
          {!modoWhatsapp ? (
            <p
              style={{
                margin: 0,
                padding: "10px 12px",
                borderRadius: 8,
                background: "#bb800926",
                border: "1px solid #bb800966",
                color: "#e6c06a",
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              Este agente não está em modo WhatsApp. Configure o modo na ficha do modelo.
            </p>
          ) : (
            <AgenteUazapiBlock
              layout="painel"
              agenteSlug={agente.agente_slug}
              agenteNome={agente.nome}
              snapshot={snapshot}
              onSnapshotPatch={(patch) => onSnapshotPatch?.(agente.agente_slug, patch)}
            />
          )}
          {modoWhatsapp ? (
            <p style={{ margin: "12px 0 0", fontSize: 11, color: RF_TEXT_MUTED, lineHeight: 1.45 }}>
              Prompt, conhecimento e ferramentas continuam na ficha do agente em Modelos.
            </p>
          ) : null}
        </div>
      </aside>
    </>
  );
}
