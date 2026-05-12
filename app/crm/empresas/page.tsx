"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { KpiBar } from "@/components/crm/KpiBar";
import { SearchBar } from "@/components/crm/SearchBar";
import { EmptyState } from "@/components/crm/EmptyState";

const LIMIT = 20;

type Empresa = {
  id: string;
  codigo: string | null;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
  segmento: string | null;
  prefixo_mercado: string | null;
  ativo: boolean | null;
  criado_em: string | null;
};

function formatData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatCnpj(cnpj: string | null): string {
  if (!cnpj) return "—";
  const d = cnpj.replace(/\D/g, "");
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  return cnpj;
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

export default function EmpresasPage() {
  const pathname = usePathname();
  const { setSlot } = useCrmHeaderSlot();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [total, setTotal] = useState(0);
  const [busca, setBusca] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [offset, setOffset] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);

  useEffect(() => {
    setCarregando(true);
    const p = new URLSearchParams({ offset: "0", ativo: String(ativo) });
    if (busca) p.set("busca", busca);

    fetch(`/api/crm/empresas?${p}`, { headers: internalApiHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setEmpresas(d.data ?? []);
        setTotal(d.total ?? 0);
        setOffset(LIMIT);
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [busca, ativo]);

  function carregarMais() {
    setCarregandoMais(true);
    const p = new URLSearchParams({ offset: String(offset), ativo: String(ativo) });
    if (busca) p.set("busca", busca);

    fetch(`/api/crm/empresas?${p}`, { headers: internalApiHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setEmpresas((prev) => [...prev, ...(d.data ?? [])]);
        setOffset((prev) => prev + LIMIT);
      })
      .catch(() => {})
      .finally(() => setCarregandoMais(false));
  }

  const temMais = empresas.length < total;

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
        { label: ativo ? "Ativas" : "Arquivadas", value: empresas.length, color: ativo ? "#22c55e" : "#8b949e" },
      ]} />

      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <SearchBar
          value={busca}
          onChange={setBusca}
          placeholder="Buscar por razão social, CNPJ ou email..."
        />
      </div>

      {/* Ativas / Arquivadas tab */}
      <div style={{ display: "flex", borderBottom: "1px solid #30363d", marginBottom: 20 }}>
        {[
          { id: true, label: "Ativas" },
          { id: false, label: "Arquivadas" },
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

      {/* Content */}
      {carregando ? (
        <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando...</p>
      ) : empresas.length === 0 ? (
        <EmptyState message="Nenhuma empresa encontrada." />
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={TH}>Código</th>
                  <th style={TH}>Razão Social</th>
                  <th style={TH}>Nome Fantasia</th>
                  <th style={TH}>CNPJ</th>
                  <th style={TH}>Segmento</th>
                  <th style={TH}>Cidade/UF</th>
                  <th style={TH}>Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => console.log(e.id)}
                    style={{ borderBottom: "1px solid #21262d", cursor: "pointer" }}
                    onMouseEnter={(el) => { (el.currentTarget as HTMLTableRowElement).style.background = "#161b22"; }}
                    onMouseLeave={(el) => { (el.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                  >
                    <td style={{ ...TD, color: "#8b949e", fontSize: 12 }}>{e.codigo || "—"}</td>
                    <td style={{ ...TD, fontWeight: 600 }}>{e.razao_social}</td>
                    <td style={{ ...TD, color: "#8b949e", fontSize: 12 }}>{e.nome_fantasia || "—"}</td>
                    <td style={{ ...TD, color: "#8b949e", fontSize: 12, fontFamily: "monospace" }}>{formatCnpj(e.cnpj)}</td>
                    <td style={TD}>
                      {e.segmento ? (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#8b949e22", color: "#8b949e", border: "1px solid #8b949e44" }}>
                          {e.segmento}
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ ...TD, color: "#8b949e", fontSize: 12 }}>
                      {e.cidade ? `${e.cidade}${e.estado ? `/${e.estado}` : ""}` : "—"}
                    </td>
                    <td style={{ ...TD, color: "#8b949e", fontSize: 12 }}>{formatData(e.criado_em)}</td>
                  </tr>
                ))}
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
                {carregandoMais ? "Carregando..." : `Carregar mais (${total - empresas.length} restantes)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
