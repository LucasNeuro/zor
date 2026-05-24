"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { EmptyState } from "@/components/crm/EmptyState";
import { CadastroFiltrosBar } from "@/components/crm/cadastro/CadastroFiltrosBar";
import { CadastroListaTable } from "@/components/crm/cadastro/CadastroListaTable";
import { EMPRESA_SEGMENTOS } from "@/lib/crm/empresa-cadastro";
import { AREA_ATUACAO_SELECT_OPTIONS } from "@/lib/crm/areas-atuacao";
import { MERCADOS_PREFIXO_OPTIONS } from "@/lib/crm/negocio-cadastro";
import {
  colunasEmpresaLista,
  colunasPessoaLista,
  type EmpresaListaRow,
  type PessoaListaRow,
} from "@/lib/crm/cadastro-list-columns";
import {
  colunasParceiroLista,
  ESTAGIO_CAPTACAO_LABEL,
} from "@/lib/crm/parceiro-list-columns";
import { crmQueryKeys } from "@/lib/crm/crm-query-keys";
import { prependPessoaListaCache } from "@/lib/crm/cadastro-cache-update";
import type { HubPessoaRow } from "@/lib/crm/hub-pessoas-compat";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { CrmTelefoneCell } from "@/components/crm/CrmTelefoneCell";
import {
  useCrmEmpresasList,
  useCrmParceirosList,
  useCrmPessoasList,
  type ParceiroListaRow,
} from "@/hooks/useCrmListQueries";
import { isCrmListInitialLoad } from "@/hooks/useCrmListQueryUi";
import { useCrmHeaderSlotConfig } from "@/hooks/useCrmHeaderSlotConfig";

const CadastroWizard = dynamic(
  () =>
    import("@/components/crm/cadastro/CadastroWizard").then((m) => ({
      default: m.CadastroWizard,
    })),
  { ssr: false }
);
const CadastroContactoSideover = dynamic(
  () =>
    import("@/components/crm/cadastro/CadastroContactoSideover").then((m) => ({
      default: m.CadastroContactoSideover,
    })),
  { ssr: false }
);
const CadastroEmpresaSideover = dynamic(
  () =>
    import("@/components/crm/cadastro/CadastroEmpresaSideover").then((m) => ({
      default: m.CadastroEmpresaSideover,
    })),
  { ssr: false }
);
const ParceiroLinkWizard = dynamic(
  () =>
    import("@/components/crm/parceiros/ParceiroLinkWizard").then((m) => ({
      default: m.ParceiroLinkWizard,
    })),
  { ssr: false }
);

const COLUNAS_PESSOAS = colunasPessoaLista();
const COLUNAS_EMPRESAS = colunasEmpresaLista();
const COLUNAS_PARCEIROS = colunasParceiroLista();

type RegistoId = "contactos" | "empresas" | "parceiros";
type SideoverMode = "view" | "edit" | null;

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

const ORIGENS_PESSOA = [
  { value: "", label: "Todas origens" },
  { value: "crm_manual", label: "CRM manual" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "site", label: "Site" },
  { value: "indicacao", label: "Indicação" },
  { value: "outro", label: "Outro" },
];

const REGISTO_OPTIONS = [
  { value: "contactos", label: "Cadastros (PF/PJ)" },
  { value: "empresas", label: "Empresas" },
  { value: "parceiros", label: "Parceiros" },
];

const STATUS_PARCEIRO_OPTIONS = [
  { value: "", label: "Todos status" },
  { value: "captacao", label: "Captação" },
  { value: "em_homologacao", label: "Homologação" },
  { value: "homologado", label: "Homologados" },
];

function registoFromSearchParams(sp: URLSearchParams): RegistoId {
  const raw = sp.get("registo") || sp.get("tab");
  if (raw === "empresas" || raw === "parceiros") return raw;
  return "contactos";
}

function actorFromUser(user: User | null) {
  if (!user) return {};
  const meta = user.user_metadata as { name?: string } | undefined;
  return {
    id: user.id,
    email: user.email ?? undefined,
    name: meta?.name?.trim() || user.email?.split("@")[0],
  };
}

