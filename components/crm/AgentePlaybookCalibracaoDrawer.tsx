"use client";

import type { CSSProperties } from "react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, GitBranch, RefreshCw, Save, Send, User, X } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import {
  PlaybookUploadAnalisePanel,
  type PlaybookAnaliseResultado,
  type PlaybookUploadStatus,
  PLAYBOOK_ACCEPT_ATTR,
} from "@/components/crm/PlaybookUploadAnalisePanel";
import { PlaybookFlowStatusBanner } from "@/components/crm/PlaybookFlowStatusBanner";
const PlaybookFlowVisualSideover = dynamic(
  () =>
    import("@/components/crm/PlaybookFlowVisualSideover").then((m) => ({
      default: m.PlaybookFlowVisualSideover,
    })),
  { ssr: false, loading: () => null }
);
import { CrmHeaderActionsRow } from "@/components/crm/CrmHeaderActionsRow";
import { crmFeatureFlags } from "@/lib/crm/feature-flags";
import { BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";
import { CRM_ACCENT, crmBtnPrimary } from "@/lib/crm/crm-button-styles";
import { normalizarAnalisePlaybook } from "@/lib/playbook/playbook-analise-ui";
import { MAX_PLAYBOOK_UPLOAD_BYTES } from "@/lib/playbook/custom-playbook";
import {
  agenteUsaFluxoWhatsappPlaybook,
  assessPlaybookFlowInMarkdown,
} from "@/lib/playbook/playbook-flow-ui";
import { PLAYBOOK_FLOW_FENCE_TAG } from "@/lib/playbook/flow-schema";
import { emitFlowVisualTelemetry } from "@/lib/playbook/flow-visual-telemetry";
import {
  useCrmConfirm,
  useCrmToast,
  type CrmConfirmDialogOptions,
} from "@/lib/crm/crm-feedback";

const PLAYBOOK_INPUT_CALIB = "playbook-calibracao-upload";

type ChatMsg = {
  id: string;
  papel: "user" | "assistant";
  conteudo: string;
  criado_em: string;
  modelo?: string;
};

function extractApiError(payload: Record<string, unknown>, fallback: string): string {
  const base = typeof payload.error === "string" && payload.error.trim() ? payload.error.trim() : fallback;
  const errs = Array.isArray(payload.errors)
    ? payload.errors.map((x) => String(x).trim()).filter(Boolean)
    : [];
  if (!errs.length) return base;
  return `${base}\n- ${errs.join("\n- ")}`;
}

export type AgentePlaybookCalibracaoDrawerProps = {
  open: boolean;
  onClose: () => void;
  agenteSlug: string;
  agenteNome: string;
  /** Só `canal_whatsapp` usa editor visual e bloco JSON de fluxo dinâmico. */
  modoOperacao?: string | null;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function AgentePlaybookCalibracaoDrawer({
  open,
  onClose,
  agenteSlug,
  agenteNome,
  modoOperacao = null,
}: AgentePlaybookCalibracaoDrawerProps) {
  const { confirmDialog, closeConfirmDialog, setConfirmLoading } = useCrmConfirm();
  const { success: toastSuccess, info: toastInfo } = useCrmToast();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const [markdown, setMarkdown] = useState("");
  const [markdownPublicado, setMarkdownPublicado] = useState("");
  const [meta, setMeta] = useState<{
    hash: string | null;
    path: string | null;
    url: string | null;
    generatedAt: string | null;
    area: string | null;
    instrucaoModo: string | null;
  }>({ hash: null, path: null, url: null, generatedAt: null, area: null, instrucaoModo: null });

  const [publicando, setPublicando] = useState(false);
  const [regenerando, setRegenerando] = useState(false);
  const [adaptandoMotor, setAdaptandoMotor] = useState(false);
  const [aplicandoPresetWa, setAplicandoPresetWa] = useState(false);
  const [visualSideoverOpen, setVisualSideoverOpen] = useState(false);
  const [markdownOrigem, setMarkdownOrigem] = useState<"visual" | "texto" | null>(null);

  const [uploadStatus, setUploadStatus] = useState<PlaybookUploadStatus>("idle");
  const [uploadHover, setUploadHover] = useState(false);
  const [uploadMensagem, setUploadMensagem] = useState("");
  const [uploadPct, setUploadPct] = useState(0);
  const [arquivoNome, setArquivoNome] = useState("");

  const [analiseLoading, setAnaliseLoading] = useState(false);
  const [analisePct, setAnalisePct] = useState(0);
  const [analiseErro, setAnaliseErro] = useState("");
  const [analiseResultado, setAnaliseResultado] = useState<PlaybookAnaliseResultado | null>(null);

  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatEnviando, setChatEnviando] = useState(false);
  const chatFimRef = useRef<HTMLDivElement>(null);

  const dirty = markdown.trim() !== markdownPublicado.trim();
  const temConteudo = markdown.trim().length > 0;
  const flowStatus = useMemo(() => assessPlaybookFlowInMarkdown(markdown), [markdown]);
  const flowStatusPublicado = useMemo(
    () => assessPlaybookFlowInMarkdown(markdownPublicado),
    [markdownPublicado]
  );
  const whatsappFlowAgent = agenteUsaFluxoWhatsappPlaybook(modoOperacao);
  const visualBuilderEnabled =
    whatsappFlowAgent && crmFeatureFlags.playbookFlowVisualSideover();
  const publishRequiresWhatsappFlow = whatsappFlowAgent;
  const canPublishPlaybook =
    dirty &&
    temConteudo &&
    !publicando &&
    (!publishRequiresWhatsappFlow || flowStatus.kind === "ready");

  const dropzoneBorder =
    uploadHover || uploadStatus === "hover"
      ? "1px dashed #58a6ff"
      : uploadStatus === "erro"
        ? "1px dashed #f85149"
        : uploadStatus === "sucesso"
          ? "1px dashed #3fb950"
          : "1px dashed #3d444d";

  const dropzoneBg =
    uploadHover || uploadStatus === "hover"
      ? "#58a6ff14"
      : uploadStatus === "erro"
        ? "#f8514912"
        : uploadStatus === "sucesso"
          ? "#23863618"
          : "rgba(6, 13, 8, 0.72)";

  const carregarConteudo = useCallback(async () => {
    if (!agenteSlug) return;
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch(
        `/api/hub/agentes/${encodeURIComponent(agenteSlug)}/playbook/conteudo`,
        { headers: internalApiHeaders() }
      );
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setErro(extractApiError(data, `Erro HTTP ${res.status}`));
        return;
      }

      setMeta({
        hash: typeof data.playbook_source_hash === "string" ? data.playbook_source_hash : null,
        path: typeof data.playbook_object_path === "string" ? data.playbook_object_path : null,
        url: typeof data.playbook_public_url === "string" ? data.playbook_public_url : null,
        generatedAt:
          typeof data.playbook_generated_at === "string" ? data.playbook_generated_at : null,
        area: typeof data.area === "string" ? data.area : null,
        instrucaoModo: typeof data.instrucao_modo === "string" ? data.instrucao_modo : null,
      });

      const md = typeof data.markdown === "string" ? data.markdown : "";
      setMarkdown(md);
      setMarkdownPublicado(md);

      if (!data.tem_playbook && typeof data.error === "string") {
        setErro(String(data.error));
      }
    } catch {
      setErro("Falha de rede ao carregar playbook.");
    } finally {
      setCarregando(false);
    }
  }, [agenteSlug]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !agenteSlug) return;
    setChatMsgs([]);
    setChatInput("");
    setAnaliseResultado(null);
    setAnaliseErro("");
    setUploadStatus("idle");
    setUploadMensagem("");
    setVisualSideoverOpen(false);
    setMarkdownOrigem(null);
    void carregarConteudo();
  }, [open, agenteSlug, carregarConteudo]);

  useEffect(() => {
    chatFimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs, chatEnviando, open]);

  async function confirmarEPublicar(
    markdownAlvo: string,
    opts: Omit<CrmConfirmDialogOptions, "theme">
  ) {
    const ok = await confirmDialog({ ...opts, theme: "dark" });
    if (!ok) return;
    setConfirmLoading(true);
    try {
      await publicarMarkdown(markdownAlvo);
    } finally {
      setConfirmLoading(false);
      closeConfirmDialog();
    }
  }

  async function publicarMarkdown(markdownOverride?: string) {
    const markdownToPublish =
      typeof markdownOverride === "string" ? markdownOverride : markdown;
    if (!markdownToPublish.trim() || publicando) return;
    const statusToPublish = assessPlaybookFlowInMarkdown(markdownToPublish);
    if (publishRequiresWhatsappFlow && statusToPublish.kind !== "ready") {
      if (statusToPublish.kind === "invalid") {
        if (markdownOrigem === "visual") {
          void emitFlowVisualTelemetry({
            event: "playbook.flow_visual.publish_validation_invalid",
            agente_slug: agenteSlug,
            metadata: {
              source: "visual",
              errors_count: statusToPublish.errors.length,
            },
          });
        }
        const detalhes = statusToPublish.errors.slice(0, 3);
        setErro(
          `Fluxo com pendências antes da publicação:\n- ${detalhes.join("\n- ")}${
            statusToPublish.errors.length > 3 ? `\n- ...e mais ${statusToPublish.errors.length - 3} erro(s).` : ""
          }`
        );
      } else if (statusToPublish.kind === "no_flow_block") {
        setErro(
          `Antes de publicar, gere/edite o bloco \`json ${PLAYBOOK_FLOW_FENCE_TAG}\` no modo visual ou use «Gerar fluxo da empresa».`
        );
      } else {
        setErro(
          `Antes de publicar, use «Gerar fluxo da empresa» até o banner verde confirmar o fluxo WhatsApp (\`${PLAYBOOK_FLOW_FENCE_TAG}\`).`
        );
      }
      return;
    }
    setPublicando(true);
    setErro("");
    try {
      const res = await fetch(
        `/api/hub/agentes/${encodeURIComponent(agenteSlug)}/playbook/conteudo`,
        {
          method: "PUT",
          headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ markdown: markdownToPublish }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setErro(extractApiError(data, `Erro HTTP ${res.status}`));
        return;
      }
      setMarkdown(markdownToPublish);
      setMarkdownPublicado(markdownToPublish);
      setMarkdownOrigem(null);
      setMeta((m) => ({
        ...m,
        hash: typeof data.playbook_source_hash === "string" ? data.playbook_source_hash : m.hash,
        url: typeof data.playbook_public_url === "string" ? data.playbook_public_url : m.url,
        path: typeof data.playbook_object_path === "string" ? data.playbook_object_path : m.path,
        generatedAt:
          typeof data.playbook_generated_at === "string" ? data.playbook_generated_at : m.generatedAt,
      }));
      const autoFlow = data.auto_appended_flow === true;
      toastSuccess(
        autoFlow
          ? "Publicado com bloco de fluxo WA acrescentado automaticamente."
          : "Playbook publicado no bucket (com fluxo WhatsApp).",
      );
    } catch {
      setErro("Falha de rede ao publicar.");
    } finally {
      setPublicando(false);
    }
  }

  async function regenerarDoAgente() {
    if (regenerando) return;
    setRegenerando(true);
    setErro("");
    try {
      const res = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlug)}/playbook`, {
        method: "POST",
        headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(typeof data.error === "string" ? data.error : `Erro HTTP ${res.status}`);
        return;
      }
      toastSuccess("Playbook regenerado a partir do estado do agente.");
      await carregarConteudo();
    } catch {
      setErro("Falha ao regenerar playbook.");
    } finally {
      setRegenerando(false);
    }
  }

  async function enviarUpload(file: File) {
    const nomeLower = file.name.toLowerCase();
    const extOk = nomeLower.endsWith(".md") || nomeLower.endsWith(".txt");
    if (!extOk) {
      setUploadStatus("erro");
      setUploadMensagem("Formato inválido. Envie .md ou .txt.");
      return;
    }
    if (file.size > MAX_PLAYBOOK_UPLOAD_BYTES) {
      setUploadStatus("erro");
      setUploadMensagem("Arquivo acima do limite de 1 MB.");
      return;
    }

    setArquivoNome(file.name);
    setUploadStatus("enviando");
    setUploadMensagem("A enviar...");
    setUploadPct(20);
    setAnaliseResultado(null);
    setAnaliseErro("");

    try {
      const texto = (await file.text()).trim();
      if (!texto) {
        setUploadStatus("erro");
        setUploadMensagem("Arquivo vazio.");
        setUploadPct(0);
        return;
      }
      setMarkdown(texto);
      setMarkdownOrigem("texto");
      setUploadPct(55);

      const form = new FormData();
      form.append("file", file);
      const res = await fetch(
        `/api/hub/agentes/${encodeURIComponent(agenteSlug)}/playbook/upload`,
        { method: "POST", headers: internalApiHeaders(), body: form }
      );
      const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setUploadStatus("erro");
        setUploadMensagem(extractApiError(payload, `Falha HTTP ${res.status}`));
        setUploadPct(0);
        return;
      }

      setMarkdownPublicado(texto);
      setUploadStatus("sucesso");
      setUploadPct(100);
      setUploadMensagem("Upload concluído e publicado.");
      toastSuccess("Playbook substituído pelo upload.");
      await carregarConteudo();
    } catch {
      setUploadStatus("erro");
      setUploadMensagem("Falha de rede no upload.");
      setUploadPct(0);
    }
  }

  async function analisarComMistral() {
    if (!temConteudo || analiseLoading) return;
    setAnaliseLoading(true);
    setAnaliseErro("");
    setAnaliseResultado(null);
    setAnalisePct(8);

    const tick = window.setInterval(() => {
      setAnalisePct((p) => (p >= 92 ? p : Math.min(92, p + Math.max(1, Math.round((92 - p) * 0.08)))));
    }, 180);

    try {
      const res = await fetch(
        `/api/hub/agentes/${encodeURIComponent(agenteSlug)}/playbook/analisar`,
        {
          method: "POST",
          headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ content: markdown }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setAnaliseErro(typeof data.error === "string" ? data.error : `Erro HTTP ${res.status}`);
        return;
      }
      setAnaliseResultado(normalizarAnalisePlaybook(data));
    } catch {
      setAnaliseErro("Falha de rede na análise.");
    } finally {
      window.clearInterval(tick);
      setAnalisePct(100);
      setAnaliseLoading(false);
    }
  }

  async function aplicarPresetConversacaoWa(forcarPlaybook = false) {
    if (carregando || publicando || aplicandoPresetWa) return;
    const ok = await confirmDialog({
      title: forcarPlaybook ? "Substituir playbook pelo preset WA?" : "Aplicar preset conversação WA?",
      message: forcarPlaybook
        ? "Isto substitui o playbook pelo template Waje v1, actualiza ferramentas, conhecimento e ciclos. Continuar?"
        : "Aplica cargo, ferramentas, conhecimento, ciclos e publica playbook só se ainda não existir. Continuar?",
      confirmLabel: "Aplicar preset",
      variant: forcarPlaybook ? "destructive" : "default",
    });
    if (!ok) return;

    setAplicandoPresetWa(true);
    setErro("");
    try {
      const res = await fetch(
        `/api/hub/agentes/${encodeURIComponent(agenteSlug)}/preset-wa`,
        {
          method: "POST",
          headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            preset: "conversacao_universal",
            forcar_playbook: forcarPlaybook,
            publicar_playbook: forcarPlaybook,
          }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setErro(extractApiError(data, `Erro HTTP ${res.status}`));
        return;
      }
      const passos = Array.isArray(data.passos)
        ? (data.passos as Array<{ passo?: string; detalhe?: string }>)
        : [];
      const detalhePlaybook = passos.find((p) => p.passo === "playbook")?.detalhe;
      toastSuccess(
        detalhePlaybook
          ? `Preset WA aplicado. ${detalhePlaybook}`
          : "Preset conversação WA aplicado com sucesso."
      );
      await carregarConteudo();
    } catch {
      setErro("Falha de rede ao aplicar preset WA.");
    } finally {
      setAplicandoPresetWa(false);
    }
  }

  async function gerarFluxoDaEmpresa(forcarSubstituir = false) {
    if (carregando || publicando || uploadStatus === "enviando" || adaptandoMotor) return;
    if (!temConteudo) {
      setErro("Cole ou carregue o playbook no editor antes de gerar o fluxo.");
      return;
    }
    if (flowStatus.kind === "ready" && !forcarSubstituir) {
      toastInfo("O rascunho já tem fluxo WhatsApp válido. Pode publicar ou regenerar o fluxo da empresa.");
      if (dirty) {
        await confirmarEPublicar(markdown, {
          title: "Publicar rascunho agora?",
          message: "Fluxo WA já está válido. Deseja publicar este rascunho agora?",
          confirmLabel: "Publicar",
        });
      }
      return;
    }

    setAdaptandoMotor(true);
    setErro("");
    try {
      const res = await fetch(
        `/api/hub/agentes/${encodeURIComponent(agenteSlug)}/playbook/fluxo-empresa`,
        {
          method: "POST",
          headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ content: markdown }),
        }
      );
      const data = (await res.json()) as {
        error?: string;
        markdown?: string;
        message?: string;
        resumo_contexto?: { empresa_label?: string; nicho?: string | null; opcoes_triagem?: string[] };
      };
      if (!res.ok) {
        setErro(data.error ?? `Falha ao gerar fluxo (HTTP ${res.status}).`);
        return;
      }
      const outMarkdown = typeof data.markdown === "string" ? data.markdown : "";
      if (!outMarkdown.trim()) {
        setErro("Resposta sem markdown do fluxo.");
        return;
      }

      setMarkdown(outMarkdown);
      setAnaliseResultado(null);
      setAnaliseErro("");

      const empresa = data.resumo_contexto?.empresa_label ?? "empresa";
      const nicho = data.resumo_contexto?.nicho;
      toastSuccess(
        nicho
          ? `Fluxo gerado para ${empresa} (${nicho}). Revise no editor visual e publique.`
          : `Fluxo gerado para ${empresa}. Revise no editor visual e publique.`
      );

      await confirmarEPublicar(outMarkdown, {
        title: "Publicar playbook com fluxo da empresa?",
        message: data.message ?? "Fluxo contextual pronto. Deseja publicar agora?",
        confirmLabel: "Publicar agora",
        variant: "success",
      });
    } catch {
      setErro("Falha de rede ao gerar fluxo da empresa.");
    } finally {
      setAdaptandoMotor(false);
    }
  }

  async function enviarChat() {
    const t = chatInput.trim();
    if (!t || chatEnviando || !temConteudo) return;

    const now = new Date().toISOString();
    const tempId = `user-${Date.now()}`;
    const historico = chatMsgs.map((m) => ({ papel: m.papel, conteudo: m.conteudo }));

    setChatMsgs((prev) => [...prev, { id: tempId, papel: "user", conteudo: t, criado_em: now }]);
    setChatEnviando(true);
    setChatInput("");
    setErro("");

    try {
      const res = await fetch(
        `/api/hub/agentes/${encodeURIComponent(agenteSlug)}/playbook/calibracao-chat`,
        {
          method: "POST",
          headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            mensagem: t,
            historico,
            markdown_rascunho: markdown,
          }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        resposta?: string;
        modelo?: string;
      };
      if (!res.ok) {
        setChatMsgs((prev) => prev.filter((m) => m.id !== tempId));
        setErro(typeof data.error === "string" ? data.error : `Erro HTTP ${res.status}`);
        setChatInput(t);
        return;
      }
      const resposta = typeof data.resposta === "string" ? data.resposta : "";
      setChatMsgs((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          papel: "assistant",
          conteudo: resposta || "(sem resposta)",
          criado_em: new Date().toISOString(),
          modelo: typeof data.modelo === "string" ? data.modelo : undefined,
        },
      ]);
    } catch {
      setChatMsgs((prev) => prev.filter((m) => m.id !== tempId));
      setErro("Falha de rede no chat de calibração.");
      setChatInput(t);
    } finally {
      setChatEnviando(false);
    }
  }

  if (!agenteSlug) return null;

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 210,
          background: "rgba(11, 31, 16, 0.32)",
          backdropFilter: "blur(3px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.25s ease",
        }}
      />
      <aside
        aria-hidden={!open}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          zIndex: 211,
          height: "100vh",
          width: "min(100vw, 1180px)",
          maxWidth: "100%",
          background: "#060d08",
          borderLeft: "1px solid rgba(63, 152, 72, 0.42)",
          boxShadow: open ? "-12px 0 40px rgba(0,0,0,0.45)" : "none",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flexShrink: 0,
            padding: "14px 16px",
            borderBottom: "1px solid rgba(146, 255, 0, 0.16)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            background: "#0b1f10",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2 style={{ color: "#e8f5e9", fontSize: 15, fontWeight: 700, margin: 0 }}>
                Playbook — Calibração
              </h2>
              <p style={{ color: "#7a9a7e", fontSize: 12, fontWeight: 600, margin: "4px 0 0" }}>
                {agenteNome}
              </p>
              {meta.generatedAt ? (
                <p style={{ color: "#6e7681", fontSize: 10, margin: "6px 0 0" }}>
                  Publicado: {new Date(meta.generatedAt).toLocaleString("pt-BR")}
                  {meta.hash ? ` · hash ${meta.hash.slice(0, 10)}…` : ""}
                  {temConteudo ? ` · ${formatBytes(new TextEncoder().encode(markdown).length)}` : ""}
                </p>
              ) : null}
              {erro ? (
                <p style={{ color: "#f85149", fontSize: 11, margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{erro}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              style={{
                flexShrink: 0,
                width: 40,
                height: 40,
                borderRadius: 10,
                border: "1px solid rgba(63, 152, 72, 0.42)",
                background: "rgba(6, 13, 8, 0.6)",
                color: "#92ff00",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={20} />
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap" }}>
            <CrmHeaderActionsRow align="start" overflowBehavior="scroll">
              {visualBuilderEnabled ? (
                <button
                  type="button"
                  onClick={() => {
                    void emitFlowVisualTelemetry({
                      event: "playbook.flow_visual.sideover_opened",
                      agente_slug: agenteSlug,
                      metadata: {
                        source: "visual_button",
                      },
                    });
                    setVisualSideoverOpen(true);
                  }}
                  style={{
                    ...btnToolbar,
                    background: "rgba(146, 255, 0, 0.12)",
                    color: CRM_ACCENT,
                  }}
                  title="Abrir editor visual React Flow em sideover dedicado"
                >
                  Editar fluxo visual
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void carregarConteudo()}
                disabled={carregando}
                style={btnToolbar}
                title="Recarrega o playbook publicado do bucket"
              >
                <RefreshCw size={14} /> Recarregar
              </button>
              {whatsappFlowAgent ? (
                <button
                  type="button"
                  onClick={() => void aplicarPresetConversacaoWa(false)}
                  disabled={carregando || publicando || aplicandoPresetWa}
                  style={{
                    ...btnToolbar,
                    background: "rgba(146, 255, 0, 0.18)",
                    color: CRM_ACCENT,
                  }}
                  title="Playbook + cargo + ferramentas + ciclos (preserva playbook existente)"
                >
                  {aplicandoPresetWa ? "A aplicar…" : "Preset conversação WA"}
                </button>
              ) : null}
              {whatsappFlowAgent ? (
                <button
                  type="button"
                  onClick={() => void gerarFluxoDaEmpresa(flowStatus.kind === "ready")}
                  disabled={
                    carregando ||
                    publicando ||
                    uploadStatus === "enviando" ||
                    adaptandoMotor ||
                    !temConteudo
                  }
                  style={{
                    ...btnToolbar,
                    background: flowStatus.kind === "ready" ? "rgba(6, 13, 8, 0.72)" : "rgba(146, 255, 0, 0.12)",
                    color: flowStatus.kind === "ready" ? "#7a9a7e" : CRM_ACCENT,
                  }}
                  title={`Gera o bloco json ${PLAYBOOK_FLOW_FENCE_TAG} a partir do cargo, conhecimento e base documental da empresa`}
                >
                  <GitBranch size={14} />{" "}
                  {adaptandoMotor ? "A gerar…" : "Gerar fluxo da empresa"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void regenerarDoAgente()}
                disabled={regenerando || carregando}
                style={btnToolbar}
                title="Gera playbook a partir do cargo/conhecimento do agente (pode remover o fluxo WA)"
              >
                <RefreshCw size={14} className={regenerando ? "animate-spin" : undefined} />
                {regenerando ? "A gerar…" : "Regenerar"}
              </button>
              <button
                type="button"
                onClick={() => void publicarMarkdown()}
                disabled={!canPublishPlaybook}
                style={{
                  ...btnToolbarPublish,
                  ...(!canPublishPlaybook
                    ? { background: "#4a6356", color: "#c8dcc8", cursor: "not-allowed" }
                    : {}),
                }}
                title={
                  publishRequiresWhatsappFlow && flowStatus.kind !== "ready"
                    ? "Use «Gerar fluxo da empresa» até o banner verde antes de publicar"
                    : "Grava o rascunho no bucket e substitui playbook.md"
                }
              >
                <Save size={14} /> {publicando ? "A publicar…" : "Publicar alterações"}
              </button>
            </CrmHeaderActionsRow>
            {dirty ? (
              <span
                style={{
                  fontSize: 10,
                  color: "#d29922",
                  fontWeight: 700,
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid #d2992244",
                  background: "#d2992211",
                  flexShrink: 0,
                }}
              >
                Rascunho não publicado
              </span>
            ) : (
              <span style={{ fontSize: 10, color: "#3fb950", fontWeight: 600, flexShrink: 0 }}>Publicado</span>
            )}
          </div>
        </div>

        <div style={{ flexShrink: 0, margin: "10px 16px 0", display: "flex", flexDirection: "column", gap: 8 }}>
          {whatsappFlowAgent ? (
            <PlaybookFlowStatusBanner
              status={flowStatus}
              published={!dirty && flowStatusPublicado.kind === "ready"}
              theme="dark"
            />
          ) : (
            <p
              style={{
                margin: 0,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(63, 152, 72, 0.35)",
                background: "rgba(6, 13, 8, 0.72)",
                color: "#7a9a7e",
                fontSize: 11,
                lineHeight: 1.45,
              }}
            >
              Este agente não usa fluxo dinâmico WhatsApp — edite o playbook como texto/instruções para a IA. O
              editor visual de menus e perguntas pré-prontas fica disponível só em agentes «Atendimento (WhatsApp)».
            </p>
          )}
          {whatsappFlowAgent && dirty && flowStatusPublicado.kind === "ready" ? (
            <p style={{ margin: 0, color: "#7a9a7e", fontSize: 10, lineHeight: 1.45 }}>
              Versão publicada ainda válida para motor dinâmico. Publique o rascunho para substituir no bucket (
              <code style={{ fontSize: 10 }}>tenant/slug/playbook.md</code>, arquivo único).
            </p>
          ) : null}
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 0.95fr)",
            gap: 0,
            overflow: "hidden",
          }}
        >
          {/* Coluna documento */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              minHeight: 0,
              borderRight: "1px solid rgba(146, 255, 0, 0.16)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                flex: 1,
                minHeight: 0,
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                overflowY: "auto",
                overscrollBehavior: "contain",
              }}
            >
              {carregando ? (
                <div
                  style={{
                    flex: "0 0 auto",
                    height: "34vh",
                    minHeight: 220,
                    maxHeight: 420,
                    borderRadius: 10,
                    border: "1px solid rgba(63, 152, 72, 0.42)",
                    background: "rgba(6, 13, 8, 0.72)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    color: "#5d7a67",
                  }}
                >
                  <RefreshCw size={18} className="animate-spin" />
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>A carregar playbook...</p>
                </div>
              ) : (
                <textarea
                  value={markdown}
                  onChange={(e) => {
                    setMarkdownOrigem("texto");
                    setMarkdown(e.target.value);
                  }}
                  placeholder="Sem playbook publicado. Carregue um .md, regenere do agente ou escreva aqui."
                  spellCheck={false}
                  style={{
                    flex: "0 0 auto",
                    height: "34vh",
                    minHeight: 220,
                    maxHeight: 420,
                    resize: "none",
                    borderRadius: 10,
                    border: "1px solid rgba(63, 152, 72, 0.42)",
                    background: "rgba(6, 13, 8, 0.85)",
                    color: "#e8f5e9",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 12,
                    lineHeight: 1.5,
                    padding: 12,
                  }}
                />
              )}

              <input
                id={PLAYBOOK_INPUT_CALIB}
                type="file"
                accept={PLAYBOOK_ACCEPT_ATTR}
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void enviarUpload(f);
                  e.target.value = "";
                }}
              />

              <PlaybookUploadAnalisePanel
                inputId={PLAYBOOK_INPUT_CALIB}
                uploadStatus={uploadHover ? "hover" : uploadStatus}
                uploadMensagem={uploadMensagem}
                uploadPct={uploadPct}
                arquivoNome={arquivoNome}
                conteudoPreview={markdown.slice(0, 800)}
                conteudoCarregado={temConteudo}
                analiseLoading={analiseLoading}
                analisePct={analisePct}
                analiseErro={analiseErro}
                analiseResultado={analiseResultado}
                dropzoneBorder={dropzoneBorder}
                dropzoneBg={dropzoneBg}
                onHoverChange={(h) => {
                  setUploadHover(h);
                  if (h && uploadStatus === "idle") setUploadStatus("hover");
                  if (!h && uploadStatus === "hover") setUploadStatus("idle");
                }}
                onFileSelect={(file) => void enviarUpload(file)}
                onAnalisar={() => void analisarComMistral()}
                theme="dark"
              />
            </div>
          </div>

          {/* Coluna chat */}
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0, overflow: "hidden" }}>
            <div
              style={{
                flexShrink: 0,
                padding: "10px 14px",
                borderBottom: "1px solid rgba(146, 255, 0, 0.16)",
              }}
            >
              <p style={{ margin: 0, color: "#e8f5e9", fontSize: 13, fontWeight: 700 }}>
                Chat de calibração
              </p>
              <p style={{ margin: "4px 0 0", color: "#6e7681", fontSize: 10, lineHeight: 1.45 }}>
                Converse com a IA para auditar, reescrever secções e fechar gaps. Usa o rascunho do editor (publicar
                continua manual).
              </p>
            </div>

            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                overscrollBehavior: "contain",
                padding: "14px 16px",
              }}
            >
              {chatMsgs.length === 0 && !chatEnviando ? (
                <p style={{ color: "#5d7a67", fontSize: 12, lineHeight: 1.55, maxWidth: 420 }}>
                  Exemplos: «Resume os gaps críticos», «Reescreve a saudação mais curta», «O que falta para cobrir
                  objeções de preço?»
                </p>
              ) : null}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {chatMsgs.map((m) => {
                  const isUser = m.papel === "user";
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: "flex",
                        gap: 8,
                        justifyContent: isUser ? "flex-end" : "flex-start",
                      }}
                    >
                      {!isUser ? (
                        <Bot size={18} color="#86efac" style={{ flexShrink: 0, marginTop: 4 }} />
                      ) : null}
                      <div
                        style={{
                          maxWidth: "92%",
                          background: isUser ? "rgba(11, 31, 16, 0.95)" : "rgba(6, 13, 8, 0.85)",
                          border: `1px solid ${isUser ? "rgba(63, 152, 72, 0.42)" : "rgba(146, 255, 0, 0.16)"}`,
                          borderRadius: 10,
                          padding: "10px 12px",
                          fontSize: 12,
                          color: "#e8f5e9",
                          lineHeight: 1.55,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {m.conteudo}
                        {m.modelo ? (
                          <div style={{ fontSize: 9, color: "#484f58", marginTop: 6 }}>{m.modelo}</div>
                        ) : null}
                      </div>
                      {isUser ? (
                        <User size={18} color="#79c0ff" style={{ flexShrink: 0, marginTop: 4 }} />
                      ) : null}
                    </div>
                  );
                })}
                {chatEnviando ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#5d7a67", fontSize: 12 }}>
                    <Bot size={18} color="#86efac" /> A pensar…
                  </div>
                ) : null}
                <div ref={chatFimRef} />
              </div>
            </div>

            <div
              style={{
                flexShrink: 0,
                padding: 12,
                borderTop: "1px solid rgba(146, 255, 0, 0.16)",
                display: "flex",
                gap: 8,
              }}
            >
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void enviarChat();
                  }
                }}
                disabled={!temConteudo || chatEnviando}
                placeholder={
                  temConteudo
                    ? "Peça melhorias ao playbook… (Enter envia)"
                    : "Carregue ou escreva um playbook primeiro."
                }
                rows={2}
                style={{
                  flex: 1,
                  resize: "none",
                  borderRadius: 10,
                  border: "1px solid rgba(63, 152, 72, 0.42)",
                  background: "rgba(6, 13, 8, 0.85)",
                  color: "#e8f5e9",
                  fontSize: 12,
                  padding: "10px 12px",
                }}
              />
              <button
                type="button"
                onClick={() => void enviarChat()}
                disabled={!temConteudo || chatEnviando || !chatInput.trim()}
                style={{
                  ...btnPrimario,
                  alignSelf: "flex-end",
                  opacity: !temConteudo || chatEnviando || !chatInput.trim() ? 0.45 : 1,
                }}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
        {visualBuilderEnabled && visualSideoverOpen ? (
          <PlaybookFlowVisualSideover
            open={visualSideoverOpen}
            onClose={() => setVisualSideoverOpen(false)}
            markdown={markdown}
            onMarkdownChange={(next) => {
              setMarkdownOrigem("visual");
              setMarkdown(next);
            }}
            agenteSlug={agenteSlug}
            agenteNome={agenteNome}
            disabled={carregando || publicando || uploadStatus === "enviando"}
            onBuilderError={(message) => {
              void emitFlowVisualTelemetry({
                event: "playbook.flow_visual.builder_fallback",
                agente_slug: agenteSlug,
                metadata: {
                  source: "builder_error_boundary",
                  message_size: message.length,
                },
              });
              setVisualSideoverOpen(false);
              setErro(
                `Editor visual indisponivel no momento. Continue pelo modo texto sem impacto na publicacao.\nDetalhe: ${message}`
              );
            }}
          />
        ) : null}
      </aside>
    </>
  );
}

/** Base para botões dentro de `CrmHeaderActionsRow` (borda/radius vêm do grupo). */
const btnToolbar: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  borderRadius: 0,
  border: "none",
  background: "rgba(6, 13, 8, 0.72)",
  color: "#e8f5e9",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const btnToolbarPublish: CSSProperties = {
  ...btnToolbar,
  background: BRAND_TEXT_DARK,
  color: BRAND_GREEN_BRIGHT,
};

const btnPrimario: CSSProperties = {
  ...crmBtnPrimary(),
  fontSize: 11,
  padding: "7px 12px",
  borderRadius: 8,
};
