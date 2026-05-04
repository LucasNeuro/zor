"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
    ({ ok: "text-green-400", atencao: "text-yellow-400", critico: "text-red-400" }[n] || "text-gray-400");

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div>
          <h1 className="text-white font-bold text-lg">Painel de KPIs</h1>
          <p className="text-gray-500 text-xs">Métricas em tempo real — últimas 24h</p>
        </div>
      </div>

      <div className="p-6">
        {carregando ? (
          <div className="text-center text-gray-500 mt-12">Carregando KPIs...</div>
        ) : metas.length === 0 ? (
          <div className="text-center mt-12">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-gray-400 font-bold">Nenhuma meta configurada ainda</p>
            <p className="text-gray-600 text-sm mt-1">As metas são criadas automaticamente quando o sistema inicia</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {metas.map(meta => {
              const resultado = getResultado(meta.kpi_slug as string, meta.agente_slug as string);
              const nivel = resultado?.nivel_alerta as string || "ok";
              const borderCor = nivel === "critico" ? "border-red-800" : nivel === "atencao" ? "border-yellow-800" : "border-gray-800";
              const badgeCor = nivel === "critico" ? "bg-red-900 text-red-300" : nivel === "atencao" ? "bg-yellow-900 text-yellow-300" : "bg-green-900 text-green-300";
              return (
                <div key={meta.id as string} className={`bg-gray-900 rounded-xl border p-4 ${borderCor}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-white font-bold text-sm">{meta.kpi_slug as string}</p>
                      <p className="text-gray-500 text-xs">{meta.agente_slug as string}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${badgeCor}`}>
                      {nivel === "ok" ? "✓ OK" : nivel === "atencao" ? "⚠ Atenção" : "🔴 Crítico"}
                    </span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-gray-500 text-xs">Valor atual</p>
                      <p className={`font-bold text-lg ${nivelCor(nivel)}`}>
                        {resultado ? Number(resultado.valor).toFixed(1) : "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500 text-xs">Meta</p>
                      <p className="text-white text-sm font-bold">{meta.valor_meta as number}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
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
