"use client";

/**
 * Checklist operacional para segundo tenant (piloto) — Fase 4.
 * Execução SQL: supabase/migrations/20260509120000_hub_ciclos_slugs_e_tenants.sql
 */
export default function OnboardingTenantPage() {
  const itens = [
    "Rodar migração `hub_tenants` + `tenant_id` nas tabelas piloto.",
    "Criar linha em `hub_tenants` para o cliente piloto (slug único).",
    "Ativar RLS no Supabase com política `tenant_id = jwt_tenant()` (JWT custom claim).",
    "Publicar `NEXT_PUBLIC_DEFAULT_TENANT_SLUG` ou resolver tenant por host.",
    "Validar zero vazamento: usuário A não vê leads de B.",
  ];

  return (
    <div className="min-h-screen bg-[#0d1117] text-white px-4 py-8 max-w-2xl mx-auto">
      <ol className="list-decimal list-inside space-y-3 text-sm text-[#e6edf3]">
        {itens.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>
    </div>
  );
}
