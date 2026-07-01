"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { ChevronRight, Loader2, Plug, Unplug } from "lucide-react";
import { CrmIntegracaoSideoverShell } from "@/components/crm/AgenteUazapiBlock";
import { IntegracaoMarcaIcon } from "@/components/crm/IntegracaoMarcaIcon";
import { BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";
import { crmBtnPrimaryLg } from "@/lib/crm/crm-button-styles";
import {
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_LIGHT_INPUT_STYLE,
  RF_LIGHT_TEXT_MUTED,
  RF_LIGHT_TEXT_PRIMARY,
  RF_LIGHT_TEXT_SECONDARY,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
  rfInputStyle,
  rfLightInputStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";
import { HUB_INT_SUPABASE_EXTERNO_CONSULTAR } from "@/lib/hub/supabase-externo-constants";
import { mensagemUsuario } from "@/lib/crm/mensagens-usuario";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";

export type AgenteSupabaseCrmBlockProps = {
  agenteSlug: string;
  agenteNome?: string;
  /** Desactiva ferramenta externa ao desligar base (opcional). */
  onUsoChange?: (ferramentaKey: string, ativo: boolean) => void;
  layout?: "card" | "painel";
  theme?: "dark" | "light";
};

type StatusPayload = {
  waje_crm?: { configurado?: boolean; project_url_mascarado?: string | null };
  supabase_externo?: {
    configurado?: boolean;
    project_host?: string | null;
    rotulo?: string | null;
  };
};

function supabaseBadge(ligado: boolean, dark: boolean): { bg: string; fg: string; rotulo: string } {
  if (ligado) {
    return { bg: "#23863633", fg: "#3fb950", rotulo: "LIGADO" };
  }
  return {
    bg: dark ? "rgba(11, 31, 16, 0.72)" : "#dcebd8",
    fg: dark ? RF_TEXT_MUTED : "#5d7a67",
    rotulo: "NÃO LIGADO",
  };
}

export function AgenteSupabaseCrmBlock({
  agenteSlug,
  agenteNome,
  onUsoChange,
  layout = "card",
  theme = "light",
}: AgenteSupabaseCrmBlockProps) {
  const isCard = layout === "card";
  /** Resumo do card na ficha do agente (fundo branco). */
  const isDark = theme === "dark";
  /** Formulários no sideover ou painel do wizard (fundo escuro). */
  const formDark = isCard || isDark;

  const [sideoverOpen, setSideoverOpen] = useState(false);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [rotulo, setRotulo] = useState("Supabase externo");

  const wajeOk = status?.waje_crm?.configurado !== false;
  const externoOk = status?.supabase_externo?.configurado === true;
  const badge = supabaseBadge(wajeOk, isCard ? false : isDark);

  const border = isDark ? RF_BORDER : "#dcebd8";
  const cardBg = isDark ? "rgba(6, 13, 8, 0.72)" : "#ffffff";
  const titleColor = isCard ? "#0b2210" : isDark ? RF_TEXT_PRIMARY : "#0b2210";
  const bodyColor = isCard ? "#5d7a67" : isDark ? RF_TEXT_SECONDARY : "#5d7a67";
  const mutedColor = isCard ? "#6e7681" : isDark ? RF_TEXT_MUTED : "#6e7681";

  const formTitle = formDark ? RF_TEXT_PRIMARY : RF_LIGHT_TEXT_PRIMARY;
  const formBody = formDark ? RF_TEXT_SECONDARY : RF_LIGHT_TEXT_SECONDARY;
  const formMuted = formDark ? RF_TEXT_MUTED : RF_LIGHT_TEXT_MUTED;
  const formLabel: CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: formMuted,
    display: "block",
    marginBottom: 4,
  };
  const fieldInputStyle = (): CSSProperties => ({
    ...(formDark ? rfInputStyle() : rfLightInputStyle()),
    marginTop: 0,
    width: "100%",
  });
  const inputClassName = formDark ? "waje-rf-input-dark" : "waje-rf-input-light";

  const refreshStatus = useCallback(async () => {
    setCarregando(true);
    try {
      const headers = await crmApiHeaders();
      const res = await fetch("/api/hub/integradores/supabase-externo/status", { headers });
      const data = (await res.json().catch(() => ({}))) as StatusPayload;
      setStatus(data);
      if (data.supabase_externo?.rotulo) setRotulo(data.supabase_externo.rotulo);
    } catch (e) {
      setStatus(null);
      const msg = e instanceof Error ? e.message : "";
      if (/failed to fetch|networkerror|load failed/i.test(msg)) {
        setErro("Falha de rede ao carregar estado do Supabase. Verifique a ligação e recarregue.");
      }
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (sideoverOpen) void refreshStatus();
  }, [sideoverOpen, refreshStatus]);

  const ligarExterno = useCallback(async () => {
    setBusy(true);
    setErro("");
    try {
      const headers = await crmApiHeaders();
      const res = await fetch("/api/hub/integradores/supabase-externo/conectar", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          project_url: projectUrl.trim(),
          api_key: apiKey.trim(),
          rotulo: rotulo.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Falha ao ligar Supabase externo.");
      }
      setApiKey("");
      await refreshStatus();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Erro ao ligar.";
      const msg = /failed to fetch|networkerror|load failed/i.test(raw)
        ? "Falha de rede ao contactar o servidor. Verifique a ligação e tente novamente."
        : raw;
      setErro(mensagemUsuario(msg));
    } finally {
      setBusy(false);
    }
  }, [apiKey, projectUrl, refreshStatus, rotulo]);

  const desligarExterno = useCallback(async () => {
    setBusy(true);
    setErro("");
    try {
      const headers = await crmApiHeaders();
      const res = await fetch("/api/hub/integradores/supabase-externo/desconectar", {
        method: "POST",
        headers,
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Falha ao desligar.");
      }
      onUsoChange?.(HUB_INT_SUPABASE_EXTERNO_CONSULTAR, false);
      await refreshStatus();
    } catch (e) {
      setErro(mensagemUsuario(e instanceof Error ? e.message : "Erro ao desligar."));
    } finally {
      setBusy(false);
    }
  }, [onUsoChange, refreshStatus]);

  const btnPrimary: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    minHeight: 40,
    padding: "9px 14px",
    borderRadius: 8,
    border: "none",
    fontSize: 12,
    fontWeight: 700,
    cursor: busy ? "not-allowed" : "pointer",
    background: busy ? "#4a6356" : BRAND_TEXT_DARK,
    color: busy ? "#c8dcc8" : BRAND_GREEN_BRIGHT,
  };

  const btnSecondaryDark: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: 40,
    padding: "9px 14px",
    borderRadius: 8,
    border: `1px solid ${RF_BORDER_STRONG}`,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    background: "transparent",
    color: RF_TEXT_PRIMARY,
  };

  const painelConfig = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 12,
          border: "1px solid rgba(62, 207, 142, 0.35)",
          background: "rgba(62, 207, 142, 0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <IntegracaoMarcaIcon variant="supabase" size={28} />
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: formTitle }}>
              Base CRM Waje (Supabase)
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: formBody }}>
              {wajeOk
                ? `Ligada · ${status?.waje_crm?.project_url_mascarado ?? "projecto da plataforma"}`
                : "Projecto Supabase da plataforma Waje"}
            </p>
          </div>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 10,
              fontWeight: 800,
              color: "#3fb950",
              border: "1px solid rgba(63, 185, 80, 0.35)",
              borderRadius: 4,
              padding: "3px 8px",
            }}
          >
            {wajeOk ? "LIGADA" : "—"}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: formMuted, lineHeight: 1.5 }}>
          A base Waje fica sempre activa para o tenant. Active ou restrinja cada operação CRM na secção{" "}
          <strong>Integrações ligadas</strong> abaixo.
        </p>
      </div>

      <div
        style={{
          padding: "14px 16px",
          borderRadius: 12,
          border: `1px solid ${externoOk ? "rgba(62, 207, 142, 0.35)" : RF_BORDER_STRONG}`,
          background: "rgba(6, 13, 8, 0.72)",
        }}
      >
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 800, color: formTitle }}>
          Supabase externo (opcional)
        </p>
        {externoOk ? (
          <>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: formBody }}>
              Ligado a <strong>{status?.supabase_externo?.project_host}</strong>
              {status?.supabase_externo?.rotulo ? ` · ${status.supabase_externo.rotulo}` : ""}
            </p>
            <button type="button" style={btnPrimary} disabled={busy} onClick={() => void desligarExterno()}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Unplug size={16} />}
              Desligar base externa
            </button>
          </>
        ) : (
          <>
            <p style={{ margin: "0 0 12px", fontSize: 11, color: formBody, lineHeight: 1.5 }}>
              Ligue outro projecto Supabase para o agente consultar tabelas/views e comparar com o CRM Waje.
            </p>
            <label style={{ display: "block", marginBottom: 10 }}>
              <span style={formLabel}>Rótulo</span>
              <input
                value={rotulo}
                onChange={(e) => setRotulo(e.target.value)}
                className={inputClassName}
                style={fieldInputStyle()}
                placeholder="Ex.: ERP legado"
              />
            </label>
            <label style={{ display: "block", marginBottom: 10 }}>
              <span style={formLabel}>URL do projecto</span>
              <input
                value={projectUrl}
                onChange={(e) => setProjectUrl(e.target.value)}
                className={inputClassName}
                style={fieldInputStyle()}
                placeholder="https://xxxx.supabase.co"
                autoComplete="off"
              />
            </label>
            <label style={{ display: "block", marginBottom: 12 }}>
              <span style={formLabel}>Chave API</span>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className={inputClassName}
                style={fieldInputStyle()}
                placeholder="service_role ou anon"
                autoComplete="new-password"
              />
            </label>
            <button
              type="button"
              style={btnPrimary}
              disabled={busy || !projectUrl.trim() || !apiKey.trim()}
              onClick={() => void ligarExterno()}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Plug size={16} />}
              Testar e ligar Supabase externo
            </button>
          </>
        )}
      </div>

      {erro ? (
        <p role="alert" style={{ margin: 0, fontSize: 12, color: "#f85149" }}>
          {erro}
        </p>
      ) : null}
    </div>
  );

  const sideoverFooter = (
    <button type="button" style={btnSecondaryDark} onClick={() => setSideoverOpen(false)}>
      Fechar
    </button>
  );

  if (!isCard) {
    return (
      <section
        style={{
          borderRadius: 14,
          border: `1px solid ${border}`,
          background: cardBg,
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "14px 16px",
            borderBottom: `1px solid ${border}`,
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: isDark
                ? "rgba(11, 31, 16, 0.9)"
                : "linear-gradient(145deg, rgba(62,207,142,0.14), rgba(36,147,97,0.1))",
              border: `1px solid ${isDark ? "rgba(62, 207, 142, 0.35)" : "rgba(62,207,142,0.35)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IntegracaoMarcaIcon variant="supabase" size={24} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: isDark ? "#3ecf8e" : "#249361", letterSpacing: 0.04 }}>
              SUPABASE
            </p>
            <h3 style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 800, color: titleColor }}>
              Base de dados CRM
            </h3>
            <span
              style={{
                display: "inline-block",
                marginTop: 8,
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 800,
                background: badge.bg,
                color: badge.fg,
              }}
            >
              {carregando ? "…" : badge.rotulo}
            </span>
          </div>
        </header>
        <div style={{ padding: "14px 16px" }}>{painelConfig}</div>
      </section>
    );
  }

  const subtituloCard = externoOk
    ? `CRM Waje · + externo ${status?.supabase_externo?.project_host ?? ""}`
    : "CRM Waje · Supabase da plataforma";

  return (
    <>
      <div
        style={{
          marginBottom: 18,
          borderRadius: 14,
          border: "1px solid #dcebd8",
          background: "#ffffff",
          boxShadow: "0 4px 16px rgba(11, 31, 16, 0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: 3,
            background: "linear-gradient(90deg, #249361, #3ecf8e)",
            opacity: 0.95,
          }}
          aria-hidden
        />
        <div style={{ padding: "14px 16px 16px" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", gap: 12, minWidth: 0, alignItems: "center" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "linear-gradient(145deg, rgba(62,207,142,0.14), rgba(36,147,97,0.1))",
                  border: "1px solid rgba(62,207,142,0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <IntegracaoMarcaIcon variant="supabase" size={22} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, color: titleColor, fontSize: 14, fontWeight: 800 }}>
                  Base de dados CRM (Supabase)
                </p>
                <p style={{ margin: "4px 0 0", color: bodyColor, fontSize: 12, lineHeight: 1.45 }}>
                  {subtituloCard} ·{" "}
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 800,
                      background: badge.bg,
                      color: badge.fg,
                    }}
                  >
                    {carregando ? "…" : badge.rotulo}
                  </span>
                </p>
                {wajeOk && status?.waje_crm?.project_url_mascarado ? (
                  <p style={{ margin: "6px 0 0", color: mutedColor, fontSize: 11 }}>
                    Projecto: <strong style={{ color: titleColor }}>{status.waje_crm.project_url_mascarado}</strong>
                  </p>
                ) : null}
                {externoOk && status?.supabase_externo?.project_host ? (
                  <p style={{ margin: "4px 0 0", color: mutedColor, fontSize: 11 }}>
                    Externo: <strong style={{ color: titleColor }}>{status.supabase_externo.project_host}</strong>
                  </p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSideoverOpen(true)}
              style={{
                ...crmBtnPrimaryLg(false),
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                flex: "none",
                padding: "9px 14px",
              }}
            >
              Configurar ligação
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <CrmIntegracaoSideoverShell
        open={sideoverOpen}
        onClose={() => setSideoverOpen(false)}
        title={agenteNome?.trim() || agenteSlug}
        subtitle="Supabase — CRM Waje e bases externas"
        footer={sideoverFooter}
        theme="dark"
        sectionLabel="Supabase"
        loading={sideoverOpen && carregando}
        loadingLabel="A carregar…"
      >
        {painelConfig}
      </CrmIntegracaoSideoverShell>
    </>
  );
}
