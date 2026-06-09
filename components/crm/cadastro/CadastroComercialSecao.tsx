"use client";

import type { CSSProperties } from "react";
import { Target } from "lucide-react";
import { CrmToggleSwitch } from "@/components/crm/CrmToggleSwitch";
import { EMPRESA_SEGMENTOS } from "@/lib/crm/empresa-cadastro";
import type { SuperCadastroInput } from "@/lib/crm/super-cadastro-form";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_INPUT_STYLE,
  RF_LABEL_STYLE,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

const INPUT: CSSProperties = { ...RF_INPUT_STYLE, padding: "10px 12px", borderRadius: 10, fontSize: 13 };
const LABEL: CSSProperties = { ...RF_LABEL_STYLE, fontWeight: 600, marginBottom: 4, display: "block" };

type Props = {
  tipo: "PF" | "PJ";
  nome: string;
  documento: string;
  comercial: SuperCadastroInput["comercial"];
  onComercialChange: (partial: Partial<SuperCadastroInput["comercial"]>) => void;
  /** Mantido por compatibilidade — mercados Obra10 removidos da UI genérica */
  onMercadoToggle?: (sigla: string, ativo: boolean) => void;
};

export function CadastroComercialSecao({
  tipo,
  nome,
  documento,
  comercial,
  onComercialChange,
}: Props) {
  const criarLead = comercial.criar_lead === true;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: RF_ACCENT, letterSpacing: 0.04 }}>
        VÍNCULO COM CRM
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: "12px 14px",
          borderRadius: 12,
          border: `1px solid ${criarLead ? RF_BORDER_STRONG : RF_BORDER}`,
          background: "rgba(6, 13, 8, 0.45)",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: criarLead ? "rgba(146, 255, 0, 0.12)" : "rgba(6, 13, 8, 0.6)",
            color: criarLead ? RF_ACCENT : RF_TEXT_MUTED,
            flexShrink: 0,
          }}
        >
          <Target size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: RF_TEXT_PRIMARY }}>
            Criar lead no funil de vendas
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.45, color: RF_TEXT_MUTED }}>
            Opcional. Use quando o contacto vier de campanha ou must entrar no pipeline comercial.
            Sem marcar, fica só no cadastro de clientes.
          </p>
        </div>
        <CrmToggleSwitch
          checked={criarLead}
          onCheckedChange={(v) => onComercialChange({ criar_lead: v, mercados: v ? ["GRL"] : [] })}
          labelledBy="criar-lead-toggle"
        />
      </div>

      {criarLead ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          <div>
            <label style={LABEL}>Origem</label>
            <select
              style={INPUT}
              value={comercial.lead_origem || "outro"}
              onChange={(e) => {
                const lead_origem = e.target.value as SuperCadastroInput["comercial"]["lead_origem"];
                onComercialChange({
                  lead_origem,
                  indicado_por: lead_origem === "indicacao" ? comercial.indicado_por ?? "" : null,
                });
              }}
            >
              <option value="outro">Manual / outro</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="site">Site</option>
              <option value="indicacao">Indicação</option>
              <option value="meta_ads">Meta Ads</option>
              <option value="google_ads">Google Ads</option>
              <option value="linkedin">LinkedIn</option>
            </select>
          </div>
          {comercial.lead_origem === "indicacao" ? (
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={LABEL}>Quem indicou?</label>
              <input
                style={INPUT}
                value={comercial.indicado_por || ""}
                onChange={(e) => onComercialChange({ indicado_por: e.target.value })}
                placeholder="Nome de quem indicou"
              />
            </div>
          ) : null}
          {tipo === "PJ" ? (
            <div>
              <label style={LABEL}>Perfil da empresa</label>
              <select
                style={INPUT}
                value={comercial.segmento || "cliente"}
                onChange={(e) =>
                  onComercialChange({
                    segmento: e.target.value as SuperCadastroInput["comercial"]["segmento"],
                  })
                }
              >
                {EMPRESA_SEGMENTOS.filter(
                  (s) => s.value !== "fornecedor" && s.value !== "parceiro"
                ).map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        style={{
          padding: 12,
          borderRadius: 10,
          border: `1px solid ${RF_BORDER}`,
          fontSize: 12,
          color: RF_TEXT_MUTED,
          background: "rgba(6, 13, 8, 0.35)",
        }}
      >
        <span style={{ color: RF_TEXT_SECONDARY }}>
          {tipo === "PF" ? "Pessoa física" : "Empresa"} — {nome || "sem nome"}
          {tipo === "PJ" && documento ? ` · ${documento}` : ""}
          {criarLead ? " · será criado lead no funil" : " · apenas cadastro de cliente"}
        </span>
      </div>
    </div>
  );
}
