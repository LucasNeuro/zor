import { NextRequest, NextResponse } from "next/server";
import { crmConfigError } from "@/lib/crm/supabase-server";
import { requireInternalApiKey } from "@/lib/crm/crm-api-auth";
import { mistralApiKey, pingMistralApi } from "@/lib/ia/mistral-health";

export type IntegracaoStatus = {
  id: string;
  nome: string;
  descricao: string;
  status: "conectado" | "nao_configurado" | "erro" | "em_breve";
  href?: string;
  detail?: string;
};

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const uazapiUrl = process.env.UAZAPI_BASE_URL?.trim();
  const uazapiToken = process.env.UAZAPI_INSTANCE_TOKEN?.trim();
  const windsor = process.env.WINDSOR_API_KEY?.trim();
  const mistralPresent = Boolean(mistralApiKey());
  const mistralPing = mistralPresent ? await pingMistralApi() : null;

  const integracoes: IntegracaoStatus[] = [
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
      descricao: "Agentes, cargos, WhatsApp e automações",
      status: !mistralPresent ? "nao_configurado" : mistralPing?.ok ? "conectado" : "erro",
      href: "/crm/agentes",
      detail: !mistralPresent
        ? "Serviço de IA ainda não disponível neste ambiente"
        : mistralPing?.ok
          ? "Serviço de IA operacional"
          : mistralPing?.detail?.slice(0, 200) ?? "Falha ao contactar o serviço de IA",
    },
    {
      id: "meta",
      nome: "Meta Ads",
      descricao: "Facebook e Instagram",
      status: "em_breve",
      detail: "OAuth previsto em fase posterior",
    },
    {
      id: "google_ads",
      nome: "Google Ads",
      descricao: "Search, Display e YouTube",
      status: "em_breve",
    },
    {
      id: "ga4",
      nome: "Google Analytics 4",
      descricao: "Tráfego orgânico e eventos",
      status: "em_breve",
    },
  ];

  return NextResponse.json({ integracoes });
}
