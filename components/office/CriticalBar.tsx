"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

interface CriticalBarProps {
  onVerInbox: () => void;
}

type CriticalItem = {
  id: string;
  titulo: string;
  valor: number;
  criado_em: string;
};

export default function CriticalBar({ onVerInbox }: CriticalBarProps) {
  const [criticals, setCriticals] = useState<CriticalItem[]>([]);

  useEffect(() => {
    let mounted = true;

    async function carregar() {
      const [aprovacoes, alertas] = await Promise.all([
        supabase
          .from("hub_aprovacoes")
          .select("id, descricao, valor_envolvido, criado_em")
          .eq("status", "pendente")
          .order("criado_em", { ascending: false })
          .limit(10),
        supabase
          .from("hub_alertas")
          .select("id, titulo, dados, criado_em")
          .eq("resolvido", false)
          .eq("tipo", "critico")
          .order("criado_em", { ascending: false })
          .limit(10),
      ]);

      if (!mounted) return;

      const aprovacaoItems = (aprovacoes.data || []).map((item) => ({
        id: `aprovacao:${item.id}`,
        titulo: item.descricao || "Aprovação pendente",
        valor: Number(item.valor_envolvido) || 0,
        criado_em: item.criado_em,
      }));

      const alertaItems = (alertas.data || []).map((item) => {
        const dados = (item.dados || {}) as Record<string, unknown>;
        return {
          id: `alerta:${item.id}`,
          titulo: item.titulo || "Alerta crítico",
          valor: Number(dados.valor_envolvido || dados.valor_estimado || dados.receita_em_risco) || 0,
          criado_em: item.criado_em,
        };
      });

      setCriticals([...aprovacaoItems, ...alertaItems]);
    }

    carregar();
    const channel = supabase
      .channel("critical-bar")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_aprovacoes" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_alertas" }, carregar)
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  if (criticals.length === 0) return null;

  const topDecision = [...criticals].sort((a, b) => b.valor - a.valor)[0];
  const totalRisco = criticals.reduce((total, item) => total + item.valor, 0);

  return (
    <div style={{
      height: 44, padding: "0 20px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: "rgba(239,68,68,0.08)", borderBottom: "1px solid rgba(239,68,68,0.2)",
      flexShrink: 0, gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
          background: "#ef4444", boxShadow: "0 0 8px #ef4444",
          animation: "pulse 1.5s infinite",
        }} />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <strong style={{ color: "#ef4444" }}>
            {criticals.length} crítico{criticals.length > 1 ? "s" : ""}
          </strong>
          {" "}exigem ação —{" "}
          <strong>{totalRisco > 0 ? `R${(totalRisco / 1000).toFixed(0)}k` : "valor a revisar"}</strong>
          {" "}em risco — Próxima: {topDecision.titulo}
        </span>
      </div>
      <button
        onClick={onVerInbox}
        style={{
          padding: "6px 14px", borderRadius: 6, flexShrink: 0, whiteSpace: "nowrap",
          background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)",
          color: "#ef4444", fontSize: 11, cursor: "pointer", fontWeight: 700,
          transition: "all 150ms",
        }}
      >
        Ver o que precisa de mim →
      </button>
    </div>
  );
}
