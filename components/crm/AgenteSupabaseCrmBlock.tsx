"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { ChevronRight, Loader2, Plug, Unplug } from "lucide-react";
import { CrmIntegracaoSideoverShell } from "@/components/crm/AgenteUazapiBlock";
import { CrmToggleSwitch } from "@/components/crm/CrmToggleSwitch";
import { IntegracaoMarcaIcon } from "@/components/crm/IntegracaoMarcaIcon";
import { BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";
import {
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
  rfInputStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";
import { mergeUsoFerramentasComPadraoPreservandoCustom } from "@/lib/hub/agente-ferramentas-registry";
import { HUB_INT_CRM_OPERAR } from "@/lib/hub/crm-integrador-constants";
import { ferramentasDoIntegrador } from "@/lib/hub/integradores-catalogo";
import { HUB_INT_SUPABASE_EXTERNO_CONSULTAR } from "@/lib/hub/supabase-externo-constants";
import { mensagemUsuario } from "@/lib/crm/mensagens-usuario";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";

export type AgenteSupabaseCrmBlockProps = {
  agenteSlug: string;
  agenteNome?: string;
  modoInterno?: boolean;
  usoFerramentas: Record<string, boolean>;
  onUsoChange?: (ferramentaKey: string, ativo: boolean) => void;
  layout?: "card" | "painel";
};

type StatusPayload = {
  waje_crm?: { configurado?: boolean; project_url_mascarado?: string | null };
  supabase_externo?: {
    configurado?: boolean;
    project_host?: string | null;
    rotulo?: string | null;
  };
};

const FERRAMENTAS_WAJE = ferramentasDoIntegrador("waje_crm");
const FERRAMENTA_EXTERNA = ferramentasDoIntegrador("supabase_externo")[0];

function toolRow(
  key: string,
  titulo: string,
  descricao: string,
  checked: boolean,
  onChange: (v: boolean) => void,
  disabled?: boolean,
  badge?: string
) {
  const labelId = `supabase-tool-${key}`;
  return (
    <div
      key={key}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 12,
        border: `1px solid ${checked ? "rgba(62, 207, 142, 0.35)" : RF_BORDER_STRONG}`,
        background: checked ? "rgba(62, 207, 142, 0.07)" : "rgba(6, 13, 8, 0.72)",
        opacity: disabled ? 0.65 : 1,
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          background: checked ? "rgba(62, 207, 142, 0.14)" : "rgba(11, 31, 16, 0.9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        <IntegracaoMarcaIcon variant="supabase" size={24} />
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <span id={labelId} style={{ color: RF_TEXT_PRIMARY, fontSize: 13, fontWeight: 700 }}>
            {titulo}
          </span>
          {badge ? (
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 0.06,
                color: "#3ECF8E",
                border: "1px solid rgba(62, 207, 142, 0.35)",
                borderRadius: 4,
                padding: "2px 6px",
              }}
            >
              {badge}
            </span>
          ) : null}
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: RF_TEXT_SECONDARY, lineHeight: 1.45 }}>{descricao}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: checked ? "#3fb950" : RF_TEXT_MUTED }}>
          {checked ? "ACTIVO" : "INACTIVO"}
        </span>
        <CrmToggleSwitch
          checked={checked}
          onCheckedChange={onChange}
          disabled={disabled}
          labelledBy={labelId}
          variant="dark"
        />
      </div>
    </div>
  );
}

