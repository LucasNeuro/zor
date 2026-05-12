"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";

type Campanha = {
  campaign_name: string;
  spend: number;
  clicks: number;
  impressions: number;
  cpc: number;
  ctr: number;
  conversions: number;
};

const PERIODOS = [
  { label: "7 dias", value: "7d" },
  { label: "14 dias", value: "14d" },
  { label: "30 dias", value: "30d" },
];

function moeda(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(v);
}

function num(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

export default function TrafegoPage() {
  const pathname = usePathname();
  const { setSlot } = useCrmHeaderSlot();
  const [periodo, setPeriodo] = useState("7d");
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErro(null);
    fetch(`/api/windsor/campanhas?periodo=${periodo}`, { headers: internalApiHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setErro(d.error); setCampanhas([]); }
        else setCampanhas(Array.isArray(d) ? d : []);
      })
      .catch(() => setErro("Erro ao conectar com Windsor.ai"))
      .finally(() => setLoading(false));
  }, [periodo]);

  const totalGasto = campanhas.reduce((s, c) => s + c.spend, 0);
  const totalCliques = campanhas.reduce((s, c) => s + c.clicks, 0);
  const totalConversoes = campanhas.reduce((s, c) => s + (c.conversions || 0), 0);
  const cpcMedio = totalCliques > 0 ? totalGasto / totalCliques : 0;

  const kpis = [
    { label: "Gasto Total", value: moeda(totalGasto), cor: "#EF4444" },
    { label: "Cliques", value: num(totalCliques), cor: "#3B82F6" },
    { label: "CPC Médio", value: moeda(cpcMedio), cor: "#F97316" },
    { label: "Conversões", value: String(totalConversoes), cor: "#22C55E" },
  ];

  useEffect(() => {
    setSlot({
      path: pathname,
      actions: (
        <div className="flex rounded-lg p-0.5" style={{ background: "#21262d" }}>
          {PERIODOS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriodo(p.value)}
              className="rounded-md px-3 py-1.5 text-xs font-bold transition-colors"
              style={{
                background: periodo === p.value ? "#30363d" : "transparent",
                color: periodo === p.value ? "#e6edf3" : "#8b949e",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      ),
    });
    return () => setSlot(null);
  }, [pathname, setSlot, periodo]);

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: "#0d1117" }}>
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-px flex-shrink-0" style={{ background: "#21262d" }}>
        {kpis.map(k => (
          <div key={k.label} className="px-5 py-3" style={{ background: "#0d1117" }}>
            <p className="text-xs mb-0.5" style={{ color: "#8b949e" }}>{k.label}</p>
            <p className="font-black text-lg" style={{ color: loading ? "#484f58" : k.cor }}>{loading ? "—" : k.value}</p>
          </div>
        ))}
      </div>

      {/* Campanhas */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading && (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "#30363d", borderTopColor: "#c9a24a" }} />
          </div>
        )}

        {!loading && erro && (
          <div className="rounded-xl p-6 text-center" style={{ background: "#1a0a0a", border: "1px solid #4a1a1a" }}>
            <p className="text-sm mb-1" style={{ color: "#EF4444" }}>Erro ao carregar dados</p>
            <p className="text-xs" style={{ color: "#8b949e" }}>{erro}</p>
            <p className="text-xs mt-3" style={{ color: "#484f58" }}>Configure a integração Windsor.ai em /crm/configuracoes</p>
          </div>
        )}

        {!loading && !erro && campanhas.length === 0 && (
          <div className="rounded-xl p-8 text-center" style={{ background: "#161b22", border: "1px solid #30363d" }}>
            <p className="text-4xl mb-3">📡</p>
            <p className="font-bold mb-1" style={{ color: "#e6edf3" }}>Nenhuma campanha encontrada</p>
            <p className="text-xs" style={{ color: "#8b949e" }}>Conecte suas contas de anúncios no Windsor.ai</p>
          </div>
        )}

        {!loading && !erro && campanhas.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #30363d" }}>
            <table className="w-full text-sm">
              <thead style={{ background: "#161b22" }}>
                <tr>
                  {["Campanha", "Gasto", "Cliques", "Impressões", "CTR", "CPC", "Conversões"].map(h => (
                    <th key={h} className="text-left text-xs font-bold uppercase tracking-wide px-4 py-3" style={{ color: "#8b949e" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campanhas.map((c, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #21262d" }}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-xs truncate max-w-xs" style={{ color: "#e6edf3" }}>{c.campaign_name}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-xs" style={{ color: "#EF4444" }}>{moeda(c.spend)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#3B82F6" }}>{num(c.clicks)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#8b949e" }}>{num(c.impressions)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#F97316" }}>{(c.ctr * 100).toFixed(2)}%</td>
                    <td className="px-4 py-3 text-xs font-bold" style={{ color: "#c9a24a" }}>{moeda(c.cpc)}</td>
                    <td className="px-4 py-3 text-xs font-bold" style={{ color: "#22C55E" }}>{c.conversions || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
