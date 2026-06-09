"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ExternalLink, Eye, Loader2, Pencil, Search, Settings2 } from "lucide-react";
import { CrmIntegradorSideover } from "@/components/crm/CrmIntegradorSideover";
import {
  CrmResizableDataTable,
  type CrmResizableColumn,
} from "@/components/crm/CrmResizableDataTable";
import type { IntegracaoAmbienteStatus } from "@/app/api/hub/integradores/route";
import type { IntegradorCatalogoEntry } from "@/lib/hub/integradores-catalogo";
import { integradorConfiguravel } from "@/lib/hub/integradores-catalogo";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import type { AgenteFerramentaSyncRow } from "@/lib/hub/sync-ferramenta-agentes";

type ConexaoMap = Record<string, { hub_id: string; configurado: boolean; ativo: boolean }>;

type StatusIntegracao = "conectado" | "nao_configurado" | "erro" | "em_breve";

export type IntegracaoTableRow = {
  rowKey: string;
  nome: string;
  descricao: string;
  tipo: "ambiente" | "agente";
  status: StatusIntegracao;
  funcoes: number;
  detalhe?: string;
  href?: string;
  integrador?: IntegradorCatalogoEntry;
};

type Props = {
  agentes?: AgenteFerramentaSyncRow[];
  agentesNomes?: Record<string, string>;
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
  variant?: "default" | "primary";
  disabled?: boolean;
}) {
  const tone =
    variant === "primary"
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

function StatusBadge({ status }: { status: StatusIntegracao }) {
  const map: Record<StatusIntegracao, { label: string; bg: string; color: string; border: string }> = {
    conectado: {
      label: "Ligado",
      bg: "rgba(63,185,80,0.12)",
      color: "#1e4a24",
      border: "1px solid rgba(63,185,80,0.3)",
    },
    nao_configurado: {
      label: "Não ligado",
      bg: "rgba(72,79,88,0.08)",
      color: "#5d7a67",
      border: "1px solid #dbe1e7",
    },
    erro: {
      label: "Erro",
      bg: "rgba(248,81,73,0.12)",
      color: "#c0392b",
      border: "1px solid rgba(248,81,73,0.35)",
    },
    em_breve: {
      label: "Em breve",
      bg: "rgba(201,162,74,0.12)",
      color: "#8a6d1f",
      border: "1px solid rgba(201,162,74,0.35)",
    },
  };
  const s = map[status];
  return (
    <span
      className="inline-flex rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ background: s.bg, color: s.color, border: s.border }}
    >
      {s.label}
    </span>
  );
}

function TipoBadge({ tipo }: { tipo: "ambiente" | "agente" }) {
  const ambiente = tipo === "ambiente";
  return (
    <span
      className="inline-flex rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{
        background: ambiente ? "#eef6ff" : "#f4f0ff",
        border: ambiente ? "1px solid #cbe1ff" : "1px solid #ddd0ff",
        color: ambiente ? "#2e67b1" : "#5b3fa8",
      }}
    >
      {ambiente ? "Ambiente" : "Agente IA"}
    </span>
  );
}

