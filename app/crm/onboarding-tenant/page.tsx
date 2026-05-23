"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

type Step = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  href?: string;
};

type StatusPayload = {
  progress: number;
  completed: number;
  total: number;
  ready: boolean;
  steps: Step[];
  error?: string;
};

export default function OnboardingTenantPage() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/crm/onboarding/status", { headers: internalApiHeaders() })
      .then(async (res) => {
        const json = (await res.json()) as StatusPayload & { error?: string };
        if (!res.ok) setData({ progress: 0, completed: 0, total: 0, ready: false, steps: [], error: json.error });
        else setData(json);
      })
      .catch(() =>
        setData({
          progress: 0,
          completed: 0,
          total: 0,
          ready: false,
          steps: [],
          error: "Erro de rede",
        })
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto min-h-full max-w-2xl bg-[#0d1117] px-4 py-8 text-[#e6edf3]">
      <h1 className="text-xl font-bold">Onboarding do tenant</h1>
      <p className="mt-1 text-sm text-[#8b949e]">
        Checklist vivo para colocar o CRM Obra10+ em produção no seu escritório.
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-[#8b949e]">A verificar estado…</p>
      ) : data?.error ? (
        <p className="mt-8 text-sm text-[#ff7b72]">{data.error}</p>
      ) : (
        <>
          <div className="mt-6 rounded-xl border border-[#30363d] bg-[#161b22] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold">Progresso</span>
              <span className="text-sm tabular-nums text-[#c9a24a]">{data?.progress ?? 0}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#21262d]">
              <div
                className="h-full rounded-full bg-[#c9a24a] transition-all"
                style={{ width: `${data?.progress ?? 0}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[#8b949e]">
              {data?.completed}/{data?.total} passos —{" "}
              {data?.ready ? "Pronto para operar" : "Conclua os itens em falta"}
            </p>
          </div>

          <ol className="mt-6 space-y-3">
            {(data?.steps ?? []).map((step, i) => (
              <li
                key={step.id}
                className="flex gap-3 rounded-xl border border-[#30363d] bg-[#161b22] p-4"
              >
                {step.ok ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#3fb950]" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-[#484f58]" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {i + 1}. {step.label}
                  </p>
                  <p className="mt-1 text-xs text-[#8b949e]">{step.detail}</p>
                  {step.href && !step.ok && (
                    <Link
                      href={step.href}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#c9a24a] hover:underline"
                    >
                      Configurar
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {data?.ready && (
            <Link
              href="/crm"
              className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[#c9a24a] px-4 text-sm font-bold text-[#003b26]"
            >
              Ir para o Dashboard
            </Link>
          )}
        </>
      )}
    </div>
  );
}
