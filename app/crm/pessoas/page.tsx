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

type Pessoa = {
  id: string;
  codigo: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  tipo: string;
  tipo_pessoa: string | null;
  empresa: string | null;
  cidade: string | null;
  estado: string | null;
  criado_em: string | null;
};

const TIPO_PILLS = [
  { id: "", label: "Todos" },
  { id: "PF", label: "Pessoa Física" },
  { id: "PJ", label: "Pessoa Jurídica" },
];

function formatData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
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

export default function PessoasPage() {
  const pathname = usePathname();
  const { setSlot } = useCrmHeaderSlot();
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [total, setTotal] = useState(0);
  const [busca, setBusca] = useState("");
  const [tipoPessoa, setTipoPessoa] = useState("");
  const [offset, setOffset] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);

  useEffect(() => {
    setCarregando(true);
    const p = new URLSearchParams({ offset: "0" });
    if (busca) p.set("busca", busca);
    if (tipoPessoa) p.set("tipo_pessoa", tipoPessoa);

    fetch(`/api/crm/pessoas?${p}`, { headers: internalApiHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setPessoas(d.data ?? []);
        setTotal(d.total ?? 0);
        setOffset(LIMIT);
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [busca, tipoPessoa]);

  function carregarMais() {
    setCarregandoMais(true);
    const p = new URLSearchParams({ offset: String(offset) });
    if (busca) p.set("busca", busca);
    if (tipoPessoa) p.set("tipo_pessoa", tipoPessoa);

    fetch(`/api/crm/pessoas?${p}`, { headers: internalApiHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setPessoas((prev) => [...prev, ...(d.data ?? [])]);
        setOffset((prev) => prev + LIMIT);
      })
      .catch(() => {})
      .finally(() => setCarregandoMais(false));
  }

  const pfCount = pessoas.filter((p) => p.tipo_pessoa === "PF").length;
  const pjCount = pessoas.filter((p) => p.tipo_pessoa === "PJ").length;
  const temMais = pessoas.length < total;

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
        { label: "PF", value: pfCount, color: "#3b82f6" },
        { label: "PJ", value: pjCount, color: "#10b981" },
      ]} />

      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <SearchBar
          value={busca}
          onChange={setBusca}
          placeholder="Buscar por nome, email ou telefone..."
        />
      </div>

      {/* Filter Pills */}
      <div style={{ marginBottom: 20 }}>
        <FilterPills pills={TIPO_PILLS} active={tipoPessoa} onChange={setTipoPessoa} />
      </div>

      {/* Content */}
      {carregando ? (
        <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando...</p>
      ) : pessoas.length === 0 ? (
        <EmptyState message="Nenhuma pessoa encontrada." />
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead>
                <tr>
                  <th style={TH}>Código</th>
                  <th style={TH}>Nome</th>
                  <th style={TH}>Tipo</th>
                  <th style={TH}>Empresa</th>
                  <th style={TH}>Cidade/UF</th>
                  <th style={TH}>Telefone</th>
                  <th style={TH}>Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {pessoas.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => console.log(p.id)}
                    style={{ borderBottom: "1px solid #21262d", cursor: "pointer" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#161b22"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                  >
                    <td style={{ ...TD, color: "#8b949e", fontSize: 12 }}>{p.codigo}</td>
                    <td style={{ ...TD, fontWeight: 600 }}>{p.nome}</td>
                    <td style={TD}>
                      {p.tipo_pessoa ? (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                          background: p.tipo_pessoa === "PF" ? "#3b82f622" : "#10b98122",
                          color: p.tipo_pessoa === "PF" ? "#3b82f6" : "#10b981",
                          border: `1px solid ${p.tipo_pessoa === "PF" ? "#3b82f644" : "#10b98144"}`,
                        }}>
                          {p.tipo_pessoa}
                        </span>
                      ) : (
                        <span style={{ color: "#8b949e", fontSize: 12 }}>{p.tipo || "—"}</span>
                      )}
                    </td>
                    <td style={{ ...TD, color: "#8b949e", fontSize: 12, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.empresa || "—"}
                    </td>
                    <td style={{ ...TD, color: "#8b949e", fontSize: 12 }}>
                      {p.cidade ? `${p.cidade}${p.estado ? `/${p.estado}` : ""}` : "—"}
                    </td>
                    <td style={{ ...TD, color: "#8b949e", fontSize: 12 }}>{p.telefone || "—"}</td>
                    <td style={{ ...TD, color: "#8b949e", fontSize: 12 }}>{formatData(p.criado_em)}</td>
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
                {carregandoMais ? "Carregando..." : `Carregar mais (${total - pessoas.length} restantes)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
