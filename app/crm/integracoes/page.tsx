"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import type { IntegracaoStatus } from "@/app/api/crm/integracoes/status/route";

const STATUS_LABELS: Record<
  IntegracaoStatus["status"],
  { label: string; cor: string }
> = {
  conectado: { label: "Conectado", cor: "#22c55e" },
  nao_configurado: { label: "Não configurado", cor: "#484f58" },
  erro: { label: "Erro", cor: "#f85149" },
  em_breve: { label: "Em breve", cor: "#c9a24a" },
};

const ICONS: Record<string, string> = {
  whatsapp: "💬",
  windsor: "📈",
  anthropic: "✨",
  meta: "📘",
  google_ads: "🔴",
  ga4: "📊",
};

export default function IntegracoesPage() {
  const [integracoes, setIntegracoes] = useState<IntegracaoStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/crm/integracoes/status", { headers: internalApiHeaders() })
      .then(async (res) => {
        const j = (await res.json()) as { integracoes?: IntegracaoStatus[] };
        setIntegracoes(j.integracoes ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-full bg-[#0d1117] px-4 py-8 sm:px-6">
      <Link
        href="/crm/configuracoes"
        className="mb-4 inline-block text-[11px] font-bold text-[#c9a24a] hover:underline"
      >
        ← Configurações
      </Link>
      <h1 className="text-xl font-bold text-[#e6edf3]">Integrações</h1>
      <p className="mt-1 text-sm text-[#8b949e]">Estado real das credenciais no ambiente.</p>

      {loading ? (
        <p className="mt-8 text-sm text-[#8b949e]">Carregando…</p>
      ) : (
        <div className="mt-6 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
          {integracoes.map((intg) => {
            const st = STATUS_LABELS[intg.status];
            return (
              <div
                key={intg.id}
                className="flex flex-col gap-3 rounded-xl border border-[#30363d] bg-[#161b22] p-4"
              >
                <div className="flex gap-3">
                  <span className="text-2xl">{ICONS[intg.id] ?? "🔌"}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#e6edf3]">{intg.nome}</p>
                    <p className="text-xs text-[#8b949e]">{intg.descricao}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.cor }} />
                  <span className="text-xs font-semibold" style={{ color: st.cor }}>
                    {st.label}
                  </span>
                </div>
                {intg.detail && <p className="text-[11px] text-[#6e7681]">{intg.detail}</p>}
                {intg.href && intg.status !== "em_breve" && (
                  <Link
                    href={intg.href}
                    className="min-h-10 rounded-lg border border-[#c9a24a44] bg-[#21262d] px-3 py-2 text-center text-xs font-bold text-[#c9a24a]"
                  >
                    {intg.status === "conectado" ? "Abrir" : "Configurar"}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
