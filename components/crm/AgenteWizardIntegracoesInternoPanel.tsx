"use client";

import { useCallback, useEffect, useState } from "react";
import type { IntegracaoAmbienteStatus } from "@/app/api/hub/integradores/route";
import { AgenteGoogleWorkspaceBlock } from "@/components/crm/AgenteGoogleWorkspaceBlock";
import { AgenteSupabaseCrmBlock } from "@/components/crm/AgenteSupabaseCrmBlock";
import { AgenteMistralBlock } from "@/components/crm/AgenteMistralBlock";
import { IntegracaoMarcaIcon, type IntegracaoMarcaIconVariant } from "@/components/crm/IntegracaoMarcaIcon";
import type { IntegradorCatalogoEntry } from "@/lib/hub/integradores-catalogo";
import { mergeUsoFerramentasComPadraoPreservandoCustom } from "@/lib/hub/agente-ferramentas-registry";
import { wizardGoogleOAuthReturnTo } from "@/lib/hub/agente-wizard-google";
import {
  RF_BORDER,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";

export type AgenteWizardIntegracoesInternoPanelProps = {
  agenteSlug: string;
  agenteNome?: string;
  theme?: "dark" | "light";
  usoFerramentas: Record<string, boolean>;
  onUsoChange: (ferramentaKey: string, ativo: boolean) => void;
  onUsoSynced?: (patch: Record<string, boolean>) => void;
  googleOauthEmail?: string | null;
  onOauthEmail?: (email: string | null) => void;
  contextoGoogle?: "agendamento" | "padrao";
};

type StatusIntegracao = "conectado" | "nao_configurado" | "erro" | "em_breve";

function integradorIconVariant(id: string): IntegracaoMarcaIconVariant | null {
  if (id === "gmail") return "gmail";
  if (id === "google_calendar") return "google-calendar";
  if (id === "mistral") return "mistral";
  if (id === "mem0") return "mem0";
  if (id === "waje_crm" || id === "supabase_externo") return "supabase";
  if (id === "google_docs") return "google";
  return null;
}

function statusBadge(status: StatusIntegracao, dark: boolean) {
  const map: Record<StatusIntegracao, { label: string; color: string; border: string; bg: string }> = {
    conectado: { label: "LIGADO", color: "#3fb950", border: "rgba(63,185,80,0.45)", bg: "rgba(63,185,80,0.12)" },
    nao_configurado: {
      label: "NÃO LIGADO",
      color: dark ? RF_TEXT_MUTED : "#6e7781",
      border: dark ? RF_BORDER : "#dcebd8",
      bg: dark ? "rgba(11, 31, 16, 0.72)" : "#f8fcf6",
    },
    erro: { label: "ERRO", color: "#f85149", border: "rgba(248,81,73,0.45)", bg: "rgba(248,81,73,0.1)" },
    em_breve: { label: "EM BREVE", color: "#d4a72c", border: "rgba(212,167,44,0.45)", bg: "rgba(212,167,44,0.1)" },
  };
  return map[status];
}

export function AgenteWizardIntegracoesInternoPanel({
  agenteSlug,
  agenteNome,
  theme = "light",
  usoFerramentas,
  onUsoChange,
  onUsoSynced,
  googleOauthEmail,
  onOauthEmail,
  contextoGoogle = "padrao",
}: AgenteWizardIntegracoesInternoPanelProps) {
  const dark = theme === "dark";
  const [catalogo, setCatalogo] = useState<IntegradorCatalogoEntry[]>([]);
  const [ambiente, setAmbiente] = useState<IntegracaoAmbienteStatus[]>([]);
  const [conexoes, setConexoes] = useState<Record<string, { configurado?: boolean }>>({});
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hub/integradores", { headers: await crmApiHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setCatalogo(Array.isArray(data.catalogo) ? data.catalogo : []);
      setAmbiente(Array.isArray(data.ambiente) ? data.ambiente : []);
      setConexoes(data.conexoes && typeof data.conexoes === "object" ? data.conexoes : {});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar, googleOauthEmail]);

  const uso = mergeUsoFerramentasComPadraoPreservandoCustom(usoFerramentas);

  const cardStyle = {
    borderRadius: 12,
    border: `1px solid ${dark ? RF_BORDER : "#dcebd8"}`,
    background: dark ? "rgba(6, 13, 8, 0.72)" : "#ffffff",
    padding: "12px 14px",
  } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <AgenteSupabaseCrmBlock
        agenteSlug={agenteSlug}
        agenteNome={agenteNome}
        layout="painel"
        theme={theme}
        onUsoChange={onUsoChange}
      />

      <AgenteGoogleWorkspaceBlock
        agenteSlug={agenteSlug}
        agenteNome={agenteNome}
        layout="painel"
        theme={theme}
        contexto={contextoGoogle}
        usoFerramentas={uso}
        oauthEmail={googleOauthEmail}
        onOauthEmail={onOauthEmail}
        wizardOAuthResumePasso={7}
        returnToPath={wizardGoogleOAuthReturnTo(agenteSlug)}
        onUsoSynced={onUsoSynced}
      />

      <AgenteMistralBlock
        agenteSlug={agenteSlug}
        agenteNome={agenteNome}
        layout="painel"
        theme={theme}
        usoFerramentas={uso}
        onUsoChange={onUsoChange}
      />

      <div style={cardStyle}>
        <p
          style={{
            margin: "0 0 10px",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.04,
            textTransform: "uppercase",
            color: dark ? RF_TEXT_MUTED : "#5d7a67",
          }}
        >
          Todas as integrações do escritório
        </p>
        {loading ? (
          <p style={{ margin: 0, fontSize: 12, color: dark ? RF_TEXT_SECONDARY : "#5d7a67" }}>
            A carregar catálogo…
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ambiente
              .filter((a) => a.id === "mistral")
              .map((a) => {
                const badge = statusBadge(a.status, dark);
                return (
                  <div
                    key={`env-${a.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1px solid ${badge.border}`,
                      background: badge.bg,
                    }}
                  >
                    <IntegracaoMarcaIcon variant="mistral" size={22} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: dark ? RF_TEXT_PRIMARY : "#0b2210" }}>
                        {a.nome}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: dark ? RF_TEXT_SECONDARY : "#5d7a67" }}>
                        {a.detail || a.descricao}
                      </p>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, color: badge.color }}>{badge.label}</span>
                  </div>
                );
              })}
            {catalogo.map((item) => {
              const cx = conexoes[item.id];
              let status: StatusIntegracao = "nao_configurado";
              if (item.emBreve) status = "em_breve";
              else if (cx?.configurado) status = "conectado";
              const badge = statusBadge(status, dark);
              const icon = integradorIconVariant(item.id);
              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: `1px solid ${badge.border}`,
                    background: badge.bg,
                  }}
                >
                  {icon ? (
                    <IntegracaoMarcaIcon variant={icon} size={22} />
                  ) : (
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        background: dark ? "rgba(11,31,16,0.9)" : "#eef7eb",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 800,
                        color: dark ? RF_TEXT_MUTED : "#5d7a67",
                      }}
                    >
                      {item.nome.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: dark ? RF_TEXT_PRIMARY : "#0b2210" }}>
                      {item.nome}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: dark ? RF_TEXT_SECONDARY : "#5d7a67" }}>
                      {item.descricao}
                      {item.ferramentas.length > 0 ? ` · ${item.ferramentas.length} função(ões)` : ""}
                    </p>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: badge.color }}>{badge.label}</span>
                </div>
              );
            })}
          </div>
        )}
        <p style={{ margin: "10px 0 0", fontSize: 11, lineHeight: 1.45, color: dark ? RF_TEXT_MUTED : "#6e7781" }}>
          Ligue <strong style={{ color: dark ? RF_TEXT_PRIMARY : "#0b2210" }}>Google</strong> e confirme{" "}
          <strong style={{ color: dark ? RF_TEXT_PRIMARY : "#0b2210" }}>Mistral</strong> acima para o funcionário IA
          usar agenda, e-mail, OCR e relatórios. Outras integrações activam-se quando o tenant as configurar no Hub.
        </p>
      </div>
    </div>
  );
}
