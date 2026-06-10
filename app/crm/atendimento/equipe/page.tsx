"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, Phone } from "lucide-react";
import type { CrmResizableColumn } from "@/components/crm/CrmResizableDataTable";
import {
  CrmRetrofitTablePanel,
  crmRetrofitPageXClass,
  crmTableIdBadge,
  crmTableStatusPill,
} from "@/components/crm/CrmRetrofitTablePanel";
import { CrmMetricCard, CrmMetricsGrid } from "@/components/crm/CrmMetricCard";
import {
  sparklineFromCounts,
  sparklineFromSeed,
  trendLabel,
  trendPositive,
} from "@/lib/crm/metric-visuals";
import { CrmStickyPageHeader } from "@/components/crm/CrmStickyPageHeader";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { crmHeaderPrimaryBtnStyle } from "@/lib/crm/crm-list-pill-styles";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import type { AtendenteCrm } from "@/lib/crm/atendentes-crm";

const AtendenteEditSideover = dynamic(
  () =>
    import("@/components/crm/atendimento/AtendenteEditSideover").then((m) => ({
      default: m.AtendenteEditSideover,
    })),
  { ssr: false }
);

function formatData(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function metadataResumo(meta: Record<string, unknown> | undefined) {
  if (!meta || Object.keys(meta).length === 0) return "—";
  const s = JSON.stringify(meta);
  return s.length > 40 ? `${s.slice(0, 40)}…` : s;
}

export default function EquipeAtendimentoPage() {
  const pathname = usePathname();
  const { setSlot } = useCrmHeaderSlot();
  const narrow = useNarrowViewport();
  const isMobile = narrow !== false;

  const [atendentes, setAtendentes] = useState<AtendenteCrm[]>([]);
  const [loading, setLoading] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sideoverOpen, setSideoverOpen] = useState(false);
  const [editAtendente, setEditAtendente] = useState<AtendenteCrm | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const res = await fetch("/api/crm/atendentes?ativos=false", {
        headers: internalApiHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(typeof json.error === "string" ? json.error : "Erro ao carregar equipe.");
        setAtendentes([]);
      } else {
        setAtendentes((json.atendentes ?? []) as AtendenteCrm[]);
        setAviso(typeof json.aviso === "string" ? json.aviso : null);
      }
    } catch {
      setErro("Erro de rede ao carregar equipe.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const abrirNovo = useCallback(() => {
    setEditAtendente(null);
    setSideoverOpen(true);
  }, []);

  const abrirEditar = useCallback((a: AtendenteCrm) => {
    setEditAtendente(a);
    setSideoverOpen(true);
  }, []);

  const fecharSideover = useCallback(() => {
    setSideoverOpen(false);
    setEditAtendente(null);
  }, []);

  async function excluirAtendente(a: AtendenteCrm) {
    if (!window.confirm(`Desativar ${a.nome}? Pode reativar depois na edição.`)) return;
    setErro("");
    try {
      const res = await fetch(`/api/crm/atendentes/${encodeURIComponent(a.id)}`, {
        method: "DELETE",
        credentials: "include",
        headers: internalApiHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(typeof json.error === "string" ? json.error : "Não foi possível desativar.");
        return;
      }
      await carregar();
    } catch {
      setErro("Erro de rede ao desativar.");
    }
  }

  const botaoNovo = useMemo(
    () => (
      <button type="button" onClick={abrirNovo} style={crmHeaderPrimaryBtnStyle()}>
        + Novo atendente
      </button>
    ),
    [abrirNovo]
  );

  useEffect(() => {
    if (isMobile) {
      setSlot(null);
      return;
    }
    setSlot({
      path: pathname,
      title: "Equipe",
      subtitle: `${atendentes.filter((a) => a.ativo).length} ativos · ${atendentes.length} cadastrados`,
      actions: botaoNovo,
    });
    return () => setSlot(null);
  }, [pathname, setSlot, atendentes, isMobile, botaoNovo]);

  const kpis = useMemo(() => {
    const ativos = atendentes.filter((a) => a.ativo).length;
    const inativos = atendentes.length - ativos;
    const comAgente = atendentes.filter((a) => a.agente_slug?.trim()).length;
    const comEmail = atendentes.filter((a) => a.email?.trim()).length;
    return { total: atendentes.length, ativos, inativos, comAgente, comEmail };
  }, [atendentes]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return atendentes;
    return atendentes.filter((a) => {
      return (
        a.nome.toLowerCase().includes(q) ||
        a.telefone.includes(q) ||
        (a.email || "").toLowerCase().includes(q) ||
        (a.cargo || "").toLowerCase().includes(q) ||
        (a.slug || "").toLowerCase().includes(q) ||
        (a.agente_slug || "").toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q)
      );
    });
  }, [atendentes, busca]);

  const colunas = useMemo((): CrmResizableColumn<AtendenteCrm>[] => {
    return [
      {
        id: "nome",
        label: "Nome",
        defaultWidth: 160,
        minWidth: 120,
        render: (a) => (
          <span className={`font-semibold ${a.ativo ? "text-[#0b2210]" : "text-[#6b8a76] line-through"}`}>
            {a.nome}
          </span>
        ),
      },
      {
        id: "telefone",
        label: "WhatsApp",
        defaultWidth: 150,
        minWidth: 120,
        render: (a) => (
          <span className="inline-flex items-center gap-1 tabular-nums text-[#0b2210]">
            <Phone size={12} className="text-[#5d7a67]" />
            {a.telefone}
          </span>
        ),
      },
      {
        id: "slug",
        label: "Slug",
        defaultWidth: 120,
        minWidth: 90,
        render: (a) => (a.slug ? crmTableIdBadge(a.slug, "green") : "—"),
      },
      {
        id: "cargo",
        label: "Cargo",
        defaultWidth: 110,
        minWidth: 80,
        render: (a) => a.cargo || "—",
      },
      {
        id: "agente",
        label: "Agente IA",
        defaultWidth: 120,
        minWidth: 90,
        render: (a) =>
          a.agente_slug ? (
            <span className="inline-flex items-center gap-1 text-[#0b2210]">
              <Bot size={12} className="text-[#5d7a67]" />
              {a.agente_slug}
            </span>
          ) : (
            "—"
          ),
      },
      {
        id: "email",
        label: "E-mail",
        defaultWidth: 200,
        minWidth: 140,
        render: (a) => (
          <span className="truncate text-[#0b2210]" title={a.email ?? undefined}>
            {a.email || "—"}
          </span>
        ),
      },
      {
        id: "status",
        label: "Status",
        defaultWidth: 88,
        minWidth: 72,
        align: "center",
        render: (a) => crmTableStatusPill(a.ativo ? "Ativo" : "Inativo", a.ativo),
      },
      {
        id: "metadata",
        label: "Metadata",
        defaultWidth: 140,
        minWidth: 100,
        render: (a) => (
          <span className="text-[#5d7a67]" title={JSON.stringify(a.metadata ?? {})}>
            {metadataResumo(a.metadata)}
          </span>
        ),
      },
      {
        id: "criado_em",
        label: "Criado em",
        defaultWidth: 112,
        minWidth: 100,
        render: (a) => formatData(a.criado_em),
      },
      {
        id: "atualizado_em",
        label: "Atualizado",
        defaultWidth: 112,
        minWidth: 100,
        render: (a) => formatData(a.atualizado_em),
      },
    ];
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8fcf6]">
      {isMobile ? (
        <CrmStickyPageHeader
          title="Equipe"
          description="Atendentes e vendedores para transferência de conversas."
          actions={botaoNovo}
        />
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={`flex flex-col gap-3 pb-4 pt-3 ${crmRetrofitPageXClass}`}>
          {aviso ? (
            <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">Configuração pendente no Supabase</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-900">{aviso}</p>
            </div>
          ) : null}
          {erro ? (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
              role="alert"
            >
              {erro}
            </div>
          ) : null}

          <CrmMetricsGrid cols={4}>
          <CrmMetricCard
            label="Equipe cadastrada"
            valor={kpis.total}
            tone="brand"
            sub="Atendentes e vendedores"
            sparkline={sparklineFromCounts([kpis.ativos, kpis.inativos, kpis.comAgente, kpis.comEmail, kpis.total])}
            loading={loading}
          />
          <CrmMetricCard
            label="Ativos"
            valor={kpis.ativos}
            tone="success"
            sub="Disponíveis para transferência"
            sparkline={sparklineFromSeed(kpis.ativos + 2)}
            trend={
              kpis.total > 0
                ? {
                    label: trendLabel(kpis.ativos, kpis.total) ?? "—",
                    positive: trendPositive(kpis.ativos, kpis.total),
                  }
                : undefined
            }
            loading={loading}
          />
          <CrmMetricCard
            label="Com agente IA"
            valor={kpis.comAgente}
            tone="success"
            sub="Vinculados a funcionário IA"
            progress={{
              value: kpis.comAgente,
              max: Math.max(kpis.total, 1),
              hint: `${kpis.comAgente} de ${kpis.total}`,
            }}
            loading={loading}
          />
          <CrmMetricCard
            label="Inativos"
            valor={kpis.inativos}
            tone="muted"
            sub="Fora das transferências"
            sparkline={sparklineFromSeed(kpis.inativos + 5)}
            trend={
              kpis.total > 0
                ? {
                    label: trendLabel(kpis.inativos, kpis.total) ?? "—",
                    positive: kpis.inativos === 0,
                  }
                : undefined
            }
            loading={loading}
          />
          </CrmMetricsGrid>

          {loading ? (
            <p className="py-8 text-center text-sm text-[#5d7a67]">A carregar equipe…</p>
          ) : (
            <CrmRetrofitTablePanel
            tableId="equipe-atendimento"
            columns={colunas}
            rows={filtrados}
            rowKey={(a) => a.id}
            emptyMessage="Nenhum atendente cadastrado. Use + Novo atendente para adicionar."
            footerSummary={`Exibindo ${filtrados.length} de ${atendentes.length} atendentes`}
            onRowClick={abrirEditar}
            onEditRow={abrirEditar}
            onDeleteRow={(a) => void excluirAtendente(a)}
            toolbar={{
              searchValue: busca,
              onSearchChange: setBusca,
              searchPlaceholder: "Buscar nome, telefone, slug ou cargo…",
              showAdvancedFilters,
              onToggleAdvancedFilters: () => setShowAdvancedFilters((v) => !v),
            }}
            exportConfig={{
              filename: "equipe-atendimento.csv",
              headers: [
                "Nome",
                "WhatsApp",
                "Slug",
                "Cargo",
                "Agente IA",
                "E-mail",
                "Status",
                "Metadata",
                "Criado em",
                "Atualizado",
              ],
              rowValues: (a) => [
                a.nome,
                a.telefone,
                a.slug || "",
                a.cargo || "",
                a.agente_slug || "",
                a.email || "",
                a.ativo ? "Ativo" : "Inativo",
                JSON.stringify(a.metadata ?? {}),
                formatData(a.criado_em),
                formatData(a.atualizado_em),
              ],
            }}
            />
          )}
        </div>
      </div>

      <AtendenteEditSideover
        open={sideoverOpen}
        atendente={editAtendente}
        onClose={fecharSideover}
        onSaved={() => void carregar()}
      />
    </div>
  );
}
