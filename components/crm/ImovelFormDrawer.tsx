"use client";

import { useEffect, useState } from "react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import {
  RF_ACCENT,
  RF_BG_PANEL,
  RF_INPUT_STYLE,
  RF_TEXT_PRIMARY,
  rfAsideStyle,
  rfInputStyle,
  rfLabelStyle,
  rfOverlayStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";

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
    <div>
      <button type="button" aria-label="Fechar" onClick={onClose} style={rfOverlayStyle(50)} />
      <div
        style={{ ...rfAsideStyle(420, 51), padding: 24, color: RF_TEXT_PRIMARY }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 20px", fontSize: 18, color: RF_TEXT_PRIMARY }}>Novo imóvel</h2>
        <label style={{ ...rfLabelStyle(), marginBottom: 4 }}>Título *</label>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          style={inputStyle}
        />
        <label style={{ ...rfLabelStyle(), margin: "12px 0 4px" }}>Cidade / UF</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={cidade} onChange={(e) => setCidade(e.target.value)} style={{ ...inputStyle, flex: 2 }} placeholder="Cidade" />
          <input value={estado} onChange={(e) => setEstado(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="UF" maxLength={2} />
        </div>
        <label style={{ ...rfLabelStyle(), margin: "12px 0 4px" }}>Valor (R$)</label>
        <input value={valor} onChange={(e) => setValor(e.target.value)} type="number" style={inputStyle} />
        <label style={{ ...rfLabelStyle(), margin: "12px 0 4px" }}>Tipo</label>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={inputStyle}>
          <option value="apartamento">Apartamento</option>
          <option value="casa">Casa</option>
          <option value="terreno">Terreno</option>
          <option value="comercial">Comercial</option>
        </select>
        <label style={{ ...rfLabelStyle(), margin: "12px 0 4px" }}>Finalidade</label>
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

const inputStyle: React.CSSProperties = { ...RF_INPUT_STYLE, padding: "10px 12px", fontSize: 14 };

const btnPrimary: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 8,
  border: "none",
  background: RF_BG_PANEL,
  color: RF_ACCENT,
  fontWeight: 700,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 8,
  border: `1px solid rgba(63, 152, 72, 0.42)`,
  background: "transparent",
  color: RF_ACCENT,
  cursor: "pointer",
};
