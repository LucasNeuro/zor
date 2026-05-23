import { NextRequest, NextResponse } from "next/server";
import { crmConfigError } from "@/lib/crm/supabase-server";
import { requireInternalApiKey } from "@/lib/crm/crm-api-auth";

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
  const anthropic = process.env.ANTHROPIC_API_KEY?.trim() || process.env.MISTRAL_API_KEY?.trim();

  const integracoes: IntegracaoStatus[] = [
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
      id: "anthropic",
      nome: "IA (Anthropic / Mistral)",
      descricao: "Agentes e automações",
      status: anthropic ? "conectado" : "nao_configurado",
      href: "/crm/agentes",
      detail: anthropic ? "Chave de IA presente" : "ANTHROPIC_API_KEY ou MISTRAL_API_KEY",
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
