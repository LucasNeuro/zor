"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  ExternalLink,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { CrmFerramentaBuiltinSideover } from "@/components/crm/CrmFerramentaBuiltinSideover";
import { CrmFerramentaCustomSideover } from "@/components/crm/CrmFerramentaCustomSideover";
import {
  CrmResizableDataTable,
  type CrmResizableColumn,
} from "@/components/crm/CrmResizableDataTable";
import { ContaSectionTabs } from "@/components/crm/ContaSectionTabs";
import { CrmMetricCard, CrmMetricsGrid } from "@/components/crm/CrmMetricCard";
import { sparklineFromCounts, sparklineFromSeed } from "@/lib/crm/metric-visuals";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import type { AgenteFerramentaSyncRow } from "@/lib/hub/sync-ferramenta-agentes";
import type { HubFerramentaCustomRow } from "@/lib/hub/ferramentas-custom-db";
import type { FerramentaAgenteUso } from "@/lib/hub/ferramentas-ia-ui";
import type { HubAgenteFerramentaId, HubFerramentaCategoria } from "@/lib/hub/agente-ferramentas-registry";
import {
  catalogoBuiltinPorId,
  HUB_AGENTE_FERRAMENTAS_CATALOGO,
  HUB_FERRAMENTA_ACESSO,
  HUB_FERRAMENTA_SECAO_LABEL,
  isHubAgenteFerramentaId,
  mergeUsoFerramentasComPadraoPreservandoCustom,
} from "@/lib/hub/agente-ferramentas-registry";
import { isModoOperacaoAgente, MODO_OPERACAO_LABEL } from "@/lib/hub/agente-modo-operacao";

type SectionTab = "catalogo" | "uso";
type FiltroTipo = "todos" | "builtin" | "custom";
type FiltroCategoria = "todos" | HubFerramentaCategoria;
type FiltroAcesso = "todos" | "leitura" | "escrita";

const PAGE_SIZE = 10;
const BUILTIN_COUNT = HUB_AGENTE_FERRAMENTAS_CATALOGO.length;

export type FerramentaCatalogoTipo = "builtin" | "custom";

export type FerramentaCatalogoRow = {
  rowKey: string;
  ferramenta: string;
  chave: string;
  tipo: FerramentaCatalogoTipo;
  categoria: string;
  acesso: "leitura" | "escrita";
  whatsapp: boolean;
  execucao: string;
  smart: string;
  estado: "ativa" | "inactiva";
  agentesCount: number;
  builtinId?: HubAgenteFerramentaId;
  customRow?: HubFerramentaCustomRow;
};

type AgenteLista = {
  agente_slug: string;
  nome: string;
  modo_operacao?: string | null;
  motor_ferramentas_habilitado?: boolean;
  uso_ferramentas_ia?: unknown;
  ativo?: boolean;
  arquivado_em?: string | null;
};

type AgenteUsoRow = {
  agente_slug: string;
  nome: string;
  modo: string;
  motor: boolean;
  ferramentasCount: number;
};

