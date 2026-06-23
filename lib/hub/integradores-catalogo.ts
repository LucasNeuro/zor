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
    descricao: "Agendar reuniões no Google Calendar com link Google Meet (OAuth Google).",
    categoria: "agente",
    authModo: "bearer",
    authLabels: {
      principal: "Conta Google (OAuth)",
      principalPlaceholder: "Use «Ligar conta Google» — não cole senha do e-mail",
    },
    ferramentas: [
      {
        ferramenta_key: "hub_int_gcal_criar_evento",
        titulo: "Criar evento / reunião (Google Meet)",
        descricao_curta: "Cria evento no Calendar com link Meet.",
        descricao_modelo:
          "Usa quando o cliente **confirmar** data/hora de reserva, reunião ou videoconferência. Cria evento no Google Calendar (conta ligada). Exige título e início ISO 8601 (ex. 2026-06-24T14:30:00). Chame só após confirmação explícita do cliente.",
        politica: "escrita",
        parametros_schema: {
          type: "object",
          properties: {
            titulo: { type: "string", description: "Título da reunião" },
            inicio: {
              type: "string",
              description: "Início ISO 8601 com hora (ex. 2026-06-20T10:00:00)",
            },
            fim: { type: "string", description: "Fim ISO 8601 opcional (padrão = início)" },
            descricao: { type: "string", description: "Pauta ou notas da reunião" },
            participantes: {
              type: "array",
              items: { type: "string" },
              description: "E-mails dos convidados (inclua o do cliente se souber)",
            },
            com_google_meet: {
              type: "boolean",
              description: "Gerar link Google Meet (padrão true)",
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
          "OBRIGATÓRIO antes de sugerir horários livres para reserva ou reunião: consulta a agenda real do Google Calendar ligado. Use para ver compromissos já marcados e calcular vagas. Parâmetro dias (padrão 7).",
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
