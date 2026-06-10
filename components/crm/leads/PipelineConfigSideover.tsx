"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import {
  CadastroPremiumSideover,
  CadastroSideoverPanel,
  CadastroTipoBadge,
} from "@/components/crm/cadastro/CadastroPremiumSideover";
import { CrmToggleSwitch } from "@/components/crm/CrmToggleSwitch";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import type { PipelineEstagioRow } from "@/lib/crm/pipeline-defaults";
import { labelPipelineTab } from "@/lib/crm/tenant-pipelines";

type PipelineComEstagios = {
  id: string;
  slug: string;
  nome: string;
  tipo: string;
  mercado_sigla?: string | null;
  estagios: PipelineEstagioRow[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  tipo: "lead" | "negocio" | "atendimento";
  pipelineId: string | null;
  onUpdated?: () => void;
  onSelectPipeline?: (pipelineId: string) => void;
  showPipelineAdmin?: boolean;
  /** Abre destacando o formulário de novo pipeline. */
  focusCreate?: boolean;
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
  const [pipelines, setPipelines] = useState<PipelineComEstagios[]>([]);
  const [pipeline, setPipeline] = useState<PipelineComEstagios | null>(null);
  const [loading, setLoading] = useState(false);
  const [novoSlug, setNovoSlug] = useState("");
  const [novoLabel, setNovoLabel] = useState("");
  const [novoPipelineNome, setNovoPipelineNome] = useState("");
  const [erro, setErro] = useState("");
  const createInputRef = useRef<HTMLInputElement | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const res = await fetch(`/api/crm/pipelines?tipo=${tipo}`, {
        headers: internalApiHeaders(),
      });
      const json = await res.json();
      const list = (json.data || []) as PipelineComEstagios[];
      setPipelines(list);
      const hit = list.find((p) => p.id === pipelineId) ?? list[0] ?? null;
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
  }, [pipelineId, tipo]);

  useEffect(() => {
    if (open) void carregar();
    else {
      setPipelines([]);
      setPipeline(null);
      setNovoSlug("");
      setNovoLabel("");
      setNovoPipelineNome("");
      setErro("");
    }
  }, [open, carregar]);

  useEffect(() => {
    if (!open || !focusCreate || !showPipelineAdmin) return;
    const t = window.setTimeout(() => {
      createInputRef.current?.focus();
      createInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [open, focusCreate, showPipelineAdmin]);

  async function atualizarEstagio(
    slug: string,
    patch: { label?: string; cor?: string; ativo?: boolean }
  ) {
    if (!pipeline?.id || pipeline.id === "fallback") return;
    const headers = { ...internalApiHeaders(), "Content-Type": "application/json" };
    const res = await fetch(`/api/crm/pipelines/${pipeline.id}/estagios`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ slug, ...patch }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErro(j.error || "Erro ao actualizar estágio");
      return false;
    }
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
    await atualizarEstagio(slug, { ativo });
  }

  async function adicionarEstagio() {
    if (!pipeline?.id || pipeline.id === "fallback") return;
    const slug = novoSlug.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    const label = novoLabel.trim() || slug;
    if (!slug) {
      setErro("Informe um identificador (slug) para o estágio.");
      return;
    }
    const headers = { ...internalApiHeaders(), "Content-Type": "application/json" };
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

  async function criarPipeline() {
    const nome = novoPipelineNome.trim();
    if (!nome) {
      setErro("Informe o nome do novo pipeline.");
      return;
    }
    const headers = { ...internalApiHeaders(), "Content-Type": "application/json" };
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
    onSelectPipeline?.(String(j.data.id));
    await carregar();
    onUpdated?.();
  }

  const tipoLabel =
    tipo === "lead" ? "Leads" : tipo === "atendimento" ? "Atendimento" : "Negócios";
  const tipoBadge =
    tipo === "lead" ? "CRM Leads" : tipo === "atendimento" ? "CRM Atendimento" : "CRM Negócios";

  return (
    <CadastroPremiumSideover
      open={open}
      onClose={onClose}
      kindLabel="Pipeline"
      title={showPipelineAdmin ? "Estágios do pipeline" : "Estágios do funil"}
      subtitle={
        showPipelineAdmin
          ? pipeline?.nome || tipoLabel
          : "Personalize colunas do kanban para a sua empresa"
      }
      Icon={Settings2}
      badge={<CadastroTipoBadge label={tipoBadge} tone="gold" />}
    >
      <div className="flex flex-col gap-4 p-1">
        {showPipelineAdmin ? (
          <>
            <CadastroSideoverPanel>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-bold text-[#0b2210]">Pipelines</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#5d7a67]">
                    Active ou desactive colunas do kanban. Pode criar pipelines adicionais para
                    separar fluxos (ex.: inbound, indicações).
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {pipelines.map((item) => {
                    const ativo = pipeline?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setPipeline({
                            ...item,
                            estagios: (item.estagios || []).sort((a, b) => a.ordem - b.ordem),
                          });
                          onSelectPipeline?.(item.id);
                        }}
                        className="rounded-lg border px-3 py-2 text-xs font-bold"
                        style={{
                          borderColor: ativo ? "rgba(63, 152, 72, 0.42)" : "rgba(146, 255, 0, 0.16)",
                          background: ativo ? "rgba(146, 255, 0, 0.12)" : "rgba(6, 13, 8, 0.6)",
                          color: ativo ? "#92ff00" : "#7a9a7e",
                        }}
                      >
                        {labelPipelineTab(item)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CadastroSideoverPanel>

            <CadastroSideoverPanel>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-bold text-[#92ff00]">Novo pipeline</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#7a9a7e]">
                    Cria um pipeline novo do zero para o seu escritório. Recebe automaticamente os
                    estágios padrão Waje.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={createInputRef}
                    value={novoPipelineNome}
                    onChange={(e) => setNovoPipelineNome(e.target.value)}
                    placeholder="Nome do pipeline"
                    className="rounded-lg border border-[rgba(63,152,72,0.42)] bg-[rgba(6,13,8,0.85)] px-3 py-2 text-sm text-[#e8f5e9]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void criarPipeline();
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void criarPipeline()}
                    className="rounded-lg px-3 py-2 text-sm font-bold"
                    style={{ background: "#0b1f10", color: "#92ff00" }}
                  >
                    Criar pipeline
                  </button>
                </div>
              </div>
            </CadastroSideoverPanel>
          </>
        ) : null}

        {loading ? (
          <p className="text-sm text-[#7a9a7e]">A carregar…</p>
        ) : !pipeline ? (
          <p className="text-sm text-[#7a9a7e]">
            Execute a migração <code className="text-[#92ff00]">hub_pipelines</code> no Supabase
            para activar a configuração na base de dados. O kanban usa o template padrão até lá.
          </p>
        ) : (
          <>
            <CadastroSideoverPanel>
              <div className="space-y-3">
                <p className="text-xs leading-relaxed text-[#7a9a7e]">
                  Cada empresa define os seus estágios. Edite o nome e a cor, active ou desactive
                  colunas no kanban, ou adicione estágios novos.
                </p>
                <ul className="flex flex-col gap-2">
                  {pipeline.estagios.map((est) => (
                    <li
                      key={est.slug}
                      className="flex flex-col gap-2 rounded-xl border px-3.5 py-3 sm:flex-row sm:items-center"
                      style={{
                        borderColor: est.ativo ? `${est.cor}55` : "rgba(63, 152, 72, 0.42)",
                        background: est.ativo ? `${est.cor}0c` : "rgba(6, 13, 8, 0.6)",
                      }}
                    >
                      <span
                        className="hidden h-8 w-1 shrink-0 rounded-full sm:block"
                        style={{ backgroundColor: est.cor }}
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <input
                          defaultValue={est.label}
                          onBlur={(e) => {
                            const next = e.target.value.trim();
                            if (next && next !== est.label) void atualizarEstagio(est.slug, { label: next });
                          }}
                          className="w-full rounded-lg border border-[rgba(63,152,72,0.42)] bg-[rgba(6,13,8,0.85)] px-3 py-2 text-sm font-bold text-[#e8f5e9]"
                          aria-label={`Nome do estágio ${est.slug}`}
                        />
                        <p className="font-mono text-[10px] text-[#7a9a7e]">{est.slug}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <label className="flex items-center gap-2 text-[10px] font-bold text-[#7a9a7e]">
                          Cor
                          <input
                            type="color"
                            value={est.cor}
                            onChange={(e) => void atualizarEstagio(est.slug, { cor: e.target.value })}
                            className="h-8 w-10 cursor-pointer rounded border border-[rgba(63,152,72,0.42)] bg-transparent"
                            aria-label={`Cor do estágio ${est.label}`}
                          />
                        </label>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className="text-[10px] font-bold"
                            style={{ color: est.ativo ? "#3fb950" : "#6e7781" }}
                          >
                            {est.ativo ? "ACTIVO" : "INACTIVO"}
                          </span>
                          <CrmToggleSwitch
                            checked={est.ativo}
                            onCheckedChange={(v) => void toggleEstagio(est.slug, v)}
                            disabled={est.sistema && est.slug === "novo"}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="rounded-xl border border-[rgba(63,152,72,0.42)] bg-[rgba(6,13,8,0.6)] p-3">
                  <p className="mb-2 text-xs font-bold text-[#92ff00]">Novo estágio</p>
                  <div className="flex flex-col gap-2">
                    <input
                      value={novoSlug}
                      onChange={(e) => setNovoSlug(e.target.value)}
                      placeholder="slug (ex: pre_analise)"
                      className="rounded-lg border border-[rgba(63,152,72,0.42)] bg-[rgba(6,13,8,0.85)] px-3 py-2 text-sm text-[#e8f5e9]"
                    />
                    <input
                      value={novoLabel}
                      onChange={(e) => setNovoLabel(e.target.value)}
                      placeholder="Nome exibido"
                      className="rounded-lg border border-[rgba(63,152,72,0.42)] bg-[rgba(6,13,8,0.85)] px-3 py-2 text-sm text-[#e8f5e9]"
                    />
                    <button
                      type="button"
                      onClick={() => void adicionarEstagio()}
                      className="rounded-lg px-3 py-2 text-sm font-bold"
                      style={{ background: "#0b1f10", color: "#92ff00" }}
                    >
                      Adicionar estágio
                    </button>
                  </div>
                </div>
              </div>
            </CadastroSideoverPanel>
          </>
        )}
        {erro ? <p className="text-xs text-red-400">{erro}</p> : null}
      </div>
    </CadastroPremiumSideover>
  );
}