function TableActionGroup({ children }: { children: ReactNode }) {
  return (
    <div
      className="inline-flex items-stretch overflow-hidden rounded-lg border border-[#d4ecd0] bg-white shadow-[0_1px_2px_rgba(11,31,16,0.04)]"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

function TableActionBtn({
  onClick,
  title,
  ariaLabel,
  children,
  variant = "default",
  disabled,
}: {
  onClick: () => void;
  title: string;
  ariaLabel: string;
  children: ReactNode;
  variant?: "default" | "primary" | "danger";
  disabled?: boolean;
}) {
  const tone =
    variant === "danger"
      ? "text-[#c0392b] hover:bg-[#fff2f1]"
      : variant === "primary"
        ? "text-[#3f9848] hover:bg-[#f0f9ee]"
        : "text-[#1e4a24] hover:bg-[#f0f9ee]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 w-9 items-center justify-center border-l border-[#d4ecd0] first:border-l-0 disabled:cursor-not-allowed disabled:opacity-45 ${tone}`}
      aria-label={ariaLabel}
      title={title}
    >
      {children}
    </button>
  );
}

function TipoBadge({ tipo }: { tipo: FerramentaCatalogoTipo }) {
  const styles =
    tipo === "builtin"
      ? { bg: "#eef6ff", border: "#cbe1ff", text: "#2e67b1", label: "Builtin" }
      : tipo === "custom"
        ? { bg: "#eefbf1", border: "#cdecd5", text: "#2f7a43", label: "Custom" }
        : { bg: "#f4f0ff", border: "#ddd0ff", text: "#5b3fa8", label: "Externa" };
  return (
    <span
      className="inline-flex rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ background: styles.bg, border: `1px solid ${styles.border}`, color: styles.text }}
    >
      {styles.label}
    </span>
  );
}

function AcessoBadge({ acesso }: { acesso: "leitura" | "escrita" }) {
  const escrita = acesso === "escrita";
  return (
    <span
      className="inline-flex rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{
        background: escrita ? "rgba(248,81,73,0.12)" : "rgba(63,185,80,0.12)",
        color: escrita ? "#c0392b" : "#1e4a24",
        border: escrita ? "1px solid rgba(248,81,73,0.35)" : "1px solid rgba(63,185,80,0.3)",
      }}
    >
      {escrita ? "Escrita" : "Só leitura"}
    </span>
  );
}

function agenteUsaFerramentaKey(a: AgenteLista, key: string): boolean {
  if (a.motor_ferramentas_habilitado !== true) return false;
  const uso = mergeUsoFerramentasComPadraoPreservandoCustom(a.uso_ferramentas_ia);
  return uso[key] === true;
}

function agentesComFerramenta(agentes: AgenteLista[], key: string): AgenteLista[] {
  return agentes.filter((a) => agenteUsaFerramentaKey(a, key));
}

function countFerramentasAgente(a: AgenteLista): number {
  if (a.motor_ferramentas_habilitado !== true) return 0;
  const uso = mergeUsoFerramentasComPadraoPreservandoCustom(a.uso_ferramentas_ia);
  return Object.values(uso).filter((v) => v === true).length;
}

function modoLabel(modo?: string | null): string {
  if (isModoOperacaoAgente(modo)) return MODO_OPERACAO_LABEL[modo];
  return modo?.trim() || "—";
}

function smartLabel(provider: string): string {
  if (!provider || provider === "none") return "—";
  return provider;
}