export function AgenteSupabaseCrmBlock({
  agenteSlug,
  agenteNome,
  modoInterno = false,
  usoFerramentas,
  onUsoChange,
  layout = "card",
}: AgenteSupabaseCrmBlockProps) {
  const isCard = layout === "card";
  const uso = mergeUsoFerramentasComPadraoPreservandoCustom(usoFerramentas);

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

  const refreshStatus = useCallback(async () => {
    setCarregando(true);
    try {
      const headers = await crmApiHeaders();
      const res = await fetch("/api/hub/integradores/supabase-externo/status", { headers });
      const data = (await res.json().catch(() => ({}))) as StatusPayload;
      setStatus(data);
      if (data.supabase_externo?.rotulo) setRotulo(data.supabase_externo.rotulo);
    } catch {
      setStatus(null);
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
      setErro(mensagemUsuario(e instanceof Error ? e.message : "Erro ao ligar."));
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
      if (onUsoChange) onUsoChange(HUB_INT_SUPABASE_EXTERNO_CONSULTAR, false);
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

  const ferramentasVisiveis = FERRAMENTAS_WAJE.filter((f) => {
    if (f.ferramenta_key === HUB_INT_CRM_OPERAR && !modoInterno) return false;
    return true;
  });

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
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: RF_TEXT_PRIMARY }}>
              Base CRM Waje (Supabase)
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: RF_TEXT_SECONDARY }}>
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
        <p style={{ margin: 0, fontSize: 11, color: RF_TEXT_MUTED, lineHeight: 1.5 }}>
          Leads, negócios, financeiro e views <code>vw_rel_*</code> do seu tenant. Escrita validada no CRM — sem SQL
          livre.
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
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 800, color: RF_TEXT_PRIMARY }}>
          Supabase externo (opcional)
        </p>
        {externoOk ? (
          <>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: RF_TEXT_SECONDARY }}>
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
            <p style={{ margin: "0 0 12px", fontSize: 11, color: RF_TEXT_SECONDARY, lineHeight: 1.5 }}>
              Ligue outro projecto Supabase para o agente <strong>consultar</strong> tabelas/views e comparar com o CRM
              Waje. Use chave <code>service_role</code> ou <code>anon</code> com RLS que permita leitura.
            </p>
            <label style={{ display: "block", marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: RF_TEXT_MUTED }}>Rótulo</span>
              <input
                value={rotulo}
                onChange={(e) => setRotulo(e.target.value)}
                style={{ ...rfInputStyle, marginTop: 4, width: "100%" }}
                placeholder="Ex.: ERP legado"
              />
            </label>
            <label style={{ display: "block", marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: RF_TEXT_MUTED }}>URL do projecto</span>
              <input
                value={projectUrl}
                onChange={(e) => setProjectUrl(e.target.value)}
                style={{ ...rfInputStyle, marginTop: 4, width: "100%" }}
                placeholder="https://xxxx.supabase.co"
                autoComplete="off"
              />
            </label>
            <label style={{ display: "block", marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: RF_TEXT_MUTED }}>Chave API</span>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{ ...rfInputStyle, marginTop: 4, width: "100%" }}
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

      <div>
        <p
          style={{
            margin: "0 0 10px",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.04,
            color: RF_TEXT_MUTED,
            textTransform: "uppercase",
          }}
        >
          Funções — base Waje
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ferramentasVisiveis.map((f) =>
            toolRow(
              f.ferramenta_key,
              f.titulo,
              f.descricao_curta,
              uso[f.ferramenta_key] === true,
              (v) => onUsoChange?.(f.ferramenta_key, v),
              !onUsoChange,
              "CRM Waje"
            )
          )}
        </div>
      </div>

      {FERRAMENTA_EXTERNA ? (
        <div>
          <p
            style={{
              margin: "8px 0 10px",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.04,
              color: RF_TEXT_MUTED,
              textTransform: "uppercase",
            }}
          >
            Funções — base externa
          </p>
          {toolRow(
            FERRAMENTA_EXTERNA.ferramenta_key,
            FERRAMENTA_EXTERNA.titulo,
            externoOk
              ? FERRAMENTA_EXTERNA.descricao_curta
              : `${FERRAMENTA_EXTERNA.descricao_curta} (ligue a base externa acima primeiro)`,
            uso[FERRAMENTA_EXTERNA.ferramenta_key] === true,
            (v) => onUsoChange?.(FERRAMENTA_EXTERNA.ferramenta_key, v),
            !externoOk || !onUsoChange,
            "Supabase externo"
          )}
        </div>
      ) : null}
    </div>
  );

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

  const sideoverFooter = (
    <button type="button" style={btnSecondaryDark} onClick={() => setSideoverOpen(false)}>
      Fechar
    </button>
  );

  if (!isCard) {
    return painelConfig;
  }

  const subtitulo =
    externoOk && status?.supabase_externo?.project_host
      ? `Waje + ${status.supabase_externo.project_host}`
      : "CRM Waje · Supabase da plataforma";

  return (
    <>
      <button
        type="button"
        onClick={() => setSideoverOpen(true)}
        style={{
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          border: `1px solid ${RF_BORDER_STRONG}`,
          borderRadius: 14,
          padding: "14px 16px",
          background: "rgba(6, 13, 8, 0.72)",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "rgba(62, 207, 142, 0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <IntegracaoMarcaIcon variant="supabase" size={28} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: RF_TEXT_PRIMARY }}>
            Base de dados CRM (Supabase)
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: RF_TEXT_SECONDARY }}>{subtitulo}</p>
          {agenteNome ? (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: RF_TEXT_MUTED }}>Agente: {agenteNome}</p>
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: wajeOk ? "#3fb950" : RF_TEXT_MUTED,
              border: `1px solid ${wajeOk ? "rgba(63, 185, 80, 0.35)" : RF_BORDER_STRONG}`,
              borderRadius: 4,
              padding: "2px 8px",
            }}
          >
            {carregando ? "…" : wajeOk ? "WAJE OK" : "CRM"}
          </span>
          <ChevronRight size={20} color={RF_TEXT_MUTED} aria-hidden />
        </div>
      </button>

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
