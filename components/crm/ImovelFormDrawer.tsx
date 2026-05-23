"use client";

import { useEffect, useState } from "react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

export type ImovelEditInitial = {
  id: string;
  titulo: string;
  cidade?: string | null;
  estado?: string | null;
  valor?: number | null;
  tipo?: string;
  finalidade?: string;
  ativo?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: ImovelEditInitial | null;
};

export function ImovelFormDrawer({ open, onClose, onSaved, initial }: Props) {
  const [titulo, setTitulo] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [valor, setValor] = useState("");
  const [tipo, setTipo] = useState("apartamento");
  const [finalidade, setFinalidade] = useState("venda");
  const [ativo, setAtivo] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const isEdit = !!initial?.id;

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitulo(initial.titulo);
      setCidade(initial.cidade ?? "");
      setEstado(initial.estado ?? "");
      setValor(initial.valor != null ? String(initial.valor) : "");
      setTipo(initial.tipo ?? "apartamento");
      setFinalidade(initial.finalidade ?? "venda");
      setAtivo(initial.ativo !== false);
    } else {
      setTitulo("");
      setCidade("");
      setEstado("");
      setValor("");
      setTipo("apartamento");
      setFinalidade("venda");
      setAtivo(true);
    }
    setErro("");
  }, [open, initial]);

  if (!open) return null;

  async function salvar() {
    if (!titulo.trim()) {
      setErro("Título obrigatório");
      return;
    }
    setSalvando(true);
    setErro("");
    const payload = {
      titulo: titulo.trim(),
      cidade: cidade || null,
      estado: estado || null,
      valor: valor ? Number(valor) : null,
      tipo,
      finalidade,
      ativo,
    };
    const res = await fetch(
      isEdit ? `/api/crm/imoveis/${initial!.id}` : "/api/crm/imoveis",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify(payload),
      }
    );
    const json = (await res.json()) as { error?: string };
    setSalvando(false);
    if (!res.ok) {
      setErro(json.error || "Erro ao salvar");
      return;
    }
    if (!isEdit) {
      setTitulo("");
      setCidade("");
      setEstado("");
      setValor("");
    }
    onSaved();
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          height: "100%",
          background: "#161b22",
          borderLeft: "1px solid #30363d",
          padding: 24,
          color: "#e6edf3",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 20px", fontSize: 18 }}>Novo imóvel</h2>
        <label style={{ display: "block", fontSize: 12, color: "#8b949e", marginBottom: 4 }}>Título *</label>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          style={inputStyle}
        />
        <label style={{ display: "block", fontSize: 12, color: "#8b949e", margin: "12px 0 4px" }}>Cidade / UF</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={cidade} onChange={(e) => setCidade(e.target.value)} style={{ ...inputStyle, flex: 2 }} placeholder="Cidade" />
          <input value={estado} onChange={(e) => setEstado(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="UF" maxLength={2} />
        </div>
        <label style={{ display: "block", fontSize: 12, color: "#8b949e", margin: "12px 0 4px" }}>Valor (R$)</label>
        <input value={valor} onChange={(e) => setValor(e.target.value)} type="number" style={inputStyle} />
        <label style={{ display: "block", fontSize: 12, color: "#8b949e", margin: "12px 0 4px" }}>Tipo</label>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={inputStyle}>
          <option value="apartamento">Apartamento</option>
          <option value="casa">Casa</option>
          <option value="terreno">Terreno</option>
          <option value="comercial">Comercial</option>
        </select>
        <label style={{ display: "block", fontSize: 12, color: "#8b949e", margin: "12px 0 4px" }}>Finalidade</label>
        <select value={finalidade} onChange={(e) => setFinalidade(e.target.value)} style={inputStyle}>
          <option value="venda">Venda</option>
          <option value="locacao">Locação</option>
        </select>
        {erro && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 12 }}>{erro}</p>}
        <div style={{ marginTop: 24, display: "flex", gap: 8 }}>
          <button type="button" onClick={() => void salvar()} disabled={salvando} style={btnPrimary}>
            {salvando ? "Salvando…" : "Salvar"}
          </button>
          <button type="button" onClick={onClose} style={btnSecondary}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #30363d",
  background: "#0d1117",
  color: "#e6edf3",
  fontSize: 14,
  boxSizing: "border-box",
};

const btnPrimary: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 8,
  border: "none",
  background: "#003b26",
  color: "#c9a24a",
  fontWeight: 700,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 8,
  border: "1px solid #30363d",
  background: "transparent",
  color: "#8b949e",
  cursor: "pointer",
};
