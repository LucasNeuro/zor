"use client";

import type { CSSProperties, ReactNode } from "react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GitBranch, LayoutGrid, RefreshCw, Save, Wand2, X } from "lucide-react";
import { hubApiHeaders } from "@/lib/internal-api-headers-client";
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

const CALIB_GROUP_BORDER = "1px solid rgba(63, 152, 72, 0.38)";

function CalibToolbarGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#5a7a62",
          paddingLeft: 2,
        }}
      >
        {label}
      </span>
      <div
        role="group"
        aria-label={label}
        style={{
          display: "inline-flex",
          alignItems: "stretch",
          flexWrap: "nowrap",
          borderRadius: 10,
          border: CALIB_GROUP_BORDER,
          overflow: "hidden",
          background: "rgba(6, 13, 8, 0.82)",
          boxShadow: "inset 0 1px 0 rgba(146, 255, 0, 0.06)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function calibToolbarBtn(
  variant: "ghost" | "accent" | "primary",
  opts?: { disabled?: boolean; isLast?: boolean }
): CSSProperties {
  const disabled = opts?.disabled ?? false;
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    border: "none",
    borderRight: opts?.isLast ? undefined : CALIB_GROUP_BORDER,
    fontSize: 11,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    whiteSpace: "nowrap",
    opacity: disabled ? 0.45 : 1,
    transition: "background 0.15s ease, color 0.15s ease",
  };

  if (variant === "primary") {
    return {
      ...base,
      padding: "9px 16px",
      borderRadius: 10,
      border: "none",
      background: disabled ? "#4a6356" : BRAND_TEXT_DARK,
      color: disabled ? "#c8dcc8" : BRAND_GREEN_BRIGHT,
      boxShadow: disabled ? "none" : "0 2px 10px rgba(0, 0, 0, 0.28)",
    };
  }

  if (variant === "accent") {
    return {
      ...base,
      background: disabled ? "rgba(6, 13, 8, 0.5)" : "rgba(146, 255, 0, 0.14)",
      color: disabled ? "#6e7681" : CRM_ACCENT,
    };
  }

  return {
    ...base,
    background: "transparent",
    color: disabled ? "#6e7681" : "#d4e8d6",
  };
}

