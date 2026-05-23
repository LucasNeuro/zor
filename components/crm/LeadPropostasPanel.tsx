"use client";

import { useCallback, useEffect, useState } from "react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

type Proposta = {
  id: string;
  titulo: string;
  valor: number;
  status: string;
  criado_em: string;
};

export function LeadPropostasPanel({ leadId }: { leadId: string }) {
  const [lista, setLista] = useState<Proposta[]>([]);
  const [titulo, setTitulo] = useState("");
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const res = await fetch(`/api/crm/leads/${leadId}/propostas`, { headers: internalApiHeaders() });
    const json = (await res.json()) as { data?: Proposta[] };
    setLista(json.data ?? []);
  }, [leadId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function criar() {
    if (!titulo.trim()) return;
    setSalvando(true);
    await fetch(`/api/crm/leads/${leadId}/propostas`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ titulo: titulo.trim(), valor: Number(valor) || 0 }),
    });
    setTitulo("");
    setValor("");
    setSalvando(false);
    void carregar();
  }

  return (
    <div
      className="rounded-lg border p-3"
      style={{ borderColor: "rgba(48, 54, 61, 0.38)", background: "rgba(8, 12, 20, 0.65)" }}
    >
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#7d8a99", margin: "0 0 10px" }}>
        Propostas
      </p>
      {lista.length === 0 ? (
        <p className="text-xs" style={{ color: "#8b949e" }}>Nenhuma proposta ainda.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 10px" }}>
          {lista.map((p) => (
            <li key={p.id} style={{ fontSize: 12, marginBottom: 6, color: "#e6edf3" }}>
              {p.titulo} — R$ {Number(p.valor).toLocaleString("pt-BR")}{" "}
              <span style={{ color: "#8b949e" }}>({p.status})</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2">
        <input
          placeholder="Título da proposta"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="rounded border px-2 py-1.5 text-xs"
          style={{ borderColor: "#30363d", background: "#0d1117", color: "#e6edf3" }}
        />
        <input
          placeholder="Valor R$"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          type="number"
          className="rounded border px-2 py-1.5 text-xs"
          style={{ borderColor: "#30363d", background: "#0d1117", color: "#e6edf3" }}
        />
        <button
          type="button"
          disabled={salvando}
          onClick={() => void criar()}
          className="rounded px-3 py-1.5 text-xs font-bold"
          style={{ background: "#003b26", color: "#c9a24a", border: "none", cursor: "pointer" }}
        >
          + Nova proposta
        </button>
      </div>
    </div>
  );
}
