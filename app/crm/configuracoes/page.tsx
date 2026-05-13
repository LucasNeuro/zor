"use client";

import { useEffect, useState } from "react";
import { CrmStickyPageHeader } from "@/components/crm/CrmStickyPageHeader";

type HealthCheck = {
  name: string;
  required: boolean;
  configured: boolean;
  area: string;
};

type HealthResponse = {
  status: "ok" | "degraded";
  missingRequired: string[];
  checks: HealthCheck[];
};

const LABELS: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "Supabase URL",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "Supabase anon key",
  SUPABASE_SERVICE_ROLE_KEY: "Supabase service role",
  INTERNAL_API_KEY: "Chave API interna",
  NEXT_PUBLIC_INTERNAL_API_KEY: "Chave API interna no browser",
  CRON_SECRET: "Segredo dos ciclos",
  WEBHOOK_SECRET: "Segredo do webhook WhatsApp",
  ANTHROPIC_API_KEY: "Anthropic API key",
  EVOLUTION_API_URL: "Evolution API URL",
  EVOLUTION_API_KEY: "Evolution API key",
  EVOLUTION_INSTANCE: "Instância Evolution",
  DEFAULT_TENANT_ID: "Tenant padrão server",
  NEXT_PUBLIC_TENANT_ID: "Tenant padrão browser",
  WINDSOR_API_KEY: "Windsor.ai",
};

const OPERACIONAL = [
  { titulo: "Horário de Atendimento", desc: "Ainda precisa tela de edição; regras hoje vivem em banco/configuração." },
  { titulo: "SLA por Canal", desc: "Ciclos de SLA existem em `/api/ciclos/atendente`, dependem de cron e dados reais." },
  { titulo: "Modo da IA por Tipo de Lead", desc: "Depende de `ANTHROPIC_API_KEY` e prompts em `lib/ia`." },
  { titulo: "Comissões por Categoria", desc: "Fluxo de parceiros existe parcialmente; regras financeiras ainda precisam módulo próprio." },
  { titulo: "Cadência de Follow-up", desc: "Usa `hub_followup_config`; precisa tela para editar sem SQL." },
  { titulo: "Gatilhos de Escalada", desc: "Base em governança/aprovações; faltam parâmetros editáveis por tenant." },
];

export default function Configuracoes() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then(async (res) => {
        const body = (await res.json()) as HealthResponse;
        setHealth(body);
      })
      .catch((error) => {
        setErro(error instanceof Error ? error.message : "Erro ao carregar status");
      });
  }, []);

  return (
    <div className="flex min-h-full flex-col bg-[#0d1117]">
      <CrmStickyPageHeader
        title="Configurações"
        description="Status operacional e lacunas de configuração do sistema"
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <div className="mb-6 rounded-xl border border-[#30363d] bg-[#161b22] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#e6edf3]">Ambiente e integrações</p>
              <p className="mt-1 text-xs text-[#8b949e]">
                Mostra apenas se cada variável está configurada, sem expor segredos.
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${
              health?.status === "ok" ? "bg-[#23863633] text-[#3fb950]" : "bg-[#d2992226] text-[#e3b341]"
            }`}>
              {health?.status === "ok" ? "Completo" : "Atenção"}
            </span>
          </div>

          {erro ? (
            <p className="mt-4 text-sm text-[#ff7b72]">{erro}</p>
          ) : !health ? (
            <p className="mt-4 text-sm text-[#8b949e]">Carregando status...</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
              {health.checks.map((check) => (
                <div key={check.name} className="flex items-center justify-between gap-3 rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[#e6edf3]">{LABELS[check.name] || check.name}</p>
                    <p className="text-[11px] text-[#6e7681]">{check.area}{check.required ? " · obrigatório" : " · opcional"}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${
                    check.configured ? "bg-[#23863633] text-[#3fb950]" : check.required ? "bg-[#f8514926] text-[#ff7b72]" : "bg-[#30363d] text-[#8b949e]"
                  }`}>
                    {check.configured ? "OK" : check.required ? "Falta" : "Opcional"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {OPERACIONAL.map((item) => (
            <div key={item.titulo} className="rounded-xl border border-[#30363d] bg-[#161b22] p-4">
              <p className="text-sm font-bold text-[#e6edf3]">{item.titulo}</p>
              <p className="mt-2 text-xs leading-5 text-[#8b949e]">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
