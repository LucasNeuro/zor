import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { crmConfigError } from "@/lib/crm/supabase-server";
import { requireInternalApiKey } from "@/lib/crm/crm-api-auth";
import { mistralApiKey, mistralKeyFingerprint, pingMistralApi } from "@/lib/ia/mistral-health";
import { HUB_INTEGRADORES_CATALOGO } from "@/lib/hub/integradores-catalogo";
import { tenantIdFromRequest } from "@/lib/tenant-default";

export type IntegracaoAmbienteStatus = {
  id: string;
  nome: string;
  descricao: string;
  status: "conectado" | "nao_configurado" | "erro" | "em_breve";
  href?: string;
  detail?: string;
};

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function ambienteIntegracoes(): Promise<IntegracaoAmbienteStatus[]> {
  const uazapiUrl = process.env.UAZAPI_BASE_URL?.trim();
  const uazapiToken = process.env.UAZAPI_INSTANCE_TOKEN?.trim();
  const windsor = process.env.WINDSOR_API_KEY?.trim();
  const mistralPresent = Boolean(mistralApiKey());
  const mistralPing = mistralPresent ? await pingMistralApi() : null;

  return [
    {
      id: "whatsapp",
      nome: "WhatsApp (UAZAPI)",
      descricao: "Canais e inbox de atendimento",
      status:
        uazapiUrl && uazapiToken ? "conectado" : uazapiUrl || uazapiToken ? "erro" : "nao_configurado",
      href: "/crm/canais",
      detail:
        uazapiUrl && uazapiToken
          ? "Credenciais UAZAPI presentes"
          : "Defina UAZAPI_BASE_URL e UAZAPI_INSTANCE_TOKEN",
    },
    {
      id: "windsor",
      nome: "Windsor.ai",
      descricao: "Campanhas e métricas de tráfego pago",
      status: windsor ? "conectado" : "nao_configurado",
      href: "/crm/trafego",
      detail: windsor ? "WINDSOR_API_KEY configurada" : "Adicione WINDSOR_API_KEY no ambiente",
    },
    {
      id: "mistral",
      nome: "Mistral AI (LLM principal)",
      descricao: "Motor IA dos agentes, cargos e automações",
      status: !mistralPresent ? "nao_configurado" : mistralPing?.ok ? "conectado" : "erro",
      href: "/crm/agentes",
      detail: !mistralPresent
        ? "Defina MISTRAL_API_KEY no .env"
        : mistralPing?.ok
          ? `Chave ${mistralKeyFingerprint()} aceite pela API`
          : mistralPing?.detail?.slice(0, 200) ?? "Falha ao contactar Mistral",
    },
  ];
}

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const supabase = db();
  const tenantId = tenantIdFromRequest(request.headers);

  const { data: rows } = await supabase
    .from("hub_integracoes")
    .select("id, integracao_id, ativo, status, config, atualizado_em, hub_integracao_credenciais(credenciais)")
    .eq("tenant_id", tenantId)
    .in(
      "integracao_id",
      HUB_INTEGRADORES_CATALOGO.filter((i) => !i.emBreve).map((i) => i.id)
    );

  const conexoes: Record<string, { hub_id: string; configurado: boolean; ativo: boolean }> = {};
  for (const entry of HUB_INTEGRADORES_CATALOGO) {
    if (entry.emBreve) {
      conexoes[entry.id] = { hub_id: "", configurado: false, ativo: false };
      continue;
    }
    const row = (rows ?? []).find((r) => r.integracao_id === entry.id);
    if (!row) {
      conexoes[entry.id] = { hub_id: "", configurado: false, ativo: false };
      continue;
    }
    const creds = row.hub_integracao_credenciais;
    const credRow = Array.isArray(creds) ? creds[0] : creds;
    const credObj =
      credRow &&
      typeof credRow === "object" &&
      "credenciais" in credRow &&
      credRow.credenciais &&
      typeof credRow.credenciais === "object"
        ? (credRow.credenciais as Record<string, unknown>)
        : {};
    let configurado = false;
    if (entry.id === "zendesk") {
      const cfg =
        row.config && typeof row.config === "object" ? (row.config as Record<string, unknown>) : {};
      configurado =
        Boolean(typeof cfg.subdomain === "string" && cfg.subdomain) &&
        Boolean(typeof credObj.api_key === "string" && credObj.api_key);
    } else {
      configurado = Boolean(typeof credObj.bearer_token === "string" && credObj.bearer_token);
    }
    conexoes[entry.id] = {
      hub_id: String(row.id),
      configurado,
      ativo: row.ativo !== false && configurado,
    };
  }

  const ambiente = await ambienteIntegracoes();

  return NextResponse.json({
    catalogo: HUB_INTEGRADORES_CATALOGO,
    conexoes,
    ambiente,
  });
}
