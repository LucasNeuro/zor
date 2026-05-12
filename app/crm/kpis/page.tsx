"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

type Meta = Record<string, unknown>;
type Resultado = Record<string, unknown>;

export default function KpisPage() {
  const [metas, setMetas] = useState<Meta[]>([]);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      const [m, r] = await Promise.all([
        supabase.from("hub_kpis_metas").select("*").eq("ativo", true),
        supabase.from("hub_kpis_resultados").select("*")
          .gte("criado_em", new Date(Date.now() - 86400000).toISOString())
          .order("criado_em", { ascending: false }),
      ]);
      if (m.data) setMetas(m.data);
      if (r.data) setResultados(r.data);
      setCarregando(false);
    }
    carregar();
  }, []);

  const getResultado = (kpiSlug: string, agenteSlug: string) =>
    resultados.find(r => r.kpi_slug === kpiSlug && r.agente_slug === agenteSlug);

  const nivelCor = (n: string) =>
    ({ ok: "text-[#3fb950]", atencao: "text-[#d29922]", critico: "text-[#f85149]" }[n] || "text-[#8b949e]");

  return (
    <div className="flex min-h-full flex-col bg-[#0d1117]">
      <div className="min-h-0 flex-1 px-3 py-4 sm:px-6 sm:py-6">
        {carregando ? (
          <div className="mt-12 text-center text-[#8b949e]">Carregando KPIs...</div>
        ) : metas.length === 0 ? (
          <div className="mt-12 text-center">
            <div className="mb-3 text-4xl">📊</div>
            <p className="font-bold text-[#e6edf3]">Nenhuma meta configurada ainda</p>
            <p className="mt-1 text-sm text-[#8b949e]">As metas são criadas automaticamente quando o sistema inicia</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {metas.map(meta => {
              const resultado = getResultado(meta.kpi_slug as string, meta.agente_slug as string);
              const nivel = resultado?.nivel_alerta as string || "ok";
              const borderCor = nivel === "critico" ? "border-[#f8514966]" : nivel === "atencao" ? "border-[#d2992266]" : "border-[#30363d]";
              const badgeCor = nivel === "critico" ? "bg-[#f8514926] text-[#ff7b72]" : nivel === "atencao" ? "bg-[#d2992226] text-[#e3b341]" : "bg-[#23863633] text-[#3fb950]";
              return (
                <div key={meta.id as string} className={`rounded-xl border bg-[#161b22] p-4 ${borderCor}`}>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#e6edf3]">{meta.kpi_slug as string}</p>
                      <p className="text-xs text-[#8b949e]">{meta.agente_slug as string}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${badgeCor}`}>
                      {nivel === "ok" ? "✓ OK" : nivel === "atencao" ? "⚠ Atenção" : "🔴 Crítico"}
                    </span>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p className="text-xs text-[#8b949e]">Valor atual</p>
                      <p className={`text-lg font-bold ${nivelCor(nivel)}`}>
                        {resultado ? Number(resultado.valor).toFixed(1) : "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#8b949e]">Meta</p>
                      <p className="text-sm font-bold text-[#e6edf3]">{meta.valor_meta as number}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-[#6e7681]">
                    <span>Atenção: {meta.valor_atencao as number}</span>
                    <span>Crítico: {meta.valor_critico as number}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
