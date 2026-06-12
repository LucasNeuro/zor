"use client";

import type { ReactNode } from "react";
import { Brain, Loader2, RefreshCw, Sparkles } from "lucide-react";
import type { TenantConhecimentoAnaliseNegocio } from "@/lib/hub/tenant-conhecimento-rag";

type Props = {
  analise: TenantConhecimentoAnaliseNegocio | null;
  geradoEm: string | null;
  documentosIndexados: number;
  desatualizada: boolean;
  loading: boolean;
  generating: boolean;
  erro?: string;
  onGerar: () => void;
};

function fmtData(iso?: string | null): string {
  if (!iso?.trim()) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function confiancaLabel(c: TenantConhecimentoAnaliseNegocio["confianca"]): string {
  if (c === "alta") return "Alta confiança";
  if (c === "baixa") return "Baixa confiança";
  return "Confiança média";
}

function confiancaCores(c: TenantConhecimentoAnaliseNegocio["confianca"]) {
  if (c === "alta") return { bg: "#eefbf1", border: "#cdecd5", text: "#2f7a43" };
  if (c === "baixa") return { bg: "#fff8e8", border: "#f0dfa8", text: "#8a6d1a" };
  return { bg: "#eef6ff", border: "#cbe1ff", text: "#2e67b1" };
}

function SectionGroup({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="border-b border-[#dcebd8] pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-[#3f9848]">{title}</h3>
        {description ? <p className="mt-1 text-xs text-[#5d7a67]">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function SectionCard({
  title,
  children,
  accent,
}: {
  title: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: accent ? "#b8e8c0" : "#dcebd8",
        background: accent ? "#f3fbf4" : "#fff",
      }}
    >
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: "#5d7a67" }}>
        {title}
      </h4>
      <div className="text-sm leading-relaxed" style={{ color: "#1e3a23" }}>
        {children}
      </div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-[#89a095]">—</p>;
  return (
    <ul className="m-0 list-disc space-y-1.5 pl-4">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function CrmConhecimentoAnalisePanel({
  analise,
  geradoEm,
  documentosIndexados,
  desatualizada,
  loading,
  generating,
  erro,
  onGerar,
}: Props) {
  if (loading) {
    return (
      <div className="flex h-56 items-center justify-center px-5 py-8">
        <Loader2 size={24} className="animate-spin text-[#3f9848]" />
      </div>
    );
  }

  if (documentosIndexados === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <Brain size={32} className="mx-auto text-[#89a095]" />
        <p className="mt-3 text-sm font-semibold text-[#0b2210]">Análise do negócio</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#5d7a67]">
          Envie e indexe pelo menos um documento. Depois a IA consolida o perfil da empresa para orientar cargos e
          agentes.
        </p>
      </div>
    );
  }

  const conf = analise ? confiancaCores(analise.confianca) : null;

  return (
    <div className="px-5 py-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: "#eefbf1", border: "1px solid #cdecd5" }}
          >
            <Sparkles size={18} className="text-[#3f9848]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#0b2210]">Análise IA do negócio</h2>
            <p className="mt-1 text-xs text-[#5d7a67]">
              {geradoEm
                ? `Gerada em ${fmtData(geradoEm)} · ${documentosIndexados} documento(s) indexado(s)`
                : `${documentosIndexados} documento(s) prontos para análise`}
            </p>
            {desatualizada && analise ? (
              <p className="mt-1 text-xs font-semibold text-[#8a6d1a]">
                Há documentos novos desde a última análise — atualize para refletir o negócio atual.
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onGerar}
          disabled={generating}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold disabled:opacity-60"
          style={{ background: "#0b1f10", color: "#92ff00" }}
        >
          {generating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {generating ? "A analisar…" : analise ? "Atualizar análise" : "Gerar análise"}
        </button>
      </div>

      {erro ? (
        <p className="mb-4 rounded-xl border border-[#f0c0bd] bg-[#fff2f1] px-3 py-2 text-sm text-[#c0392b]">{erro}</p>
      ) : null}

      {!analise ? (
        <div
          className="rounded-xl border border-dashed px-4 py-8 text-center"
          style={{ borderColor: "#cdecd5", background: "#f8fcf6" }}
        >
          <p className="text-sm text-[#5d7a67]">
            Os documentos já foram processados. Clique em <strong>Gerar análise</strong> para a IA sintetizar o perfil do
            negócio.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <SectionGroup title="Síntese executiva" description="Visão geral do negócio inferida dos documentos indexados.">
            <div
              className="rounded-xl border px-4 py-4"
              style={{ borderColor: "#b8e8c0", background: "linear-gradient(135deg, #f3fbf4 0%, #fff 100%)" }}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {conf ? (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: conf.bg, border: `1px solid ${conf.border}`, color: conf.text }}
                  >
                    {confiancaLabel(analise.confianca)}
                  </span>
                ) : null}
                {analise.modelo_negocio ? (
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                    style={{ background: "#eef6ff", border: "1px solid #cbe1ff", color: "#2e67b1" }}
                  >
                    {analise.modelo_negocio}
                  </span>
                ) : null}
              </div>
              <p className="text-sm leading-relaxed text-[#0b2210]">{analise.sintese || analise.perfil_empresa}</p>
              {analise.proposta_valor ? (
                <p className="mt-3 text-sm text-[#5d7a67]">
                  <span className="font-semibold text-[#1e4a24]">Proposta: </span>
                  {analise.proposta_valor}
                </p>
              ) : null}
            </div>
          </SectionGroup>

          <SectionGroup title="Identidade do negócio" description="O que a empresa é e como opera.">
            <div className="grid gap-3 md:grid-cols-2">
              <SectionCard title="Nicho" accent>
                <p>{analise.nicho || "—"}</p>
              </SectionCard>
              <SectionCard title="Perfil da empresa">
                <p>{analise.perfil_empresa || "—"}</p>
              </SectionCard>
              <SectionCard title="Tom de voz">
                <p>{analise.tom_voz || "—"}</p>
              </SectionCard>
              <SectionCard title="Segmentos">
                <BulletList items={analise.segmentos} />
              </SectionCard>
            </div>
          </SectionGroup>

          <SectionGroup title="Mercado e oferta" description="Para quem vende e o que entrega.">
            <div className="grid gap-3 md:grid-cols-2">
              <SectionCard title="Público-alvo" accent>
                <p>{analise.publico_alvo || "—"}</p>
              </SectionCard>
              <SectionCard title="Produtos e serviços">
                <BulletList items={analise.produtos_servicos} />
              </SectionCard>
              <SectionCard title="Diferenciais" accent>
                <BulletList items={analise.diferenciais} />
              </SectionCard>
            </div>
          </SectionGroup>

          <SectionGroup
            title="Agentes IA e lacunas"
            description="Oportunidades de automação e o que ainda falta na base documental."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <SectionCard title="Oportunidades para agentes IA" accent>
                <BulletList items={analise.oportunidades_ia} />
              </SectionCard>
              <SectionCard title="Lacunas na base documental">
                <BulletList items={analise.lacunas_conhecimento} />
              </SectionCard>
              <SectionCard title="Recomendações">
                <BulletList items={analise.recomendacoes} />
              </SectionCard>
            </div>
          </SectionGroup>
        </div>
      )}
    </div>
  );
}
