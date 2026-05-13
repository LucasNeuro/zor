"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

interface MobileCriticalBarProps {
  onVerInbox: () => void;
}

export default function MobileCriticalBar({ onVerInbox }: MobileCriticalBarProps) {
  const [total, setTotal] = useState(0);
  const [valor, setValor] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function carregar() {
      const [aprovacoes, alertas] = await Promise.all([
        supabase.from("hub_aprovacoes").select("id, valor_envolvido").eq("status", "pendente"),
        supabase.from("hub_alertas").select("id, dados").eq("resolvido", false).eq("tipo", "critico"),
      ]);

      if (!mounted) return;
      const valorAprovacoes = (aprovacoes.data || []).reduce((sum, item) => sum + (Number(item.valor_envolvido) || 0), 0);
      const valorAlertas = (alertas.data || []).reduce((sum, item) => {
        const dados = (item.dados || {}) as Record<string, unknown>;
        return sum + (Number(dados.valor_envolvido || dados.valor_estimado || dados.receita_em_risco) || 0);
      }, 0);
      setTotal((aprovacoes.data?.length || 0) + (alertas.data?.length || 0));
      setValor(valorAprovacoes + valorAlertas);
    }

    carregar();
    const channel = supabase
      .channel("mobile-critical-bar")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_aprovacoes" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_alertas" }, carregar)
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  if (total === 0) return null;

  return (
    <div
      onClick={onVerInbox}
      style={{
        margin: "8px 16px",
        padding: "10px 14px",
        borderRadius: 10,
        background: "rgba(239,68,68,0.1)",
        border: "1px solid rgba(239,68,68,0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: "#ef4444", boxShadow: "0 0 8px #ef4444",
          animation: "pulse 1.5s infinite", flexShrink: 0,
        }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444" }}>
            {total} decisões críticas
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
            {valor > 0 ? `R${(valor / 1000).toFixed(0)}k em risco` : "Revisão pendente"}
          </div>
        </div>
      </div>
      <span style={{ fontSize: 16, color: "#ef4444" }}>→</span>
    </div>
  );
}
