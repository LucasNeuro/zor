"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Bell,
  ChevronRight,
  Loader2,
  MessageCircle,
  Play,
  Workflow,
} from "lucide-react";
import { FollowupFlowVisualFullscreen } from "@/components/crm/followup-flow-visual/FollowupFlowVisualFullscreen";
import { CrmIntegracaoSideoverShell } from "@/components/crm/AgenteUazapiBlock";
import { CrmToggleSwitch } from "@/components/crm/CrmToggleSwitch";
import { useCrmConfirm } from "@/lib/crm/crm-feedback";
import { hubApiHeaders } from "@/lib/internal-api-headers-client";
import { CRM_ACCENT, crmBtnPrimary, crmBtnPrimaryLg, crmBtnSecondary } from "@/lib/crm/crm-button-styles";
import { BRAND_TEXT_DARK } from "@/lib/brand";
import {
  RF_ACCENT,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
  rfInputStyle,
  rfLabelStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";
import type { HubAgenteFollowupConfig, HubAgenteFollowupPasso } from "@/lib/hub/followup-types";
import type { FollowupTipoConteudo } from "@/lib/hub/followup-types";
import {
  configGatilhoPadrao,
  esperaMinutosDoPasso,
  formatarResumoCadencia,
} from "@/lib/hub/followup-types";

type FollowupCanalWhatsapp = {
  modo_whatsapp: boolean;
  instance_id: string | null;
  instance_name: string | null;
  connection_status: string | null;
  has_instance_token: boolean;
  pronto_para_envio: boolean;
};

type Props = {
  agenteSlug: string;
  agenteNome?: string;
  layout?: "card" | "embedded";
};

function normalizarPasso(p: HubAgenteFollowupPasso): HubAgenteFollowupPasso {
  return {
    ...p,
    atraso_dias: Number.isFinite(p.atraso_dias) ? p.atraso_dias : 0,
    atraso_minutos: Number.isFinite(p.atraso_minutos) ? p.atraso_minutos : 0,
  };
}

function normalizarConfig(c: HubAgenteFollowupConfig): HubAgenteFollowupConfig {
  const padrao = configGatilhoPadrao();
  return {
    ...c,
    gatilho_tipo: c.gatilho_tipo ?? padrao.gatilho_tipo,
    gatilho_dias: c.gatilho_dias ?? padrao.gatilho_dias,
    gatilho_horas: c.gatilho_horas ?? padrao.gatilho_horas,
    gatilho_minutos: c.gatilho_minutos ?? padrao.gatilho_minutos,
    gatilho_hora_dia: c.gatilho_hora_dia ?? padrao.gatilho_hora_dia,
    arquivar_apos_dias: c.arquivar_apos_dias ?? padrao.arquivar_apos_dias,
  };
}

const cardSurfaceDark: CSSProperties = {
  borderRadius: 12,
  border: `1px solid ${RF_BORDER_STRONG}`,
  background: "rgba(6, 13, 8, 0.45)",
};

export function AgenteFollowupBlock({ agenteSlug, agenteNome, layout = "card" }: Props) {
  const { confirmDialog, closeConfirmDialog } = useCrmConfirm();
  const isCard = layout === "card";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<HubAgenteFollowupConfig | null>(null);
  const [passos, setPassos] = useState<HubAgenteFollowupPasso[]>([]);
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [sideoverOpen, setSideoverOpen] = useState(false);
  const [editorFullscreenOpen, setEditorFullscreenOpen] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [canalWhatsapp, setCanalWhatsapp] = useState<FollowupCanalWhatsapp | null>(null);
  const passosRef = useRef<HubAgenteFollowupPasso[]>([]);

  const base = `/api/hub/agentes/${encodeURIComponent(agenteSlug)}/followup`;

  const passosOrdenados = useMemo(
    () => [...passos].sort((a, b) => a.ordem - b.ordem),
    [passos]
  );

  useEffect(() => {
    passosRef.current = passosOrdenados;
  }, [passosOrdenados]);

  const btnPrimaryDark = (disabled: boolean): CSSProperties => ({
    ...crmBtnPrimaryLg(disabled),
    width: "100%",
    justifyContent: "center",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  });

  const btnSecondaryDark = (disabled: boolean): CSSProperties => ({
    ...crmBtnSecondary(disabled),
    width: "100%",
    justifyContent: "center",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(6, 13, 8, 0.55)",
    border: `1px solid ${RF_BORDER_STRONG}`,
    color: RF_TEXT_PRIMARY,
  });

  const carregar = useCallback(async () => {
    if (!agenteSlug.trim()) return;
    setLoading(true);
    setErro("");
    try {
      const res = await fetch(base, { headers: await hubApiHeaders() });
      const data = (await res.json()) as {
        error?: string;
        config?: HubAgenteFollowupConfig;
        passos?: HubAgenteFollowupPasso[];
        canal_whatsapp?: FollowupCanalWhatsapp;
      };
      if (!res.ok) throw new Error(data.error || "Falha ao carregar");
      setConfig((prev) => (data.config ? normalizarConfig(data.config) : prev));
      setCanalWhatsapp(data.canal_whatsapp ?? null);
      const normalizados = Array.isArray(data.passos)
        ? data.passos.map((p) => normalizarPasso(p as HubAgenteFollowupPasso))
        : [];
      setPassos(normalizados);
      passosRef.current = [...normalizados].sort((a, b) => a.ordem - b.ordem);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar follow-up");
    } finally {
      setLoading(false);
    }
  }, [base, agenteSlug]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (sideoverOpen || editorFullscreenOpen) void carregar();
  }, [sideoverOpen, editorFullscreenOpen, carregar]);

  async function salvarConfig(
    patch: Partial<{
      ativo: boolean;
      arquivar_apos_dias: number;
      gatilho_tipo: HubAgenteFollowupConfig["gatilho_tipo"];
      gatilho_dias: number;
      gatilho_horas: number;
      gatilho_minutos: number;
      gatilho_hora_dia: string | null;
    }>
  ) {
    setSaving(true);
    setErro("");
    setOkMsg("");
    try {
      const res = await fetch(base, {
        method: "PATCH",
        headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as {
        error?: string;
        config?: HubAgenteFollowupConfig;
        passos?: HubAgenteFollowupPasso[];
        leads_reativados?: number;
      };
      if (!res.ok) throw new Error(data.error || "Falha ao guardar");
      if (data.config) setConfig(normalizarConfig(data.config));
      if (data.passos) setPassos(data.passos.map(normalizarPasso));
      const reativados = data.leads_reativados ?? 0;
      setOkMsg(
        reativados > 0
          ? `Follow-up activo — ${reativados} lead(s) reactivado(s).`
          : "Configuração guardada."
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  }

  async function salvarPassoInner(passo: HubAgenteFollowupPasso): Promise<HubAgenteFollowupPasso> {
    const res = await fetch(`${base}/passos/${encodeURIComponent(passo.id)}`, {
      method: "PATCH",
      headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({
          ordem: passo.ordem,
          espera_minutos: passo.espera_minutos ?? undefined,
          atraso_dias: passo.atraso_dias ?? 0,
          atraso_horas: passo.atraso_horas,
          atraso_minutos: passo.atraso_minutos ?? 0,
          tipo_conteudo: passo.tipo_conteudo,
          texto_template: passo.texto_template,
          imagem_url: passo.imagem_url,
          legenda_imagem: passo.legenda_imagem,
          disparo_hora_dia: passo.disparo_hora_dia ?? null,
          ativo: passo.ativo,
        }),
    });
    const data = (await res.json()) as { error?: string; passo?: HubAgenteFollowupPasso };
    if (!res.ok || !data.passo) throw new Error(data.error || "Falha ao guardar passo");
    setPassos((prev) => prev.map((p) => (p.id === data.passo!.id ? normalizarPasso(data.passo!) : p)));
    return normalizarPasso(data.passo);
  }

  async function salvarPasso(passo: HubAgenteFollowupPasso) {
    setSaving(true);
    setErro("");
    try {
      await salvarPassoInner(passo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao guardar passo");
      throw e;
    } finally {
      setSaving(false);
    }
  }

  async function salvarTodosPassos(_lista: HubAgenteFollowupPasso[]): Promise<HubAgenteFollowupPasso[]> {
    setSaving(true);
    setErro("");
    try {
      const ordenados = [...passosRef.current].sort((a, b) => a.ordem - b.ordem);
      for (const passo of ordenados) {
        await salvarPassoInner(passo);
      }
      await carregar();
      setOkMsg("Cadência guardada.");
      return passosRef.current;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao guardar cadência");
      throw e;
    } finally {
      setSaving(false);
    }
  }

  async function salvarTudo(): Promise<{ passos: HubAgenteFollowupPasso[]; config: HubAgenteFollowupConfig }> {
    if (!config) throw new Error("Config não carregada.");
    setSaving(true);
    setErro("");
    try {
      const ordenados = [...passosRef.current].sort((a, b) => a.ordem - b.ordem);
      for (const passo of ordenados) {
        await salvarPassoInner(passo);
      }
      const cfg = await salvarConfigInner({
        arquivar_apos_dias: config.arquivar_apos_dias,
      });
      await carregar();
      setOkMsg("Fluxo guardado.");
      return { passos: passosRef.current, config: cfg };
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao guardar fluxo");
      throw e;
    } finally {
      setSaving(false);
    }
  }

  async function salvarConfigInner(
    patch: Partial<{
      ativo: boolean;
      arquivar_apos_dias: number;
      gatilho_tipo: HubAgenteFollowupConfig["gatilho_tipo"];
      gatilho_dias: number;
      gatilho_horas: number;
      gatilho_minutos: number;
      gatilho_hora_dia: string | null;
    }>
  ): Promise<HubAgenteFollowupConfig> {
    const res = await fetch(base, {
      method: "PATCH",
      headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = (await res.json()) as {
      error?: string;
      config?: HubAgenteFollowupConfig;
      passos?: HubAgenteFollowupPasso[];
    };
    if (!res.ok || !data.config) throw new Error(data.error || "Falha ao guardar config");
    const cfg = normalizarConfig(data.config);
    setConfig(cfg);
    if (data.passos) setPassos(data.passos.map(normalizarPasso));
    return cfg;
  }

  async function salvarConfigGatilho(
    patch: Partial<{
      arquivar_apos_dias: number;
      gatilho_tipo: HubAgenteFollowupConfig["gatilho_tipo"];
      gatilho_dias: number;
      gatilho_horas: number;
      gatilho_minutos: number;
      gatilho_hora_dia: string | null;
    }>
  ) {
    setSaving(true);
    setErro("");
    try {
      await salvarConfigInner(patch);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao guardar gatilho");
      throw e;
    } finally {
      setSaving(false);
    }
  }

  async function persistirOrdem(reordered: HubAgenteFollowupPasso[]) {
    setPassos(reordered);
    setSaving(true);
    setErro("");
    try {
      const res = await fetch(`${base}/passos/reorder`, {
        method: "POST",
        headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ ordem_ids: reordered.map((p) => p.id) }),
      });
      const data = (await res.json()) as { error?: string; passos?: HubAgenteFollowupPasso[] };
      if (!res.ok) throw new Error(data.error || "Falha ao reordenar");
      if (data.passos) setPassos(data.passos);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao reordenar");
      void carregar();
    } finally {
      setSaving(false);
    }
  }

  async function adicionarPasso(tipo: FollowupTipoConteudo = "texto") {
    const proximaOrdem = passosOrdenados.length + 1;
    const ultimo = passosOrdenados[passosOrdenados.length - 1];
    const esperaUltimo = ultimo
      ? esperaMinutosDoPasso(ultimo, config ?? configGatilhoPadrao(), passosOrdenados.length - 1)
      : 0;
    const esperaNovo =
      proximaOrdem === 1 ? 5 : Math.min(525_600, Math.max(60, esperaUltimo * 2 || 720));
    setSaving(true);
    try {
      const res = await fetch(`${base}/passos`, {
        method: "POST",
        headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({
          ordem: proximaOrdem,
          espera_minutos: esperaNovo,
          tipo_conteudo: tipo,
          texto_template: tipo === "texto" ? "Olá {nome}, ainda posso ajudar?" : null,
          legenda_imagem: tipo === "texto_imagem" ? "Olá {nome}, ainda posso ajudar?" : null,
        }),
      });
      const data = (await res.json()) as { error?: string; passo?: HubAgenteFollowupPasso };
      if (!res.ok) throw new Error(data.error || "Falha ao criar passo");
      if (data.passo) setPassos((prev) => [...prev, data.passo!].sort((a, b) => a.ordem - b.ordem));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao criar passo");
    } finally {
      setSaving(false);
    }
  }

  async function excluirPasso(id: string, skipConfirm = false) {
    if (!skipConfirm) {
      const ok = await confirmDialog({
        title: "Excluir lembrete?",
        message: "Este passo será removido da cadência.",
        variant: "destructive",
        confirmLabel: "Excluir",
        theme: "dark",
      });
      if (!ok) return;
      closeConfirmDialog();
    }
    setSaving(true);
    try {
      const res = await fetch(`${base}/passos/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: await hubApiHeaders(),
      });
      const data = (await res.json()) as { error?: string; passos?: HubAgenteFollowupPasso[] };
      if (!res.ok) throw new Error(data.error || "Falha ao excluir");
      if (data.passos?.length) {
        setPassos(data.passos);
      } else {
        const restantes = passosOrdenados.filter((p) => p.id !== id);
        setPassos(restantes);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setSaving(false);
    }
  }

  async function excluirCadenciaCompleta() {
    const ok = await confirmDialog({
      title: "Excluir cadência?",
      message:
        "Toda a cadência de follow-up será removida e o follow-up desactivado.",
      variant: "destructive",
      confirmLabel: "Excluir cadência",
      theme: "dark",
    });
    if (!ok) return;
    closeConfirmDialog();
    setSaving(true);
    setErro("");
    try {
      for (const passo of [...passosOrdenados]) {
        const res = await fetch(`${base}/passos/${encodeURIComponent(passo.id)}`, {
          method: "DELETE",
          headers: await hubApiHeaders(),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error || "Falha ao excluir passo");
        }
      }
      setPassos([]);
      if (config?.ativo) await salvarConfig({ ativo: false });
      setOkMsg("Cadência removida.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao excluir cadência");
      void carregar();
    } finally {
      setSaving(false);
    }
  }

  async function uploadImagem(passoId: string, file: File) {
    setUploadingId(passoId);
    setErro("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${base}/upload`, {
        method: "POST",
        headers: await hubApiHeaders(),
        body: fd,
      });
      const data = (await res.json()) as { error?: string; url?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Upload falhou");
      const passo = passos.find((p) => p.id === passoId);
      if (passo) {
        const atualizado = {
          ...passo,
          imagem_url: data.url,
          tipo_conteudo:
            passo.tipo_conteudo === "texto" ? ("texto_imagem" as const) : passo.tipo_conteudo,
        };
        await salvarPasso(atualizado);
        setOkMsg("Imagem enviada para o bucket agent-followup.");
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploadingId(null);
    }
  }

  async function testarAgora() {
    setTesting(true);
    setErro("");
    setOkMsg("");
    try {
      const res = await fetch(`${base}/test`, {
        method: "POST",
        headers: await hubApiHeaders(),
      });
      const data = (await res.json()) as {
        error?: string;
        resultado?: {
          enviados: number;
          arquivados: number;
          leads_elegiveis: number;
          erros: string[];
          acoes: string[];
          resumo_skip?: Record<string, number>;
          diagnosticos?: Array<{ lead_nome: string; motivo: string; detalhe?: string }>;
        };
      };
      if (!res.ok) throw new Error(data.error || "Falha ao testar");
      const r = data.resultado;
      if (r?.erros?.length) setErro(r.erros.slice(0, 3).join(" · "));

      const skipLabels: Record<string, string> = {
        aguardando_gatilho: "aguardando gatilho",
        aguardando_atraso_passo: "aguardando atraso do passo",
        aguardando_espera: "aguardando tempo configurado",
        aguardando_hora_disparo: "aguardando horário",
        cadencia_concluida: "cadência concluída",
        sem_ultimo_followup: "sem follow-up anterior",
        sem_ultima_msg_cliente: "sem msg do cliente no relógio",
        sem_passo: "sem passo na fila",
        sem_telefone: "sem telefone",
      };

      const skipResumo =
        r?.resumo_skip && Object.keys(r.resumo_skip).length > 0
          ? Object.entries(r.resumo_skip)
              .map(([k, n]) => `${n} ${skipLabels[k] ?? k}`)
              .join(", ")
          : "";

      const amostraDiag =
        r?.diagnosticos && r.diagnosticos.length > 0 && r.enviados === 0
          ? r.diagnosticos
              .slice(0, 2)
              .map((d) => `${d.lead_nome}: ${d.detalhe || skipLabels[d.motivo] || d.motivo}`)
              .join(" · ")
          : "";

      setOkMsg(
        r
          ? `Teste: ${r.leads_elegiveis ?? 0} lead(s), ${r.enviados} enviado(s), ${r.arquivados} arquivado(s).${
              skipResumo ? ` Motivos: ${skipResumo}.` : ""
            }${amostraDiag ? ` Ex.: ${amostraDiag}.` : ""}`
          : "Teste concluído."
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao testar");
    } finally {
      setTesting(false);
    }
  }

  function atualizarConfigLocal(patch: Partial<HubAgenteFollowupConfig>) {
    setConfig((c) => (c ? normalizarConfig({ ...c, ...patch }) : c));
  }

  function atualizarPassoLocal(id: string, patch: Partial<HubAgenteFollowupPasso>) {
    setPassos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  const ativo = config?.ativo === true;
  const passosAtivos = passos.filter((p) => p.ativo).length;
  const nomeAgente = agenteNome?.trim() || agenteSlug;

  const badge = ativo
    ? { rotulo: "ACTIVO", bg: "rgba(63,185,80,0.14)", fg: "#3fb950" }
    : { rotulo: "INACTIVO", bg: "#eef0f2", fg: "#64748b" };

  const cadenciaResumo = config ? formatarResumoCadencia(passos, config) : "—";

  const whatsappRotuloInstancia =
    canalWhatsapp?.instance_name?.trim() ||
    canalWhatsapp?.instance_id?.trim() ||
    "Sem instância";
  const whatsappStatus = (canalWhatsapp?.connection_status || "").toLowerCase();
  const whatsappConectado = whatsappStatus === "connected";
  const whatsappPronto = canalWhatsapp?.pronto_para_envio === true;

  const painelConteudo = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...cardSurfaceDark, padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: whatsappPronto ? "rgba(63, 185, 80, 0.16)" : "rgba(248, 81, 73, 0.12)",
              border: `1px solid ${whatsappPronto ? "rgba(63, 185, 80, 0.35)" : "rgba(248, 81, 73, 0.35)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <MessageCircle size={18} color={whatsappPronto ? "#86efac" : "#f85149"} aria-hidden />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: RF_TEXT_PRIMARY }}>Canal WhatsApp (UAZAPI)</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: whatsappPronto ? "#3fb950" : whatsappConectado ? "#d29922" : "#f85149",
                  textTransform: "uppercase",
                }}
              >
                {whatsappPronto ? "Pronto" : whatsappConectado ? "Parcial" : whatsappStatus || "Não ligado"}
              </span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 11, lineHeight: 1.45, color: RF_TEXT_SECONDARY }}>
              Instância:{" "}
              <span style={{ fontFamily: "monospace", color: RF_TEXT_PRIMARY }}>{whatsappRotuloInstancia}</span>
              {canalWhatsapp?.instance_id && canalWhatsapp.instance_name ? (
                <>
                  {" "}
                  · ID{" "}
                  <span style={{ fontFamily: "monospace", fontSize: 10, color: RF_TEXT_MUTED }}>
                    {canalWhatsapp.instance_id}
                  </span>
                </>
              ) : null}
            </p>
            {!whatsappPronto ? (
              <p style={{ margin: "6px 0 0", fontSize: 10, color: RF_TEXT_MUTED, lineHeight: 1.45 }}>
                {canalWhatsapp?.modo_whatsapp === false
                  ? "Defina o modo de operação WhatsApp no agente."
                  : !canalWhatsapp?.has_instance_token
                    ? "Vincule a instância UAZAPI em Integrações para o follow-up poder enviar."
                    : "Instância sem conexão ativa — reconecte o número na UAZAPI."}
              </p>
            ) : (
              <p style={{ margin: "6px 0 0", fontSize: 10, color: RF_TEXT_MUTED, lineHeight: 1.45 }}>
                Os lembretes saem por esta instância (webhook global + token do agente).
              </p>
            )}
          </div>
        </div>
      </div>

      <div style={{ ...cardSurfaceDark, padding: "14px 16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", gap: 12, flex: 1, minWidth: 0 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: ativo ? "rgba(63, 185, 80, 0.16)" : "rgba(146, 255, 0, 0.1)",
                border: `1px solid ${ativo ? "rgba(63, 185, 80, 0.35)" : "rgba(146, 255, 0, 0.22)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Bell size={20} color={ativo ? "#86efac" : RF_ACCENT} aria-hidden />
            </div>
            <div style={{ minWidth: 0 }}>
              <span id="followup-ativo-label" style={{ fontSize: 13, fontWeight: 700, color: RF_TEXT_PRIMARY }}>
                Follow-up automático WhatsApp
              </span>
              <p style={{ margin: "4px 0 0", fontSize: 11, lineHeight: 1.45, color: RF_TEXT_SECONDARY }}>
                {cadenciaResumo}
                {config ? ` · Arquivar: ${config.arquivar_apos_dias ?? 7}d` : ""}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: ativo ? "#3fb950" : RF_TEXT_MUTED }}>
              {ativo ? "ACTIVO" : "INACTIVO"}
            </span>
            <CrmToggleSwitch
              checked={ativo}
              disabled={loading || saving || !config}
              variant="dark"
              labelledBy="followup-ativo-label"
              onCheckedChange={(v) => void salvarConfig({ ativo: v })}
            />
          </div>
        </div>
      </div>

      <div style={{ ...cardSurfaceDark, padding: "14px 16px" }}>
        <label htmlFor="followup-arquivar-dias">
          <span style={rfLabelStyle()}>Arquivar lead após (dias sem resposta)</span>
          <input
            id="followup-arquivar-dias"
            type="number"
            min={1}
            max={365}
            value={config?.arquivar_apos_dias ?? 7}
            disabled={loading || saving || !config}
            onChange={(e) => {
              const dias = Math.min(365, Math.max(1, Number.parseInt(e.target.value, 10) || 7));
              atualizarConfigLocal({ arquivar_apos_dias: dias });
            }}
            onBlur={(e) => {
              const dias = Math.min(365, Math.max(1, Number.parseInt(e.target.value, 10) || 7));
              void salvarConfigGatilho({ arquivar_apos_dias: dias });
            }}
            style={{ ...rfInputStyle(), width: "100%", marginTop: 4 }}
          />
        </label>
        <p style={{ margin: "8px 0 0", fontSize: 10, color: RF_TEXT_MUTED, lineHeight: 1.45 }}>
          Depois de todos os passos, o lead é arquivado se continuar sem responder neste prazo (padrão: 7 dias).
        </p>
      </div>

      <div style={{ ...cardSurfaceDark, padding: "14px 16px" }}>
        <p style={{ margin: "0 0 8px", fontSize: 11, color: RF_TEXT_SECONDARY, lineHeight: 1.5 }}>
          Configure o <strong style={{ color: RF_TEXT_PRIMARY }}>gatilho de disparo</strong> e os passos da cadência
          no editor visual. Use <code style={{ color: RF_ACCENT }}>{"{nome}"}</code> nas mensagens.
        </p>
        <button
          type="button"
          disabled={loading || !config}
          onClick={() => setEditorFullscreenOpen(true)}
          style={{
            ...crmBtnPrimary(false),
            width: "100%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "10px 14px",
          }}
        >
          <Workflow size={16} />
          Configurar follow-up
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>

      {okMsg ? <p style={{ margin: 0, fontSize: 12, color: RF_ACCENT }}>{okMsg}</p> : null}
      {erro ? <p style={{ margin: 0, fontSize: 12, color: "#f85149" }}>{erro}</p> : null}
    </div>
  );

  const sideoverFooter = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button
        type="button"
        disabled={testing || saving || !ativo}
        style={btnPrimaryDark(testing || !ativo)}
        onClick={() => void testarAgora()}
      >
        {testing ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
        Testar envio agora
      </button>
      {isCard ? (
        <button type="button" style={btnSecondaryDark(false)} onClick={() => setSideoverOpen(false)}>
          Fechar
        </button>
      ) : null}
    </div>
  );

  if (!agenteSlug.trim()) return null;

  if (!isCard) {
    return (
      <>
        <CrmIntegracaoSideoverShell
          embedded
          open
          onClose={() => {}}
          title={nomeAgente}
          subtitle="Cadência de lembretes WhatsApp"
          footer={sideoverFooter}
          theme="dark"
          sectionLabel="Follow-up"
          loading={loading}
        >
          {painelConteudo}
        </CrmIntegracaoSideoverShell>
        {config && editorFullscreenOpen ? (
        <FollowupFlowVisualFullscreen
          open
          onClose={() => setEditorFullscreenOpen(false)}
          agenteSlug={agenteSlug}
          agenteNome={nomeAgente}
          config={config}
          passos={passosOrdenados}
          saving={saving}
          uploadingId={uploadingId}
          disabled={loading}
          onAdicionarPasso={adicionarPasso}
          onSalvarPasso={salvarPasso}
          onSalvarConfig={salvarConfigGatilho}
          onSalvarTudo={salvarTudo}
          onExcluirPasso={excluirPasso}
          onReorder={persistirOrdem}
          onUploadImagem={uploadImagem}
          onAtualizarLocal={atualizarPassoLocal}
          onAtualizarConfigLocal={atualizarConfigLocal}
        />
        ) : null}
      </>
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
            background: `linear-gradient(90deg, ${CRM_ACCENT}, #128c7e, #c9a24a)`,
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
                  background: "rgba(146,255,0,0.14)",
                  border: "1px solid rgba(146,255,0,0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Bell size={20} color={CRM_ACCENT} aria-hidden />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, color: BRAND_TEXT_DARK, fontSize: 14, fontWeight: 800 }}>
                  Follow-up automático WhatsApp
                </p>
                <p style={{ margin: "4px 0 0", color: "#5d7a67", fontSize: 12, lineHeight: 1.45 }}>
                  Lembretes após silêncio do cliente ·{" "}
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
                    {loading ? "…" : badge.rotulo}
                  </span>
                  {!loading && passos.length > 0 ? (
                    <span style={{ marginLeft: 6, fontSize: 11, color: "#5d7a67" }}>
                      · {passosAtivos}/{passos.length} passo(s)
                    </span>
                  ) : null}
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
              Configurar follow-up
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <CrmIntegracaoSideoverShell
        open={sideoverOpen}
        onClose={() => setSideoverOpen(false)}
        title={nomeAgente}
        subtitle="Gerir cadência de lembretes WhatsApp"
        footer={sideoverFooter}
        theme="dark"
        sectionLabel="Follow-up WhatsApp"
        loading={loading}
      >
        {painelConteudo}
      </CrmIntegracaoSideoverShell>

      {config && editorFullscreenOpen ? (
      <FollowupFlowVisualFullscreen
        open
        onClose={() => setEditorFullscreenOpen(false)}
        agenteSlug={agenteSlug}
        agenteNome={nomeAgente}
        config={config}
        passos={passosOrdenados}
        saving={saving}
        uploadingId={uploadingId}
        disabled={loading}
        onAdicionarPasso={adicionarPasso}
        onSalvarPasso={salvarPasso}
        onSalvarConfig={salvarConfigGatilho}
        onSalvarTudo={salvarTudo}
        onExcluirPasso={excluirPasso}
        onReorder={persistirOrdem}
        onUploadImagem={uploadImagem}
        onAtualizarLocal={atualizarPassoLocal}
        onAtualizarConfigLocal={atualizarConfigLocal}
      />
      ) : null}
    </>
  );
}
