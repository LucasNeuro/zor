"use client";
import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { KpiBar } from "@/components/crm/KpiBar";
import { SearchBar } from "@/components/crm/SearchBar";
import { FilterPills } from "@/components/crm/FilterPills";
import { EmptyState } from "@/components/crm/EmptyState";
import { NegocioFormDrawer } from "@/components/crm/NegocioFormDrawer";
import { labelMercadoPrefixo } from "@/lib/crm/negocio-cadastro";

const LIMIT = 20;

type Negocio = {
  id: string;
  codigo: string;
  titulo: string;
  prefixo_mercado: string;
  status: string;
  etapa: string;
  valor_estimado: number | null;
  valor_fechado: number | null;
  data_previsao_fechamento: string | null;
  criado_em: string | null;
};

const ETAPAS = [
  { id: "", label: "Todas" },
  { id: "briefing", label: "Briefing" },
  { id: "match", label: "Match" },
  { id: "sit-down", label: "Sit-down" },
  { id: "concluido", label: "Concluído" },
];

const ETAPA_COR: Record<string, string> = {
  briefing: "#3b82f6",
  match: "#f59e0b",
  "sit-down": "#a855f7",
  concluido: "#22c55e",
};

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  aberto: { label: "Aberto", color: "#3b82f6", bg: "#3b82f622" },
  em_negociacao: { label: "Em negociação", color: "#f59e0b", bg: "#f59e0b22" },
  fechado_ganho: { label: "Ganho", color: "#22c55e", bg: "#22c55e22" },
  fechado_perdido: { label: "Perdido", color: "#ef4444", bg: "#ef444422" },
  cancelado: { label: "Cancelado", color: "#8b949e", bg: "#8b949e22" },
};

function formatData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatCurrency(val: number | null): string {
  if (val === null || val === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);
}

const TH: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  color: "#8b949e",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  borderBottom: "1px solid #30363d",
};

const TD: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  color: "#e6edf3",
  whiteSpace: "nowrap",
};

const KANBAN_ETAPAS = [
  { id: "briefing", label: "Briefing", color: "#3b82f6" },
  { id: "match", label: "Match", color: "#f59e0b" },
  { id: "sit-down", label: "Sit-down", color: "#a855f7" },
  { id: "concluido", label: "Concluído", color: "#22c55e" },
] as const;

