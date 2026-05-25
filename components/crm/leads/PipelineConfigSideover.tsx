"use client";

import { useCallback, useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import {
  CadastroPremiumSideover,
  CadastroSideoverPanel,
  CadastroTipoBadge,
} from "@/components/crm/cadastro/CadastroPremiumSideover";
import { CrmToggleSwitch } from "@/components/crm/CrmToggleSwitch";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import type { PipelineEstagioRow } from "@/lib/crm/pipeline-defaults";

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
  tipo: "lead" | "negocio";
  pipelineId: string | null;
  onUpdated?: () => void;
  onSelectPipeline?: (pipelineId: string) => void;
  showPipelineAdmin?: boolean;
};

export function PipelineConfigSideover({
  open,
  onClose,
  tipo,
  pipelineId,
  onUpdated,
  onSelectPipeline,
  showPipelineAdmin = true,
}: Props) {
  const [pipelines, setPipelines] = useState<PipelineComEstagios[]>([]);
  const [pipeline, setPipeline] = useState<PipelineComEstagios | null>(null);
  const [loading, setLoading] = useState(false);
  const [novoSlug, setNovoSlug] = useState("");
  const [novoLabel, setNovoLabel] = useState("");
  const [novoPipelineNome, setNovoPipelineNome] = useState("");
  const [erro, setErro] = useState("");

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

  async function toggleEstagio(slug: string, ativo: boolean) {
    if (!pipeline?.id || pipeline.id === "fallback") return;
    const headers = { ...internalApiHeaders(), "Content-Type": "application/json" };
    const res = await fetch(`/api/crm/pipelines/${pipeline.id}/estagios`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ slug, ativo }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErro(j.error || "Erro ao actualizar estágio");
      return;
    }
    setPipeline((prev) =>
      prev
        ? {
            ...prev,
            estagios: prev.estagios.map((e) =>
              e.slug === slug ? { ...e, ativo } : e
            ),
          }
        : null
    );
    onUpdated?.();
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

  return (
    <CadastroPremiumSideover
      open={open}
      onClose={onClose}
      kindLabel="Pipeline"
      title="Configurar pipeline"
      subtitle={pipeline?.nome || (tipo === "lead" ? "Funil de leads" : "Funil de negócios")}
      Icon={Settings2}
      badge={
        <CadastroTipoBadge
          label={tipo === "lead" ? "CRM Leads" : "CRM Negócios"}
          tone="gold"
        />
      }
    >
      <div className="flex flex-col gap-4 p-1">
        {showPipelineAdmin ? (
          <>
            <CadastroSideoverPanel>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-bold text-[#e6edf3]">Pipelines</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#8b949e]">
                    Selecciona um pipeline para gerir os estágios. Novos pipelines criados aqui
                    nascem livres, sem vínculo de mercado, e herdam os estágios padrão.
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
                          borderColor: ativo ? "#c9a24a" : "#30363d",
                          background: ativo ? "rgba(201,162,74,0.12)" : "#0d1117",
                          color: ativo ? "#e6edf3" : "#8b949e",
                        }}
                      >
                        {item.nome.replace(/^Leads\s+[—-]\s+/i, "").replace(/^Negócios\s+[—-]\s+/i, "")}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CadastroSideoverPanel>

            <CadastroSideoverPanel>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-bold text-[#e6edf3]">Novo pipeline</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#8b949e]">
                    Cria um pipeline novo do zero. Ele fica global e recebe automaticamente os
                    estágios padrão do CRM.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    value={novoPipelineNome}
                    onChange={(e) => setNovoPipelineNome(e.target.value)}
                    placeholder="Nome do pipeline"
                    className="rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#e6edf3]"
                  />
                  <div className="rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#8b949e]">
                    Sem vínculo de mercado
                  </div>
                  <button
                    type="button"
                    onClick={() => void criarPipeline()}
                    className="rounded-lg px-3 py-2 text-sm font-bold"
                    style={{ background: "#003b26", color: "#c9a24a" }}
                  >
                    Criar pipeline
                  </button>
                </div>
              </div>
            </CadastroSideoverPanel>
          </>
        ) : null}

        {loading ? (
          <p className="text-sm text-[#8b949e]">A carregar…</p>
        ) : !pipeline ? (
          <p className="text-sm text-[#8b949e]">
            Execute a migração <code className="text-[#c9a24a]">hub_pipelines</code> no Supabase
            para activar a configuração na base de dados. O kanban usa o template padrão até lá.
          </p>
        ) : (
          <>
            <CadastroSideoverPanel>
              <div className="space-y-3">
                <p className="text-xs leading-relaxed text-[#8b949e]">
                  Desactive estágios para ocultá-los no kanban. Registos já nesse estágio mantêm-se
                  até serem movidos.
                </p>
                <ul className="flex flex-col gap-2">
                  {pipeline.estagios.map((est) => (
                    <li
                      key={est.slug}
                      className="flex items-center gap-3 rounded-xl border px-3.5 py-3"
                      style={{
                        borderColor: est.ativo ? `${est.cor}55` : "#30363d",
                        background: est.ativo ? `${est.cor}0c` : "#161b22",
                      }}
                    >
                      <span
                        className="h-8 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: est.cor }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-[#e6edf3]">{est.label}</p>
                        <p className="font-mono text-[10px] text-[#8b949e]">{est.slug}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
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
                    </li>
                  ))}
                </ul>

                <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-3">
                  <p className="mb-2 text-xs font-bold text-[#e6edf3]">Novo estágio</p>
                  <div className="flex flex-col gap-2">
                    <input
                      value={novoSlug}
                      onChange={(e) => setNovoSlug(e.target.value)}
                      placeholder="slug (ex: pre_analise)"
                      className="rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#e6edf3]"
                    />
                    <input
                      value={novoLabel}
                      onChange={(e) => setNovoLabel(e.target.value)}
                      placeholder="Nome exibido"
                      className="rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#e6edf3]"
                    />
                    <button
                      type="button"
                      onClick={() => void adicionarEstagio()}
                      className="rounded-lg px-3 py-2 text-sm font-bold"
                      style={{ background: "#003b26", color: "#c9a24a" }}
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
