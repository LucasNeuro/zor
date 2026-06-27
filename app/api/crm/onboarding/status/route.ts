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
      label: "Plataforma",
      ok: envOk,
      detail: envOk
        ? "Serviços base configurados"
        : "Configuração incompleta — contacte o suporte da plataforma",
      href: "/crm/configuracoes",
    },
    {
      id: "tenant",
      label: "Empresa activa",
      ok: tenantOk,
      detail: tenantOk
        ? `${tenantRes.data?.nome_exibicao} (${tenantRes.data?.slug})`
        : "Active ou crie a empresa na plataforma",
      href: "/crm/onboarding-tenant",
    },
    {
      id: "users",
      label: "Equipa",
      ok: usersOk,
      detail: usersOk ? `${usersRes.count} utilizador(es)` : "Convidar pelo menos um membro",
      href: "/crm/usuarios",
    },
    {
      id: "whatsapp",
      label: "WhatsApp / canais",
      ok: canalOk,
      detail: canalOk ? "Canal WhatsApp configurado" : "Configure o WhatsApp em Canais",
      href: "/crm/canais",
    },
    {
      id: "integracoes",
      label: "Integrações opcionais",
      ok: Boolean(process.env.WINDSOR_API_KEY?.trim()) || Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
      detail: "Campanhas ou IA alternativa (opcional)",
      href: "/crm/integracoes",
    },
    {
      id: "dados",
      label: "Dados CRM",
      ok: (leadsRes.count ?? 0) >= 0 && !leadsRes.error,
      detail: leadsRes.error
        ? "Não foi possível aceder aos leads. Contacte o suporte."
        : "Base de leads acessível",
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
