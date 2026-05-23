"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Eye, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { labelEmpresaSegmento } from "@/lib/crm/empresa-cadastro";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { KpiBar } from "@/components/crm/KpiBar";
import { SearchBar } from "@/components/crm/SearchBar";
import { EmptyState } from "@/components/crm/EmptyState";
import { EmpresaFormDrawer } from "@/components/crm/EmpresaFormDrawer";

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
  acesso_habilitado: boolean | null;
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
  const router = useRouter();
  const pathname = usePathname();
  const { setSlot } = useCrmHeaderSlot();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [total, setTotal] = useState(0);
  const [busca, setBusca] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [offset, setOffset] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState<Empresa | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [erroLista, setErroLista] = useState("");
  const popoverRef = useRef<HTMLDivElement | null>(null);

  function fecharConfirmExcluir() {
    setConfirmExcluir(null);
    setPopoverPos(null);
  }

  function abrirConfirmExcluir(e: Empresa, ev: React.MouseEvent) {
    ev.stopPropagation();
    setErroLista("");
    if (confirmExcluir?.id === e.id) {
      fecharConfirmExcluir();
      return;
    }
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    setPopoverPos({ top: rect.top, left: rect.right });
    setConfirmExcluir(e);
  }

  function irDetalhes(empresaId: string, ev: React.MouseEvent) {
    ev.stopPropagation();
    router.push(`/crm/empresas/${empresaId}`);
  }

  async function confirmarExclusao() {
    const e = confirmExcluir;
    if (!e) return;
    setExcluindoId(e.id);
    try {
      const res = await fetch(`/api/crm/empresas/${encodeURIComponent(e.id)}`, {
        method: "DELETE",
        headers: internalApiHeaders(),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErroLista(data.error || `Erro ${res.status} ao excluir.`);
        return;
      }
      fecharConfirmExcluir();
      setEmpresas((prev) => prev.filter((x) => x.id !== e.id));
      setTotal((t) => Math.max(0, t - 1));
    } catch {
      setErroLista("Erro de rede ao excluir a empresa.");
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

  const carregarLista = useCallback(() => {
    setErroLista("");
    setCarregando(true);
    const p = new URLSearchParams({ offset: "0", ativo: String(ativo) });
    if (busca) p.set("busca", busca);

    return fetch(`/api/crm/empresas?${p}`, { headers: internalApiHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setEmpresas(d.data ?? []);
        setTotal(d.total ?? 0);
        setOffset(LIMIT);
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [busca, ativo]);

  useEffect(() => {
    void carregarLista();
  }, [carregarLista]);

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
      {confirmExcluir && popoverPos && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-labelledby="excluir-empresa-titulo"
          onClick={(ev) => ev.stopPropagation()}
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
            id="excluir-empresa-titulo"
            style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e6edf3", lineHeight: 1.4 }}
          >
            Tem certeza que deseja excluir?
          </p>
          <p style={{ margin: "6px 0 12px", fontSize: 11, color: "#8b949e", lineHeight: 1.35 }}>
            {confirmExcluir.razao_social}
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
          {erroLista && (
            <p style={{ color: "#ef4444", fontSize: 12, margin: "0 0 12px" }}>{erroLista}</p>
          )}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={TH}>Código</th>
                  <th style={TH}>Razão Social</th>
                  <th style={TH}>Nome Fantasia</th>
                  <th style={TH}>CNPJ</th>
                  <th style={TH}>Segmento</th>
                  <th style={TH}>Acesso</th>
                  <th style={TH}>Cidade/UF</th>
                  <th style={TH}>Cadastro</th>
                  <th style={{ ...TH, width: 120, textAlign: "right" }} aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {empresas.map((e) => (
                  <tr
                    key={e.id}
                    style={{ borderBottom: "1px solid #21262d" }}
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
                          {labelEmpresaSegmento(e.segmento)}
                        </span>
                      ) : "—"}
                    </td>
                    <td style={TD}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 20,
                          background: e.acesso_habilitado !== false ? "#22c55e22" : "#8b949e22",
                          color: e.acesso_habilitado !== false ? "#22c55e" : "#8b949e",
                          border: `1px solid ${e.acesso_habilitado !== false ? "#22c55e44" : "#8b949e44"}`,
                        }}
                      >
                        {e.acesso_habilitado !== false ? "Ativo" : "Off"}
                      </span>
                    </td>
                    <td style={{ ...TD, color: "#8b949e", fontSize: 12 }}>
                      {e.cidade ? `${e.cidade}${e.estado ? `/${e.estado}` : ""}` : "—"}
                    </td>
                    <td style={{ ...TD, color: "#8b949e", fontSize: 12 }}>{formatData(e.criado_em)}</td>
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
                          onClick={(ev) => irDetalhes(e.id, ev)}
                          title="Detalhes"
                          aria-label={`Detalhes de ${e.razao_social}`}
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
                          onClick={(ev) => abrirConfirmExcluir(e, ev)}
                          disabled={excluindoId === e.id}
                          title="Excluir empresa"
                          aria-label={`Excluir ${e.razao_social}`}
                          aria-expanded={confirmExcluir?.id === e.id}
                          style={{
                            width: 32,
                            height: 28,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0,
                            border: 0,
                            borderRadius: 6,
                            cursor: excluindoId === e.id ? "not-allowed" : "pointer",
                            opacity: excluindoId === e.id ? 0.45 : 1,
                            background:
                              confirmExcluir?.id === e.id
                                ? "rgba(127, 29, 29, 0.45)"
                                : "rgba(127, 29, 29, 0.22)",
                            color: "#fca5a5",
                          }}
                        >
                          {excluindoId === e.id ? (
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
                {carregandoMais ? "Carregando..." : `Carregar mais (${total - empresas.length} restantes)`}
              </button>
            </div>
          )}
        </>
      )}

      <EmpresaFormDrawer
        open={drawerAberto}
        onClose={() => setDrawerAberto(false)}
        onSaved={(empresaId) => {
          void carregarLista();
          if (empresaId) router.push(`/crm/empresas/${empresaId}`);
        }}
      />
    </div>
  );
}