export function CrmIntegradoresCatalogoPanel({ agentes = [], agentesNomes = {} }: Props) {
  const [catalogo, setCatalogo] = useState<IntegradorCatalogoEntry[]>([]);
  const [ambiente, setAmbiente] = useState<IntegracaoAmbienteStatus[]>([]);
  const [conexoes, setConexoes] = useState<ConexaoMap>({});
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sideover, setSideover] = useState<IntegradorCatalogoEntry | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const res = await fetch("/api/hub/integradores", { headers: await crmApiHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Falha ao carregar.");
      setCatalogo(Array.isArray(data.catalogo) ? data.catalogo : []);
      setAmbiente(Array.isArray(data.ambiente) ? data.ambiente : []);
      setConexoes(data.conexoes && typeof data.conexoes === "object" ? data.conexoes : {});
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
      setCatalogo([]);
      setAmbiente([]);
      setConexoes({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const rows = useMemo((): IntegracaoTableRow[] => {
    const envRows: IntegracaoTableRow[] = ambiente.map((a) => ({
      rowKey: `env:${a.id}`,
      nome: a.nome,
      descricao: a.descricao,
      tipo: "ambiente",
      status: a.status,
      funcoes: 0,
      detalhe: a.detail,
      href: a.href,
    }));

    const agenteRows: IntegracaoTableRow[] = catalogo.map((item) => {
      const cx = conexoes[item.id];
      let status: StatusIntegracao = "nao_configurado";
      if (item.emBreve) status = "em_breve";
      else if (cx?.configurado) status = "conectado";
      return {
        rowKey: `agente:${item.id}`,
        nome: item.nome,
        descricao: item.descricao,
        tipo: "agente",
        status,
        funcoes: item.ferramentas.length,
        integrador: item,
      };
    });

    return [...envRows, ...agenteRows];
  }, [ambiente, catalogo, conexoes]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.nome.toLowerCase().includes(q) ||
        r.descricao.toLowerCase().includes(q) ||
        r.tipo.includes(q) ||
        (r.detalhe?.toLowerCase().includes(q) ?? false)
    );
  }, [rows, searchQuery]);

  const colunas = useMemo((): CrmResizableColumn<IntegracaoTableRow>[] => {
    return [
      {
        id: "nome",
        label: "Integração",
        defaultWidth: 200,
        minWidth: 140,
        render: (r) => (
          <div>
            <p className="m-0 text-sm font-bold text-[#0b2210]">{r.nome}</p>
            <p className="m-0 mt-0.5 text-[11px] leading-snug text-[#5d7a67]">{r.descricao}</p>
          </div>
        ),
      },
      {
        id: "tipo",
        label: "Tipo",
        defaultWidth: 110,
        minWidth: 90,
        truncate: false,
        render: (r) => <TipoBadge tipo={r.tipo} />,
      },
      {
        id: "funcoes",
        label: "Funções",
        defaultWidth: 80,
        minWidth: 64,
        align: "center",
        render: (r) => (
          <span className="text-sm font-semibold" style={{ color: r.funcoes > 0 ? "#1e4a24" : "#89a095" }}>
            {r.funcoes > 0 ? r.funcoes : "—"}
          </span>
        ),
      },
      {
        id: "status",
        label: "Estado",
        defaultWidth: 120,
        minWidth: 100,
        truncate: false,
        render: (r) => <StatusBadge status={r.status} />,
      },
      {
        id: "detalhe",
        label: "Nota",
        defaultWidth: 220,
        minWidth: 120,
        render: (r) => (
          <span className="text-[11px] text-[#6e7781] line-clamp-2" title={r.detalhe}>
            {r.detalhe ?? (r.tipo === "agente" ? "Credenciais + toggles na ficha do agente" : "—")}
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
        render: (r) => {
          if (r.tipo === "ambiente" && r.href) {
            return (
              <TableActionGroup>
                <Link
                  href={r.href}
                  className="inline-flex h-9 w-9 items-center justify-center text-[#1e4a24] hover:bg-[#f0f9ee]"
                  aria-label={`Abrir ${r.nome}`}
                  title="Abrir configuração"
                >
                  <ExternalLink size={15} />
                </Link>
              </TableActionGroup>
            );
          }
          if (r.tipo === "agente" && r.integrador) {
            const pode = integradorConfiguravel(r.integrador.id);
            return (
              <TableActionGroup>
                <TableActionBtn
                  onClick={() => pode && setSideover(r.integrador!)}
                  disabled={!pode}
                  ariaLabel={pode ? `Configurar ${r.nome}` : `${r.nome} em breve`}
                  title={pode ? "Ligar / editar credenciais" : "Em breve"}
                  variant={r.status === "conectado" ? "default" : "primary"}
                >
                  {r.status === "conectado" ? <Pencil size={15} /> : <Settings2 size={15} />}
                </TableActionBtn>
                {pode ? (
                  <TableActionBtn
                    onClick={() => setSideover(r.integrador!)}
                    ariaLabel={`Ver ${r.nome}`}
                    title="Ver funções incluídas"
                  >
                    <Eye size={15} />
                  </TableActionBtn>
                ) : null}
              </TableActionGroup>
            );
          }
          return <span className="text-xs text-[#89a095]">—</span>;
        },
      },
    ];
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-[#5d7a67]">
        <Loader2 size={16} className="animate-spin" />
        A carregar integrações…
      </div>
    );
  }

  return (
    <>
      <div className="border-b border-[#eef5ec] px-4 py-3">
        <p className="m-0 text-sm text-[#1e4a24]">
          <strong>Ambiente</strong> — credenciais no servidor (.env).{" "}
          <strong>Agente IA</strong> — ligue com API key/token e active funções na ficha de cada modelo.
        </p>
        {erro ? <p className="mt-2 text-sm text-[#c0392b]">{erro}</p> : null}
        <div className="mt-3 flex h-10 max-w-md items-center gap-2 rounded-xl border border-[#d4ecd0] bg-white px-3">
          <Search size={14} className="text-[#6b8a76]" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar integração..."
            className="w-full bg-transparent text-sm text-[#1e3a23] outline-none placeholder:text-[#90a89b]"
          />
        </div>
      </div>

      <CrmResizableDataTable
        tableId="crm-ferramentas-integracoes"
        columns={colunas}
        rows={filtered}
        rowKey={(r) => r.rowKey}
        emptyMessage="Nenhuma integração encontrada."
        getRowStyle={(_, idx): CSSProperties | undefined => ({
          borderTop: idx > 0 ? "1px solid #edf3fb" : "none",
        })}
      />

      <div className="border-t border-[#edf3fb] px-4 py-3">
        <p className="text-xs text-[#6f86a6]">
          {filtered.length} integração(ões) · {catalogo.filter((c) => conexoes[c.id]?.configurado).length} ligada(s) aos
          agentes
        </p>
      </div>

      <CrmIntegradorSideover
        open={sideover !== null}
        integrador={sideover}
        configurado={sideover ? conexoes[sideover.id]?.configurado === true : false}
        agentes={agentes}
        agentesNomes={agentesNomes}
        onClose={() => setSideover(null)}
        onSaved={() => {
          setSideover(null);
          void carregar();
        }}
      />
    </>
  );
}