export default function CadastroPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const filtroRegisto = registoFromSearchParams(searchParams);

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [busca, setBusca] = useState("");
  const buscaDebounced = useDebouncedValue(busca, 320);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroUf, setFiltroUf] = useState("");
  const [filtroOrigem, setFiltroOrigem] = useState("");
  const [filtroArea, setFiltroArea] = useState("");
  const [filtroSegmento, setFiltroSegmento] = useState("");
  const [filtroMercado, setFiltroMercado] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState("");
  const [filtroStatusParceiro, setFiltroStatusParceiro] = useState("");
  const [filtroEstagioParceiro, setFiltroEstagioParceiro] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [excluindoMassa, setExcluindoMassa] = useState(false);
  const [erroMassa, setErroMassa] = useState("");
  const [sucessoCadastro, setSucessoCadastro] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [parceiroWizardOpen, setParceiroWizardOpen] = useState(false);
  const [tipoWizard, setTipoWizard] = useState<"PF" | "PJ">("PF");

  const [contactoId, setContactoId] = useState<string | null>(null);
  const [contactoMode, setContactoMode] = useState<SideoverMode>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [empresaMode, setEmpresaMode] = useState<SideoverMode>(null);

  const pessoasFiltros = {
    busca: buscaDebounced,
    tipo_pessoa: filtroTipo,
    estado: filtroUf,
    origem: filtroOrigem,
    area_atuacao: filtroArea,
  };
  const empresasFiltros = {
    busca: buscaDebounced,
    segmento: filtroSegmento,
    prefixo_mercado: filtroMercado,
    estado: filtroUf,
    ativo: filtroAtivo,
  };

  const pessoasQuery = useCrmPessoasList(pessoasFiltros, filtroRegisto === "contactos");
  const empresasQuery = useCrmEmpresasList(empresasFiltros, filtroRegisto === "empresas");
  const parceirosQuery = useCrmParceirosList(filtroRegisto === "parceiros");

  const pessoas = (pessoasQuery.data ?? []) as PessoaListaRow[];
  const empresas = (empresasQuery.data ?? []) as EmpresaListaRow[];
  const parceirosTodos: ParceiroListaRow[] = parceirosQuery.data ?? [];

  const parceirosFiltrados = useMemo(() => {
    return parceirosTodos.filter((p) => {
      if (filtroStatusParceiro && p.status !== filtroStatusParceiro) return false;
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
      if (filtroEstagioParceiro) {
        const est = p.hub_parceiros_captacao?.estagio || "interessado";
        if (est !== filtroEstagioParceiro) return false;
      }
      return true;
    });
  }, [
    parceirosTodos,
    filtroStatusParceiro,
    buscaDebounced,
    filtroUf,
    filtroMercado,
    filtroEstagioParceiro,
  ]);

  const pessoasCarregando = isCrmListInitialLoad(pessoasQuery);
  const empresasCarregando = isCrmListInitialLoad(empresasQuery);
  const parceirosCarregando = isCrmListInitialLoad(parceirosQuery);

  const actor = actorFromUser(authUser);

  useEffect(() => {
    setSelecionados(new Set());
  }, [
    filtroRegisto,
    buscaDebounced,
    filtroTipo,
    filtroUf,
    filtroOrigem,
    filtroArea,
    filtroSegmento,
    filtroMercado,
    filtroAtivo,
    filtroStatusParceiro,
    filtroEstagioParceiro,
  ]);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setAuthUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (searchParams.get("convidar") === "1" && filtroRegisto === "parceiros") {
      setParceiroWizardOpen(true);
      const p = new URLSearchParams(searchParams.toString());
      p.delete("convidar");
      p.delete("tab");
      const q = p.toString();
      router.replace(q ? `/crm/cadastro?${q}` : "/crm/cadastro?registo=parceiros");
    }
  }, [searchParams, router, filtroRegisto]);

  function setRegisto(id: RegistoId) {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("tab");
    p.delete("convidar");
    if (id === "contactos") p.delete("registo");
    else p.set("registo", id);
    const q = p.toString();
    router.replace(q ? `/crm/cadastro?${q}` : "/crm/cadastro");
    setContactoId(null);
    setContactoMode(null);
    setEmpresaId(null);
    setEmpresaMode(null);
    setSelecionados(new Set());
    setErroMassa("");
  }

  const filtrosSelects = useMemo(() => {
    const registo = {
      id: "registo",
      value: filtroRegisto,
      onChange: (v: string) => setRegisto(v as RegistoId),
      label: "Tipo de registo",
      minWidth: "12rem",
      options: REGISTO_OPTIONS,
    };

    const uf = {
      id: "uf",
      value: filtroUf,
      onChange: setFiltroUf,
      label: "UF",
      options: [{ value: "", label: "Todas UFs" }, ...UFS.map((u) => ({ value: u, label: u }))],
    };

    if (filtroRegisto === "empresas") {
      return [
        registo,
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
          id: "segmento",
          value: filtroSegmento,
          onChange: setFiltroSegmento,
          label: "Segmento",
          options: [
            { value: "", label: "Todos segmentos" },
            ...EMPRESA_SEGMENTOS.map((s) => ({ value: s.value, label: s.label })),
          ],
        },
        uf,
        {
          id: "ativo",
          value: filtroAtivo,
          onChange: setFiltroAtivo,
          label: "Ativo",
          options: [
            { value: "", label: "Ativos e inativos" },
            { value: "true", label: "Só ativos" },
            { value: "false", label: "Só inativos" },
          ],
        },
      ];
    }

    if (filtroRegisto === "parceiros") {
      const estagioOpts = [
        { value: "", label: "Todos estágios" },
        ...Object.entries(ESTAGIO_CAPTACAO_LABEL).map(([value, label]) => ({ value, label })),
      ];
      return [
        registo,
        {
          id: "status",
          value: filtroStatusParceiro,
          onChange: (v: string) => {
            setFiltroStatusParceiro(v);
            if (v !== "captacao" && v !== "") setFiltroEstagioParceiro("");
          },
          label: "Status",
          options: STATUS_PARCEIRO_OPTIONS,
        },
        ...(filtroStatusParceiro === "" || filtroStatusParceiro === "captacao"
          ? [
              {
                id: "estagio",
                value: filtroEstagioParceiro,
                onChange: setFiltroEstagioParceiro,
                label: "Estágio captação",
                minWidth: "11rem",
                options: estagioOpts,
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
        uf,
      ];
    }

    return [
      registo,
      {
        id: "tipo",
        value: filtroTipo,
        onChange: setFiltroTipo,
        label: "Tipo",
        options: [
          { value: "", label: "PF e PJ" },
          { value: "PF", label: "PF" },
          { value: "PJ", label: "PJ" },
        ],
      },
      uf,
      {
        id: "origem",
        value: filtroOrigem,
        onChange: setFiltroOrigem,
        label: "Origem",
        options: ORIGENS_PESSOA,
      },
      {
        id: "area",
        value: filtroArea,
        onChange: setFiltroArea,
        label: "Área",
        minWidth: "11rem",
        options: [
          { value: "", label: "Todas áreas" },
          ...AREA_ATUACAO_SELECT_OPTIONS.filter((o) => o.value).map((o) => ({
            value: o.value,
            label: o.label,
          })),
        ],
      },
    ];
  }, [
    filtroRegisto,
    filtroTipo,
    filtroUf,
    filtroOrigem,
    filtroArea,
    filtroSegmento,
    filtroMercado,
    filtroAtivo,
    filtroStatusParceiro,
    filtroEstagioParceiro,
  ]);

  const buscaPlaceholder = useMemo(() => {
    if (filtroRegisto === "empresas") {
      return "Buscar razão social, código, CNPJ ou email…";
    }
    if (filtroRegisto === "parceiros") {
      return "Buscar nome, código, telefone, email ou especialidade…";
    }
    return "Buscar nome, código, CPF/CNPJ, email ou telefone…";
  }, [filtroRegisto]);

  const headerActions = useMemo(
    () =>
      filtroRegisto === "parceiros" ? (
        <button
          type="button"
          onClick={() => setParceiroWizardOpen(true)}
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
          + Convidar parceiro
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            setTipoWizard(
              filtroRegisto === "empresas" || filtroTipo === "PJ" ? "PJ" : "PF"
            );
            setWizardOpen(true);
          }}
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
          + Novo cadastro
        </button>
      ),
    [filtroRegisto, filtroTipo]
  );

  useCrmHeaderSlotConfig({
    path: pathname,
    actions: headerActions,
  });

  function limparFiltros() {
    setBusca("");
    setFiltroTipo("");
    setFiltroUf("");
    setFiltroOrigem("");
    setFiltroArea("");
    setFiltroSegmento("");
    setFiltroMercado("");
    setFiltroAtivo("");
    setFiltroStatusParceiro("");
    setFiltroEstagioParceiro("");
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

  async function excluirSelecionados() {
    const ids = [...selecionados];
    if (ids.length === 0 || filtroRegisto === "parceiros") return;
    const label = filtroRegisto === "empresas" ? "empresa(s)" : "cadastro(s)";
    if (!window.confirm(`Excluir ${ids.length} ${label}? Esta ação não pode ser desfeita.`)) return;

    setExcluindoMassa(true);
    setErroMassa("");
    try {
      const res = await fetch("/api/crm/cadastro/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({
          tipo: filtroRegisto === "empresas" ? "empresa" : "pessoa",
          ids,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        excluidos?: number;
        falhas?: number;
        erros?: { id: string; error: string }[];
        error?: string;
      };
      if (!res.ok) {
        setErroMassa(data.error || "Falha na exclusão em massa.");
        return;
      }
      if ((data.falhas ?? 0) > 0) {
        const msg = data.erros?.map((e) => e.error).join(" · ") || "Alguns registos não foram excluídos.";
        setErroMassa(msg);
      }
      setSelecionados(new Set());
      if (filtroRegisto === "empresas") invalidarEmpresas();
      else invalidarPessoas();
    } catch {
      setErroMassa("Erro de rede ao excluir.");
    } finally {
      setExcluindoMassa(false);
    }
  }

  function invalidarPessoas() {
    void queryClient.invalidateQueries({ queryKey: [...crmQueryKeys.all, "pessoas"] });
  }

  function invalidarEmpresas() {
    void queryClient.invalidateQueries({ queryKey: [...crmQueryKeys.all, "empresas"] });
  }

  function aposSalvar(result?: {
    pessoa_id: string;
    codigo_pessoa?: string | null;
    codigo_lead?: string | null;
    aviso?: string | null;
    pessoa?: Record<string, unknown>;
  }) {
    setWizardOpen(false);
    const codigos = [result?.codigo_pessoa, result?.codigo_lead].filter(Boolean).join(" · ");
    let msg = codigos
      ? `Cadastro gravado (${codigos}).`
      : "Cadastro gravado com sucesso.";
    if (result?.aviso) msg += ` ${result.aviso}`;
    setSucessoCadastro(msg);
    setBusca("");

    if (result?.pessoa && filtroRegisto === "contactos") {
      prependPessoaListaCache(queryClient, pessoasFiltros, result.pessoa as HubPessoaRow);
    } else if (filtroRegisto === "empresas") {
      void queryClient.invalidateQueries({
        queryKey: [...crmQueryKeys.all, "empresas"],
        refetchType: "none",
      });
    } else {
      void queryClient.invalidateQueries({
        queryKey: [...crmQueryKeys.all, "pessoas"],
        refetchType: "none",
      });
    }
  }

  const abrirParceiro = useCallback(
    (p: ParceiroListaRow) => {
      router.push(`/crm/parceiros/${p.id}`);
    },
    [router]
  );

  const pessoaPrimaryColumn = useMemo(
    () => ({
      title: (p: PessoaListaRow) => String(p.nome),
      subtitle: (p: PessoaListaRow) => (
        <>
          {p.codigo != null && String(p.codigo).trim() !== "" && (
            <p className="mt-0.5 font-mono text-[10px] text-[#c9a24a]/90">{String(p.codigo)}</p>
          )}
          {p.telefone != null && String(p.telefone).trim() !== "" && (
            <div className="mt-0.5">
              <CrmTelefoneCell telefone={String(p.telefone)} compact />
            </div>
          )}
        </>
      ),
    }),
    []
  );

  const empresaPrimaryColumn = useMemo(
    () => ({
      title: (e: EmpresaListaRow) => String(e.razao_social),
      subtitle: (e: EmpresaListaRow) => (
        <>
          {e.codigo != null && String(e.codigo).trim() !== "" && (
            <p className="mt-0.5 font-mono text-[10px] text-[#c9a24a]/90">{String(e.codigo)}</p>
          )}
          {e.cnpj != null && String(e.cnpj).trim() !== "" && (
            <p className="text-xs text-[#8b949e]">{String(e.cnpj)}</p>
          )}
        </>
      ),
    }),
    []
  );

  const parceiroPrimaryColumn = useMemo(
    () => ({
      label: (p: ParceiroListaRow) => p.nome,
      title: (p: ParceiroListaRow) => p.nome,
      meta: (p: ParceiroListaRow) =>
        p.recebe_leads ? (
          <span
            className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ background: "#003b2630", color: "#34d399" }}
          >
            Recebe leads
          </span>
        ) : null,
    }),
    []
  );

  const parceirosHomologados = parceirosTodos.filter((p) => p.status === "homologado").length;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#0d1117",
        minHeight: 0,
      }}
    >
      {sucessoCadastro && (
        <div
          role="status"
          style={{
            margin: "0 24px",
            padding: "10px 14px",
            borderRadius: 8,
            background: "rgba(34, 197, 94, 0.12)",
            border: "1px solid rgba(34, 197, 94, 0.35)",
            color: "#3fb950",
            fontSize: 13,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span>{sucessoCadastro}</span>
          <button
            type="button"
            onClick={() => setSucessoCadastro(null)}
            style={{
              border: "none",
              background: "transparent",
              color: "#8b949e",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
            }}
            aria-label="Fechar aviso"
          >
            ×
          </button>
        </div>
      )}

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
          buscaPlaceholder={buscaPlaceholder}
          onLimpar={limparFiltros}
          selects={filtrosSelects}
          trailing={
            filtroRegisto === "parceiros" && parceirosTodos.length > 0 ? (
              <span className="text-xs text-[#6e7781]">
                {parceirosTodos.length} cadastrados · {parceirosHomologados} homologados
              </span>
            ) : undefined
          }
        />

        {selecionados.size > 0 && filtroRegisto !== "parceiros" && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#c9a24a]/30 bg-[#c9a24a]/10 px-4 py-2.5">
            <span className="text-sm font-semibold text-[#c9a24a]">
              {selecionados.size} selecionado(s)
            </span>
            <button
              type="button"
              disabled={excluindoMassa}
              onClick={() => void excluirSelecionados()}
              className="min-h-9 rounded-lg bg-[#EF4444] px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {excluindoMassa ? "Excluindo…" : "Excluir selecionados"}
            </button>
            <button
              type="button"
              onClick={() => setSelecionados(new Set())}
              className="text-xs font-semibold text-[#8b949e] hover:text-white"
            >
              Limpar seleção
            </button>
          </div>
        )}

        {erroMassa && (
          <p className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 px-3 py-2 text-xs text-[#fca5a5]">
            {erroMassa}
          </p>
        )}

        {parceirosQuery.isError && filtroRegisto === "parceiros" && (
          <p className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 px-3 py-2 text-xs text-[#fca5a5]">
            {parceirosQuery.error instanceof Error
              ? parceirosQuery.error.message
              : "Não foi possível carregar parceiros."}
          </p>
        )}

        {filtroRegisto === "contactos" && (
          <>
            {pessoasCarregando && (
              <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando…</p>
            )}
            {!pessoasCarregando && pessoas.length === 0 && (
              <EmptyState message="Nenhum cadastro. Use «Novo cadastro» ou ajuste os filtros." />
            )}
            {!pessoasCarregando && pessoas.length > 0 && (
              <CadastroListaTable<PessoaListaRow>
                rows={pessoas}
                columns={COLUNAS_PESSOAS}
                selectedIds={selecionados}
                onToggleRow={toggleSelecao}
                onToggleAll={() => toggleSelecionarTodos(pessoas.map((p) => p.id))}
                stickyPrimary
                nameColWidth={280}
                primaryColumn={pessoaPrimaryColumn}
                onRowClick={(p) => {
                  setContactoId(p.id);
                  setContactoMode("view");
                }}
                onView={(p) => {
                  setContactoId(p.id);
                  setContactoMode("view");
                }}
                onEdit={(p) => {
                  setContactoId(p.id);
                  setContactoMode("edit");
                }}
              />
            )}
          </>
        )}

        {filtroRegisto === "empresas" && (
          <>
            {empresasCarregando && (
              <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando…</p>
            )}
            {!empresasCarregando && empresas.length === 0 && (
              <EmptyState message="Nenhuma empresa. Use «Novo cadastro» (PJ) ou ajuste os filtros." />
            )}
            {!empresasCarregando && empresas.length > 0 && (
              <CadastroListaTable<EmpresaListaRow>
                rows={empresas}
                columns={COLUNAS_EMPRESAS}
                selectedIds={selecionados}
                onToggleRow={toggleSelecao}
                onToggleAll={() => toggleSelecionarTodos(empresas.map((e) => e.id))}
                stickyPrimary
                nameColWidth={280}
                primaryColumn={empresaPrimaryColumn}
                onRowClick={(e) => {
                  setEmpresaId(e.id);
                  setEmpresaMode("view");
                }}
                onView={(e) => {
                  setEmpresaId(e.id);
                  setEmpresaMode("view");
                }}
                onEdit={(e) => {
                  setEmpresaId(e.id);
                  setEmpresaMode("edit");
                }}
              />
            )}
          </>
        )}

        {filtroRegisto === "parceiros" && (
          <>
            {parceirosCarregando && (
              <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando…</p>
            )}
            {!parceirosCarregando && parceirosFiltrados.length === 0 && (
              <EmptyState message="Nenhum parceiro com estes filtros. Use «+ Convidar parceiro» para gerar um link." />
            )}
            {!parceirosCarregando && parceirosFiltrados.length > 0 && (
              <CadastroListaTable<ParceiroListaRow>
                rows={parceirosFiltrados}
                columns={COLUNAS_PARCEIROS}
                selectedIds={selecionados}
                onToggleRow={toggleSelecao}
                onToggleAll={() => toggleSelecionarTodos(parceirosFiltrados.map((p) => p.id))}
                stickyPrimary
                nameColWidth={240}
                primaryColumn={parceiroPrimaryColumn}
                onRowClick={abrirParceiro}
                onView={abrirParceiro}
              />
            )}
          </>
        )}
      </div>

      {wizardOpen && (
        <CadastroWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          tipoInicial={tipoWizard}
          onSaved={aposSalvar}
        />
      )}

      {parceiroWizardOpen && (
        <ParceiroLinkWizard
          open={parceiroWizardOpen}
          onClose={() => setParceiroWizardOpen(false)}
        />
      )}

      {contactoId && (
        <CadastroContactoSideover
          pessoaId={contactoId}
          mode={contactoMode}
          actor={actor}
          onClose={() => {
            setContactoId(null);
            setContactoMode(null);
          }}
          onDeleted={() => {
            setContactoId(null);
            setContactoMode(null);
            invalidarPessoas();
          }}
          onSaved={invalidarPessoas}
          onStartEdit={() => setContactoMode("edit")}
          onBackToView={() => setContactoMode("view")}
        />
      )}

      {empresaId && (
        <CadastroEmpresaSideover
          empresaId={empresaId}
          mode={empresaMode}
          actor={actor}
          onClose={() => {
            setEmpresaId(null);
            setEmpresaMode(null);
          }}
          onDeleted={() => {
            setEmpresaId(null);
            setEmpresaMode(null);
            invalidarEmpresas();
          }}
          onSaved={invalidarEmpresas}
          onStartEdit={() => setEmpresaMode("edit")}
          onBackToView={() => setEmpresaMode("view")}
        />
      )}
    </div>
  );
}
