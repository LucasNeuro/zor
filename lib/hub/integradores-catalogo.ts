/**
 * Catálogo fixo de integradores para agentes (function calling hub_int_*).
 * O tenant só guarda credenciais — a lógica HTTP fica no código.
 */

export type HubIntegradorId =
  | "google_calendar"
  | "gmail"
  | "google_docs"
  | "zendesk"
  | "meta_ads"
  | "google_ads"
  | "ga4";

export type IntegradorAuthModo = "bearer" | "api_key" | "zendesk" | "none";

export type IntegradorFerramentaDef = {
  ferramenta_key: string;
  titulo: string;
  descricao_curta: string;
  descricao_modelo: string;
  parametros_schema: Record<string, unknown>;
  politica: "leitura" | "escrita";
};

export type IntegradorCatalogoEntry = {
  id: HubIntegradorId;
  nome: string;
  descricao: string;
  categoria: "agente";
  emBreve?: boolean;
  authModo: IntegradorAuthModo;
  authLabels: {
    principal: string;
    principalPlaceholder: string;
    extra?: string;
    extraPlaceholder?: string;
  };
  ferramentas: IntegradorFerramentaDef[];
};

const SCHEMA_VAZIO = {
  type: "object",
  properties: {},
  required: [] as string[],
  additionalProperties: false,
};

export const HUB_INTEGRADORES_CATALOGO: IntegradorCatalogoEntry[] = [
  {
    id: "google_calendar",
    nome: "Google Calendar",
    descricao: "Agendar e consultar eventos no calendário do escritório.",
    categoria: "agente",
    authModo: "bearer",
    authLabels: {
      principal: "Token de acesso OAuth",
      principalPlaceholder: "ya29.… (token OAuth do Google Calendar)",
    },
    ferramentas: [
      {
        ferramenta_key: "hub_int_gcal_criar_evento",
        titulo: "Criar evento no Calendar",
        descricao_curta: "Cria evento no Google Calendar.",
        descricao_modelo:
          "Usa quando o utilizador pedir para agendar, marcar ou criar um evento/reunião no Google Calendar. Exige título e data/hora de início.",
        politica: "escrita",
        parametros_schema: {
          type: "object",
          properties: {
            titulo: { type: "string", description: "Título do evento" },
            inicio: { type: "string", description: "ISO 8601 ou data/hora legível" },
            fim: { type: "string", description: "ISO 8601 opcional" },
            descricao: { type: "string", description: "Notas do evento" },
            participantes: {
              type: "array",
              items: { type: "string" },
              description: "E-mails dos convidados",
            },
          },
          required: ["titulo", "inicio"],
          additionalProperties: false,
        },
      },
      {
        ferramenta_key: "hub_int_gcal_listar_eventos",
        titulo: "Listar eventos do Calendar",
        descricao_curta: "Lista próximos eventos.",
        descricao_modelo:
          "Usa quando o utilizador perguntar o que está agendado, a agenda do dia ou próximos compromissos no Google Calendar.",
        politica: "leitura",
        parametros_schema: {
          type: "object",
          properties: {
            dias: { type: "number", description: "Quantos dias à frente (padrão 7)" },
          },
          required: [],
          additionalProperties: false,
        },
      },
    ],
  },
  {
    id: "gmail",
    nome: "Gmail",
    descricao: "Enviar e-mails em nome do escritório.",
    categoria: "agente",
    authModo: "bearer",
    authLabels: {
      principal: "Token de acesso OAuth",
      principalPlaceholder: "ya29.… (token OAuth Gmail)",
    },
    ferramentas: [
      {
        ferramenta_key: "hub_int_gmail_enviar",
        titulo: "Enviar e-mail",
        descricao_curta: "Envia e-mail via Gmail API.",
        descricao_modelo:
          "Usa quando o utilizador pedir para enviar e-mail, confirmar por correio ou notificar alguém por Gmail. Exige destinatário, assunto e corpo.",
        politica: "escrita",
        parametros_schema: {
          type: "object",
          properties: {
            para: { type: "string", description: "E-mail do destinatário" },
            assunto: { type: "string" },
            corpo: { type: "string", description: "Texto do e-mail" },
          },
          required: ["para", "assunto", "corpo"],
          additionalProperties: false,
        },
      },
    ],
  },
  {
    id: "google_docs",
    nome: "Google Docs",
    descricao: "Criar e ler documentos partilhados.",
    categoria: "agente",
    emBreve: true,
    authModo: "bearer",
    authLabels: {
      principal: "Token de acesso OAuth",
      principalPlaceholder: "OAuth Google Docs",
    },
    ferramentas: [],
  },
  {
    id: "zendesk",
    nome: "Zendesk",
    descricao: "Abrir e consultar tickets de suporte.",
    categoria: "agente",
    authModo: "zendesk",
    authLabels: {
      principal: "API Token",
      principalPlaceholder: "Token da API Zendesk",
      extra: "Subdomínio Zendesk",
      extraPlaceholder: "minhaempresa (minhaempresa.zendesk.com)",
    },
    ferramentas: [
      {
        ferramenta_key: "hub_int_zendesk_criar_ticket",
        titulo: "Criar ticket Zendesk",
        descricao_curta: "Abre ticket de suporte.",
        descricao_modelo:
          "Usa quando o cliente precisar de suporte técnico formal ou pedir abertura de chamado no Zendesk.",
        politica: "escrita",
        parametros_schema: {
          type: "object",
          properties: {
            assunto: { type: "string" },
            descricao: { type: "string" },
            email_solicitante: { type: "string" },
            prioridade: { type: "string", enum: ["low", "normal", "high", "urgent"] },
          },
          required: ["assunto", "descricao"],
          additionalProperties: false,
        },
      },
      {
        ferramenta_key: "hub_int_zendesk_consultar_ticket",
        titulo: "Consultar ticket Zendesk",
        descricao_curta: "Lê estado de um ticket.",
        descricao_modelo: "Usa quando o utilizador pedir estado ou detalhe de um ticket Zendesk pelo ID.",
        politica: "leitura",
        parametros_schema: {
          type: "object",
          properties: {
            ticket_id: { type: "string", description: "ID numérico do ticket" },
          },
          required: ["ticket_id"],
          additionalProperties: false,
        },
      },
    ],
  },
  {
    id: "meta_ads",
    nome: "Meta Ads",
    descricao: "Facebook e Instagram — campanhas e métricas.",
    categoria: "agente",
    emBreve: true,
    authModo: "bearer",
    authLabels: {
      principal: "Token de acesso",
      principalPlaceholder: "Token OAuth Meta",
    },
    ferramentas: [],
  },
  {
    id: "google_ads",
    nome: "Google Ads",
    descricao: "Search, Display e YouTube.",
    categoria: "agente",
    emBreve: true,
    authModo: "bearer",
    authLabels: {
      principal: "Token / developer token",
      principalPlaceholder: "Credencial Google Ads",
    },
    ferramentas: [],
  },
  {
    id: "ga4",
    nome: "Google Analytics 4",
    descricao: "Tráfego orgânico e eventos do site.",
    categoria: "agente",
    emBreve: true,
    authModo: "bearer",
    authLabels: {
      principal: "Token de acesso",
      principalPlaceholder: "OAuth GA4",
    },
    ferramentas: [],
  },
];

