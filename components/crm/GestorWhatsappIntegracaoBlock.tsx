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
  formatarTelefoneGestorExibicao,
  normalizarTelefoneGestorLista,
  parseTelefonesGestorInput,
} from "@/lib/whatsapp/gestor-telefones-format";

const UAZAPI_QR_VALID_MS = 120_000;

type LinhaGestor = {
  uazapi_instance_id?: string | null;
  uazapi_instance_name?: string | null;
  uazapi_connection_status?: string | null;
  uazapi_has_instance_token?: boolean;
  remoto_verificado?: boolean;
  uazapi_proxy_country?: string | null;
  uazapi_proxy_state?: string | null;
  uazapi_proxy_city?: string | null;
  telefones_autorizados?: string[];
  ativo?: boolean;
};

type GestorWhatsappMeta = {
  servidor_whatsapp?: string | null;
  registro_local_orfao?: boolean;
  webhook_localhost?: boolean;
  uazapi_configurado?: boolean;
};

export type GestorWhatsappIntegracaoBlockProps = {
  /** Opcional — só usado pelo picker de proxy quando não é linha gestor. */
  agenteSlug?: string;
  agenteNome?: string;
  /** Título do cartão (ex. na página Canais). */
  titulo?: string;
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
  agenteSlug = "",
  titulo = "WhatsApp",
}: GestorWhatsappIntegracaoBlockProps) {
  const [sideoverOpen, setSideoverOpen] = useState(false);
  const [linha, setLinha] = useState<LinhaGestor | null>(null);
  const [metaGestor, setMetaGestor] = useState<GestorWhatsappMeta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [loading, setLoading] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [telefoneInput, setTelefoneInput] = useState("");
  const [listaTelefones, setListaTelefones] = useState<string[]>([]);
  const [telefonesSalvos, setTelefonesSalvos] = useState<string[]>([]);
  const saveTelefonesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [paircode, setPaircode] = useState<string | null>(null);
  const [pairingPhone, setPairingPhone] = useState("");
  const [pairingMode, setPairingMode] = useState<"qr" | "code">("qr");
  const [pareamentoGeradoEm, setPareamentoGeradoEm] = useState<number | null>(null);
  const [pareamentoRelogio, setPareamentoRelogio] = useState(0);
  const [proxyCity, setProxyCity] = useState("");
  const [proxyState, setProxyState] = useState("");
  const [dialogExcluir, setDialogExcluir] = useState(false);
  const [avisoConexao, setAvisoConexao] = useState<string | null>(null);

  const statusExibido = linha?.uazapi_connection_status ?? "—";
  const temInstancia = linha?.remoto_verificado === true;
  const registroLocalPendente = Boolean(
    (linha?.uazapi_instance_id?.trim() ||
      linha?.uazapi_has_instance_token ||
      linha?.uazapi_instance_name?.trim()) &&
      !temInstancia
  );
  const conectado = (statusExibido || "").toLowerCase() === "connected";
  const badge = badgeCor(statusExibido);
  const acoesOff = loading !== null;

  const pairingPhoneDigits = pairingPhone.replace(/\D/g, "");
  const podeConectarPorCodigo = pairingPhoneDigits.length >= 10 && pairingPhoneDigits.length <= 15;
  const avisoTelefoneBr = avisoTelefoneBrPareamento(pairingPhoneDigits);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch("/api/hub/gestor-whatsapp?sync=1", { headers: await crmApiHeaders() });
      const json = (await res.json()) as {
        linha?: LinhaGestor;
        meta?: GestorWhatsappMeta;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
      setLinha(json.linha ?? null);
      setMetaGestor(json.meta ?? null);
      if (json.meta?.registro_local_orfao) {
        setAvisoConexao(
          "Havia um registo local sem ligação no servidor WhatsApp — foi limpo. Clique «Criar ligação WhatsApp» de novo."
        );
      } else if (!json.linha?.remoto_verificado) {
        setAvisoConexao("Não há ligação activa no servidor. Comece pelo passo 1 — criar ligação exclusiva.");
      } else if (json.linha?.remoto_verificado && json.meta?.servidor_whatsapp) {
        setAvisoConexao(
          `Ligação activa no servidor ${json.meta.servidor_whatsapp}. Confira o mesmo host no painel UAZAPI (não misture fitbot com onnzetecnologia).`
        );
      } else if (json.meta?.webhook_localhost) {
        setAvisoConexao(
          "A ligação cria-se na nuvem UAZAPI; o aviso de localhost só afecta receber mensagens em desenvolvimento. Para testar webhooks em local, defina WHATSAPP_WEBHOOK_PUBLIC_ORIGIN com o domínio público."
        );
      }
      const tels = (json.linha?.telefones_autorizados ?? []).map((t) => normalizarTelefoneGestorLista(String(t)));
      setListaTelefones(tels);
      setTelefonesSalvos(tels);
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

  const telefonesAutorizadosVazios = listaTelefones.length === 0;

  const aplicarStatusLinha = useCallback((status?: string) => {
    if (!status) return;
    setLinha((prev) => ({
      ...(prev ?? {}),
      uazapi_connection_status: status,
    }));
    if (status.toLowerCase() === "connected") {
      setQrcode(null);
      setPaircode(null);
      setPareamentoGeradoEm(null);
      setAvisoConexao("WhatsApp ligado. Guarde os telefones autorizados e envie *menu* para escolher um assistente.");
    }
  }, []);

  const postAction = useCallback(
    async (action: string, extra?: Record<string, unknown>, opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setErro(null);
        setLoading(action);
        if (action === "connect") setAvisoConexao(null);
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
            if (action === "connect" || action === "status") {
              setQrcode(null);
              setPaircode(null);
              setPareamentoGeradoEm(null);
            }
            if (json.uazapi_auth_failed === true) {
              setAvisoConexao(
                "Não foi possível validar a ligação. Elimine a ligação actual e crie uma nova."
              );
            }
          }
          if (typeof json.uazapi_connection_status === "string") {
            aplicarStatusLinha(json.uazapi_connection_status as string);
          }
          return json;
        }

        if (json.qr_invalid === true) {
          setQrcode(null);
          setPaircode(null);
          setPareamentoGeradoEm(null);
          if (!opts?.silent) {
            setErro(
              typeof json.connect_hint === "string" && json.connect_hint.trim()
                ? json.connect_hint.trim()
                : "QR inválido. Desligue a sessão, guarde a região e tente de novo."
            );
          }
        } else if (typeof json.qrcode === "string" && json.qrcode.trim()) {
          const norm = normalizarSrcImagemQrUazapi(json.qrcode);
          if (norm) {
            setQrcode(norm);
            setPaircode(null);
            if (action === "connect") {
              setPareamentoGeradoEm(Date.now());
              setSideoverOpen(true);
            }
          } else if (!opts?.silent && action === "connect") {
            setQrcode(null);
            setPareamentoGeradoEm(null);
            setErro("O servidor enviou um QR inválido. Gere outro código.");
          }
        } else if (!opts?.silent && (action === "connect" || action === "status")) {
          setQrcode(null);
          setPareamentoGeradoEm(null);
        }

        if (typeof json.paircode === "string" && json.paircode.trim()) {
          setPaircode(json.paircode.trim());
          setQrcode(null);
          if (action === "connect") {
            setPareamentoGeradoEm(Date.now());
            setSideoverOpen(true);
          }
        } else if (!opts?.silent && (action === "connect" || action === "status")) {
          setPaircode(null);
        }

        if (typeof json.uazapi_connection_status === "string") {
          aplicarStatusLinha(json.uazapi_connection_status as string);
        }

        const connectHint = typeof json.connect_hint === "string" ? json.connect_hint.trim() : "";
        const webhookWarning = typeof json.webhook_warning === "string" ? json.webhook_warning.trim() : "";
        if (!opts?.silent) {
          if (connectHint) setAvisoConexao(connectHint);
          else if (webhookWarning) setAvisoConexao(webhookWarning);
          else if (
            action === "sync_webhook" &&
            typeof json.webhook_url_display === "string" &&
            json.webhook_url_display.trim()
          ) {
            const wh = json.webhook_url_display.trim();
            setAvisoConexao(
              /localhost|127\.0\.0\.1/i.test(wh)
                ? `Webhook em localhost (${wh}). Em produção, abra o CRM no domínio público e sincronize de novo.`
                : `Webhook sincronizado: ${wh}`
            );
          }
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
            remoto_verificado: json.remoto_verificado === true || json.servidor_confirmado === true,
          }));
          if (typeof json.servidor_whatsapp === "string" && json.servidor_whatsapp.trim()) {
            setMetaGestor((prev) => ({
              ...(prev ?? {}),
              servidor_whatsapp: json.servidor_whatsapp as string,
            }));
          }
          setSideoverOpen(true);
          const srv =
            typeof json.servidor_whatsapp === "string" && json.servidor_whatsapp.trim()
              ? json.servidor_whatsapp.trim()
              : metaGestor?.servidor_whatsapp;
          setAvisoConexao(
            srv
              ? `Ligação criada no servidor ${srv}. Passo 2: escolha a cidade e guarde a região antes de gerar o QR.`
              : "Ligação exclusiva criada no servidor. Passo 2: escolha a cidade e guarde a região antes de gerar o QR."
          );
        }
        if (action === "save_proxy" && json.ok === true) {
          setAvisoConexao("Região guardada. Passo 3: gere o QR no rodapé e ligue o telefone.");
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
          if (!opts?.silent) {
            setErro("Ligação não encontrada no servidor — crie uma nova ligação WhatsApp.");
          }
        }
        if (action === "disconnect") {
          setQrcode(null);
          setPaircode(null);
          setPareamentoGeradoEm(null);
        }
        if (action === "delete_remote") {
          setLinha(null);
          setMetaGestor((prev) => (prev ? { ...prev, registro_local_orfao: false } : prev));
          setQrcode(null);
          setPaircode(null);
          setAvisoConexao(null);
        }
        if (!opts?.silent && action !== "status" && action !== "create") {
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
    [aplicarStatusLinha, carregar, metaGestor?.servidor_whatsapp]
  );

  postActionRef.current = postAction;

  async function guardarTelefones(lista: string[], opts?: { silencioso?: boolean }) {
    if (!opts?.silencioso) setLoading("telefones");
    setErro(null);
    try {
      const res = await fetch("/api/hub/gestor-whatsapp", {
        method: "PATCH",
        headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ telefones_autorizados: lista }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
      setTelefonesSalvos(lista);
      if (!opts?.silencioso) await carregar();
    } catch (e) {
      setErro(erroUiAmigavel(e instanceof Error ? e.message : "Falha ao guardar telefones"));
    } finally {
      if (!opts?.silencioso) setLoading(null);
    }
  }

  const agendarSalvarTelefones = useCallback((lista: string[]) => {
    if (saveTelefonesTimer.current) clearTimeout(saveTelefonesTimer.current);
    saveTelefonesTimer.current = setTimeout(() => {
      void guardarTelefones(lista, { silencioso: true });
    }, 700);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTelefonesTimer.current) clearTimeout(saveTelefonesTimer.current);
    };
  }, []);

  function aplicarListaTelefones(nova: string[]) {
    setListaTelefones(nova);
    const mudou =
      nova.length !== telefonesSalvos.length || nova.some((t, i) => t !== telefonesSalvos[i]);
    if (mudou) agendarSalvarTelefones(nova);
  }

  function adicionarTelefoneLista(raw?: string) {
    const entrada = (raw ?? telefoneInput).trim();
    if (!entrada) return;
    const novos = parseTelefonesGestorInput(entrada);
    if (!novos.length) {
      setErro("Telefone inválido — use DDI + número (ex.: 5511999999999).");
      return;
    }
    setErro(null);
    const merged = [...listaTelefones];
    for (const n of novos) {
      if (!merged.includes(n)) merged.push(n);
    }
    setTelefoneInput("");
    aplicarListaTelefones(merged);
  }

  function removerTelefoneLista(tel: string) {
    aplicarListaTelefones(listaTelefones.filter((t) => t !== tel));
  }

  function formatarInputTelefone(valor: string) {
    const digits = valor.replace(/\D/g, "");
    if (digits.length <= 2) return digits ? `+${digits}` : "";
    if (digits.length <= 4) return `+${digits.slice(0, 2)} (${digits.slice(2)}`;
    if (digits.length <= 6) {
      return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4)}`;
    }
    if (digits.length <= 11) {
      return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    return formatarTelefoneGestorExibicao(digits);
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

  const conectarGestor = useCallback(
    async (opts?: { resetSession?: boolean }) => {
      const extra: Record<string, unknown> = {
        ...proxyConnectExtra(),
        ...(opts?.resetSession ? { reset_session: true } : {}),
        ...(pairingMode === "code" && podeConectarPorCodigo ? { phone: pairingPhoneDigits } : {}),
      };
      const city = proxyCity.trim().toLowerCase();
      if (city && !linha?.uazapi_proxy_city?.trim()) {
        await postAction("save_proxy", {
          proxy_managed_country: "br",
          proxy_managed_city: city,
          ...(proxyState.trim() ? { proxy_managed_state: proxyState.trim().toLowerCase() } : {}),
        });
      }
      await postAction("connect", extra);
    },
    [
      linha?.uazapi_proxy_city,
      pairingMode,
      pairingPhoneDigits,
      podeConectarPorCodigo,
      postAction,
      proxyCity,
      proxyConnectExtra,
      proxyState,
    ]
  );

  const reconectarWhatsApp = useCallback(() => {
    void conectarGestor({ resetSession: true });
  }, [conectarGestor]);

  const regiaoGuardada = Boolean((linha?.uazapi_proxy_city?.trim() || proxyCity.trim()).length);
  const mostrarQr = qrcode && (qrcode.startsWith("data:image") || /^https?:\/\//i.test(qrcode));
  const pareamentoSegundosRestantes = pareamentoGeradoEm
    ? Math.max(
        0,
        Math.floor(
          ((paircode && !qrcode ? UAZAPI_PAIRCODE_VALID_MS : UAZAPI_QR_VALID_MS) -
            (Date.now() - pareamentoGeradoEm)) /
            1000
        )
      )
    : null;
  const qrExpirado =
    mostrarQr && pareamentoGeradoEm != null && (pareamentoSegundosRestantes ?? 0) <= 0;
  const mostrarQrAtivo = Boolean(mostrarQr && !qrExpirado);
  const paircodeAtivo = Boolean(
    paircode?.trim() && pareamentoGeradoEm != null && (pareamentoSegundosRestantes ?? 0) > 0 && !qrcode
  );
  const precisaReconectar =
    temInstancia &&
    !conectado &&
    (qrExpirado ||
      (String(statusExibido).toLowerCase() === "connecting" && !mostrarQrAtivo && !paircodeAtivo));
  const conectarBloqueado =
    acoesOff || loading === "connect" || !temInstancia || !regiaoGuardada ||
    (pairingMode === "code" && !podeConectarPorCodigo);

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
    if (st === "connected") return;
    if (st !== "connecting" && !aguardando) return;
    const id = window.setInterval(() => {
      void postActionRef.current("status", undefined, { silent: true });
    }, aguardando ? 3000 : 6000);
    return () => window.clearInterval(id);
  }, [temInstancia, sideoverOpen, statusExibido, paircode, qrcode]);

  const rotuloEstado = useMemo(() => {
    if (temInstancia) return String(statusExibido).toUpperCase();
    return "SEM LIGAÇÃO";
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

  const botoesFooter = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {!temInstancia ? (
        <>
          <p style={{ margin: 0, color: CRM_ACCENT, fontSize: 10, fontWeight: 800, letterSpacing: 0.08 }}>
            PASSO 1 — CRIAR LIGAÇÃO
          </p>
          <p style={{ margin: 0, color: RF_TEXT_MUTED, fontSize: 11, lineHeight: 1.45 }}>
            Crie a ligação WhatsApp com o botão abaixo. Depois escolha a cidade e use «Guardar região». O QR para ligar
            o telefone fica no passo 2.
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
                onClick={() => void conectarGestor({ resetSession: precisaReconectar })}
              >
                {loading === "connect" ? <Loader2 size={15} className="animate-spin" /> : <QrCode size={15} />}
                {precisaReconectar ? "Reconectar" : pairingMode === "code" ? "Gerar código" : "Gerar QR"}
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
            <p style={{ margin: "8px 0 0", color: RF_TEXT_MUTED, fontSize: 10, lineHeight: 1.45, gridColumn: "1 / -1" }}>
              <strong style={{ color: RF_TEXT_PRIMARY }}>Trocar número:</strong> use «Desligar sessão» e depois «Gerar QR/código».
              <strong style={{ color: RF_TEXT_PRIMARY }}> Eliminar ligação</strong> remove o cadastro no provedor WhatsApp.
            </p>
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
          {precisaReconectar && !conectado ? (
            <button
              type="button"
              disabled={conectarBloqueado}
              style={{ ...btnBase(conectarBloqueado, "primary"), width: "100%", minHeight: 44 }}
              onClick={() => reconectarWhatsApp()}
            >
              {loading === "connect" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              Reconectar WhatsApp
            </button>
          ) : null}
          <button
            type="button"
            disabled={acoesOff}
            style={{ ...btnBase(acoesOff, "danger"), width: "100%", minHeight: 42 }}
            onClick={() => setDialogExcluir(true)}
          >
            {loading === "delete_remote" ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            Eliminar ligação WhatsApp
          </button>
        </>
      )}
    </div>
  );

  const passoAtual: 1 | 2 | 3 | 4 = !temInstancia
    ? 1
    : !regiaoGuardada
      ? 2
      : conectado
        ? 4
        : 3;

  function renderPassoIndicador() {
    const passos = [
      { n: 1, label: "Criar ligação" },
      { n: 2, label: "Região" },
      { n: 3, label: "Ligar telefone" },
      { n: 4, label: "Autorizados" },
    ] as const;
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 6,
          marginBottom: 4,
        }}
      >
        {passos.map((p) => {
          const ativo = passoAtual === p.n;
          const feito = passoAtual > p.n;
          return (
            <div
              key={p.n}
              style={{
                padding: "8px 6px",
                borderRadius: 8,
                border: `1px solid ${ativo ? "#3f984866" : feito ? "#3f984844" : RF_BORDER_STRONG}`,
                background: ativo ? "#3f984818" : feito ? "#3f98480c" : "rgba(6, 13, 8, 0.5)",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 10,
                  fontWeight: 800,
                  color: ativo ? "#86efac" : feito ? "#5d7a67" : RF_TEXT_MUTED,
                }}
              >
                {p.n}. {p.label}
              </p>
            </div>
          );
        })}
      </div>
    );
  }

  const painelSubtitle = temInstancia
    ? "Passo 2: ligue o WhatsApp com QR ou código."
    : "Passo 1: criar ligação WhatsApp. Depois escolha a cidade; QR no passo 2.";

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
                <p style={{ margin: 0, color: "#0b2210", fontSize: 14, fontWeight: 800 }}>{titulo}</p>
                <p style={{ margin: "4px 0 0", color: "#5d7a67", fontSize: 12, lineHeight: 1.45 }}>
                  {temInstancia
                    ? conectado
                      ? "Telefone ligado · "
                      : "Ligue o telefone (passo 2) · "
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
        title="WhatsApp"
        subtitle={painelSubtitle}
        footer={botoesFooter}
        sectionLabel="WhatsApp"
        loading={carregando}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {renderPassoIndicador()}

          {passoAtual === 1 ? (
            <div style={{ padding: "14px 16px", ...cardSurface }}>
              <p style={{ margin: 0, color: RF_TEXT_SECONDARY, fontSize: 12, lineHeight: 1.55 }}>
                Crie uma <strong style={{ color: RF_TEXT_PRIMARY }}>ligação exclusiva</strong> no servidor WhatsApp,
                separada dos agentes comerciais (Dany, SDR, etc.). Use o botão «Criar ligação WhatsApp» no rodapé.
              </p>
              {metaGestor?.servidor_whatsapp ? (
                <p style={{ margin: "10px 0 0", color: RF_TEXT_MUTED, fontSize: 11, lineHeight: 1.45 }}>
                  Servidor activo neste processo:{" "}
                  <strong style={{ color: RF_TEXT_SECONDARY }}>{metaGestor.servidor_whatsapp}</strong>
                  {" — "}a instância aparece no painel UAZAPI desse host. Se o `.env` diz outro servidor, pare e
                  reinicie <code style={{ fontSize: 10 }}>npm run dev</code>.
                </p>
              ) : null}
              {registroLocalPendente ? (
                <p style={{ margin: "10px 0 0", color: "#e6c06a", fontSize: 11, lineHeight: 1.45 }}>
                  Registo local incompleto ou servidor diferente do painel que está a consultar. Elimine a ligação e
                  crie de novo após confirmar o <code style={{ fontSize: 10 }}>UAZAPI_BASE_URL</code> no servidor.
                </p>
              ) : null}
            </div>
          ) : null}

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

          {avisoConexao ? (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #c9a24a55",
                background: "#c9a24a12",
                color: "#e6c06a",
                fontSize: 12,
                lineHeight: 1.45,
              }}
              role="status"
            >
              {avisoConexao}
            </div>
          ) : null}

          {passoAtual >= 3 ? (
            <div style={{ padding: "14px 16px", ...cardSurface }}>
              <p style={{ margin: "0 0 8px", color: CRM_ACCENT, fontSize: 11, fontWeight: 800, letterSpacing: 0.06 }}>
                TELEFONES AUTORIZADOS
              </p>
              <p style={{ margin: "0 0 10px", color: RF_TEXT_MUTED, fontSize: 11, lineHeight: 1.45 }}>
                Celular <strong>de quem envia</strong> os comandos (seu WhatsApp pessoal). Não é o número da linha
                conectada — use «Mensagens para você» no WhatsApp ou outro aparelho autorizado.
              </p>
              {telefonesAutorizadosVazios ? (
                <p style={{ margin: "0 0 10px", color: "#e6c06a", fontSize: 11, lineHeight: 1.45 }}>
                  Adicione o seu celular antes de testar — sem número autorizado o assistente responde com aviso de
                  acesso negado.
                </p>
              ) : null}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  type="tel"
                  value={telefoneInput}
                  onChange={(e) => setTelefoneInput(formatarInputTelefone(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      adicionarTelefoneLista();
                    }
                  }}
                  placeholder="+55 (11) 99999-9999"
                  style={{ ...fieldStyle, flex: "1 1 200px", fontFamily: "inherit" }}
                />
                <button
                  type="button"
                  disabled={loading !== null}
                  onClick={() => adicionarTelefoneLista()}
                  style={btnBase(loading !== null, "primary")}
                >
                  Adicionar
                </button>
              </div>
              {listaTelefones.length > 0 ? (
                <ul
                  style={{
                    margin: "12px 0 0",
                    padding: 0,
                    listStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {listaTelefones.map((tel) => (
                    <li
                      key={tel}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: `1px solid ${RF_BORDER_STRONG}`,
                        background: "#0d111788",
                        fontSize: 13,
                        color: RF_TEXT_PRIMARY,
                      }}
                    >
                      <span>{formatarTelefoneGestorExibicao(tel)}</span>
                      <button
                        type="button"
                        disabled={loading !== null}
                        onClick={() => removerTelefoneLista(tel)}
                        style={{
                          ...btnBase(loading !== null, "default"),
                          padding: "4px 8px",
                          color: RF_TEXT_MUTED,
                        }}
                        aria-label="Remover telefone"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <button
                type="button"
                disabled={loading !== null || listaTelefones.length === 0}
                onClick={() => void guardarTelefones(listaTelefones)}
                style={{ ...btnBase(loading !== null, "primary"), marginTop: 12 }}
              >
                {loading === "telefones" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {telefonesSalvos.length === listaTelefones.length &&
                listaTelefones.every((t, i) => t === telefonesSalvos[i])
                  ? "Guardado"
                  : "Guardar telefones"}
              </button>
            </div>
          ) : null}

          {temInstancia ? (
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
                Telefone ligado. Para trocar de número, desligue a sessão e gere um novo QR.
              </p>
            ) : passoAtual === 2 ? (
              <p style={{ margin: 0, color: RF_TEXT_SECONDARY, fontSize: 12, lineHeight: 1.5 }}>
                Ligação criada no servidor. Escolha a região abaixo antes de gerar o QR.
              </p>
            ) : null}
          </div>
          ) : null}

          {passoAtual >= 2 ? (
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
          ) : null}

          {passoAtual >= 3 && !conectado ? (
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

          {passoAtual >= 3 && !conectado && mostrarQrAtivo ? (
            <div style={{ padding: 16, textAlign: "center", ...cardSurface }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                  gap: 8,
                }}
              >
                <p style={{ margin: 0, color: RF_TEXT_MUTED, fontSize: 11, fontWeight: 700 }}>QR WHATSAPP</p>
                {pareamentoSegundosRestantes != null && pareamentoSegundosRestantes > 0 ? (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: pareamentoSegundosRestantes <= 30 ? "#f85149" : "#58a6ff",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    Expira em {formatarContagemQr(pareamentoSegundosRestantes)}
                  </span>
                ) : null}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="QR WhatsApp"
                src={qrcode!}
                style={{
                  maxWidth: "100%",
                  width: 260,
                  height: "auto",
                  borderRadius: 10,
                  border: `1px solid ${RF_BORDER_STRONG}`,
                  margin: "0 auto",
                  display: "block",
                }}
              />
              <p style={{ margin: "12px 0 0", color: RF_TEXT_MUTED, fontSize: 11, lineHeight: 1.5 }}>
                WhatsApp → Aparelhos ligados → Ligar com QR. Quando o tempo acabar, use{" "}
                <strong style={{ color: RF_TEXT_PRIMARY }}>Reconectar</strong>.
              </p>
            </div>
          ) : null}

          {passoAtual >= 3 && !conectado && paircodeAtivo ? (
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                border: "1px solid #58a6ff66",
                background: "rgba(31, 111, 235, 0.14)",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                  gap: 8,
                }}
              >
                <p style={{ margin: 0, color: "#79c0ff", fontSize: 11, fontWeight: 700 }}>CÓDIGO DE PAREAMENTO</p>
                {pareamentoSegundosRestantes != null && pareamentoSegundosRestantes > 0 ? (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: pareamentoSegundosRestantes <= 60 ? "#f85149" : "#58a6ff",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    Expira em {formatarContagemQr(pareamentoSegundosRestantes)}
                  </span>
                ) : null}
              </div>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: RF_TEXT_PRIMARY, letterSpacing: 4 }}>
                {paircode}
              </p>
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
        Apaga a ligação no provedor WhatsApp. Terá de criar uma nova para voltar a usar.
      </CrmConfirmDialog>
    </>
  );
}
