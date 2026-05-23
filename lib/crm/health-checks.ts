export type HealthCheck = {
  name: string;
  required: boolean;
  configured: boolean;
  area: string;
};

const CHECKS: { name: string; required: boolean; area: string }[] = [
  { name: "NEXT_PUBLIC_SUPABASE_URL", required: true, area: "Supabase" },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: true, area: "Supabase" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", required: true, area: "Supabase" },
  { name: "INTERNAL_API_KEY", required: true, area: "API" },
  { name: "NEXT_PUBLIC_INTERNAL_API_KEY", required: false, area: "API" },
  { name: "CRON_SECRET", required: false, area: "Ciclos" },
  { name: "WEBHOOK_SECRET", required: false, area: "WhatsApp" },
  { name: "ANTHROPIC_API_KEY", required: false, area: "IA" },
  { name: "UAZAPI_BASE_URL", required: false, area: "WhatsApp" },
  { name: "UAZAPI_INSTANCE_TOKEN", required: false, area: "WhatsApp" },
  { name: "DEFAULT_TENANT_ID", required: false, area: "Tenant" },
  { name: "NEXT_PUBLIC_TENANT_ID", required: false, area: "Tenant" },
  { name: "WINDSOR_API_KEY", required: false, area: "Marketing" },
];

export function buildHealthResponse(): {
  status: "ok" | "degraded";
  missingRequired: string[];
  checks: HealthCheck[];
} {
  const checks: HealthCheck[] = CHECKS.map((c) => ({
    ...c,
    configured: Boolean(process.env[c.name]?.trim()),
  }));
  const missingRequired = checks.filter((c) => c.required && !c.configured).map((c) => c.name);
  return {
    status: missingRequired.length === 0 ? "ok" : "degraded",
    missingRequired,
    checks,
  };
}