export function integradorPorId(id: string): IntegradorCatalogoEntry | undefined {
  return HUB_INTEGRADORES_CATALOGO.find((i) => i.id === id);
}

export function integradorConfiguravel(id: string): boolean {
  const e = integradorPorId(id);
  return Boolean(e && !e.emBreve && e.authModo !== "none");
}

export function ferramentaIntegradorPorKey(key: string): {
  integrador: IntegradorCatalogoEntry;
  ferramenta: IntegradorFerramentaDef;
} | null {
  for (const integrador of HUB_INTEGRADORES_CATALOGO) {
    const ferramenta = integrador.ferramentas.find((f) => f.ferramenta_key === key);
    if (ferramenta) return { integrador, ferramenta };
  }
  return null;
}

export function todasFerramentasIntegradores(): IntegradorFerramentaDef[] {
  return HUB_INTEGRADORES_CATALOGO.flatMap((i) => i.ferramentas);
}

export function ferramentasDoIntegrador(id: HubIntegradorId): IntegradorFerramentaDef[] {
  return integradorPorId(id)?.ferramentas ?? [];
}

export type FerramentaIntegradorMistralDef = {
  ferramenta_key: string;
  descricao_modelo: string;
  parametros_schema: Record<string, unknown>;
  integrador_id: HubIntegradorId;
};

export function ferramentaIntegradorParaMistral(
  integradorId: HubIntegradorId,
  f: IntegradorFerramentaDef
): FerramentaIntegradorMistralDef {
  const schema =
    f.parametros_schema && typeof f.parametros_schema === "object"
      ? f.parametros_schema
      : SCHEMA_VAZIO;
  return {
    ferramenta_key: f.ferramenta_key,
    descricao_modelo: f.descricao_modelo,
    parametros_schema: schema,
    integrador_id: integradorId,
  };
}
