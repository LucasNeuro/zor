"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";

type ObraPainel = {
  id: string;
  codigo: string | null;
  titulo: string;
  status: string;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
};

export default function ObraPainelPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [obra, setObra] = useState<ObraPainel | null>(null);
  const [pedidos, setPedidos] = useState<Record<string, unknown>[]>([]);
  const [checkins, setCheckins] = useState<Record<string, unknown>[]>([]);
  const [diario, setDiario] = useState<Record<string, unknown>[]>([]);

  const carregar = useCallback(async () => {
    const res = await fetch(`/api/crm/obras/${encodeURIComponent(id)}`, {
      headers: internalApiHeaders(),
    });
    const json = (await res.json()) as {
      data?: ObraPainel;
      pedidos?: Record<string, unknown>[];
      checkins?: Record<string, unknown>[];
      diario?: Record<string, unknown>[];
    };
    setObra(json.data ?? null);
    setPedidos(json.pedidos ?? []);
    setCheckins(json.checkins ?? []);
    setDiario(json.diario ?? []);
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (!obra) {
    return <p style={{ padding: 24, color: "#5d7a67" }}>Carregando painel da obra…</p>;
  }

  return (
    <div style={{ padding: 24, color: "#0b2210", maxWidth: 960 }}>
      <button type="button" onClick={() => router.push("/crm/obras")} style={{ color: "#5d7a67", marginBottom: 16 }}>
        ← Obras
      </button>
      <h1 style={{ margin: 0 }}>{obra.titulo}</h1>
      <p style={{ color: "#5d7a67", fontFamily: "monospace" }}>{obra.codigo} · {obra.status}</p>
      <p style={{ marginTop: 8, fontSize: 14 }}>
        {[obra.endereco, obra.cidade, obra.estado].filter(Boolean).join(" — ") || "Endereço não informado"}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 32 }}>
        <section style={{ background: "#ffffff", borderRadius: 10, padding: 16, border: "1px solid #dcebd8" }}>
          <h2 style={{ fontSize: 14, margin: "0 0 12px" }}>Pedidos de material</h2>
          {pedidos.length === 0 ? (
            <p style={{ fontSize: 12, color: "#5d7a67" }}>Nenhum pedido.</p>
          ) : (
            pedidos.map((p) => (
              <p key={String(p.id)} style={{ fontSize: 12, margin: "6px 0" }}>
                {String(p.descricao)} — {String(p.status)}
              </p>
            ))
          )}
        </section>
        <section style={{ background: "#ffffff", borderRadius: 10, padding: 16, border: "1px solid #dcebd8" }}>
          <h2 style={{ fontSize: 14, margin: "0 0 12px" }}>Check-ins</h2>
          {checkins.length === 0 ? (
            <p style={{ fontSize: 12, color: "#5d7a67" }}>Nenhum check-in.</p>
          ) : (
            checkins.map((c) => (
              <p key={String(c.id)} style={{ fontSize: 12, margin: "6px 0" }}>
                {String(c.tipo)} — {new Date(String(c.criado_em)).toLocaleString("pt-BR")}
              </p>
            ))
          )}
        </section>
        <section style={{ background: "#ffffff", borderRadius: 10, padding: 16, border: "1px solid #dcebd8" }}>
          <h2 style={{ fontSize: 14, margin: "0 0 12px" }}>Diário de obra</h2>
          {diario.length === 0 ? (
            <p style={{ fontSize: 12, color: "#5d7a67" }}>Sem registros.</p>
          ) : (
            diario.map((d) => (
              <p key={String(d.id)} style={{ fontSize: 12, margin: "6px 0" }}>
                {String(d.resumo).slice(0, 80)}
              </p>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
