import { NextRequest, NextResponse } from "next/server";
import { crmDb, crmConfigError } from "@/lib/crm/supabase-server";
import { buildHealthResponse } from "@/lib/crm/health-checks";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";
import { requireInternalApiKey } from "@/lib/crm/crm-api-auth";

export type OnboardingStep = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  href?: string;
};

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const supabase = crmDb();
  const health = buildHealthResponse();

  const [
    tenantRes,
    usersRes,
    canaisRes,
    leadsRes,
  ] = await Promise.all([
    supabase.from("hub_tenants").select("id, slug, nome_exibicao, ativo").eq("id", tenantId).maybeSingle(),
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase
      .from("hub_agente_identidade")
      .select("agente_slug", { count: "exact", head: true })
      .eq("ativo", true)
      .limit(1),
    supabase.from("hub_leads_crm").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).limit(1),
  ]);

  const envOk = health.status === "ok";
  const tenantOk = !!tenantRes.data?.ativo;
  const usersOk = (usersRes.count ?? 0) > 0;
  const uazapiOk =
    Boolean(process.env.UAZAPI_BASE_URL?.trim()) &&
    Boolean(process.env.UAZAPI_INSTANCE_TOKEN?.trim());
  const canalOk = uazapiOk || (canaisRes.count ?? 0) > 0;

  const steps: OnboardingStep[] = [
    {
      id: "env",
      label: "Variáveis de ambiente",
      ok: envOk,
      detail: envOk
        ? "Supabase e API interna configurados"
        : `Faltam: ${health.missingRequired.join(", ") || "revisar .env"}`,
      href: "/crm/configuracoes",
    },
    {
      id: "tenant",
      label: "Tenant ativo",
      ok: tenantOk,
      detail: tenantOk
        ? `${tenantRes.data?.nome_exibicao} (${tenantRes.data?.slug})`
        : "Criar ou ativar linha em hub_tenants",
      href: "/crm/onboarding-tenant",
    },
    {
      id: "users",
      label: "Equipa em public.users",
      ok: usersOk,
      detail: usersOk ? `${usersRes.count} utilizador(es)` : "Convidar pelo menos um membro",
      href: "/crm/usuarios",
    },
    {
      id: "whatsapp",
      label: "WhatsApp / canais",
      ok: canalOk,
      detail: canalOk ? "UAZAPI ou canal cadastrado" : "Configurar UAZAPI ou /crm/canais",
      href: "/crm/canais",
    },
    {
      id: "integracoes",
      label: "Integrações opcionais",
      ok: Boolean(process.env.WINDSOR_API_KEY?.trim()) || Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
      detail: "Windsor (campanhas) ou Anthropic (IA)",
      href: "/crm/integracoes",
    },
    {
      id: "dados",
      label: "Dados CRM",
      ok: (leadsRes.count ?? 0) >= 0 && !leadsRes.error,
      detail: leadsRes.error
        ? `Erro hub_leads_crm: ${leadsRes.error.message}`
        : "Tabela hub_leads_crm acessível",
      href: "/crm/leads",
    },
  ];

  const completed = steps.filter((s) => s.ok).length;
  const progress = Math.round((completed / steps.length) * 100);

  return NextResponse.json({
    tenantId,
    progress,
    completed,
    total: steps.length,
    ready: completed === steps.length,
    steps,
  });
}
