"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { BadgeCheck, ClipboardList, UserPlus } from "lucide-react";
import { CrmStickyTabs } from "@/components/crm/CrmStickyTabs";
import { EmptyState } from "@/components/crm/EmptyState";
import { CadastroFiltrosBar } from "@/components/crm/cadastro/CadastroFiltrosBar";
import { CadastroListaTable } from "@/components/crm/cadastro/CadastroListaTable";
import { ParceiroLinkWizard } from "@/components/crm/parceiros/ParceiroLinkWizard";
import { useCrmParceirosList, type ParceiroListaRow } from "@/hooks/useCrmListQueries";
import { useCrmHeaderSlotConfig } from "@/hooks/useCrmHeaderSlotConfig";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  colunasParceiroLista,
  ESTAGIO_CAPTACAO_LABEL,
} from "@/lib/crm/parceiro-list-columns";
import { MERCADOS_PREFIXO_OPTIONS } from "@/lib/crm/negocio-cadastro";

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

type AbaId = "captacao" | "homologacao" | "homologados";

const STATUS_POR_ABA: Record<AbaId, string> = {
  captacao: "captacao",
  homologacao: "em_homologacao",
  homologados: "homologado",
};

export default function ParceirosPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [aba, setAba] = useState<AbaId>("captacao");
  const [busca, setBusca] = useState("");
  const buscaDebounced = useDebouncedValue(busca, 320);
  const [filtroUf, setFiltroUf] = useState("");
  const [filtroMercado, setFiltroMercado] = useState("");
  const [filtroEstagio, setFiltroEstagio] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [wizardOpen, setWizardOpen] = useState(false);

  const parceirosQuery = useCrmParceirosList();
  const parceiros: ParceiroListaRow[] = parceirosQuery.data ?? [];
  const semDados =
    parceirosQuery.data === undefined && parceirosQuery.isPending;
  const erroLista =
    parceirosQuery.isError
      ? parceirosQuery.error instanceof Error
        ? parceirosQuery.error.message
        : "Não foi possível carregar a lista de parceiros."
      : null;

  useEffect(() => {
    if (searchParams.get("convidar") === "1") {
      setWizardOpen(true);
      const p = new URLSearchParams(searchParams.toString());
      p.delete("convidar");
      const q = p.toString();
      router.replace(q ? `/crm/parceiros?${q}` : "/crm/parceiros");
    }
  }, [searchParams, router]);

  useEffect(() => {
    setSelecionados(new Set());
  }, [aba, buscaDebounced, filtroUf, filtroMercado, filtroEstagio]);

  const filtrados = useMemo(() => {
    const statusAlvo = STATUS_POR_ABA[aba];
    return parceiros.filter((p) => {
      if (p.status !== statusAlvo) return false;
      if (buscaDebounced) {
        const q = buscaDebounced.toLowerCase();
        const match =
          p.nome.toLowerCase().includes(q) ||
          (p.codigo || "").toLowerCase().includes(q) ||
          p.telefone.includes(buscaDebounced.replace(/\D/g, "")) ||
          (p.email || "").toLowerCase().includes(q) ||
          (p.especialidade || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filtroUf && p.estado !== filtroUf) return false;
      if (filtroMercado && p.mercado !== filtroMercado) return false;
      if (aba === "captacao" && filtroEstagio) {
        const est = p.hub_parceiros_captacao?.estagio || "interessado";
        if (est !== filtroEstagio) return false;
      }
      return true;
    });
  }, [parceiros, aba, buscaDebounced, filtroUf, filtroMercado, filtroEstagio]);

  const contagens = useMemo(
    () => ({
      captacao: parceiros.filter((p) => p.status === "captacao").length,
      homologacao: parceiros.filter((p) => p.status === "em_homologacao").length,
      homologados: parceiros.filter((p) => p.status === "homologado").length,
    }),
    [parceiros]
  );

  const headerActions = useMemo(
    () => (
      <button
        type="button"
        onClick={() => setWizardOpen(true)}
        style={{
          background: "#003b26",
          color: "#c9a24a",
          border: "none",
          borderRadius: 8,
          padding: "10px 20px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        + Convidar
      </button>
    ),
    []
  );

  useCrmHeaderSlotConfig({
    path: pathname,
    actions: headerActions,
  });

  function limparFiltros() {
    setBusca("");
    setFiltroUf("");
    setFiltroMercado("");
    setFiltroEstagio("");
  }

  function toggleSelecao(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelecionarTodos(ids: string[]) {
    setSelecionados((prev) => {
      if (ids.length > 0 && ids.every((id) => prev.has(id))) return new Set();
      return new Set(ids);
    });
  }

  function abrirDetalhe(p: ParceiroListaRow) {
    router.push(`/crm/parceiros/${p.id}`);
  }

  const emptyMessages: Record<AbaId, string> = {
    captacao: "Nenhum parceiro em captação. Use «+ Convidar» para gerar um link de inscrição.",
    homologacao: "Nenhum parceiro em homologação no momento.",
    homologados: "Nenhum parceiro homologado ainda.",
  };

  const estagioOptions = [
    { value: "", label: "Todos estágios" },
    ...Object.entries(ESTAGIO_CAPTACAO_LABEL).map(([value, label]) => ({ value, label })),
  ];

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#f8fcf6",
        minHeight: 0,
      }}
    >
      <CrmStickyTabs
        activeId={aba}
        onChange={(id) => {
          setAba(id as AbaId);
          setFiltroEstagio("");
        }}
        tabs={[
          { id: "captacao", label: `Captação (${contagens.captacao})`, icon: UserPlus },
          { id: "homologacao", label: `Homologação (${contagens.homologacao})`, icon: ClipboardList },
          { id: "homologados", label: `Homologados (${contagens.homologados})`, icon: BadgeCheck },
        ]}
        scrollable
      />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          padding: "16px 24px 20px",
          gap: 12,
        }}
      >
        <CadastroFiltrosBar
          busca={busca}
          onBuscaChange={setBusca}
          buscaPlaceholder="Buscar nome, código, telefone, email ou especialidade…"
          onLimpar={limparFiltros}
          selects={[
            ...(aba === "captacao"
              ? [
                  {
                    id: "estagio",
                    value: filtroEstagio,
                    onChange: setFiltroEstagio,
                    label: "Estágio",
                    minWidth: "11rem",
                    options: estagioOptions,
                  },
                ]
              : []),
            {
              id: "mercado",
              value: filtroMercado,
              onChange: setFiltroMercado,
              label: "Mercado",
              options: [
                { value: "", label: "Todos mercados" },
                ...MERCADOS_PREFIXO_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
              ],
            },
            {
              id: "uf",
              value: filtroUf,
              onChange: setFiltroUf,
              label: "UF",
              options: [
                { value: "", label: "Todas UFs" },
                ...UFS.map((u) => ({ value: u, label: u })),
              ],
            },
          ]}
          trailing={
            <span className="text-xs text-[#6e7781]">
              {parceiros.length} cadastrados · {contagens.homologados} homologados
            </span>
          }
        />

        {erroLista && (
          <p className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 px-3 py-2 text-xs text-[#fca5a5]">
            {erroLista}
          </p>
        )}

        {selecionados.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#c9a24a]/30 bg-[#c9a24a]/10 px-4 py-2.5">
            <span className="text-sm font-semibold text-[#c9a24a]">
              {selecionados.size} selecionado(s)
            </span>
            <button
              type="button"
              onClick={() => setSelecionados(new Set())}
              className="text-xs font-semibold text-[#5d7a67] hover:text-white"
            >
              Limpar seleção
            </button>
          </div>
        )}

        {semDados && parceirosQuery.isPending && (
          <p style={{ color: "#5d7a67", fontSize: 13 }}>Carregando…</p>
        )}
        {!semDados && filtrados.length === 0 && (
          <EmptyState message={emptyMessages[aba]} />
        )}
        {!semDados && filtrados.length > 0 && (
          <CadastroListaTable<ParceiroListaRow>
            rows={filtrados}
            columns={colunasParceiroLista()}
            selectedIds={selecionados}
            onToggleRow={toggleSelecao}
            onToggleAll={() => toggleSelecionarTodos(filtrados.map((p) => p.id))}
            stickyPrimary
            nameColWidth={240}
            primaryColumn={{
              label: (p) => p.nome,
              title: (p) => p.nome,
              meta: (p) =>
                p.recebe_leads ? (
                  <span
                    className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ background: "#003b2630", color: "#34d399" }}
                  >
                    Recebe leads
                  </span>
                ) : null,
            }}
            onRowClick={abrirDetalhe}
            onView={abrirDetalhe}
          />
        )}
      </div>

      <ParceiroLinkWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
