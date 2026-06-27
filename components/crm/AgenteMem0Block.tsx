"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { ChevronRight, Loader2, Plug } from "lucide-react";
import { CrmIntegracaoSideoverShell } from "@/components/crm/AgenteUazapiBlock";
import { CrmToggleSwitch } from "@/components/crm/CrmToggleSwitch";
import { IntegracaoMarcaIcon } from "@/components/crm/IntegracaoMarcaIcon";
import { BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";
import { crmBtnPrimaryLg } from "@/lib/crm/crm-button-styles";
import {
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";
import { mergeUsoFerramentasComPadraoPreservandoCustom } from "@/lib/hub/agente-ferramentas-registry";
import { MEM0_BUSCAR_KEY, MEM0_SUPER_MEMORIA_KEY } from "@/lib/hub/mem0-constants";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";

export type AgenteMem0BlockProps = {
  agenteSlug: string;
  agenteNome?: string;
  usoFerramentas: Record<string, boolean>;
  onUsoChange?: (ferramentaKey: string, ativo: boolean) => void;
  layout?: "card" | "painel";
};

function mem0Badge(plataformaOk: boolean, algumaFerramentaOn: boolean) {
  if (!plataformaOk) {
    return { bg: "#f0f0f0", fg: "#656d76", rotulo: "NÃO LIGADO" };
  }
  if (algumaFerramentaOn) {
    return { bg: "#23863633", fg: "#3fb950", rotulo: "ACTIVO" };
  }
  return { bg: "#23863633", fg: "#3fb950", rotulo: "LIGADO" };
}

export function AgenteMem0Block({
  agenteSlug,
  agenteNome,
  usoFerramentas,
  onUsoChange,
  layout = "card",
}: AgenteMem0BlockProps) {
  const isCard = layout === "card";

  const [sideoverOpen, setSideoverOpen] = useState(false);
  const [plataformaOk, setPlataformaOk] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [testeOk, setTesteOk] = useState<boolean | null>(null);
  const [testeMsg, setTesteMsg] = useState("");

  const uso = mergeUsoFerramentasComPadraoPreservandoCustom(usoFerramentas);
  const superOn = uso[MEM0_SUPER_MEMORIA_KEY] === true;
  const buscarOn = uso[MEM0_BUSCAR_KEY] === true;
  const algumaFerramentaOn = superOn || buscarOn;
  const badge = mem0Badge(plataformaOk, algumaFerramentaOn);

  const tituloIntegracao = "Mem0 — Super Memória";
  const subtituloCard = superOn
    ? "Plus activo · recall semântico Mem0"
    : "Memória Supabase (tradicional)";

  const toggleRow = (
    key: string,
    titulo: string,
    descricao: string,
    checked: boolean,
    disabled: boolean
  ) => {
    const labelId = `mem0-toggle-${key}`;
    return (
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: "12px 14px",
          borderRadius: 12,
          border: `1px solid ${checked ? "rgba(63, 185, 80, 0.35)" : RF_BORDER_STRONG}`,
          background: checked ? "rgba(63, 185, 80, 0.08)" : "rgba(6, 13, 8, 0.72)",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p id={labelId} style={{ margin: 0, fontSize: 13, fontWeight: 700, color: RF_TEXT_PRIMARY }}>
            {titulo}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 11, color: RF_TEXT_SECONDARY, lineHeight: 1.5 }}>
            {descricao}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: checked ? "#3fb950" : RF_TEXT_MUTED }}>
            {checked ? "ACTIVO" : "INACTIVO"}
          </span>
          <CrmToggleSwitch
            checked={checked}
            onCheckedChange={(v) => onUsoChange?.(key, v)}
            disabled={disabled || !onUsoChange}
            labelledBy={labelId}
            variant="dark"
          />
        </div>
      </div>
    );
  };

  const refreshStatus = useCallback(async () => {
    setCarregando(true);
    try {
      const headers = await crmApiHeaders();
      const res = await fetch("/api/hub/integradores/mem0/status", { headers });
      const data = (await res.json().catch(() => ({}))) as { plataforma?: boolean; ligado?: boolean };
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
      const res = await fetch("/api/hub/integradores/mem0/ligar", {
        method: "POST",
        headers,
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Não foi possível validar Mem0.");
      }
      setPlataformaOk(true);
      setTesteOk(true);
      setTesteMsg(data.message || "Mem0 OK — active as ferramentas abaixo.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao validar Mem0");
    } finally {
      setBusy(false);
    }
  }, []);

  const testarMem0 = useCallback(async () => {
    setBusy(true);
    setErro("");
    setTesteOk(null);
    setTesteMsg("");
    try {
      const headers = await crmApiHeaders();
      const res = await fetch("/api/hub/integradores/mem0/test", {
        method: "POST",
        headers,
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || data.message || "Teste Mem0 falhou.");
      }
      setTesteOk(true);
      setTesteMsg(data.message || "Conexão Mem0 OK.");
    } catch (e) {
      setTesteOk(false);
      setTesteMsg(e instanceof Error ? e.message : "Erro no teste");
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
    color: RF_TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  const painel = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: "#f5f5f5",
            border: "1px solid #e8e8e8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <IntegracaoMarcaIcon variant="mem0" size={28} />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: RF_TEXT_MUTED, letterSpacing: 0.04 }}>
            MEM0 · SUPER MEMÓRIA
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: RF_TEXT_SECONDARY, lineHeight: 1.5 }}>
            Plus opcional por agente. Com Super Memória <strong>desligada</strong>, o atendimento usa só a memória
            tradicional do Supabase (<code style={{ fontSize: 11 }}>hub_memorias_lead</code> e ferramenta{" "}
            <code style={{ fontSize: 11 }}>hub_lead_memorias</code>) — o fluxo WhatsApp não muda.
          </p>
        </div>
      </div>

      {!plataformaOk ? (
        <>
          <p
            style={{
              margin: 0,
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid rgba(201, 162, 74, 0.45)",
              background: "rgba(201, 162, 74, 0.08)",
              color: "#c9a24a",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            Defina <strong>MEM0_API_KEY</strong> no <strong>.env</strong> local e no Render (web + worker WhatsApp),
            reinicie o servidor e clique em validar.
          </p>
          <button
            type="button"
            onClick={() => void confirmarLigacao()}
            disabled={busy}
            style={btnPrimaryDark(busy)}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Plug size={16} />}
            Validar MEM0_API_KEY
          </button>
        </>
      ) : (
        <>
          <p
            style={{
              margin: 0,
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid rgba(63, 185, 80, 0.35)",
              background: "rgba(63, 185, 80, 0.08)",
              color: "#3fb950",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            Integração disponível (<code style={{ fontSize: 11 }}>MEM0_API_KEY</code> detectada). Active abaixo o
            plus Mem0 — ou deixe desligado para memória Supabase apenas.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {toggleRow(
              MEM0_SUPER_MEMORIA_KEY,
              "Super Memória (recall automático)",
              "Injeta memórias Mem0 no prompt a cada turno. Desligado = sem chamadas à API Mem0.",
              superOn,
              !plataformaOk
            )}
            {toggleRow(
              MEM0_BUSCAR_KEY,
              "Buscar memórias (ferramenta IA)",
              "Permite à IA pesquisar Mem0 sob demanda (function calling). Requer Super Memória ou uso manual.",
              buscarOn,
              !plataformaOk
            )}
          </div>
          <p style={{ margin: 0, fontSize: 11, color: RF_TEXT_MUTED, lineHeight: 1.5 }}>
            Modo actual:{" "}
            <strong style={{ color: superOn ? "#3fb950" : RF_TEXT_PRIMARY }}>
              {superOn ? "Supabase + Mem0 (plus)" : "Supabase tradicional"}
            </strong>
            . Guarde a ficha do agente após alterar os toggles.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button type="button" onClick={() => void confirmarLigacao()} disabled={busy} style={btnPrimaryDark(busy)}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Plug size={16} />}
              Confirmar ligação Mem0
            </button>
            <button type="button" onClick={() => void testarMem0()} disabled={busy} style={btnSecondaryDark(busy)}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Plug size={16} />}
              Testar conexão Mem0
            </button>
          </div>
          {testeOk != null ? (
            <p style={{ margin: 0, fontSize: 11, color: testeOk ? "#3fb950" : "#f85149" }}>{testeMsg}</p>
          ) : null}
        </>
      )}

      {erro ? <p style={{ margin: 0, fontSize: 11, color: "#f85149" }}>{erro}</p> : null}
    </div>
  );

  const sideoverFooter = (
    <button type="button" style={btnSecondaryDark(false)} onClick={() => setSideoverOpen(false)}>
      Fechar
    </button>
  );

  if (!isCard) {
    return painel;
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
            background: "linear-gradient(90deg, #0d0d0d, #6b6b6b, #0d0d0d)",
            opacity: 0.92,
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
                  background: "linear-gradient(145deg, #f5f5f5, #ebebeb)",
                  border: "1px solid #e0e0e0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <IntegracaoMarcaIcon variant="mem0" size={24} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, color: "#0b2210", fontSize: 14, fontWeight: 800 }}>
                  {tituloIntegracao}
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
                {plataformaOk && algumaFerramentaOn ? (
                  <p style={{ margin: "6px 0 0", color: "#6e7681", fontSize: 11 }}>
                    Ferramentas activas neste agente
                  </p>
                ) : plataformaOk ? (
                  <p style={{ margin: "6px 0 0", color: "#6e7681", fontSize: 11 }}>
                    Chave OK · {superOn ? "Plus Mem0 activo" : "Só memória Supabase — active o plus se quiser"}
                  </p>
                ) : (
                  <p style={{ margin: "6px 0 0", color: "#c9a24a", fontSize: 11, fontWeight: 600 }}>
                    Defina MEM0_API_KEY no Render / .env
                  </p>
                )}
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
        subtitle="Mem0 · Super Memória (plataforma)"
        footer={sideoverFooter}
        theme="dark"
        sectionLabel="Mem0"
        loading={sideoverOpen && carregando}
        loadingLabel="A carregar…"
      >
        {painel}
      </CrmIntegracaoSideoverShell>
    </>
  );
}
