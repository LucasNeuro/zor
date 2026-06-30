"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Check, ChevronRight, Loader2, Plug } from "lucide-react";
import { CrmIntegracaoSideoverShell } from "@/components/crm/AgenteUazapiBlock";
import { CrmToggleSwitch } from "@/components/crm/CrmToggleSwitch";
import { IntegracaoMarcaIcon } from "@/components/crm/IntegracaoMarcaIcon";
import { BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";
import { CRM_ACCENT, crmBtnPrimaryLg } from "@/lib/crm/crm-button-styles";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";
import { mergeUsoFerramentasComPadraoPreservandoCustom } from "@/lib/hub/agente-ferramentas-registry";
import { MISTRAL_PERCEPCAO_KEY } from "@/lib/hub/mistral-integracao-constants";
import { mensagemUsuario } from "@/lib/crm/mensagens-usuario";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";

export type AgenteMistralBlockProps = {
  agenteSlug: string;
  agenteNome?: string;
  usoFerramentas: Record<string, boolean>;
  onUsoChange?: (ferramentaKey: string, ativo: boolean) => void;
  layout?: "card" | "painel";
};

function mistralBadge(plataformaOk: boolean, percepcaoOn: boolean) {
  if (!plataformaOk) {
    return { bg: "rgba(11, 31, 16, 0.9)", fg: RF_TEXT_MUTED, rotulo: "NÃO LIGADO", bar: "#484f58" };
  }
  if (percepcaoOn) {
    return { bg: "#23863633", fg: "#3fb950", rotulo: "ACTIVO", bar: "#3fb950" };
  }
  return { bg: "#23863633", fg: "#3fb950", rotulo: "LIGADO", bar: "#3fb950" };
}

export function AgenteMistralBlock({
  agenteSlug,
  agenteNome,
  usoFerramentas,
  onUsoChange,
  layout = "card",
}: AgenteMistralBlockProps) {
  const isCard = layout === "card";
  const isDark = isCard;

  const [sideoverOpen, setSideoverOpen] = useState(false);
  const [plataformaOk, setPlataformaOk] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [testeOk, setTesteOk] = useState<boolean | null>(null);
  const [testeMsg, setTesteMsg] = useState("");

  const uso = mergeUsoFerramentasComPadraoPreservandoCustom(usoFerramentas);
  const percepcaoOn = uso[MISTRAL_PERCEPCAO_KEY] === true;
  const badge = mistralBadge(plataformaOk, percepcaoOn);

  const tituloIntegracao = "Percepção multimodal";
  const subtituloCard = percepcaoOn ? "OCR, áudio e visão activos" : "OCR e visão (opcional)";

  const border = isDark ? RF_BORDER : "#dcebd8";
  const cardBg = isDark ? "rgba(6, 13, 8, 0.72)" : "#ffffff";
  const title = isDark ? RF_TEXT_PRIMARY : "#0b2210";
  const body = isDark ? RF_TEXT_SECONDARY : "#5d7a67";
  const muted = isDark ? RF_TEXT_MUTED : "#6e7681";
  const accent = isDark ? RF_ACCENT : CRM_ACCENT;

  const refreshStatus = useCallback(async () => {
    setCarregando(true);
    try {
      const headers = await crmApiHeaders();
      const res = await fetch("/api/hub/integradores/mistral/status", { headers });
      const data = (await res.json().catch(() => ({}))) as {
        plataforma?: boolean;
        ligado?: boolean;
      };
      setPlataformaOk(data.plataforma === true || data.ligado === true);
    } catch {
      setPlataformaOk(false);
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

  const confirmarLigacao = useCallback(async () => {
    setBusy(true);
    setErro("");
    setTesteOk(null);
    setTesteMsg("");
    try {
      const headers = await crmApiHeaders();
      const res = await fetch("/api/hub/integradores/mistral/ligar", {
        method: "POST",
        headers,
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Não foi possível validar Mistral.");
      }
      setPlataformaOk(true);
      setTesteOk(true);
      setTesteMsg(data.message || "Ligação confirmada.");
    } catch (e) {
      setErro(mensagemUsuario(e instanceof Error ? e.message : "Erro ao validar Mistral"));
    } finally {
      setBusy(false);
    }
  }, []);

  const testarMistral = useCallback(async () => {
    setBusy(true);
    setErro("");
    setTesteOk(null);
    setTesteMsg("");
    try {
      const headers = await crmApiHeaders();
      const res = await fetch("/api/hub/integradores/mistral/test", {
        method: "POST",
        headers,
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || data.message || "Teste Mistral falhou.");
      }
      setTesteOk(true);
      setTesteMsg(data.message || "Conexão confirmada.");
    } catch (e) {
      setTesteOk(false);
      setTesteMsg(mensagemUsuario(e instanceof Error ? e.message : "Erro no teste"));
    } finally {
      setBusy(false);
    }
  }, []);

  const btnPrimaryDark = (disabled: boolean): CSSProperties => ({
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
    cursor: disabled ? "not-allowed" : "pointer",
    background: disabled ? "#4a6356" : BRAND_TEXT_DARK,
    color: disabled ? "#c8dcc8" : BRAND_GREEN_BRIGHT,
  });

  const btnSecondaryDark = (disabled: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    minHeight: 40,
    padding: "9px 14px",
    borderRadius: 8,
    border: `1px solid ${RF_BORDER_STRONG}`,
    background: "rgba(6, 13, 8, 0.72)",
    color: disabled ? RF_TEXT_MUTED : RF_TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  const botoesMistral = (
    <>
      {!plataformaOk ? (
        <button type="button" onClick={() => void confirmarLigacao()} disabled={busy} style={btnPrimaryDark(busy)}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Plug size={16} />}
          Validar ligação
        </button>
      ) : (
        <button type="button" onClick={() => void testarMistral()} disabled={busy} style={btnSecondaryDark(busy)}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Plug size={16} />}
          Testar conexão
        </button>
      )}
    </>
  );

  const painelConteudo = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          position: "relative",
          padding: "14px 16px",
          borderRadius: 12,
          border: `1px solid ${border}`,
          background: cardBg,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 10,
            bottom: 10,
            width: 3,
            borderRadius: "0 4px 4px 0",
            background: badge.bar,
          }}
          aria-hidden
        />
        <div style={{ paddingLeft: 12 }}>
          <span
            style={{
              display: "inline-block",
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
              background: badge.bg,
              color: badge.fg,
            }}
          >
            {carregando ? "A VERIFICAR…" : badge.rotulo}
          </span>
          {plataformaOk && percepcaoOn ? (
            <p style={{ margin: "10px 0 0", fontSize: 12, color: body, lineHeight: 1.5 }}>
              Multimodal activo neste agente
            </p>
          ) : null}
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: body, lineHeight: 1.55 }}>
        {plataformaOk
          ? "Active OCR, áudio e visão para o agente processar documentos nas conversas."
          : "O serviço Mistral não está disponível neste ambiente."}
      </p>

      {erro ? <p style={{ margin: 0, color: "#f85149", fontSize: 12, lineHeight: 1.45 }}>{erro}</p> : null}

      {!isCard ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{botoesMistral}</div> : null}

      {plataformaOk ? (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "12px 14px",
            borderRadius: 12,
            border: `1px solid ${percepcaoOn ? "rgba(63, 185, 80, 0.35)" : border}`,
            background: percepcaoOn ? "rgba(63, 185, 80, 0.08)" : cardBg,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p id="mistral-toggle-percepcao" style={{ margin: 0, fontSize: 13, fontWeight: 700, color: title }}>
              Percepção multimodal
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: body, lineHeight: 1.45 }}>
              PDF, imagem e áudio nas conversas
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: percepcaoOn ? "#3fb950" : muted }}>
              {percepcaoOn ? "ACTIVO" : "INACTIVO"}
            </span>
            <CrmToggleSwitch
              checked={percepcaoOn}
              onCheckedChange={(v) => onUsoChange?.(MISTRAL_PERCEPCAO_KEY, v)}
              disabled={!onUsoChange}
              labelledBy="mistral-toggle-percepcao"
              variant={isDark ? "dark" : "light"}
            />
          </div>
        </div>
      ) : null}

      {testeOk != null ? (
        <p style={{ margin: 0, fontSize: 12, color: testeOk ? "#3fb950" : "#f85149", lineHeight: 1.45 }}>
          {mensagemUsuario(testeMsg)}
        </p>
      ) : null}
    </div>
  );

  const painelSubtitle = plataformaOk
    ? percepcaoOn
      ? "Multimodal activo — teste a ligação ou ajuste o toggle."
      : "Serviço disponível — active multimodal se precisar de documentos ou áudio."
    : "Valide a ligação com o motor Mistral da plataforma.";

  const sideoverFooter = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {isCard ? botoesMistral : null}
      {isCard ? (
        <button type="button" style={btnSecondaryDark(false)} onClick={() => setSideoverOpen(false)}>
          Fechar
        </button>
      ) : null}
    </div>
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
              background: "rgba(11, 31, 16, 0.9)",
              border: "1px solid rgba(255, 112, 0, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IntegracaoMarcaIcon variant="mistral" size={24} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: accent, letterSpacing: 0.04 }}>
              MISTRAL AI
            </p>
            <h3 style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 800, color: title }}>
              {tituloIntegracao}
            </h3>
            {carregando ? (
              <p style={{ margin: "8px 0 0", fontSize: 11, color: muted }}>A verificar ligação…</p>
            ) : plataformaOk ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 8,
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#3fb950",
                }}
              >
                <Check size={12} />
                Ligado{percepcaoOn ? " · multimodal activo" : ""}
              </span>
            ) : (
              <span style={{ display: "block", marginTop: 8, fontSize: 11, color: "#c9a24a", fontWeight: 600 }}>
                Serviço indisponível
              </span>
            )}
          </div>
        </header>
        <div style={{ padding: "14px 16px" }}>{painelConteudo}</div>
      </section>
    );
  }

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
            background: "linear-gradient(90deg, #fc8304, #fcdb04, #e40404)",
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
                  background: "#fff8f0",
                  border: "1px solid #ffd4b0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <IntegracaoMarcaIcon variant="mistral" size={22} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, color: "#0b2210", fontSize: 14, fontWeight: 800 }}>
                  Mistral — {tituloIntegracao}
                </p>
                <p style={{ margin: "4px 0 0", color: "#5d7a67", fontSize: 12, lineHeight: 1.45 }}>
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
        subtitle={painelSubtitle}
        footer={sideoverFooter}
        theme="dark"
        sectionLabel="Mistral"
        loading={sideoverOpen && carregando}
        loadingLabel="A carregar…"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: "rgba(11, 31, 16, 0.9)",
                border: "1px solid rgba(255, 112, 0, 0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IntegracaoMarcaIcon variant="mistral" size={24} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: RF_ACCENT, letterSpacing: 0.04 }}>
                MISTRAL AI
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 800, color: RF_TEXT_PRIMARY }}>
                {tituloIntegracao}
              </p>
              {!carregando && plataformaOk ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    marginTop: 8,
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#3fb950",
                  }}
                >
                  <Check size={12} />
                  Ligado{percepcaoOn ? " · multimodal activo" : ""}
                </span>
              ) : !carregando ? (
                <span style={{ display: "block", marginTop: 8, fontSize: 11, color: "#c9a24a", fontWeight: 600 }}>
                  Serviço indisponível
                </span>
              ) : null}
            </div>
          </div>
          {painelConteudo}
        </div>
      </CrmIntegracaoSideoverShell>
    </>
  );
}