export default function NegociosPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSlot } = useCrmHeaderSlot();
  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [busca, setBusca] = useState("");
  const [etapa, setEtapa] = useState("");
  const [offset, setOffset] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [drawerAberto, setDrawerAberto] = useState(false);

  const carregarLista = useCallback(() => {
    setCarregando(true);
    const p = new URLSearchParams({ offset: "0" });
    if (busca) p.set("busca", busca);
    if (etapa) p.set("etapa", etapa);

    return fetch(`/api/crm/negocios?${p}`, { headers: internalApiHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setNegocios(d.data ?? []);
        setTotal(d.total ?? 0);
        setOffset(LIMIT);
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [busca, etapa]);

  useEffect(() => {
    const et = searchParams.get("etapa");
    const v = searchParams.get("view");
    if (et) setEtapa(et);
    if (v === "kanban" || v === "lista") setView(v);
  }, [searchParams]);

  useEffect(() => {
    void carregarLista();
  }, [carregarLista]);

  function carregarMais() {
    setCarregandoMais(true);
    const p = new URLSearchParams({ offset: String(offset) });
    if (busca) p.set("busca", busca);
    if (etapa) p.set("etapa", etapa);

    fetch(`/api/crm/negocios?${p}`, { headers: internalApiHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setNegocios((prev) => [...prev, ...(d.data ?? [])]);
        setOffset((prev) => prev + LIMIT);
      })
      .catch(() => {})
      .finally(() => setCarregandoMais(false));
  }

  const briefingCount = negocios.filter((n) => n.etapa === "briefing").length;
  const matchCount = negocios.filter((n) => n.etapa === "match").length;
  const sitdownCount = negocios.filter((n) => n.etapa === "sit-down").length;
  const concluidoCount = negocios.filter((n) => n.etapa === "concluido").length;
  const temMais = negocios.length < total;

  async function moverEtapa(negocioId: string, novaEtapa: string) {
    await fetch(`/api/crm/negocios/${negocioId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ etapa: novaEtapa }),
    });
    setNegocios((prev) => prev.map((n) => (n.id === negocioId ? { ...n, etapa: novaEtapa } : n)));
  }

  useEffect(() => {
    setSlot({
      path: pathname,
      actions: (
        <button
          type="button"
          onClick={() => setDrawerAberto(true)}
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
          + Novo
        </button>
      ),
    });
    return () => setSlot(null);
  }, [pathname, setSlot]);

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "#0d1117", padding: "24px" }}>
      <NegocioFormDrawer
        open={drawerAberto}
        onClose={() => setDrawerAberto(false)}
        onSaved={carregarLista}
      />

      {/* KPI Bar — by etapa */}
      <KpiBar kpis={[
        { label: "Total", value: total, color: "#c9a24a" },
        { label: "Briefing", value: briefingCount, color: "#3b82f6" },
        { label: "Match", value: matchCount, color: "#f59e0b" },
        { label: "Sit-down", value: sitdownCount, color: "#a855f7" },
        { label: "Concluído", value: concluidoCount, color: "#22c55e" },
      ]} />

      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <SearchBar
          value={busca}
          onChange={setBusca}
          placeholder="Buscar por título ou código..."
        />
      </div>

      {/* Filter Pills — by etapa */}
      <div style={{ marginBottom: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <FilterPills pills={ETAPAS} active={etapa} onChange={setEtapa} />
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {(["kanban", "lista"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #30363d",
                background: view === v ? "#003b26" : "transparent",
                color: view === v ? "#c9a24a" : "#8b949e",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {v === "kanban" ? "Kanban" : "Lista"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {carregando ? (
        <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando...</p>
      ) : negocios.length === 0 ? (
        <EmptyState message="Nenhum negócio encontrado." />
      ) : view === "kanban" ? (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
          {KANBAN_ETAPAS.map((col) => {
            const cards = negocios.filter((n) => n.etapa === col.id);
            return (
              <div
                key={col.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragId) void moverEtapa(dragId, col.id);
                  setDragId(null);
                }}
                style={{
                  minWidth: 240,
                  flex: "1 0 240px",
                  background: "#161b22",
                  borderRadius: 10,
                  border: "1px solid #30363d",
                  padding: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: col.color }}>{col.label}</span>
                  <span style={{ fontSize: 11, color: "#8b949e" }}>{cards.length}</span>
                </div>
                {cards.map((n) => (
                  <div
                    key={n.id}
                    draggable
                    onDragStart={() => setDragId(n.id)}
                    onClick={() => router.push(`/crm/negocios/${n.id}`)}
                    style={{
                      background: "#0d1117",
                      border: "1px solid #21262d",
                      borderRadius: 8,
                      padding: 10,
                      marginBottom: 8,
                      cursor: "pointer",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{n.titulo}</p>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#8b949e", fontFamily: "monospace" }}>{n.codigo}</p>
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#c9a24a" }}>{formatCurrency(n.valor_estimado)}</p>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={TH}>Código</th>
                  <th style={TH}>Título</th>
                  <th style={TH}>Mercado</th>
                  <th style={TH}>Etapa</th>
                  <th style={TH}>Status</th>
                  <th style={TH}>Valor Est.</th>
                  <th style={TH}>Previsão</th>
                  <th style={TH}>Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {negocios.map((n) => {
                  const etapaCor = ETAPA_COR[n.etapa] ?? "#8b949e";
                  const statusInfo = STATUS_LABEL[n.status] ?? { label: n.status, color: "#8b949e", bg: "#8b949e22" };
                  return (
                    <tr
                      key={n.id}
                      onClick={() => router.push(`/crm/negocios/${n.id}`)}
                      style={{ borderBottom: "1px solid #21262d", cursor: "pointer" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#161b22"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                    >
                      <td style={{ ...TD, color: "#8b949e", fontSize: 12, fontFamily: "monospace" }}>{n.codigo}</td>
                      <td style={{ ...TD, fontWeight: 600, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {n.titulo}
                      </td>
                      <td style={TD}>
                        <span style={{
                          fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20,
                          background: "#c9a24a22", color: "#c9a24a", border: "1px solid #c9a24a44",
                        }}>
                          {labelMercadoPrefixo(n.prefixo_mercado)}
                        </span>
                      </td>
                      <td style={TD}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                          background: `${etapaCor}22`, color: etapaCor, border: `1px solid ${etapaCor}44`,
                          textTransform: "capitalize",
                        }}>
                          {n.etapa}
                        </span>
                      </td>
                      <td style={TD}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                          background: statusInfo.bg, color: statusInfo.color,
                          border: `1px solid ${statusInfo.color}44`,
                        }}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td style={{ ...TD, color: "#c9a24a", fontSize: 12, fontWeight: 700 }}>{formatCurrency(n.valor_estimado)}</td>
                      <td style={{ ...TD, color: "#8b949e", fontSize: 12 }}>{formatData(n.data_previsao_fechamento)}</td>
                      <td style={{ ...TD, color: "#8b949e", fontSize: 12 }}>{formatData(n.criado_em)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {temMais && (
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <button
                onClick={carregarMais}
                disabled={carregandoMais}
                style={{ padding: "10px 24px", borderRadius: 8, background: "#161b22", border: "1px solid #30363d", color: "#8b949e", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
              >
                {carregandoMais ? "Carregando..." : `Carregar mais (${total - negocios.length} restantes)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
