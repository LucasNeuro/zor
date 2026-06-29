"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronRight,
  Loader2,
  QrCode,
  RefreshCw,
  Save,
  Smartphone,
  Trash2,
  Unplug,
} from "lucide-react";
import { CrmConfirmDialog } from "@/components/crm/CrmConfirmDialog";
import { CrmIntegracaoSideoverShell } from "@/components/crm/AgenteUazapiBlock";
import { IntegracaoMarcaIcon } from "@/components/crm/IntegracaoMarcaIcon";
import { UazapiProxyCityPicker } from "@/components/crm/UazapiProxyCityPicker";
import { CRM_ACCENT, crmBtnPrimaryLg } from "@/lib/crm/crm-button-styles";
import { BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";
import {
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";
import { crmApiHeaders, hubApiHeaders } from "@/lib/internal-api-headers-client";
import { normalizarSrcImagemQrUazapi } from "@/lib/whatsapp/qr-uazapi";
import {
  avisoTelefoneBrPareamento,
  UAZAPI_PAIRCODE_VALID_MS,
} from "@/lib/whatsapp/uazapi-proxy-connect";
import {
  formatProxyCityDisplay,
  formatProxyCityLabel,
} from "@/lib/whatsapp/uazapi-proxy-city-label";

const UAZAPI_QR_VALID_MS = 120_000;

type LinhaGestor = {
  uazapi_instance_id?: string | null;
  uazapi_instance_name?: string | null;
  uazapi_connection_status?: string | null;
  uazapi_has_instance_token?: boolean;
  uazapi_proxy_country?: string | null;
  uazapi_proxy_state?: string | null;
  uazapi_proxy_city?: string | null;
  telefones_autorizados?: string[];
  ativo?: boolean;
};

export type GestorWhatsappIntegracaoBlockProps = {
  agenteSlug: string;
  agenteNome?: string;
};

function badgeCor(status?: string | null): { bg: string; fg: string; bar: string } {
  const s = (status || "").toLowerCase();
  if (s === "connected") return { bg: "#23863633", fg: "#3fb950", bar: "#3fb950" };
  if (s === "connecting") return { bg: "#bb800926", fg: "#e6c06a", bar: "#e6c06a" };
  return { bg: "#dcebd8", fg: "#5d7a67", bar: "#484f58" };
}

function formatarContagemQr(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function erroUiAmigavel(msg: string): string {
  if (/lock broken|steal option|acquiretimeout/i.test(msg)) {
    return "Sessão em sincronização — feche e abra de novo ou actualize a página.";
  }
  return msg;
}

export function GestorWhatsappIntegracaoBlock({
  agenteSlug,
  agenteNome,
}: GestorWhatsappIntegracaoBlockProps) {
  const [sideoverOpen, setSideoverOpen] = useState(false);
  const [linha, setLinha] = useState<LinhaGestor | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [loading, setLoading] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [telefones, setTelefones] = useState("");
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [paircode, setPaircode] = useState<string | null>(null);
  const [pairingPhone, setPairingPhone] = useState("");
  const [pairingMode, setPairingMode] = useState<"qr" | "code">("qr");
  const [pareamentoGeradoEm, setPareamentoGeradoEm] = useState<number | null>(null);
  const [pareamentoRelogio, setPareamentoRelogio] = useState(0);
  const [proxyCity, setProxyCity] = useState("");
  const [proxyState, setProxyState] = useState("");
  const [dialogExcluir, setDialogExcluir] = useState(false);
  const [uazapiServer, setUazapiServer] = useState<string | null>(null);

  const statusExibido = linha?.uazapi_connection_status ?? "—";
  const temInstancia = Boolean(linha?.uazapi_instance_id?.trim());
  const conectado = (statusExibido || "").toLowerCase() === "connected";
  const badge = badgeCor(statusExibido);
  const acoesOff = loading !== null;

  const regiaoLabel = useMemo(() => {
    const city = (linha?.uazapi_proxy_city?.trim() || proxyCity.trim()).toLowerCase();
    if (!city) return null;
    const st = (linha?.uazapi_proxy_state?.trim() || proxyState.trim()).toUpperCase();
    return formatProxyCityDisplay(formatProxyCityLabel(city), st);
  }, [linha?.uazapi_proxy_city, linha?.uazapi_proxy_state, proxyCity, proxyState]);

  const pairingPhoneDigits = pairingPhone.replace(/\D/g, "");
  const podeConectarPorCodigo = pairingPhoneDigits.length >= 10 && pairingPhoneDigits.length <= 15;
  const avisoTelefoneBr = avisoTelefoneBrPareamento(pairingPhoneDigits);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch("/api/hub/gestor-whatsapp", { headers: await crmApiHeaders() });
      const json = (await res.json()) as { linha?: LinhaGestor; uazapi_server?: string | null; error?: string };
      if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
      setLinha(json.linha ?? null);
      setUazapiServer(typeof json.uazapi_server === "string" ? json.uazapi_server : null);
      const tels = json.linha?.telefones_autorizados ?? [];
      setTelefones(tels.join("\n"));
      setProxyCity(json.linha?.uazapi_proxy_city?.trim() || "");
      setProxyState(json.linha?.uazapi_proxy_state?.trim() || "");
    } catch (e) {
      setErro(erroUiAmigavel(e instanceof Error ? e.message : "Falha ao carregar"));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const postActionRef = useRef<
    (action: string, extra?: Record<string, unknown>, opts?: { silent?: boolean }) => Promise<Record<string, unknown> | null>
  >(() => Promise.resolve(null));

  const postAction = useCallback(
    async (action: string, extra?: Record<string, unknown>, opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setErro(null);
        setLoading(action);
      }
      try {
        const res = await fetch("/api/hub/gestor-whatsapp", {
          method: "POST",
          headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...extra }),
        });
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          if (!opts?.silent) {
            setErro(erroUiAmigavel(typeof json.error === "string" ? json.error : `Erro ${res.status}`));
            if (action === "connect") {
              setQrcode(null);
              setPaircode(null);
            }
          }
          return json;
        }
        if (typeof json.qrcode === "string") {
          setQrcode(normalizarSrcImagemQrUazapi(json.qrcode));
          setPaircode(null);
          setPareamentoGeradoEm(Date.now());
        }
        if (typeof json.paircode === "string") {
          setPaircode(json.paircode);
          setQrcode(null);
          setPareamentoGeradoEm(Date.now());
        }
        if (typeof json.uazapi_connection_status === "string") {
          setLinha((prev) => ({
            ...(prev ?? {}),
            uazapi_connection_status: json.uazapi_connection_status as string,
          }));
        }
        if (action === "create" && typeof json.uazapi_instance_id === "string") {
          setLinha((prev) => ({
            ...(prev ?? {}),
            uazapi_instance_id: json.uazapi_instance_id as string,
            uazapi_instance_name:
              typeof json.uazapi_instance_name === "string"
                ? (json.uazapi_instance_name as string)
                : prev?.uazapi_instance_name,
            uazapi_connection_status:
              typeof json.uazapi_connection_status === "string"
                ? (json.uazapi_connection_status as string)
                : prev?.uazapi_connection_status,
            uazapi_has_instance_token: true,
          }));
        }
        if (action === "verify_remote" && json.encontrada === false) {
          setLinha(null);
          setQrcode(null);
          setPaircode(null);
          if (typeof json.error === "string") {
            setErro(erroUiAmigavel(json.error));
          }
        }
        if (action === "status" && json.orphan_cleared === true) {
          setLinha(null);
          setQrcode(null);
          setPaircode(null);
          setErro("Instância não existe no UAZAPI — clique «Recriar no UAZAPI» para registar de novo.");
        }
        if (action === "delete_remote") {
          setLinha(null);
          setQrcode(null);
          setPaircode(null);
        }
        if (!opts?.silent && action !== "status") {
          await carregar();
        }
        return json;
      } catch (e) {
        if (!opts?.silent) {
          setErro(erroUiAmigavel(e instanceof Error ? e.message : "Falha na acção"));
        }
        return null;
      } finally {
        if (!opts?.silent) setLoading(null);
      }
    },
    [carregar]
  );

  postActionRef.current = postAction;

  async function guardarTelefones() {
    setLoading("telefones");
    setErro(null);
    try {
      const lista = telefones
        .split(/[\n,;]+/)
        .map((t) => t.replace(/\D/g, ""))
        .filter((t) => t.length >= 10);
      const res = await fetch("/api/hub/gestor-whatsapp", {
        method: "PATCH",
        headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ telefones_autorizados: lista }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
      await carregar();
    } catch (e) {
      setErro(erroUiAmigavel(e instanceof Error ? e.message : "Falha ao guardar telefones"));
    } finally {
      setLoading(null);
    }
  }

  const proxyConnectExtra = useCallback((): Record<string, unknown> => {
    const extra: Record<string, unknown> = { proxy_managed_country: "br" };
    const city = proxyCity.trim().toLowerCase();
    const state = proxyState.trim().toLowerCase();
    if (city) {
      extra.proxy_managed_city = city;
      if (state) extra.proxy_managed_state = state;
    }
    return extra;
  }, [proxyCity, proxyState]);

  const regiaoGuardada = Boolean((linha?.uazapi_proxy_city?.trim() || proxyCity.trim()).length);
  const conectarBloqueado = acoesOff || !temInstancia || !regiaoGuardada;
  const mostrarQr = qrcode && (qrcode.startsWith("data:image") || /^https?:\/\//i.test(qrcode));

  useEffect(() => {
    if (!pareamentoGeradoEm || (!qrcode && !paircode?.trim())) return;
    const id = window.setInterval(() => setPareamentoRelogio((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [pareamentoGeradoEm, qrcode, paircode]);

  useEffect(() => {
    if (!pareamentoGeradoEm) return;
    const temQr = Boolean(qrcode);
    const temCode = Boolean(paircode?.trim());
    if (!temQr && !temCode) return;
    const validMs = temCode && !temQr ? UAZAPI_PAIRCODE_VALID_MS : UAZAPI_QR_VALID_MS;
    const restante = validMs - (Date.now() - pareamentoGeradoEm);
    if (restante <= 0) {
      if (temQr) setQrcode(null);
      if (temCode) setPaircode(null);
      setPareamentoGeradoEm(null);
    }
  }, [pareamentoGeradoEm, qrcode, paircode, pareamentoRelogio]);

  useEffect(() => {
    if (!temInstancia || !sideoverOpen) return;
    const st = (statusExibido || "").toLowerCase();
    const aguardando = Boolean(paircode?.trim() || qrcode);
    if (st !== "connecting" && !aguardando) return;
    const id = window.setInterval(() => {
      void postActionRef.current("status", undefined, { silent: true });
    }, aguardando ? 3000 : 6000);
    return () => window.clearInterval(id);
  }, [temInstancia, sideoverOpen, statusExibido, paircode, qrcode]);

  const rotuloEstado = useMemo(() => {
    if (temInstancia) return String(statusExibido).toUpperCase();
    return "SEM INSTÂNCIA";
  }, [temInstancia, statusExibido]);

  const fieldStyle: CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 9,
    border: `1px solid ${RF_BORDER_STRONG}`,
    background: "rgba(6, 13, 8, 0.85)",
    color: RF_TEXT_PRIMARY,
    fontSize: 13,
    boxSizing: "border-box",
  };

  const cardSurface: CSSProperties = {
    borderRadius: 12,
    background: "rgba(11, 31, 16, 0.92)",
    border: `1px solid ${RF_BORDER_STRONG}`,
  };

  const btnBase = (disabled: boolean, variant: "default" | "primary" | "danger" = "default"): CSSProperties => {
    const base: CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: "9px 14px",
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer",
      minHeight: 38,
      whiteSpace: "nowrap",
    };
    if (variant === "primary") {
      return {
        ...base,
        border: "none",
        background: disabled ? "#4a6356" : BRAND_TEXT_DARK,
        color: disabled ? "#c8dcc8" : BRAND_GREEN_BRIGHT,
      };
    }
    if (variant === "danger") {
      return {
        ...base,
        border: "1px solid #f8514966",
        background: disabled ? "rgba(6, 13, 8, 0.5)" : "#f8514910",
        color: disabled ? RF_TEXT_MUTED : "#f85149",
      };
    }
    return {
      ...base,
      border: `1px solid ${RF_BORDER_STRONG}`,
      background: disabled ? "rgba(6, 13, 8, 0.5)" : "rgba(6, 13, 8, 0.72)",
      color: disabled ? RF_TEXT_MUTED : RF_TEXT_PRIMARY,
    };
  };

  const btnGroupShell: CSSProperties = {
    display: "grid",
    borderRadius: 10,
    border: `1px solid ${RF_BORDER_STRONG}`,
    overflow: "hidden",
    background: "rgba(6, 13, 8, 0.72)",
  };

  const btnInGroup = (
    disabled: boolean,
    variant: "default" | "primary" | "danger",
    withRightDivider: boolean
  ): CSSProperties => ({
    ...btnBase(disabled, variant),
    width: "100%",
    minHeight: 42,
    borderRadius: 0,
    border: "none",
    borderRight: withRightDivider ? `1px solid ${RF_BORDER_STRONG}` : undefined,
    boxShadow: "none",
  });

  const segundosRestantesPareamento = pareamentoGeradoEm
    ? Math.max(
        0,
        Math.floor(
          ((paircode && !qrcode ? UAZAPI_PAIRCODE_VALID_MS : UAZAPI_QR_VALID_MS) -
            (Date.now() - pareamentoGeradoEm)) /
            1000
        )
      )
    : 0;

  const botoesFooter = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {!temInstancia ? (
        <>
          <p style={{ margin: 0, color: CRM_ACCENT, fontSize: 10, fontWeight: 800, letterSpacing: 0.08 }}>
            PASSO 1 — CADASTRAR INSTÂNCIA
          </p>
          <p style={{ margin: 0, color: RF_TEXT_MUTED, fontSize: 11, lineHeight: 1.45 }}>
            Uma ligação partilhada por todos os agentes internos. Crie a instância, escolha a região e ligue o telefone.
          </p>
          <button
            type="button"
            disabled={acoesOff}
            style={{ ...btnBase(acoesOff, "primary"), width: "100%", minHeight: 44 }}
            onClick={() => void postAction("create")}
          >
            {loading === "create" ? <Loader2 size={15} className="animate-spin" /> : <Smartphone size={15} />}
            Criar ligação WhatsApp
          </button>
        </>
      ) : (
        <>
          <p style={{ margin: 0, color: CRM_ACCENT, fontSize: 10, fontWeight: 800, letterSpacing: 0.08 }}>
            PASSO 2 — LIGAR WHATSAPP
          </p>
          <div
            style={{
              ...btnGroupShell,
              gridTemplateColumns: conectado ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))",
            }}
          >
            {!conectado ? (
              <button
                type="button"
                disabled={conectarBloqueado}
                style={btnInGroup(conectarBloqueado, "primary", true)}
                onClick={() =>
                  void postAction("connect", {
                    ...proxyConnectExtra(),
                    ...(pairingMode === "code" && podeConectarPorCodigo ? { phone: pairingPhoneDigits } : {}),
                  })
                }
              >
                {loading === "connect" ? <Loader2 size={15} className="animate-spin" /> : <QrCode size={15} />}
                {pairingMode === "code" ? "Gerar código" : "Gerar QR"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={loading !== null}
              style={btnInGroup(loading !== null, "default", !conectado)}
              onClick={() => void postAction("status")}
            >
              {loading === "status" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              Actualizar estado
            </button>
            <button
              type="button"
              disabled={acoesOff}
              style={btnInGroup(acoesOff, "default", false)}
              onClick={() => void postAction("disconnect")}
            >
              {loading === "disconnect" ? <Loader2 size={15} className="animate-spin" /> : <Unplug size={15} />}
              Desligar sessão
            </button>
          </div>
          {!conectado ? (
            <div style={{ ...btnGroupShell, gridTemplateColumns: "minmax(0, 1fr)" }}>
              <button
                type="button"
                disabled={acoesOff}
                style={btnInGroup(acoesOff, "default", false)}
                onClick={() => void postAction("sync_webhook")}
              >
                {loading === "sync_webhook" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                Sincronizar recepção
              </button>
            </div>
          ) : null}
          {temInstancia ? (
            <button
              type="button"
              disabled={acoesOff}
              style={{ ...btnBase(acoesOff, "default"), width: "100%" }}
              onClick={() => void postAction("verify_remote")}
            >
              {loading === "verify_remote" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              Verificar no servidor UAZAPI
            </button>
          ) : null}
          {temInstancia && !conectado ? (
            <button
              type="button"
              disabled={acoesOff}
              style={{ ...btnBase(acoesOff, "primary"), width: "100%" }}
              onClick={() => void postAction("create")}
            >
              {loading === "create" ? <Loader2 size={15} className="animate-spin" /> : <Smartphone size={15} />}
              Recriar no UAZAPI
            </button>
          ) : null}
          <button
            type="button"
            disabled={acoesOff}
            style={{ ...btnBase(acoesOff, "danger"), width: "100%" }}
            onClick={() => setDialogExcluir(true)}
          >
            {loading === "delete_remote" ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            Eliminar ligação WhatsApp
          </button>
        </>
      )}
    </div>
  );

  const painelSubtitle = temInstancia
    ? "Mesmo fluxo dos agentes externos (região + QR). O número ligado é único na empresa — todos os internos usam esta linha."
    : "Passo 1: criar ligação. Depois escolha a região; QR no passo 2. Um número para todos os agentes internos.";

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
            background: "linear-gradient(90deg, #25d366, #128c7e, #1f6feb)",
            opacity: 0.95,
          }}
          aria-hidden
        />
        <div style={{ padding: "14px 16px 16px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, minWidth: 0, alignItems: "center" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "linear-gradient(145deg, #25d36633, #128c7e18)",
                  border: "1px solid #25d36644",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <IntegracaoMarcaIcon variant="whatsapp" size={22} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, color: "#0b2210", fontSize: 14, fontWeight: 800 }}>WhatsApp</p>
                <p style={{ margin: "4px 0 0", color: "#5d7a67", fontSize: 12, lineHeight: 1.45 }}>
                  {temInstancia
                    ? conectado
                      ? "Telefone ligado · "
                      : "Instância criada — ligue o telefone (passo 2) · "
                    : "Passo 1: cadastro · "}
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
                    {rotuloEstado}
                  </span>
                </p>
                <p style={{ margin: "6px 0 0", color: "#6e7681", fontSize: 11 }}>
                  Linha única da empresa · no WhatsApp escreva <strong>menu</strong> para escolher o assistente
                </p>
                {linha?.uazapi_instance_name ? (
                  <p style={{ margin: "6px 0 0", color: "#6e7681", fontSize: 11 }}>
                    Instância UAZAPI: <strong style={{ color: "#2d4a38" }}>{linha.uazapi_instance_name}</strong>
                  </p>
                ) : null}
                {uazapiServer ? (
                  <p style={{ margin: "6px 0 0", color: "#6e7681", fontSize: 11 }}>
                    Servidor UAZAPI: <strong style={{ color: "#2d4a38" }}>{uazapiServer}</strong>
                    {uazapiServer.includes("onnzetecnologia") ? (
                      <span style={{ color: "#c9a24a" }}> — confira o painel deste host (não outro subdomínio)</span>
                    ) : null}
                  </p>
                ) : null}
                {regiaoLabel ? (
                  <p style={{ margin: "6px 0 0", color: "#6e7681", fontSize: 11 }}>
                    Região: <strong style={{ color: "#2d4a38" }}>{regiaoLabel}</strong>
                  </p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              disabled={carregando}
              onClick={() => setSideoverOpen(true)}
              style={{
                ...crmBtnPrimaryLg(carregando),
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
        theme="dark"
        open={sideoverOpen}
        onClose={() => setSideoverOpen(false)}
        title={agenteNome?.trim() ? `WhatsApp ${agenteNome.trim()}` : "WhatsApp"}
        subtitle={painelSubtitle}
        footer={botoesFooter}
        sectionLabel="WhatsApp"
        loading={carregando}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {erro ? (
            <div
              style={{
                display: "flex",
                gap: 10,
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #f8514966",
                background: "#f8514910",
                color: "#f85149",
                fontSize: 12,
              }}
              role="alert"
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{erro}</span>
            </div>
          ) : null}

          <div style={{ padding: "14px 16px", ...cardSurface }}>
            <p style={{ margin: "0 0 8px", color: CRM_ACCENT, fontSize: 11, fontWeight: 800, letterSpacing: 0.06 }}>
              TELEFONES AUTORIZADOS
            </p>
            <p style={{ margin: "0 0 10px", color: RF_TEXT_MUTED, fontSize: 11, lineHeight: 1.45 }}>
              Só estes números podem usar a linha (DDI + número, um por linha). Gmail e agenda continuam por agente;
              apenas o WhatsApp é partilhado entre todos os internos.
            </p>
            <textarea
              value={telefones}
              onChange={(e) => setTelefones(e.target.value)}
              placeholder="5511999999999"
              rows={3}
              style={{ ...fieldStyle, fontFamily: "inherit", resize: "vertical" }}
            />
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void guardarTelefones()}
              style={{ ...btnBase(loading !== null, "primary"), marginTop: 10 }}
            >
              {loading === "telefones" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Guardar telefones
            </button>
          </div>

          <div style={{ padding: "14px 16px", ...cardSurface }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <span
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 800,
                  background: badge.bg,
                  color: badge.fg,
                }}
              >
                {rotuloEstado}
              </span>
            </div>
            {conectado ? (
              <p style={{ margin: 0, color: RF_TEXT_SECONDARY, fontSize: 12, lineHeight: 1.5 }}>
                A instância está activa. Para trocar de número, desligue a sessão e gere um novo QR.
              </p>
            ) : null}
          </div>

          <div style={{ padding: "14px 16px", ...cardSurface }}>
            <p style={{ margin: "0 0 12px", color: CRM_ACCENT, fontSize: 11, fontWeight: 800, letterSpacing: 0.06 }}>
              REGIÃO DO NÚMERO
            </p>
            <UazapiProxyCityPicker
              agenteSlug={agenteSlug}
              gestorWhatsapp
              cityValue={proxyCity}
              stateValue={proxyState}
              disabled={acoesOff}
              saving={loading === "save_proxy"}
              dark
              temInstancia={temInstancia}
              onSelect={(c) => {
                setProxyCity(c.value);
                if (c.state) setProxyState(c.state);
              }}
              onSave={() =>
                void postAction("save_proxy", {
                  proxy_managed_country: "br",
                  proxy_managed_city: proxyCity.trim().toLowerCase(),
                  ...(proxyState.trim() ? { proxy_managed_state: proxyState.trim().toLowerCase() } : {}),
                })
              }
            />
          </div>

          {temInstancia && !conectado ? (
            <div style={{ padding: "14px 16px", ...cardSurface }}>
              <p style={{ margin: "0 0 10px", color: "#c9a24a", fontSize: 11, fontWeight: 800 }}>
                MODO DE CONEXÃO
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <button
                  type="button"
                  disabled={acoesOff}
                  style={btnInGroup(acoesOff, pairingMode === "qr" ? "primary" : "default", true)}
                  onClick={() => setPairingMode("qr")}
                >
                  <QrCode size={15} />
                  QR
                </button>
                <button
                  type="button"
                  disabled={acoesOff}
                  style={btnInGroup(acoesOff, pairingMode === "code" ? "primary" : "default", false)}
                  onClick={() => setPairingMode("code")}
                >
                  <Smartphone size={15} />
                  Código
                </button>
              </div>
              {pairingMode === "code" ? (
                <div style={{ marginTop: 12 }}>
                  <label style={{ display: "block", color: RF_TEXT_MUTED, fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
                    Número do WhatsApp (com DDI)
                  </label>
                  <input
                    value={pairingPhone}
                    onChange={(e) => setPairingPhone(e.target.value)}
                    placeholder="5511999999999"
                    inputMode="numeric"
                    style={fieldStyle}
                  />
                  {pairingPhone.trim() && !podeConectarPorCodigo ? (
                    <p style={{ margin: "6px 0 0", color: "#f85149", fontSize: 11 }}>
                      Informe de 10 a 15 dígitos (ex.: 5511999999999).
                    </p>
                  ) : null}
                  {avisoTelefoneBr ? (
                    <p style={{ margin: "6px 0 0", color: "#e6c06a", fontSize: 11, lineHeight: 1.45 }}>
                      {avisoTelefoneBr}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {temInstancia && !conectado && mostrarQr ? (
            <div style={{ padding: 16, textAlign: "center", ...cardSurface }}>
              <img
                src={qrcode}
                alt="QR Code WhatsApp"
                style={{ maxWidth: 260, borderRadius: 8, border: `1px solid ${RF_BORDER}` }}
              />
              {segundosRestantesPareamento > 0 ? (
                <p style={{ margin: "10px 0 0", color: RF_TEXT_MUTED, fontSize: 11 }}>
                  Expira em {formatarContagemQr(segundosRestantesPareamento)}
                </p>
              ) : null}
            </div>
          ) : null}

          {temInstancia && !conectado && paircode ? (
            <div style={{ padding: "14px 16px", ...cardSurface, textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: RF_TEXT_PRIMARY }}>
                Código de pareamento: <code>{paircode}</code>
              </p>
              {segundosRestantesPareamento > 0 ? (
                <p style={{ margin: "8px 0 0", color: RF_TEXT_MUTED, fontSize: 11 }}>
                  Expira em {formatarContagemQr(segundosRestantesPareamento)}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </CrmIntegracaoSideoverShell>

      <CrmConfirmDialog
        open={dialogExcluir}
        title="Eliminar ligação WhatsApp"
        danger
        confirmLabel="Eliminar"
        loading={loading === "delete_remote"}
        onCancel={() => setDialogExcluir(false)}
        onConfirm={() => {
          setDialogExcluir(false);
          void postAction("delete_remote");
        }}
      >
        Apaga a instância no provedor WhatsApp. Terá de criar uma nova ligação para voltar a usar.
      </CrmConfirmDialog>
    </>
  );
}
