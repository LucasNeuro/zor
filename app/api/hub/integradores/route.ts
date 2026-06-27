import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { crmConfigError } from "@/lib/crm/supabase-server";
import { requireInternalApiKey } from "@/lib/crm/crm-api-auth";
import { mistralApiKey, pingMistralApi } from "@/lib/ia/mistral-health";
import { HUB_INTEGRADORES_CATALOGO } from "@/lib/hub/integradores-catalogo";
import { mem0PlataformaConfigurada } from "@/lib/hub/mem0-env";
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
      nome: "WhatsApp",
      descricao: "Canais e inbox de atendimento",
      status:
        uazapiUrl && uazapiToken ? "conectado" : uazapiUrl || uazapiToken ? "erro" : "nao_configurado",
      href: "/crm/canais",
      detail:
        uazapiUrl && uazapiToken
          ? "Canal WhatsApp ligado"
          : "Configure o WhatsApp em Canais",
    },
    {
      id: "windsor",
      nome: "Windsor.ai",
      descricao: "Campanhas e métricas de tráfego pago",
      status: windsor ? "conectado" : "nao_configurado",
      href: "/crm/trafego",
      detail: windsor ? "Integração de tráfego activa" : "Integração de tráfego ainda não configurada",
    },
    {
      id: "mistral",
      nome: "Motor de IA",
      descricao: "Motor IA dos agentes, cargos e automações",
      status: !mistralPresent ? "nao_configurado" : mistralPing?.ok ? "conectado" : "erro",
      href: "/crm/agentes",
      detail: !mistralPresent
        ? "Serviço de IA ainda não disponível neste ambiente"
        : mistralPing?.ok
          ? "Serviço de IA operacional"
          : mistralPing?.detail?.slice(0, 200) ?? "Falha ao contactar o serviço de IA",
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

  const conexoes: Record<
    string,
    {
      hub_id: string;
      configurado: boolean;
      ativo: boolean;
      oauth_email?: string | null;
      plataforma_ok?: boolean;
    }
  > = {};
  for (const entry of HUB_INTEGRADORES_CATALOGO) {
    if (entry.emBreve) {
      conexoes[entry.id] = { hub_id: "", configurado: false, ativo: false, oauth_email: null };
      continue;
    }
    if (entry.id === "mem0") {
      const plataformaOk = mem0PlataformaConfigurada();
      conexoes[entry.id] = {
        hub_id: "",
        configurado: plataformaOk,
        ativo: plataformaOk,
        plataforma_ok: plataformaOk,
        oauth_email: null,
      };
      continue;
    }
    const row = (rows ?? []).find((r) => r.integracao_id === entry.id);
    if (!row) {
      conexoes[entry.id] = { hub_id: "", configurado: false, ativo: false, oauth_email: null };
      continue;
    }
    const cfg =
      row.config && typeof row.config === "object" ? (row.config as Record<string, unknown>) : {};
    const oauthEmail =
      typeof cfg.oauth_email === "string" && cfg.oauth_email.trim()
        ? cfg.oauth_email.trim().toLowerCase()
        : null;
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
    } else if (entry.id === "gmail" || entry.id === "google_calendar") {
      configurado =
        (credObj._enc === true && typeof credObj.access_token === "string" && Boolean(credObj.access_token)) ||
        Boolean(typeof credObj.bearer_token === "string" && credObj.bearer_token);
    } else {
      configurado = Boolean(typeof credObj.bearer_token === "string" && credObj.bearer_token);
    }
    conexoes[entry.id] = {
      hub_id: String(row.id),
      configurado,
      ativo: row.ativo !== false && configurado,
      oauth_email: entry.id === "gmail" || entry.id === "google_calendar" ? oauthEmail : null,
    };
  }

  const ambiente = await ambienteIntegracoes();

  return NextResponse.json({
    catalogo: HUB_INTEGRADORES_CATALOGO,
    conexoes,
    ambiente,
  });
}
