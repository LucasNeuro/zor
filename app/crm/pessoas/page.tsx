"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Eye, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { KpiBar } from "@/components/crm/KpiBar";
import { SearchBar } from "@/components/crm/SearchBar";
import { FilterPills } from "@/components/crm/FilterPills";
import { EmptyState } from "@/components/crm/EmptyState";
import { PessoaFormModal } from "@/components/crm/PessoaFormModal";
import { labelAreaAtuacao } from "@/lib/crm/areas-atuacao";

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
  area_atuacao: string | null;
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
  const router = useRouter();
  const pathname = usePathname();
  const { setSlot } = useCrmHeaderSlot();
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [total, setTotal] = useState(0);
  const [statsPf, setStatsPf] = useState(0);
  const [statsPj, setStatsPj] = useState(0);
  const [busca, setBusca] = useState("");
  const [tipoPessoa, setTipoPessoa] = useState("");
  const [offset, setOffset] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState<Pessoa | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [erroLista, setErroLista] = useState("");
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const carregarLista = useCallback(() => {
    setErroLista("");
    setCarregando(true);
    const p = new URLSearchParams({ offset: "0" });
    if (busca) p.set("busca", busca);
    if (tipoPessoa) p.set("tipo_pessoa", tipoPessoa);

    return fetch(`/api/crm/pessoas?${p}`, { headers: internalApiHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setPessoas(d.data ?? []);
        setTotal(d.total ?? 0);
        setStatsPf(d.stats?.pf ?? 0);
        setStatsPj(d.stats?.pj ?? 0);
        setOffset(LIMIT);
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [busca, tipoPessoa]);

  useEffect(() => {
    void carregarLista();
  }, [carregarLista]);

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

  const temMais = pessoas.length < total;

  function fecharConfirmExcluir() {
    setConfirmExcluir(null);
    setPopoverPos(null);
  }

  function irDetalhes(pessoaId: string, ev: React.MouseEvent) {
    ev.stopPropagation();
    router.push(`/crm/pessoas/${pessoaId}`);
  }

  function abrirConfirmExcluir(p: Pessoa, e: React.MouseEvent) {
    e.stopPropagation();
    setErroLista("");
    if (confirmExcluir?.id === p.id) {
      fecharConfirmExcluir();
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopoverPos({ top: rect.top, left: rect.right });
    setConfirmExcluir(p);
  }

  async function confirmarExclusao() {
    const p = confirmExcluir;
    if (!p) return;
    setExcluindoId(p.id);
    try {
      const res = await fetch(`/api/crm/pessoas/${encodeURIComponent(p.id)}`, {
        method: "DELETE",
        headers: internalApiHeaders(),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErroLista(data.error || `Erro ${res.status} ao excluir.`);
        return;
      }
      fecharConfirmExcluir();
      setPessoas((prev) => prev.filter((x) => x.id !== p.id));
      setTotal((t) => Math.max(0, t - 1));
      if (p.tipo_pessoa === "PF") setStatsPf((n) => Math.max(0, n - 1));
      if (p.tipo_pessoa === "PJ") setStatsPj((n) => Math.max(0, n - 1));
    } catch {
      setErroLista("Erro de rede ao excluir o cadastro.");
    } finally {
      setExcluindoId(null);
    }
  }

  useEffect(() => {
    if (!confirmExcluir) return;
    const onPointerDown = (ev: MouseEvent) => {
      const target = ev.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if ((target as Element).closest?.("[data-excluir-trigger]")) return;
      fecharConfirmExcluir();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") fecharConfirmExcluir();
    };
    const onScroll = () => fecharConfirmExcluir();
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [confirmExcluir]);

  useEffect(() => {
    setSlot({
      path: pathname,
      actions: (
        <button
          type="button"
          onClick={() => setModalAberto(true)}
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
      <PessoaFormModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        onSaved={(pessoaId) => {
          void carregarLista();
          if (pessoaId) router.push(`/crm/pessoas/${pessoaId}`);
        }}
      />

      {confirmExcluir && popoverPos && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-labelledby="excluir-pessoa-titulo"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: popoverPos.top - 8,
            left: Math.max(12, popoverPos.left - 220),
            transform: "translateY(-100%)",
            zIndex: 300,
            width: 220,
            padding: "12px 14px",
            borderRadius: 10,
            background: "#161b22",
            border: "1px solid #30363d",
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          }}
        >
          <p
            id="excluir-pessoa-titulo"
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 600,
              color: "#e6edf3",
              lineHeight: 1.4,
            }}
          >
            Tem certeza que deseja excluir?
          </p>
          <p
            style={{
              margin: "6px 0 12px",
              fontSize: 11,
              color: "#8b949e",
              lineHeight: 1.35,
            }}
          >
            {confirmExcluir.nome}
            {confirmExcluir.codigo ? ` · ${confirmExcluir.codigo}` : ""}
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={fecharConfirmExcluir}
              disabled={excluindoId === confirmExcluir.id}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid #30363d",
                background: "transparent",
                color: "#8b949e",
                fontSize: 12,
                fontWeight: 600,
                cursor: excluindoId === confirmExcluir.id ? "not-allowed" : "pointer",
              }}
            >
              Não
            </button>
            <button
              type="button"
              onClick={() => void confirmarExclusao()}
              disabled={excluindoId === confirmExcluir.id}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "none",
                background: "#7f1d1d",
                color: "#fecaca",
                fontSize: 12,
                fontWeight: 700,
                cursor: excluindoId === confirmExcluir.id ? "not-allowed" : "pointer",
                opacity: excluindoId === confirmExcluir.id ? 0.7 : 1,
              }}
            >
              {excluindoId === confirmExcluir.id ? "…" : "Sim"}
            </button>
          </div>
        </div>
      )}

      {/* KPI Bar */}
      <KpiBar kpis={[
        { label: "Total", value: total, color: "#c9a24a" },
        { label: "PF", value: statsPf, color: "#3b82f6" },
        { label: "PJ", value: statsPj, color: "#10b981" },
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
          {erroLista && (
            <p style={{ color: "#ef4444", fontSize: 12, margin: "0 0 12px" }}>{erroLista}</p>
          )}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead>
                <tr>
                  <th style={TH}>Código</th>
                  <th style={TH}>Nome</th>
                  <th style={TH}>Tipo</th>
                  <th style={TH}>Empresa</th>
                  <th style={TH}>Área</th>
                  <th style={TH}>Cidade/UF</th>
                  <th style={TH}>Telefone</th>
                  <th style={TH}>Cadastro</th>
                  <th style={{ ...TH, width: 120, textAlign: "right" }} aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {pessoas.map((p) => (
                  <tr
                    key={p.id}
                    style={{ borderBottom: "1px solid #21262d" }}
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
                    <td style={{ ...TD, color: "#8b949e", fontSize: 12, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.area_atuacao ? labelAreaAtuacao(p.area_atuacao) : "—"}
                    </td>
                    <td style={{ ...TD, color: "#8b949e", fontSize: 12 }}>
                      {p.cidade ? `${p.cidade}${p.estado ? `/${p.estado}` : ""}` : "—"}
                    </td>
                    <td style={{ ...TD, color: "#8b949e", fontSize: 12 }}>{p.telefone || "—"}</td>
                    <td style={{ ...TD, color: "#8b949e", fontSize: 12 }}>{formatData(p.criado_em)}</td>
                    <td style={{ ...TD, textAlign: "right", width: 120 }}>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          gap: 6,
                        }}
                      >
                        <button
                          type="button"
                          onClick={(ev) => irDetalhes(p.id, ev)}
                          title="Detalhes"
                          aria-label={`Detalhes de ${p.nome}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            height: 28,
                            padding: "0 8px",
                            border: 0,
                            borderRadius: 6,
                            cursor: "pointer",
                            background: "rgba(0, 59, 38, 0.45)",
                            color: "#c9a24a",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          <Eye size={14} strokeWidth={2.25} aria-hidden />
                          Detalhes
                        </button>
                        <button
                          type="button"
                          data-excluir-trigger
                          onClick={(e) => abrirConfirmExcluir(p, e)}
                          disabled={excluindoId === p.id}
                          title="Excluir cadastro"
                          aria-label={`Excluir ${p.nome}`}
                          aria-expanded={confirmExcluir?.id === p.id}
                          style={{
                            width: 32,
                            height: 28,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0,
                            border: 0,
                            borderRadius: 6,
                            cursor: excluindoId === p.id ? "not-allowed" : "pointer",
                            opacity: excluindoId === p.id ? 0.45 : 1,
                            background:
                              confirmExcluir?.id === p.id
                                ? "rgba(127, 29, 29, 0.45)"
                                : "rgba(127, 29, 29, 0.22)",
                            color: "#fca5a5",
                          }}
                        >
                          {excluindoId === p.id ? (
                            <span style={{ fontSize: 11, fontWeight: 700 }}>…</span>
                          ) : (
                            <Trash2 size={15} strokeWidth={2.25} aria-hidden />
                          )}
                        </button>
                      </div>
                    </td>
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
