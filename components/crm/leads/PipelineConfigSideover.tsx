"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Settings2, Trash2 } from "lucide-react";
import {
  CrmSideoverActionBtn,
  CrmSideoverActionGroup,
  CrmSideoverTabGroup,
  CrmSideoverToolbarRow,
} from "@/components/crm/CrmSideoverActionGroup";
import { CrmRetrofitSideoverShell } from "@/components/crm/CrmRetrofitSideoverShell";
import { CrmSideoverLoadingState } from "@/components/crm/CrmSideoverLoadingState";
import { CrmToggleSwitch } from "@/components/crm/CrmToggleSwitch";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import type { PipelineEstagioRow } from "@/lib/crm/pipeline-defaults";
import { slugEstagioFromLabel } from "@/lib/crm/pipeline-estagios-ia";
import { isUuidValido } from "@/lib/tenant-default";
import {
  RF_LIGHT_BORDER_STRONG,
  RF_LIGHT_INPUT_STYLE,
  RF_LIGHT_TEXT_MUTED,
  RF_LIGHT_TEXT_PRIMARY,
  RF_LIGHT_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";
import { isPipelinePrincipal, labelPipelineTab } from "@/lib/crm/tenant-pipelines";
import { useCrmConfirm } from "@/lib/crm/crm-feedback";

type PipelineComEstagios = {
  id: string;
  slug: string;
  nome: string;
  tipo: string;
  mercado_sigla?: string | null;
  ativo?: boolean;
  estagios: PipelineEstagioRow[];
};

type ConfigTab = "estagios" | "pipelines";

type Props = {
  open: boolean;
  onClose: () => void;
  tipo: "lead" | "negocio" | "atendimento";
  pipelineId: string | null;
  onUpdated?: () => void;
  onSelectPipeline?: (pipelineId: string) => void;
  showPipelineAdmin?: boolean;
  /** Abre na aba Pipelines com foco no formulário de criação. */
  focusCreate?: boolean;
};

const THEME = "light" as const;

const INPUT_CLASS =
  "w-full min-h-9 rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#3f9848]";

const INPUT_STYLE: React.CSSProperties = {
  ...RF_LIGHT_INPUT_STYLE,
  borderColor: RF_LIGHT_BORDER_STRONG,
};

export function PipelineConfigSideover({
  open,
  onClose,
  tipo,
  pipelineId,
  onUpdated,
  onSelectPipeline,
  showPipelineAdmin = true,
  focusCreate = false,
}: Props) {
  const { confirmDialog, closeConfirmDialog } = useCrmConfirm();
  const [pipelines, setPipelines] = useState<PipelineComEstagios[]>([]);
  const [pipeline, setPipeline] = useState<PipelineComEstagios | null>(null);
  const [loading, setLoading] = useState(false);
  const [configTab, setConfigTab] = useState<ConfigTab>("estagios");
  const [novoSlug, setNovoSlug] = useState("");
  const [novoLabel, setNovoLabel] = useState("");
  const [novoPipelineNome, setNovoPipelineNome] = useState("");
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [salvandoSlug, setSalvandoSlug] = useState<string | null>(null);
  const [salvandoPipelineId, setSalvandoPipelineId] = useState<string | null>(null);
  const createInputRef = useRef<HTMLInputElement | null>(null);

  const pipelinesActivos = useMemo(
    () => pipelines.filter((p) => p.ativo !== false),
    [pipelines]
  );

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const adminQs = showPipelineAdmin ? "&incluir_inativos=1" : "";
      const headers = await crmApiHeaders();
      const res = await fetch(`/api/crm/pipelines?tipo=${tipo}${adminQs}`, {
        headers,
      });
      const json = await res.json();
      if (!res.ok) {
        setErro(typeof json.error === "string" ? json.error : "Não foi possível carregar o pipeline.");
        return;
      }
      const list = (json.data || []) as PipelineComEstagios[];
      setPipelines(list);
      const activos = list.filter((p) => p.ativo !== false);
      const hit =
        list.find((p) => p.id === pipelineId && p.ativo !== false) ??
        activos[0] ??
        list.find((p) => p.id === pipelineId) ??
        list[0] ??
        null;
      if (hit) {
        setPipeline({
          ...hit,
          estagios: (hit.estagios || []).sort((a, b) => a.ordem - b.ordem),
        });
      }
    } catch {
      setErro("Não foi possível carregar o pipeline.");
    } finally {
      setLoading(false);
    }
  }, [pipelineId, showPipelineAdmin, tipo]);

  useEffect(() => {
    if (open) {
      setConfigTab(focusCreate && showPipelineAdmin ? "pipelines" : "estagios");
      void carregar();
    } else {
      setPipelines([]);
      setPipeline(null);
      setConfigTab("estagios");
      setNovoSlug("");
      setNovoLabel("");
      setNovoPipelineNome("");
      setErro("");
      setOkMsg("");
      setSalvandoSlug(null);
      setSalvandoPipelineId(null);
    }
  }, [open, carregar, focusCreate, showPipelineAdmin]);

  useEffect(() => {
    if (!open || !focusCreate || !showPipelineAdmin || configTab !== "pipelines") return;
    const t = window.setTimeout(() => {
      createInputRef.current?.focus();
      createInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [open, focusCreate, showPipelineAdmin, configTab]);

  async function atualizarEstagio(
    slug: string,
    patch: { label?: string; cor?: string; ativo?: boolean }
  ) {
    if (!pipeline?.id || pipeline.id === "fallback" || !isUuidValido(pipeline.id)) return;
    const headers = { ...(await crmApiHeaders()), "Content-Type": "application/json" };
    const res = await fetch(`/api/crm/pipelines/${pipeline.id}/estagios`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ slug, ...patch }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErro(j.error || "Erro ao actualizar estágio");
      setOkMsg("");
      return false;
    }
    setErro("");
    setPipeline((prev) =>
      prev
        ? {
            ...prev,
            estagios: prev.estagios.map((e) =>
              e.slug === slug
                ? {
                    ...e,
                    ...(patch.label != null ? { label: patch.label } : {}),
                    ...(patch.cor != null ? { cor: patch.cor } : {}),
                    ...(patch.ativo != null ? { ativo: patch.ativo } : {}),
                  }
                : e
            ),
          }
        : null
    );
    onUpdated?.();
    return true;
  }

  async function toggleEstagio(slug: string, ativo: boolean) {
    if (!pipeline?.id || pipeline.id === "fallback" || !isUuidValido(pipeline.id) || salvandoSlug === slug) return;

    const anterior = pipeline?.estagios.find((e) => e.slug === slug)?.ativo ?? !ativo;
    setErro("");
    setOkMsg("");
    setSalvandoSlug(slug);
    setPipeline((prev) =>
      prev
        ? {
            ...prev,
            estagios: prev.estagios.map((e) => (e.slug === slug ? { ...e, ativo } : e)),
          }
        : null
    );

    const ok = await atualizarEstagio(slug, { ativo });
    if (!ok) {
      setPipeline((prev) =>
        prev
          ? {
              ...prev,
              estagios: prev.estagios.map((e) =>
                e.slug === slug ? { ...e, ativo: anterior } : e
              ),
            }
          : null
      );
    } else {
      setOkMsg(
        ativo
          ? "Estágio activo — visível no kanban e para agentes IA."
          : "Estágio inactivo — oculto no kanban e ignorado pelos agentes IA."
      );
      window.setTimeout(() => setOkMsg(""), 3200);
    }
    setSalvandoSlug(null);
  }

  async function adicionarEstagio() {
    if (!pipeline?.id || pipeline.id === "fallback" || !isUuidValido(pipeline.id)) return;
    const label = novoLabel.trim();
    const slug = (novoSlug.trim() || slugEstagioFromLabel(label)).toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    if (!label) {
      setErro("Informe o nome do estágio.");
      return;
    }
    if (!slug || slug.length < 2) {
      setErro("Nome inválido para gerar identificador do estágio.");
      return;
    }
    const headers = { ...(await crmApiHeaders()), "Content-Type": "application/json" };
    const res = await fetch(`/api/crm/pipelines/${pipeline.id}/estagios`, {
      method: "POST",
      headers,
      body: JSON.stringify({ slug, label }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro(j.error || "Erro ao criar estágio");
      return;
    }
    setNovoSlug("");
    setNovoLabel("");
    await carregar();
    onUpdated?.();
  }

  const estagiosOrdenados = useMemo(
    () => [...(pipeline?.estagios ?? [])].sort((a, b) => a.ordem - b.ordem),
    [pipeline?.estagios]
  );

  async function reordenarEstagios(slugs: string[]) {
    if (!pipeline?.id || pipeline.id === "fallback" || !isUuidValido(pipeline.id)) return false;
    const headers = { ...(await crmApiHeaders()), "Content-Type": "application/json" };
    const res = await fetch(`/api/crm/pipelines/${pipeline.id}/estagios`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ reorder: slugs }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro(j.error || "Erro ao reordenar estágios");
      return false;
    }
    setPipeline((prev) =>
      prev
        ? {
            ...prev,
            estagios: slugs.map((slug, ordem) => {
              const hit = prev.estagios.find((e) => e.slug === slug);
              return hit ? { ...hit, ordem } : ({ slug, ordem } as PipelineEstagioRow);
            }),
          }
        : null
    );
    onUpdated?.();
    return true;
  }

  async function moverEstagio(slug: string, direcao: "up" | "down") {
    const slugs = estagiosOrdenados.map((e) => e.slug);
    const idx = slugs.indexOf(slug);
    if (idx < 0) return;
    const swap = direcao === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= slugs.length) return;
    [slugs[idx], slugs[swap]] = [slugs[swap], slugs[idx]];
    await reordenarEstagios(slugs);
  }

  async function excluirEstagio(est: PipelineEstagioRow) {
    if (!pipeline?.id || pipeline.id === "fallback" || !isUuidValido(pipeline.id)) return;
    const ok = await confirmDialog({
      title: "Excluir estágio?",
      message: `Excluir o estágio «${est.label}»? Só é possível se não houver leads/negócios nesta coluna.`,
      variant: "destructive",
      confirmLabel: "Excluir",
      theme: "light",
    });
    if (!ok) return;
    closeConfirmDialog();
    const res = await fetch(
      `/api/crm/pipelines/${pipeline.id}/estagios?slug=${encodeURIComponent(est.slug)}`,
      { method: "DELETE", headers: await crmApiHeaders() }
    );
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro(j.error || "Erro ao excluir estágio");
      return;
    }
    setPipeline((prev) =>
      prev ? { ...prev, estagios: prev.estagios.filter((e) => e.slug !== est.slug) } : null
    );
    onUpdated?.();
  }

  async function criarPipeline() {
    const nome = novoPipelineNome.trim();
    if (!nome) {
      setErro("Informe o nome do novo pipeline.");
      return;
    }
    const headers = { ...(await crmApiHeaders()), "Content-Type": "application/json" };
    const res = await fetch("/api/crm/pipelines", {
      method: "POST",
      headers,
      body: JSON.stringify({
        nome,
        tipo,
        mercado_sigla: null,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro(j.error || "Erro ao criar pipeline");
      return;
    }
    setNovoPipelineNome("");
    setConfigTab("estagios");
    onSelectPipeline?.(String(j.data.id));
    await carregar();
    onUpdated?.();
  }

  async function togglePipelineAtivo(item: PipelineComEstagios, ativo: boolean) {
    if (!item.id || item.id === "fallback" || !isUuidValido(item.id) || salvandoPipelineId === item.id) return;

    const principal = isPipelinePrincipal({
      slug: item.slug,
      tipo: tipo as "lead" | "negocio" | "atendimento",
    });
    if (principal && !ativo) {
      setErro("O pipeline principal de Leads não pode ser desactivado.");
      return;
    }

    setSalvandoPipelineId(item.id);
    setErro("");
    setOkMsg("");

    const headers = { ...(await crmApiHeaders()), "Content-Type": "application/json" };
    const res = await fetch(`/api/crm/pipelines/${item.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ ativo }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro(j.error || "Erro ao actualizar pipeline");
      setSalvandoPipelineId(null);
      return;
    }

    setPipelines((prev) =>
      prev.map((p) => (p.id === item.id ? { ...p, ativo } : p))
    );
    if (pipeline?.id === item.id && !ativo) {
      const proximo = pipelinesActivos.find((p) => p.id !== item.id);
      if (proximo) {
        setPipeline({
          ...proximo,
          estagios: (proximo.estagios || []).sort((a, b) => a.ordem - b.ordem),
        });
        onSelectPipeline?.(proximo.id);
      }
    }
    setOkMsg(ativo ? "Pipeline activado." : "Pipeline desactivado.");
    window.setTimeout(() => setOkMsg(""), 2800);
    setSalvandoPipelineId(null);
    onUpdated?.();
  }

  async function excluirPipeline(item: PipelineComEstagios) {
    if (!item.id || item.id === "fallback" || !isUuidValido(item.id)) return;

    const principal = isPipelinePrincipal({
      slug: item.slug,
      tipo: tipo as "lead" | "negocio" | "atendimento",
    });
    if (principal) {
      setErro("O pipeline principal de Leads não pode ser excluído.");
      return;
    }

    const ok = await confirmDialog({
      title: "Excluir pipeline?",
      message: `Excluir o pipeline «${labelPipelineTab(item)}»? Só é possível se não houver leads neste funil.`,
      variant: "destructive",
      confirmLabel: "Excluir",
      theme: "light",
    });
    if (!ok) return;
    closeConfirmDialog();

    const res = await fetch(`/api/crm/pipelines/${item.id}`, {
      method: "DELETE",
      headers: await crmApiHeaders(),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro(j.error || "Erro ao excluir pipeline");
      return;
    }

    if (pipeline?.id === item.id) {
      const restantes = pipelines.filter((p) => p.id !== item.id && p.ativo !== false);
      const proximo = restantes[0] ?? null;
      if (proximo) {
        setPipeline({
          ...proximo,
          estagios: (proximo.estagios || []).sort((a, b) => a.ordem - b.ordem),
        });
        onSelectPipeline?.(proximo.id);
      } else {
        setPipeline(null);
      }
    }
    await carregar();
    onUpdated?.();
  }

  function seleccionarPipeline(item: PipelineComEstagios) {
    setPipeline({
      ...item,
      estagios: (item.estagios || []).sort((a, b) => a.ordem - b.ordem),
    });
    onSelectPipeline?.(item.id);
    setConfigTab("estagios");
  }

  const tipoLabel =
    tipo === "lead" ? "Leads" : tipo === "atendimento" ? "Atendimento" : "Negócios";

  const configTabs: { id: ConfigTab; label: string }[] = showPipelineAdmin
    ? [
        { id: "estagios", label: "Estágios" },
        { id: "pipelines", label: "Pipelines" },
      ]
    : [{ id: "estagios", label: "Estágios" }];

  return (
    <CrmRetrofitSideoverShell
      open={open}
      onClose={onClose}
      theme={THEME}
      kindLabel="Pipeline"
      title={showPipelineAdmin ? "Configuração do funil" : "Estágios do funil"}
      subtitle={
        showPipelineAdmin
          ? pipeline?.nome || tipoLabel
          : "Personalize colunas do kanban para a sua empresa"
      }
      icon={Settings2}
      headerToolbar={
        showPipelineAdmin ? (
          <CrmSideoverTabGroup
            tabs={configTabs}
            active={configTab}
            onChange={setConfigTab}
            theme={THEME}
          />
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        {loading ? (
          <CrmSideoverLoadingState theme="light" label="A carregar pipelines…" centered />
        ) : configTab === "pipelines" && showPipelineAdmin ? (
          <>
            <p className="text-xs leading-relaxed" style={{ color: RF_LIGHT_TEXT_MUTED }}>
              Active ou desactive pipelines adicionais. O pipeline principal de Leads permanece
              sempre activo e não pode ser excluído.
            </p>

            <ul className="flex flex-col gap-2">
              {pipelines.map((item) => {
                const principal = isPipelinePrincipal({
                  slug: item.slug,
                  tipo: tipo as "lead" | "negocio" | "atendimento",
                });
                const activo = item.ativo !== false;
                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 sm:flex-nowrap"
                    style={{
                      borderColor: activo ? RF_LIGHT_BORDER_STRONG : "#d1d5db",
                      background: activo ? "#ffffff" : "#f3f4f6",
                      opacity: activo ? 1 : 0.85,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => seleccionarPipeline(item)}
                      className="min-w-0 flex-1 truncate text-left text-sm font-semibold hover:underline"
                      style={{ color: RF_LIGHT_TEXT_PRIMARY }}
                      title="Editar estágios deste pipeline"
                    >
                      {labelPipelineTab(item)}
                    </button>
                    {principal ? (
                      <span
                        className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                        style={{ background: "#e8f5e9", color: "#2d6a3e" }}
                      >
                        Principal
                      </span>
                    ) : null}
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className="text-[10px] font-bold uppercase"
                        style={{ color: activo ? "#2d6a3e" : "#9aa4af" }}
                      >
                        {salvandoPipelineId === item.id
                          ? "…"
                          : activo
                            ? "Activo"
                            : "Inactivo"}
                      </span>
                      <CrmToggleSwitch
                        variant="light"
                        checked={activo}
                        disabled={principal || salvandoPipelineId === item.id}
                        onCheckedChange={(v) => void togglePipelineAtivo(item, v)}
                      />
                      {!principal ? (
                        <button
                          type="button"
                          title="Excluir pipeline"
                          onClick={() => void excluirPipeline(item)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={15} />
                        </button>
                      ) : (
                        <span className="inline-block h-8 w-8" aria-hidden />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div
              className="rounded-xl border p-3"
              style={{ borderColor: RF_LIGHT_BORDER_STRONG, background: "#fafcfa" }}
            >
              <p
                className="mb-2 text-xs font-bold uppercase tracking-wide"
                style={{ color: RF_LIGHT_TEXT_SECONDARY }}
              >
                Novo pipeline
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  ref={createInputRef}
                  value={novoPipelineNome}
                  onChange={(e) => setNovoPipelineNome(e.target.value)}
                  placeholder="Nome do pipeline"
                  className={INPUT_CLASS}
                  style={INPUT_STYLE}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void criarPipeline();
                  }}
                />
                <button
                  type="button"
                  onClick={() => void criarPipeline()}
                  className="shrink-0 rounded-lg px-4 py-2 text-sm font-bold text-white"
                  style={{ background: "#2d6a3e" }}
                >
                  Criar
                </button>
              </div>
            </div>
          </>
        ) : !pipeline ? (
          <p className="text-sm" style={{ color: RF_LIGHT_TEXT_MUTED }}>
            A configuração de pipelines ainda não está disponível na base de dados. O kanban usa o
            template padrão até estar activa.
          </p>
        ) : (
          <>
            {showPipelineAdmin && pipelinesActivos.length > 1 ? (
              <div className="min-w-0 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
                <CrmSideoverToolbarRow>
                  <CrmSideoverActionGroup className="min-w-max" theme={THEME}>
                    {pipelinesActivos.map((item) => (
                      <CrmSideoverActionBtn
                        key={item.id}
                        active={pipeline.id === item.id}
                        onClick={() => seleccionarPipeline(item)}
                        title={labelPipelineTab(item)}
                        theme={THEME}
                      >
                        {labelPipelineTab(item)}
                      </CrmSideoverActionBtn>
                    ))}
                  </CrmSideoverActionGroup>
                </CrmSideoverToolbarRow>
              </div>
            ) : null}

            <p className="text-xs leading-relaxed" style={{ color: RF_LIGHT_TEXT_MUTED }}>
              Edite nome e cor, active ou desactive colunas, reordene, exclua estágios vazios ou
              adicione novos. Os agentes de IA enxergam os estágios activos.
            </p>

            <ul className="flex flex-col gap-2">
              {estagiosOrdenados.map((est, idx) => (
                <li
                  key={est.slug}
                  className="flex flex-wrap items-center gap-2 rounded-xl border px-2.5 py-2 sm:flex-nowrap"
                  style={{
                    borderColor: est.ativo ? `${est.cor}66` : "#d1d5db",
                    borderStyle: est.ativo ? "solid" : "dashed",
                    background: est.ativo ? `${est.cor}0a` : "#f9fafb",
                    opacity: est.ativo ? 1 : 0.82,
                  }}
                >
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      title="Subir"
                      disabled={idx === 0}
                      onClick={() => void moverEstagio(est.slug, "up")}
                      className="flex h-8 w-7 items-center justify-center rounded-lg border disabled:opacity-30"
                      style={{ borderColor: RF_LIGHT_BORDER_STRONG, color: RF_LIGHT_TEXT_SECONDARY }}
                    >
                      <ChevronUp size={15} />
                    </button>
                    <button
                      type="button"
                      title="Descer"
                      disabled={idx === estagiosOrdenados.length - 1}
                      onClick={() => void moverEstagio(est.slug, "down")}
                      className="flex h-8 w-7 items-center justify-center rounded-lg border disabled:opacity-30"
                      style={{ borderColor: RF_LIGHT_BORDER_STRONG, color: RF_LIGHT_TEXT_SECONDARY }}
                    >
                      <ChevronDown size={15} />
                    </button>
                  </div>
                  <span
                    className="hidden h-7 w-1 shrink-0 rounded-full sm:block"
                    style={{ backgroundColor: est.cor }}
                  />
                  <input
                    defaultValue={est.label}
                    onBlur={(e) => {
                      const next = e.target.value.trim();
                      if (next && next !== est.label) void atualizarEstagio(est.slug, { label: next });
                    }}
                    className={`${INPUT_CLASS} min-w-[8rem] flex-1 font-semibold`}
                    style={INPUT_STYLE}
                    aria-label={`Nome do estágio ${est.slug}`}
                  />
                  <label className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold" style={{ color: RF_LIGHT_TEXT_MUTED }}>
                    Cor
                    <input
                      type="color"
                      value={est.cor}
                      onChange={(e) => void atualizarEstagio(est.slug, { cor: e.target.value })}
                      className="h-8 w-9 cursor-pointer rounded border bg-transparent"
                      style={{ borderColor: RF_LIGHT_BORDER_STRONG }}
                      aria-label={`Cor do estágio ${est.label}`}
                    />
                  </label>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span
                      className="text-[10px] font-bold uppercase"
                      style={{ color: est.ativo ? "#2d6a3e" : "#9aa4af" }}
                    >
                      {salvandoSlug === est.slug ? "…" : est.ativo ? "On" : "Off"}
                    </span>
                    <CrmToggleSwitch
                      variant="light"
                      checked={est.ativo}
                      disabled={salvandoSlug === est.slug}
                      onCheckedChange={(v) => void toggleEstagio(est.slug, v)}
                    />
                  </div>
                  <button
                    type="button"
                    title="Excluir estágio"
                    onClick={() => void excluirEstagio(est)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>

            <div
              className="rounded-xl border p-3"
              style={{ borderColor: RF_LIGHT_BORDER_STRONG, background: "#fafcfa" }}
            >
              <p
                className="mb-2 text-xs font-bold uppercase tracking-wide"
                style={{ color: RF_LIGHT_TEXT_SECONDARY }}
              >
                Novo estágio
              </p>
              <div className="flex flex-col gap-2">
                <input
                  value={novoLabel}
                  onChange={(e) => setNovoLabel(e.target.value)}
                  placeholder="Nome exibido (ex.: Pré-análise)"
                  className={INPUT_CLASS}
                  style={INPUT_STYLE}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void adicionarEstagio();
                  }}
                />
                <input
                  value={novoSlug}
                  onChange={(e) => setNovoSlug(e.target.value)}
                  placeholder="Identificador opcional (ex.: pre_analise)"
                  className={INPUT_CLASS}
                  style={{ ...INPUT_STYLE, color: RF_LIGHT_TEXT_MUTED }}
                />
                <button
                  type="button"
                  onClick={() => void adicionarEstagio()}
                  className="rounded-lg px-3 py-2 text-sm font-bold text-white"
                  style={{ background: "#2d6a3e" }}
                >
                  Adicionar estágio
                </button>
              </div>
            </div>
          </>
        )}

        {okMsg ? (
          <p
            className="rounded-lg border px-3 py-2 text-xs"
            style={{ borderColor: "#b8d4bc", background: "#e8f5e9", color: "#2d6a3e" }}
          >
            {okMsg}
          </p>
        ) : null}
        {erro ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {erro}
          </p>
        ) : null}
      </div>
    </CrmRetrofitSideoverShell>
  );
}