export default function FerramentasHubPage() {
  const [agentes, setAgentes] = useState<AgenteLista[]>([]);
  const [customRows, setCustomRows] = useState<HubFerramentaCustomRow[]>([]);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterTipo, setFilterTipo] = useState<FiltroTipo>("todos");
  const [filterCategoria, setFilterCategoria] = useState<FiltroCategoria>("todos");
  const [filterAcesso, setFilterAcesso] = useState<FiltroAcesso>("todos");
  const [sectionTab, setSectionTab] = useState<SectionTab>("catalogo");
  const [page, setPage] = useState(1);
  const [pageUso, setPageUso] = useState(1);

  const [sideoverBuiltin, setSideoverBuiltin] = useState<HubAgenteFerramentaId | null>(null);
  const [sideoverCustom, setSideoverCustom] = useState<HubFerramentaCustomRow | null>(null);
  const [sideoverCustomMode, setSideoverCustomMode] = useState<"view" | "create" | "edit">("view");

  const onViewBuiltin = useCallback((id: HubAgenteFerramentaId) => {
    setSideoverBuiltin(id);
  }, []);

  const onViewCustom = useCallback((row: HubFerramentaCustomRow) => {
    setSideoverCustom(row);
    setSideoverCustomMode("view");
  }, []);

  const onCreateCustom = useCallback(() => {
    setSideoverCustom(null);
    setSideoverCustomMode("create");
  }, []);

  const onEditCustom = useCallback((row: HubFerramentaCustomRow) => {
    setSideoverCustom(row);
    setSideoverCustomMode("edit");
  }, []);

  const carregar = useCallback(async () => {
    setErro("");
    setLoading(true);
    try {
      const headers = await crmApiHeaders();
      const [resAgentes, resCustom] = await Promise.all([
        fetch("/api/hub/agentes?todos=true", { headers }),
        fetch("/api/hub/ferramentas-custom?all=true", { headers }),
      ]);

      const json: unknown = await resAgentes.json();
      if (!resAgentes.ok) {
        const msg =
          json && typeof json === "object" && "error" in json && typeof (json as Record<string, unknown>).error === "string"
            ? String((json as Record<string, unknown>).error)
            : "Falha ao listar agentes.";
        throw new Error(msg);
      }
      setAgentes(Array.isArray(json) ? (json as AgenteLista[]) : []);

      let list: HubFerramentaCustomRow[] = [];
      if (resCustom.ok) {
        const raw = await resCustom.json().catch(() => null);
        if (Array.isArray(raw)) {
          list = raw.map((x: Record<string, unknown>) => ({
            id: String(x.id ?? ""),
            ferramenta_key: String(x.ferramenta_key ?? ""),
            titulo: String(x.titulo ?? ""),
            descricao_curta:
              x.descricao_curta != null && String(x.descricao_curta).trim()
                ? String(x.descricao_curta).trim()
                : null,
            descricao_modelo: String(x.descricao_modelo ?? ""),
            builtin_impl: String(x.builtin_impl ?? ""),
            parametros_schema: x.parametros_schema ?? {},
            smart_provider: String(x.smart_provider ?? "none"),
            smart_model: x.smart_model != null ? String(x.smart_model) : null,
            smart_prompt: x.smart_prompt != null ? String(x.smart_prompt) : null,
            ativo: x.ativo !== false,
            tenant_id: String(x.tenant_id ?? ""),
            criado_em: x.criado_em != null ? String(x.criado_em) : undefined,
            atualizado_em: x.atualizado_em != null ? String(x.atualizado_em) : undefined,
          })) as HubFerramentaCustomRow[];
        }
      }
      setCustomRows(list);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar.");
      setAgentes([]);
      setCustomRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const agentesProducao = useMemo(
    () => agentes.filter((a) => !a.arquivado_em && a.ativo !== false),
    [agentes]
  );

  const agentesSyncRows = useMemo(
    (): AgenteFerramentaSyncRow[] =>
      agentesProducao.map((a) => ({
        agente_slug: a.agente_slug,
        motor_ferramentas_habilitado: a.motor_ferramentas_habilitado,
        uso_ferramentas_ia: a.uso_ferramentas_ia,
      })),
    [agentesProducao]
  );

  const agentesNomes = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of agentesProducao) {
      if (a.agente_slug) m[a.agente_slug] = a.nome?.trim() || a.agente_slug;
    }
    return m;
  }, [agentesProducao]);

  const customActivas = useMemo(() => customRows.filter((c) => c.ativo && c.ferramenta_key), [customRows]);
  const agentesComMotor = useMemo(
    () => agentesProducao.filter((a) => a.motor_ferramentas_habilitado === true),
    [agentesProducao]
  );

  const catalogoRows = useMemo((): FerramentaCatalogoRow[] => {
    const builtins: FerramentaCatalogoRow[] = HUB_AGENTE_FERRAMENTAS_CATALOGO.map((f) => {
      const comTool = agentesComFerramenta(agentesProducao, f.id);
      return {
        rowKey: `builtin:${f.id}`,
        ferramenta: f.titulo,
        chave: f.mistralFunction.name,
        tipo: "builtin",
        categoria: HUB_FERRAMENTA_SECAO_LABEL[f.categoria],
        acesso: HUB_FERRAMENTA_ACESSO[f.id],
        whatsapp: f.recomendadoWhatsApp,
        execucao: f.id,
        smart: "—",
        estado: "ativa",
        agentesCount: comTool.length,
        builtinId: f.id,
      };
    });

    const customs: FerramentaCatalogoRow[] = customRows
      .filter((c) => c.ferramenta_key)
      .map((c) => {
        const baseCat = isHubAgenteFerramentaId(c.builtin_impl) ? catalogoBuiltinPorId(c.builtin_impl) : undefined;
        const comTool = agentesComFerramenta(agentesProducao, c.ferramenta_key);
        return {
          rowKey: `custom:${c.ferramenta_key}`,
          ferramenta: c.titulo,
          chave: c.ferramenta_key,
          tipo: "custom" as const,
          categoria: baseCat ? HUB_FERRAMENTA_SECAO_LABEL[baseCat.categoria] : "Custom",
          acesso: baseCat ? HUB_FERRAMENTA_ACESSO[baseCat.id] : "leitura",
          whatsapp: baseCat?.recomendadoWhatsApp ?? false,
          execucao: c.builtin_impl,
          smart: smartLabel(c.smart_provider),
          estado: c.ativo ? "ativa" : "inactiva",
          agentesCount: comTool.length,
          customRow: c,
        };
      });

    return [...builtins, ...customs];
  }, [agentesProducao, customRows]);

  const ferramentasEmUso = useMemo(() => {
    const keys = new Set<string>();
    for (const a of agentesComMotor) {
      const uso = mergeUsoFerramentasComPadraoPreservandoCustom(a.uso_ferramentas_ia);
      for (const [k, v] of Object.entries(uso)) {
        if (v === true) keys.add(k);
      }
    }
    return keys.size;
  }, [agentesComMotor]);

  const filteredCatalogo = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return catalogoRows.filter((r) => {
      if (filterTipo !== "todos" && r.tipo !== filterTipo) return false;
      if (filterCategoria !== "todos") {
        const catKey = HUB_FERRAMENTA_SECAO_LABEL[filterCategoria];
        if (r.categoria !== catKey) return false;
      }
      if (filterAcesso !== "todos" && r.acesso !== filterAcesso) return false;
      if (!q) return true;
      return (
        r.ferramenta.toLowerCase().includes(q) ||
        r.chave.toLowerCase().includes(q) ||
        r.execucao.toLowerCase().includes(q)
      );
    });
  }, [catalogoRows, searchQuery, filterTipo, filterCategoria, filterAcesso]);

  const usoRows = useMemo((): AgenteUsoRow[] => {
    return agentesProducao
      .map((a) => ({
        agente_slug: a.agente_slug,
        nome: a.nome?.trim() || a.agente_slug,
        modo: modoLabel(a.modo_operacao),
        motor: a.motor_ferramentas_habilitado === true,
        ferramentasCount: countFerramentasAgente(a),
      }))
      .sort((x, y) => y.ferramentasCount - x.ferramentasCount || x.nome.localeCompare(y.nome, "pt-BR"));
  }, [agentesProducao]);

  const filteredUso = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return usoRows;
    return usoRows.filter(
      (r) => r.nome.toLowerCase().includes(q) || r.agente_slug.toLowerCase().includes(q) || r.modo.toLowerCase().includes(q)
    );
  }, [usoRows, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredCatalogo.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const totalPagesUso = Math.max(1, Math.ceil(filteredUso.length / PAGE_SIZE));
  const safePageUso = Math.min(pageUso, totalPagesUso);

  useEffect(() => {
    setPage(1);
    setPageUso(1);
  }, [searchQuery, filterTipo, filterCategoria, filterAcesso, sectionTab]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (pageUso > totalPagesUso) setPageUso(totalPagesUso);
  }, [pageUso, totalPagesUso]);

  const paginatedCatalogo = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredCatalogo.slice(start, start + PAGE_SIZE);
  }, [filteredCatalogo, safePage]);

  const paginatedUso = useMemo(() => {
    const start = (safePageUso - 1) * PAGE_SIZE;
    return filteredUso.slice(start, start + PAGE_SIZE);
  }, [filteredUso, safePageUso]);

  const builtinSideoverAgentes = useMemo((): FerramentaAgenteUso[] => {
    if (!sideoverBuiltin) return [];
    return agentesComFerramenta(agentesProducao, sideoverBuiltin).map((a) => ({
      agente_slug: a.agente_slug,
      nome: a.nome,
    }));
  }, [sideoverBuiltin, agentesProducao]);

  const colunasCatalogo = useMemo((): CrmResizableColumn<FerramentaCatalogoRow>[] => {
    return [
      {
        id: "ferramenta",
        label: "Ferramenta",
        defaultWidth: 220,
        minWidth: 140,
        render: (r) => (
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[#0b2210]" title={r.ferramenta}>
              {r.ferramenta}
            </div>
            {r.tipo === "custom" && r.customRow?.descricao_curta ? (
              <div className="mt-0.5 line-clamp-1 text-xs text-[#6f86a6]" title={r.customRow.descricao_curta}>
                {r.customRow.descricao_curta}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        id: "chave",
        label: "Chave",
        defaultWidth: 180,
        minWidth: 110,
        render: (r) => (
          <code className="text-[11px] text-[#2e67b1]" title={r.chave}>
            {r.chave}
          </code>
        ),
      },
      {
        id: "tipo",
        label: "Tipo",
        defaultWidth: 90,
        minWidth: 72,
        truncate: false,
        render: (r) => <TipoBadge tipo={r.tipo} />,
      },
      {
        id: "categoria",
        label: "Categoria",
        defaultWidth: 200,
        minWidth: 120,
        render: (r) => <span className="text-xs text-[#4e657f]">{r.categoria}</span>,
      },
      {
        id: "acesso",
        label: "Acesso",
        defaultWidth: 100,
        minWidth: 84,
        truncate: false,
        render: (r) => <AcessoBadge acesso={r.acesso} />,
      },
      {
        id: "whatsapp",
        label: "WhatsApp",
        defaultWidth: 90,
        minWidth: 72,
        align: "center",
        render: (r) => (
          <span className="text-xs font-semibold" style={{ color: r.whatsapp ? "#1e4a24" : "#89a095" }}>
            {r.whatsapp ? "Sim" : "—"}
          </span>
        ),
      },
      {
        id: "execucao",
        label: "Execução",
        defaultWidth: 160,
        minWidth: 100,
        render: (r) => (
          <code className="text-[11px] text-[#5d7a67]" title={r.execucao}>
            {r.execucao}
          </code>
        ),
      },
      {
        id: "smart",
        label: "Smart",
        defaultWidth: 80,
        minWidth: 64,
        render: (r) => <span className="text-xs text-[#4e657f]">{r.smart}</span>,
      },
      {
        id: "estado",
        label: "Estado",
        defaultWidth: 100,
        minWidth: 80,
        truncate: false,
        render: (r) => (
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: r.estado === "ativa" ? "rgba(146,255,0,0.12)" : "rgba(72,79,88,0.12)",
              color: r.estado === "ativa" ? "#1e4a24" : "#5d7a67",
              border: r.estado === "ativa" ? "1px solid rgba(146,255,0,0.3)" : "1px solid #dbe1e7",
            }}
          >
            {r.estado === "ativa" ? "Activa" : "Inactiva"}
          </span>
        ),
      },
      {
        id: "agentes",
        label: "Agentes",
        defaultWidth: 72,
        minWidth: 56,
        align: "center",
        render: (r) => (
          <span className="text-sm font-semibold" style={{ color: r.agentesCount > 0 ? "#1e4a24" : "#89a095" }}>
            {r.agentesCount}
          </span>
        ),
      },
      {
        id: "acoes",
        label: "Ações",
        defaultWidth: 100,
        minWidth: 88,
        truncate: false,
        align: "center",
        render: (r) => (
          <TableActionGroup>
            <TableActionBtn
              onClick={() => {
                if (r.tipo === "builtin" && r.builtinId) onViewBuiltin(r.builtinId);
                else if (r.tipo === "custom" && r.customRow) onViewCustom(r.customRow);
              }}
              ariaLabel={`Ver ${r.ferramenta}`}
              title="Ver detalhes"
            >
              <Eye size={15} />
            </TableActionBtn>
            {r.tipo === "custom" && r.customRow ? (
              <TableActionBtn
                onClick={() => onEditCustom(r.customRow!)}
                ariaLabel={`Editar ${r.ferramenta}`}
                title="Editar ferramenta custom"
                variant="primary"
              >
                <Pencil size={15} />
              </TableActionBtn>
            ) : null}
          </TableActionGroup>
        ),
      },
    ];
  }, [onEditCustom, onViewBuiltin, onViewCustom]);

  const colunasUso = useMemo((): CrmResizableColumn<AgenteUsoRow>[] => {
    return [
      {
        id: "agente",
        label: "Agente",
        defaultWidth: 220,
        minWidth: 140,
        render: (r) => (
          <Link
            href={`/crm/agentes/${encodeURIComponent(r.agente_slug)}`}
            className="text-sm font-semibold text-[#0b2210] hover:underline"
          >
            {r.nome}
          </Link>
        ),
      },
      {
        id: "modo",
        label: "Modo",
        defaultWidth: 180,
        minWidth: 120,
        render: (r) => <span className="text-xs text-[#4e657f]">{r.modo}</span>,
      },
      {
        id: "motor",
        label: "Motor IA",
        defaultWidth: 100,
        minWidth: 80,
        truncate: false,
        render: (r) => (
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: r.motor ? "rgba(146,255,0,0.12)" : "rgba(72,79,88,0.12)",
              color: r.motor ? "#1e4a24" : "#5d7a67",
              border: r.motor ? "1px solid rgba(146,255,0,0.3)" : "1px solid #dbe1e7",
            }}
          >
            {r.motor ? "Ligado" : "Desligado"}
          </span>
        ),
      },
      {
        id: "ferramentas",
        label: "Ferramentas",
        defaultWidth: 100,
        minWidth: 80,
        align: "center",
        render: (r) => (
          <span className="text-sm font-semibold" style={{ color: r.ferramentasCount > 0 ? "#1e4a24" : "#89a095" }}>
            {r.ferramentasCount}
          </span>
        ),
      },
      {
        id: "links",
        label: "Links",
        defaultWidth: 140,
        minWidth: 100,
        truncate: false,
        render: (r) => (
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={`/crm/agentes/${encodeURIComponent(r.agente_slug)}`}
              className="inline-flex items-center gap-1 rounded-lg border border-[#d4ecd0] px-2 py-1 text-[10px] font-semibold text-[#1e4a24] hover:bg-[#f0f9ee]"
            >
              <ExternalLink size={11} />
              Modelo
            </Link>
            <Link
              href={`/crm/agentes/${encodeURIComponent(r.agente_slug)}#ferramentas`}
              className="inline-flex items-center gap-1 rounded-lg border border-[#d4ecd0] px-2 py-1 text-[10px] font-semibold text-[#1e4a24] hover:bg-[#f0f9ee]"
            >
              Ferramentas
            </Link>
          </div>
        ),
      },
    ];
  }, []);

  const exportCsv = useCallback(() => {
    const header = [
      "ferramenta",
      "chave",
      "tipo",
      "categoria",
      "acesso",
      "whatsapp",
      "execucao",
      "smart",
      "estado",
      "agentes",
    ];
    const rows = filteredCatalogo.map((r) =>
      [
        r.ferramenta.replace(/"/g, '""'),
        r.chave,
        r.tipo,
        r.categoria.replace(/"/g, '""'),
        r.acesso,
        r.whatsapp ? "sim" : "nao",
        r.execucao,
        r.smart,
        r.estado,
        String(r.agentesCount),
      ]
        .map((c) => `"${c}"`)
        .join(",")
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ferramentas-ia-catalogo.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredCatalogo]);

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center" style={{ background: "#f8fcf6" }}>
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#92ff00] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-full w-full min-w-0 px-3 py-4 sm:px-5 lg:px-6 xl:px-8" style={{ background: "#f8fcf6" }}>
      <div className="w-full min-w-0">
        {erro ? (
          <p className="mb-4 rounded-xl border border-[#f0c0bd] bg-[#fff2f1] px-3 py-2 text-sm text-[#c0392b]">{erro}</p>
        ) : null}

        <CrmMetricsGrid cols={4} className="mb-4">
          <CrmMetricCard
            label="Builtins"
            valor={BUILTIN_COUNT}
            sub="Catálogo fixo do Hub"
            tone="brand"
            sparkline={sparklineFromSeed(BUILTIN_COUNT)}
          />
          <CrmMetricCard
            label="Custom"
            valor={customActivas.length}
            sub={`${customRows.length} no total`}
            tone="success"
            sparkline={sparklineFromCounts([customActivas.length, customRows.length - customActivas.length])}
          />
          <CrmMetricCard
            label="Agentes com motor IA"
            valor={agentesComMotor.length}
            sub={`${agentesProducao.length} agentes activos`}
            tone="success"
            sparkline={sparklineFromSeed(agentesComMotor.length + 1)}
          />
          <CrmMetricCard
            label="Ferramentas em uso"
            valor={ferramentasEmUso}
            sub="Chaves activas em modelos"
            tone="brand"
            sparkline={sparklineFromSeed(ferramentasEmUso + 2)}
          />
        </CrmMetricsGrid>

        <div className="w-full min-w-0 rounded-2xl border border-[#dcebd8] bg-white shadow-[0_2px_8px_rgba(11,31,16,0.05)]">
          <ContaSectionTabs
            tabs={[
              { id: "catalogo", label: "Catálogo" },
              { id: "uso", label: "Uso por agente" },
            ]}
            activeId={sectionTab}
            onSelect={(id) => setSectionTab(id as SectionTab)}
          />

          {sectionTab === "catalogo" ? (
            <>
              <div className="flex flex-wrap items-center justify-end gap-2 border-b border-[#eef5ec] px-4 py-2">
                <button
                  type="button"
                  onClick={onCreateCustom}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold"
                  style={{ background: "#0b1f10", color: "#92ff00" }}
                >
                  <Plus size={13} />
                  Nova ferramenta custom
                </button>
              </div>

              <div className="border-b border-[#eef5ec] px-4 py-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto]">
                  <div className="flex h-10 items-center gap-2 rounded-xl border border-[#d4ecd0] bg-white px-3">
                    <Search size={14} className="text-[#6b8a76]" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por nome ou chave..."
                      className="w-full bg-transparent text-sm text-[#1e3a23] outline-none placeholder:text-[#90a89b]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedFilters((v) => !v)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold"
                    style={{ borderColor: "#d4ecd0", color: "#1e4a24", background: "#fff" }}
                  >
                    <SlidersHorizontal size={13} />
                    Filtros avançados
                  </button>
                  <button
                    type="button"
                    onClick={exportCsv}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold"
                    style={{ borderColor: "#d4ecd0", color: "#1e4a24", background: "#fff" }}
                  >
                    Exportar
                  </button>
                </div>
                {showAdvancedFilters ? (
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                    <label className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#89a095]">Tipo</span>
                      <select
                        value={filterTipo}
                        onChange={(e) => setFilterTipo(e.target.value as FiltroTipo)}
                        className="h-10 w-full rounded-xl border border-[#d4ecd0] bg-white px-3 text-sm text-[#1e4a24]"
                      >
                        <option value="todos">Todos</option>
                        <option value="builtin">Builtin</option>
                        <option value="custom">Custom</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#89a095]">Categoria</span>
                      <select
                        value={filterCategoria}
                        onChange={(e) => setFilterCategoria(e.target.value as FiltroCategoria)}
                        className="h-10 w-full rounded-xl border border-[#d4ecd0] bg-white px-3 text-sm text-[#1e4a24]"
                      >
                        <option value="todos">Todas</option>
                        <option value="cliente">{HUB_FERRAMENTA_SECAO_LABEL.cliente}</option>
                        <option value="analise">{HUB_FERRAMENTA_SECAO_LABEL.analise}</option>
                        <option value="registos">{HUB_FERRAMENTA_SECAO_LABEL.registos}</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#89a095]">Acesso</span>
                      <select
                        value={filterAcesso}
                        onChange={(e) => setFilterAcesso(e.target.value as FiltroAcesso)}
                        className="h-10 w-full rounded-xl border border-[#d4ecd0] bg-white px-3 text-sm text-[#1e4a24]"
                      >
                        <option value="todos">Todos</option>
                        <option value="leitura">Só leitura</option>
                        <option value="escrita">Escrita</option>
                      </select>
                    </label>
                  </div>
                ) : null}
              </div>

              <CrmResizableDataTable
                tableId="crm-ferramentas-catalogo"
                columns={colunasCatalogo}
                rows={paginatedCatalogo}
                rowKey={(r) => r.rowKey}
                emptyMessage="Nenhuma ferramenta encontrada."
                getRowStyle={(r, idx): CSSProperties | undefined => ({
                  borderTop: idx > 0 ? "1px solid #edf3fb" : "none",
                  opacity: r.estado === "inactiva" ? 0.88 : undefined,
                })}
              />

              <div className="flex items-center justify-between border-t border-[#edf3fb] px-4 py-3">
                <p className="text-xs text-[#6f86a6]">
                  {filteredCatalogo.length > 0
                    ? `Exibindo ${(safePage - 1) * PAGE_SIZE + 1}-${Math.min(safePage * PAGE_SIZE, filteredCatalogo.length)} de ${filteredCatalogo.length} ferramentas`
                    : `Exibindo 0 de ${catalogoRows.length} ferramentas`}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border disabled:opacity-40"
                    style={{ borderColor: "#d4e3f7", color: "#6a81a3", background: "#fff" }}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span
                    className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-bold"
                    style={{ background: "#0f6b4f", color: "#fff" }}
                  >
                    {safePage}
                  </span>
                  {totalPages > 1 ? <span className="text-xs text-[#6f86a6]">/ {totalPages}</span> : null}
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border disabled:opacity-40"
                    style={{ borderColor: "#d4e3f7", color: "#6a81a3", background: "#fff" }}
                    aria-label="Próxima página"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="border-b border-[#eef5ec] px-4 py-3">
                <div className="flex h-10 max-w-md items-center gap-2 rounded-xl border border-[#d4ecd0] bg-white px-3">
                  <Search size={14} className="text-[#6b8a76]" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar agente ou modo..."
                    className="w-full bg-transparent text-sm text-[#1e3a23] outline-none placeholder:text-[#90a89b]"
                  />
                </div>
              </div>

              <CrmResizableDataTable
                tableId="crm-ferramentas-uso-agente"
                columns={colunasUso}
                rows={paginatedUso}
                rowKey={(r) => r.agente_slug}
                emptyMessage="Nenhum agente activo encontrado."
                getRowStyle={(_, idx): CSSProperties | undefined => ({
                  borderTop: idx > 0 ? "1px solid #edf3fb" : "none",
                })}
              />

              <div className="flex items-center justify-between border-t border-[#edf3fb] px-4 py-3">
                <p className="text-xs text-[#6f86a6]">
                  {filteredUso.length > 0
                    ? `Exibindo ${(safePageUso - 1) * PAGE_SIZE + 1}-${Math.min(safePageUso * PAGE_SIZE, filteredUso.length)} de ${filteredUso.length} agentes`
                    : `Exibindo 0 de ${usoRows.length} agentes`}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePageUso <= 1}
                    onClick={() => setPageUso((p) => Math.max(1, p - 1))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border disabled:opacity-40"
                    style={{ borderColor: "#d4e3f7", color: "#6a81a3", background: "#fff" }}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span
                    className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-bold"
                    style={{ background: "#0f6b4f", color: "#fff" }}
                  >
                    {safePageUso}
                  </span>
                  {totalPagesUso > 1 ? <span className="text-xs text-[#6f86a6]">/ {totalPagesUso}</span> : null}
                  <button
                    type="button"
                    disabled={safePageUso >= totalPagesUso}
                    onClick={() => setPageUso((p) => Math.min(totalPagesUso, p + 1))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border disabled:opacity-40"
                    style={{ borderColor: "#d4e3f7", color: "#6a81a3", background: "#fff" }}
                    aria-label="Próxima página"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <CrmFerramentaBuiltinSideover
        open={sideoverBuiltin !== null}
        onClose={() => setSideoverBuiltin(null)}
        ferramentaId={sideoverBuiltin}
        agentes={builtinSideoverAgentes}
      />

      <CrmFerramentaCustomSideover
        open={sideoverCustomMode === "create" || sideoverCustom !== null}
        onClose={() => {
          setSideoverCustom(null);
          setSideoverCustomMode("view");
        }}
        mode={sideoverCustomMode}
        row={sideoverCustom}
        agentes={agentesSyncRows}
        agentesNomes={agentesNomes}
        onSaved={() => void carregar()}
        onDeleted={() => void carregar()}
        onRequestEdit={() => setSideoverCustomMode("edit")}
      />

    </div>
  );
}
