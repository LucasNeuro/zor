"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { KpiBar } from "@/components/crm/KpiBar";
import { SearchBar } from "@/components/crm/SearchBar";
import { FilterPills } from "@/components/crm/FilterPills";
import { EmptyState } from "@/components/crm/EmptyState";

const LIMIT = 20;

type Imovel = {
  id: string;
  codigo: string | null;
  titulo: string | null;
  tipo: string | null;
  finalidade: string | null;
  status: string | null;
  valor: number | null;
  cidade: string | null;
  estado: string | null;
  dormitorios: number | null;
  area_total_m2: number | null;
  ativo: boolean | null;
  criado_em: string | null;
};

const FINALIDADE_PILLS = [
  { id: "", label: "Todos" },
  { id: "venda", label: "Venda" },
  { id: "locacao", label: "Locação" },
];

function formatData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatCurrency(val: number | null): string {
  if (val === null || val === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);
}

const STATUS_COR: Record<string, { bg: string; color: string }> = {
  disponivel: { bg: "#22c55e22", color: "#22c55e" },
  vendido: { bg: "#3b82f622", color: "#3b82f6" },
  alugado: { bg: "#a855f722", color: "#a855f7" },
  reservado: { bg: "#f59e0b22", color: "#f59e0b" },
};

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

export default function ImoveisPage() {
  const pathname = usePathname();
  const { setSlot } = useCrmHeaderSlot();
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [total, setTotal] = useState(0);
  const [busca, setBusca] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [finalidade, setFinalidade] = useState("");
  const [offset, setOffset] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);

  useEffect(() => {
    setCarregando(true);
    const p = new URLSearchParams({ offset: "0", ativo: String(ativo) });
    if (busca) p.set("busca", busca);
    if (finalidade) p.set("finalidade", finalidade);

    fetch(`/api/crm/imoveis?${p}`, { headers: internalApiHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setImoveis(d.data ?? []);
        setTotal(d.total ?? 0);
        setOffset(LIMIT);
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [busca, ativo, finalidade]);

  function carregarMais() {
    setCarregandoMais(true);
    const p = new URLSearchParams({ offset: String(offset), ativo: String(ativo) });
    if (busca) p.set("busca", busca);
    if (finalidade) p.set("finalidade", finalidade);

    fetch(`/api/crm/imoveis?${p}`, { headers: internalApiHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setImoveis((prev) => [...prev, ...(d.data ?? [])]);
        setOffset((prev) => prev + LIMIT);
      })
      .catch(() => {})
      .finally(() => setCarregandoMais(false));
  }

  const vendaCount = imoveis.filter((i) => i.finalidade === "venda").length;
  const locacaoCount = imoveis.filter((i) => i.finalidade === "locacao").length;
  const temMais = imoveis.length < total;

  useEffect(() => {
    setSlot({
      path: pathname,
      actions: (
        <button
          type="button"
          onClick={() => alert("Formulário disponível em breve")}
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
      {/* KPI Bar */}
      <KpiBar kpis={[
        { label: "Total", value: total, color: "#c9a24a" },
        { label: "Venda", value: vendaCount, color: "#3b82f6" },
        { label: "Locação", value: locacaoCount, color: "#a855f7" },
      ]} />

      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <SearchBar
          value={busca}
          onChange={setBusca}
          placeholder="Buscar por título, cidade ou bairro..."
        />
      </div>

      {/* Ativos / Arquivados tab */}
      <div style={{ display: "flex", borderBottom: "1px solid #30363d", marginBottom: 12 }}>
        {[
          { id: true, label: "Ativos" },
          { id: false, label: "Arquivados" },
        ].map((tab) => (
          <button
            key={String(tab.id)}
            onClick={() => setAtivo(tab.id)}
            style={{
              padding: "8px 20px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              background: "none",
              border: "none",
              borderBottom: ativo === tab.id ? "2px solid #c9a24a" : "2px solid transparent",
              color: ativo === tab.id ? "#c9a24a" : "#8b949e",
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Pills */}
      <div style={{ marginBottom: 20 }}>
        <FilterPills pills={FINALIDADE_PILLS} active={finalidade} onChange={setFinalidade} />
      </div>

      {/* Content */}
      {carregando ? (
        <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando...</p>
      ) : imoveis.length === 0 ? (
        <EmptyState message="Nenhum imóvel encontrado." />
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 740 }}>
              <thead>
                <tr>
                  <th style={TH}>Código</th>
                  <th style={TH}>Título</th>
                  <th style={TH}>Tipo</th>
                  <th style={TH}>Finalidade</th>
                  <th style={TH}>Status</th>
                  <th style={TH}>Valor</th>
                  <th style={TH}>Cidade/UF</th>
                  <th style={TH}>Dorms</th>
                  <th style={TH}>Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {imoveis.map((im) => {
                  const statusStyle = STATUS_COR[im.status || ""] ?? { bg: "#8b949e22", color: "#8b949e" };
                  return (
                    <tr
                      key={im.id}
                      onClick={() => console.log(im.id)}
                      style={{ borderBottom: "1px solid #21262d", cursor: "pointer" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#161b22"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                    >
                      <td style={{ ...TD, color: "#8b949e", fontSize: 12 }}>{im.codigo || "—"}</td>
                      <td style={{ ...TD, fontWeight: 600, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {im.titulo || "Sem título"}
                      </td>
                      <td style={{ ...TD, color: "#8b949e", fontSize: 12, textTransform: "capitalize" }}>{im.tipo || "—"}</td>
                      <td style={TD}>
                        {im.finalidade ? (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                            background: im.finalidade === "venda" ? "#3b82f622" : "#a855f722",
                            color: im.finalidade === "venda" ? "#3b82f6" : "#a855f7",
                            border: `1px solid ${im.finalidade === "venda" ? "#3b82f644" : "#a855f744"}`,
                          }}>
                            {im.finalidade === "locacao" ? "Locação" : "Venda"}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={TD}>
                        {im.status ? (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                            background: statusStyle.bg,
                            color: statusStyle.color,
                            border: `1px solid ${statusStyle.color}44`,
                            textTransform: "capitalize",
                          }}>
                            {im.status}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ ...TD, color: "#c9a24a", fontSize: 12, fontWeight: 700 }}>{formatCurrency(im.valor)}</td>
                      <td style={{ ...TD, color: "#8b949e", fontSize: 12 }}>
                        {im.cidade ? `${im.cidade}${im.estado ? `/${im.estado}` : ""}` : "—"}
                      </td>
                      <td style={{ ...TD, color: "#8b949e", fontSize: 12 }}>
                        {im.dormitorios !== null ? `${im.dormitorios}q` : "—"}
                      </td>
                      <td style={{ ...TD, color: "#8b949e", fontSize: 12 }}>{formatData(im.criado_em)}</td>
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
                {carregandoMais ? "Carregando..." : `Carregar mais (${total - imoveis.length} restantes)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
