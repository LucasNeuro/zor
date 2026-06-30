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
  | "ga4"
  | "mem0"
  | "mistral";

export type IntegradorAuthModo = "bearer" | "api_key" | "zendesk" | "none";

export type IntegradorFerramentaDef = {
  ferramenta_key: string;
  titulo: string;
  descricao_curta: string;
  descricao_modelo: string;
  parametros_schema: Record<string, unknown>;
  politica: "leitura" | "escrita";
  /** false = toggle no agente, mas não expõe function calling ao Mistral (ex.: Super Memória). */
  exportarMistral?: boolean;
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
          "Usa quando o cliente **confirmar** data/hora de reserva. Use **formato 24h**: 20:30 = noite (não 08:30). Passe `hora_cliente` como o cliente disse (ex. «20:30», «20h30»). A resposta inclui link_para_whatsapp.",
        politica: "escrita",
        parametros_schema: {
          type: "object",
          properties: {
            titulo: { type: "string", description: "Título interno (ex. Reserva - 4 pessoas - Cantina Nova)" },
            inicio: {
              type: "string",
              description: "Data/hora ISO 24h (ex. 2026-06-24T20:30:00 para 20h30 da noite)",
            },
            hora_cliente: {
              type: "string",
              description: "Hora como o cliente disse (ex. 20:30, 20h30) — obrigatório para evitar AM/PM errado",
            },
            fim: {
              type: "string",
              description: "Fim ISO opcional; se omitido, usa duracao_reserva_min do tenant",
            },
            descricao: { type: "string", description: "Notas internas (nome cliente, telefone)" },
            participantes: {
              type: "array",
              items: { type: "string" },
              description: "E-mails opcionais",
            },
            com_google_meet: {
              type: "boolean",
              description: "Link Meet (padrão false para reservas; true para videoconferência)",
            },
          },
          required: ["titulo", "inicio"],
          additionalProperties: false,
        },
      },
      {
        ferramenta_key: "hub_int_gcal_listar_eventos",
        titulo: "Consultar vagas na agenda",
        descricao_curta: "Slots livres sem expor outros clientes.",
        descricao_modelo:
          "OBRIGATÓRIO antes de sugerir horários. Retorna vagas_disponiveis e horarios_ocupados **sem nomes** de terceiros. Use parâmetro data (YYYY-MM-DD) para um dia específico.",
        politica: "leitura",
        parametros_schema: {
          type: "object",
          properties: {
            dias: { type: "number", description: "Quantos dias à frente (padrão 7)" },
            data: { type: "string", description: "Dia foco ISO date (ex. 2026-06-23)" },
          },
          required: [],
          additionalProperties: false,
        },
      },
      {
        ferramenta_key: "hub_int_gcal_listar_reservas_lead",
        titulo: "Minhas reservas (este cliente)",
        descricao_curta: "Lista só reservas do lead na sessão.",
        descricao_modelo:
          "Usa quando o cliente perguntar «minhas reservas», «minha agenda» ou «o que tenho marcado». Retorna apenas eventos **deste** lead/contacto WhatsApp.",
        politica: "leitura",
        parametros_schema: SCHEMA_VAZIO,
      },
      {
        ferramenta_key: "hub_int_gcal_cancelar_evento",
        titulo: "Cancelar reserva no Calendar",
        descricao_curta: "Remove evento do lead na sessão.",
        descricao_modelo:
          "OBRIGATÓRIO quando o cliente pedir cancelar/desmarcar. Cancela a reserva **deste lead** no Google Calendar. Opcional: evento_id ou inicio para escolher qual reserva.",
        politica: "escrita",
        parametros_schema: {
          type: "object",
          properties: {
            evento_id: { type: "string", description: "ID Google Calendar (se souber)" },
            inicio: { type: "string", description: "ISO da reserva a cancelar (ex. 2026-06-23T20:30:00)" },
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
          "Usa quando o utilizador pedir para enviar e-mail, confirmar por correio ou notificar alguém por Gmail. Exige destinatário, assunto e corpo. Confirme o e-mail exato (ex.: hotmail.com, não hotmail.com.br salvo se o cliente disser .com.br).",
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
    emBreve: true,
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
  {
    id: "mem0",
    nome: "Mem0 — Super Memória",
    descricao:
      "Memória persistente entre sessões com recall semântico por agente. Plus opcional — desligado usa memória interna do CRM.",
    categoria: "agente",
    authModo: "none",
    authLabels: {
      principal: "Credencial da plataforma",
      principalPlaceholder: "Configurada pela plataforma — não editável aqui",
    },
    ferramentas: [
      {
        ferramenta_key: "hub_int_mem0_super_memoria",
        titulo: "Super Memória (recall automático)",
        descricao_curta: "Injeta memórias Mem0 no prompt a cada turno WhatsApp.",
        descricao_modelo: "",
        politica: "leitura",
        exportarMistral: false,
        parametros_schema: SCHEMA_VAZIO,
      },
      {
        ferramenta_key: "hub_int_mem0_buscar",
        titulo: "Buscar memórias do cliente (Mem0)",
        descricao_curta: "Pesquisa semântica no histórico Mem0 deste lead.",
        descricao_modelo:
          "Usa quando precisar recordar preferências, nome, contexto de conversas anteriores ou factos não visíveis no CRM. Retorna memórias relevantes ao query.",
        politica: "leitura",
        parametros_schema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Pergunta ou tema a pesquisar (ex.: nome do cliente, preferências, último pedido)",
            },
            limite: { type: "number", description: "Máximo de memórias (1–12, padrão 6)" },
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
    ],
  },
  {
    id: "mistral",
    nome: "Mistral — Document AI & Multimodal",
    descricao:
      "OCR, transcrição de áudio, visão e Q&A em documentos via API Mistral da plataforma (MISTRAL_API_KEY).",
    categoria: "agente",
    authModo: "none",
    authLabels: {
      principal: "Chave API da plataforma",
      principalPlaceholder: "MISTRAL_API_KEY no servidor — não editável por agente",
    },
    ferramentas: [
      {
        ferramenta_key: "hub_mistral_percepcao",
        titulo: "Percepção multimodal (OCR, áudio, visão)",
        descricao_curta: "Processa PDF, imagem e áudio com Mistral Document AI.",
        descricao_modelo:
          "Usa quando precisar extrair texto de documento/imagem, transcrever áudio ou responder perguntas sobre um ficheiro (modos: ocr, transcrever_audio, descrever_imagem, perguntar_documento).",
        politica: "leitura",
        parametros_schema: {
          type: "object",
          properties: {
            modo: {
              type: "string",
              enum: ["ocr", "transcrever_audio", "descrever_imagem", "perguntar_documento"],
            },
            url: { type: "string", description: "URL pública do ficheiro" },
            base64: { type: "string" },
            mime: { type: "string" },
            pergunta: { type: "string" },
          },
          required: ["modo"],
          additionalProperties: false,
        },
      },
    ],
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