function CalibStatusBadge({ dirty }: { dirty: boolean }) {
  if (dirty) {
    return (
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          padding: "3px 9px",
          borderRadius: 999,
          border: "1px solid rgba(210, 153, 34, 0.45)",
          background: "rgba(210, 153, 34, 0.12)",
          color: "#e3b341",
          flexShrink: 0,
        }}
      >
        Rascunho
      </span>
    );
  }

  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: "3px 9px",
        borderRadius: 999,
        border: "1px solid rgba(63, 185, 80, 0.4)",
        background: "rgba(63, 185, 80, 0.12)",
        color: "#3fb950",
        flexShrink: 0,
      }}
    >
      Publicado
    </span>
  );
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
        { headers: await hubApiHeaders() }
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
    setAnaliseResultado(null);
    setAnaliseErro("");
    setUploadStatus("idle");
    setUploadMensagem("");
    setVisualSideoverOpen(false);
    setMarkdownOrigem(null);
    void carregarConteudo();
  }, [open, agenteSlug, carregarConteudo]);

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

  async function salvarRascunhoPlaybookNoBucket(markdownAlvo: string) {
    const trimmed = markdownAlvo.trim();
    if (!trimmed || publicando) return;
    setPublicando(true);
    setErro("");
    try {
      const res = await fetch(
        `/api/hub/agentes/${encodeURIComponent(agenteSlug)}/playbook/conteudo`,
        {
          method: "PUT",
          headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
          body: JSON.stringify({ markdown: trimmed }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(extractApiError(data, `Erro HTTP ${res.status}`));
      }
      setMarkdown(trimmed);
      setMarkdownPublicado(trimmed);
      setMarkdownOrigem("visual");
      setMeta((m) => ({
        ...m,
        hash: typeof data.playbook_source_hash === "string" ? data.playbook_source_hash : m.hash,
        url: typeof data.playbook_public_url === "string" ? data.playbook_public_url : m.url,
        path: typeof data.playbook_object_path === "string" ? data.playbook_object_path : m.path,
        generatedAt:
          typeof data.playbook_generated_at === "string" ? data.playbook_generated_at : m.generatedAt,
      }));
      toastSuccess("Fluxo gravado no playbook (bucket).");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao gravar rascunho.";
      setErro(msg);
      throw e;
    } finally {
      setPublicando(false);
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
          headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
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
        headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
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
        { method: "POST", headers: await hubApiHeaders(), body: form }
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
          headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
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

    setAplicandoPresetWa(true);
    setErro("");
    try {
      const res = await fetch(
        `/api/hub/agentes/${encodeURIComponent(agenteSlug)}/preset-wa`,
        {
          method: "POST",
          headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
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
          headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
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
            padding: "16px 18px 14px",
            borderBottom: "1px solid rgba(146, 255, 0, 0.14)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            background: "linear-gradient(180deg, #0d2214 0%, #0b1f10 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h2 style={{ color: "#e8f5e9", fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>
                  Playbook — Calibração
                </h2>
                <CalibStatusBadge dirty={dirty} />
              </div>
              <p style={{ color: "#92ff00", fontSize: 12, fontWeight: 600, margin: "5px 0 0" }}>{agenteNome}</p>
              {meta.generatedAt ? (
                <p
                  style={{
                    color: "#6e7681",
                    fontSize: 11,
                    margin: "6px 0 0",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "4px 10px",
                    lineHeight: 1.5,
                  }}
                >
                  <span>
                    Última publicação:{" "}
                    <span style={{ color: "#8b949e" }}>
                      {new Date(meta.generatedAt).toLocaleString("pt-BR")}
                    </span>
                  </span>
                  {meta.hash ? (
                    <span>
                      Hash{" "}
                      <code style={{ color: "#7a9a7e", fontSize: 10 }}>{meta.hash.slice(0, 10)}…</code>
                    </span>
                  ) : null}
                  {temConteudo ? (
                    <span>
                      Tamanho{" "}
                      <span style={{ color: "#8b949e" }}>
                        {formatBytes(new TextEncoder().encode(markdown).length)}
                      </span>
                    </span>
                  ) : null}
                </p>
              ) : (
                <p style={{ color: "#6e7681", fontSize: 11, margin: "6px 0 0" }}>Nenhuma publicação no bucket ainda.</p>
              )}
              {erro ? (
                <p style={{ color: "#f85149", fontSize: 11, margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{erro}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              style={{
                flexShrink: 0,
                width: 36,
                height: 36,
                borderRadius: 10,
                border: "1px solid rgba(63, 152, 72, 0.35)",
                background: "rgba(6, 13, 8, 0.55)",
                color: "#92ff00",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={18} />
            </button>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: "12px 16px",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12, minWidth: 0, flex: 1 }}>
              {whatsappFlowAgent ? (
                <CalibToolbarGroup label="Fluxo WhatsApp">
                  {visualBuilderEnabled ? (
                    <button
                      type="button"
                      onClick={() => {
                        void emitFlowVisualTelemetry({
                          event: "playbook.flow_visual.sideover_opened",
                          agente_slug: agenteSlug,
                          metadata: { source: "visual_button" },
                        });
                        setVisualSideoverOpen(true);
                      }}
                      style={calibToolbarBtn("ghost")}
                      title="Abrir editor visual do fluxo WhatsApp"
                    >
                      <LayoutGrid size={14} /> Editor visual
                    </button>
                  ) : null}
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
                    style={calibToolbarBtn(
                      flowStatus.kind === "ready" ? "ghost" : "accent",
                      { disabled: carregando || publicando || uploadStatus === "enviando" || adaptandoMotor || !temConteudo, isLast: true }
                    )}
                    title={`Gera o bloco json ${PLAYBOOK_FLOW_FENCE_TAG} a partir do cargo, conhecimento e docs da empresa`}
                  >
                    <GitBranch size={14} />
                    {adaptandoMotor ? "A gerar…" : "Gerar fluxo"}
                  </button>
                </CalibToolbarGroup>
              ) : null}

              <CalibToolbarGroup label="Conteúdo">
                <button
                  type="button"
                  onClick={() => void carregarConteudo()}
                  disabled={carregando}
                  style={calibToolbarBtn("ghost", { disabled: carregando })}
                  title="Recarrega o playbook publicado do bucket"
                >
                  <RefreshCw size={14} className={carregando ? "animate-spin" : undefined} />
                  Recarregar
                </button>
                <button
                  type="button"
                  onClick={() => void regenerarDoAgente()}
                  disabled={regenerando || carregando}
                  style={calibToolbarBtn("ghost", {
                    disabled: regenerando || carregando,
                    isLast: !whatsappFlowAgent,
                  })}
                  title="Gera playbook a partir do cargo/conhecimento do agente (pode remover o fluxo WA)"
                >
                  <Wand2 size={14} />
                  {regenerando ? "A gerar…" : "Regenerar"}
                </button>
                {whatsappFlowAgent ? (
                  <button
                    type="button"
                    onClick={() => void aplicarPresetConversacaoWa(false)}
                    disabled={carregando || publicando || aplicandoPresetWa}
                    style={calibToolbarBtn("ghost", {
                      disabled: carregando || publicando || aplicandoPresetWa,
                      isLast: true,
                    })}
                    title="Playbook + cargo + ferramentas + ciclos (preserva playbook existente)"
                  >
                    {aplicandoPresetWa ? "A aplicar…" : "Preset WA"}
                  </button>
                ) : null}
              </CalibToolbarGroup>
            </div>

            <button
              type="button"
              onClick={() => void publicarMarkdown()}
              disabled={!canPublishPlaybook}
              style={calibToolbarBtn("primary", { disabled: !canPublishPlaybook })}
              title={
                publishRequiresWhatsappFlow && flowStatus.kind !== "ready"
                  ? "Use «Gerar fluxo» até o banner verde antes de publicar"
                  : "Grava o rascunho no bucket e substitui playbook.md"
              }
            >
              <Save size={14} />
              {publicando ? "A publicar…" : "Publicar"}
            </button>
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
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              minHeight: 0,
              overflow: "hidden",
              flex: 1,
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
        </div>
      </aside>
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
          onPersistDraft={salvarRascunhoPlaybookNoBucket}
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
    </>
  );
}

const btnPrimario: CSSProperties = {
  ...crmBtnPrimary(),
  fontSize: 11,
  padding: "7px 12px",
  borderRadius: 8,
};
