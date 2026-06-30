/**
 * Catálogo declarado de ferramentas Hub ↔ function calling (Mistral chat completions / Agents).
 * Cada tool tem schema estável e execução servidor em `executarFerramentasHub`.
 */

import type { MistralChatToolDefinition } from "@/lib/ia/mistral-chat-tools";
import { MEM0_BUSCAR_KEY, MEM0_SUPER_MEMORIA_KEY } from "@/lib/hub/mem0-constants";
import {
  CRM_ENTIDADES_TOOL_KEYS,
  FERRAMENTAS_CRM_MOVED_TO_INTEGRADOR,
  HUB_INT_CRM_ATUALIZAR_LEAD,
  HUB_INT_CRM_CONSULTAR,
  HUB_INT_CRM_CRIAR_NEGOCIO,
  HUB_INT_CRM_OPERAR,
  HUB_INT_CRM_REGISTAR_NOTA,
  sincronizarUsoCrmIntegrador,
} from "@/lib/hub/crm-integrador-constants";

export type HubFerramentaCategoria = "cliente" | "analise" | "registos" | "empresa";

export type HubAgenteFerramentaId =
  | "hub_lead_resumo"
  | "hub_lead_memorias"
  | "hub_lead_lookup_por_telefone"
  | "hub_metricas_escritorio"
  | "hub_dados_empresa"
  | "hub_operacao_empresa"
  | "hub_raciocinio_avancado"
  | "hub_relatorio_html_simples"
  | "hub_superagente_dados"
  | "hub_superagente_artefato"
  | "hub_mistral_percepcao"
  | "hub_registar_nota_lead"
  | "hub_whatsapp_menu"
  | "hub_atualizar_lead"
  | "hub_criar_negocio";

export type HubAgenteFerramentaCatalogo = {
  id: HubAgenteFerramentaId;
  categoria: HubFerramentaCategoria;
  /** Rótulo curto na UI */
  titulo: string;
  descricao: string;
  /** Sugestão de pré-ligar em atendimento WhatsApp (não força default no servidor) */
  recomendadoWhatsApp: boolean;
  /** Capacidade do modelo — não é function calling Mistral */
  metaCapacidade?: boolean;
  mistralFunction?: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export const HUB_AGENTE_FERRAMENTAS_CATALOGO: readonly HubAgenteFerramentaCatalogo[] = [
  {
    id: "hub_lead_resumo",
    categoria: "cliente",
    titulo: "Resumo do cliente (lead)",
    descricao:
      "Consulta estágio, dados de contacto e responsáveis no CRM para responder com factos sobre esta conversa.",
    recomendadoWhatsApp: true,
    mistralFunction: {
      name: "hub_lead_resumo",
      description:
        "Obtém um resumo factual do lead actual nesta conversa no CRM. Use antes de afirmar estado do negócio.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_lead_memorias",
    categoria: "cliente",
    titulo: "Memórias sobre o cliente",
    descricao:
      "Lista notas automáticas ou memorias guardadas sobre este cliente (preferências, histórico relevante).",
    recomendadoWhatsApp: true,
    mistralFunction: {
      name: "hub_lead_memorias",
      description:
        "Recupera memorias conhecidas sobre o lead (preferências, objeções, histórico relevante). Chame quando precisar lembrar contexto.",
      parameters: {
        type: "object",
        properties: {
          limite: {
            type: "integer",
            description: "N máximo de memorias (1–10). Omita para 5.",
            minimum: 1,
            maximum: 10,
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_lead_lookup_por_telefone",
    categoria: "cliente",
    titulo: "Consultar lead por telefone",
    descricao:
      "Consulta a ficha CRM **só do telefone desta conversa** (isolamento). Para a sessão actual prefira hub_lead_resumo.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_lead_lookup_por_telefone",
      description:
        "Consulta lead/pessoa no CRM apenas pelo telefone **desta** conversa WhatsApp (o mesmo da sessão). Não use para pesquisar outros números. Se omitir telefone, usa o da sessão. Não cria nem altera dados.",
      parameters: {
        type: "object",
        properties: {
          telefone: {
            type: "string",
            description:
              "Opcional — só o telefone desta conversa (será validado). Omita para usar o número da sessão.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_metricas_escritorio",
    categoria: "analise",
    titulo: "Métricas rápidas do escritório",
    descricao:
      "Devolve contagens agregadas (total de leads no tenant e volume recente de acções/atividade ligadas a este modelo). Só leitura.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_metricas_escritorio",
      description:
        "Obtém contagens agregadas do CRM para contextualizar respostas (escopo tenant + agente). Não substitui relatório financeiro completo.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_dados_empresa",
    categoria: "empresa",
    titulo: "Dados da empresa (relatórios)",
    descricao:
      "Consulta dados operacionais reais do tenant via views de relatório (leads, negócios, financeiro, KPIs, atendimento). Só leitura — exclusivo agentes internos.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_dados_empresa",
      description:
        "Consulta dados operacionais da empresa (tenant) em views vw_rel_*: leads, negócios, contas a receber/pagar, fluxo de caixa, KPIs, filas, etc. Use SEMPRE antes de afirmar números ou listas factuais sobre a operação. Parâmetro view obrigatório (ex.: vw_rel_leads_enriquecidos, vw_rel_fluxo_caixa, vw_rel_negocios_pipeline).",
      parameters: {
        type: "object",
        properties: {
          view: {
            type: "string",
            description:
              "Id da view vw_rel_* (ex.: vw_rel_leads_enriquecidos, vw_rel_contas_receber, vw_rel_fluxo_caixa).",
          },
          colunas: {
            type: "array",
            items: { type: "string" },
            description: "Colunas opcionais a devolver (omitir = recomendadas da view).",
          },
          limite: {
            type: "integer",
            description: "Máximo de linhas (1–50, padrão 25).",
            minimum: 1,
            maximum: 50,
          },
          filtro_coluna: {
            type: "string",
            description: "Coluna para filtro textual simples (ex.: estagio, status, nome).",
          },
          filtro_texto: {
            type: "string",
            description: "Texto a procurar na filtro_coluna (contém, case-insensitive).",
          },
        },
        required: ["view"],
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_operacao_empresa",
    categoria: "empresa",
    titulo: "Operações CRM (leitura e escrita)",
    descricao:
      "Interface conversacional do sistema para agentes internos: consultar views, obter registo por id, criar, actualizar e registar notas em leads, negócios, financeiro, KPIs, etc. Sem SQL livre — exclusivo agentes internos.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_operacao_empresa",
      description:
        "Opera o CRM da empresa (tenant). Acções: listar_entidades | consultar (view vw_rel_*) | obter (por id) | criar | atualizar | nota. Entidades: lead, negocio, pessoa, nota, conta_receber, conta_pagar, atividade, aprovacao, alerta, parceiro, servico, proposta, kpi_meta, kpi_resultado. Use consultar/obter antes de alterar; confirme ids reais.",
      parameters: {
        type: "object",
        properties: {
          acao: {
            type: "string",
            enum: ["listar_entidades", "consultar", "obter", "criar", "atualizar", "nota"],
            description: "Operação a executar.",
          },
          entidade: {
            type: "string",
            description:
              "Entidade alvo (ex.: lead, negocio, conta_receber). Obrigatório excepto em listar_entidades e consultar só com view.",
          },
          id: {
            type: "string",
            description: "UUID do registo — obrigatório em obter e atualizar.",
          },
          dados: {
            type: "object",
            description: "Campos a criar ou actualizar (validados no servidor).",
            additionalProperties: true,
          },
          view: {
            type: "string",
            description: "Para acao=consultar — id vw_rel_* (ex.: vw_rel_leads_enriquecidos).",
          },
          colunas: { type: "array", items: { type: "string" } },
          limite: { type: "integer", minimum: 1, maximum: 50 },
          filtro_coluna: { type: "string" },
          filtro_texto: { type: "string" },
          arquivar: {
            type: "boolean",
            description: "Com acao=atualizar, marca como cancelado/arquivado conforme entidade.",
          },
        },
        required: ["acao"],
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_raciocinio_avancado",
    categoria: "analise",
    titulo: "Raciocínio avançado (Mistral)",
    descricao:
      "Activa thinking interno do modelo antes de responder — melhora decisões em orçamentos, triagem e uso de várias ferramentas. O cliente só vê a resposta final. Aumenta latência e consumo de tokens.",
    recomendadoWhatsApp: false,
    metaCapacidade: true,
  },
  {
    id: "hub_relatorio_html_simples",
    categoria: "analise",
    titulo: "Página HTML + link público",
    descricao:
      "Gera uma página HTML simples (título + texto em segurança), guarda no armazenamento e devolve um URL para abrir noutra janela.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_relatorio_html_simples",
      description:
        "Gera relatório HTML minimalista com texto plano escapado e devolve URL público. Use quando o utilizador pedir página para partilhar ou rever fora do chat.",
      parameters: {
        type: "object",
        properties: {
          titulo: {
            type: "string",
            description: "Título curto da página (obrigatório).",
          },
          texto_plano: {
            type: "string",
            description: "Corpo em texto simples (sem HTML); será escapado no servidor.",
          },
        },
        required: ["titulo", "texto_plano"],
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_superagente_dados",
    categoria: "empresa",
    titulo: "Superagente — catálogo e dados",
    descricao:
      "Lista todas as views vw_rel_* do tenant e consulta dados (leitura). Escrita via hub_operacao_empresa.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_superagente_dados",
      description:
        "Superagente: catalogar views de relatório ou consultar vw_rel_* com filtros. Use antes de relatórios executivos.",
      parameters: {
        type: "object",
        properties: {
          acao: { type: "string", enum: ["catalogar", "consultar"], description: "catalogar lista views; consultar executa query" },
          view: { type: "string", description: "Id vw_rel_* para consultar" },
          colunas: { type: "array", items: { type: "string" } },
          limite: { type: "integer", minimum: 1, maximum: 80 },
          filtro_coluna: { type: "string" },
          filtro_texto: { type: "string" },
          categoria: { type: "string", description: "Filtrar catálogo: comercial, financeiro, ia_agentes, etc." },
        },
        required: ["acao"],
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_superagente_artefato",
    categoria: "analise",
    titulo: "Canvas — relatório com gráficos",
    descricao:
      "Gera página HTML interativa (Chart.js) com texto, tabelas e gráficos; devolve URL público para WhatsApp gestor.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_superagente_artefato",
      description:
        "Cria relatório canvas com UI Synkron.IA (avatar e nome do agente), tabelas e gráficos Chart.js. Inclua seções tipo grafico; tabelas com valores numéricos ganham gráfico automático. Devolve url_publica em /artefato/{id}.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          subtitulo: { type: "string" },
          tema: { type: "string", enum: ["claro", "escuro"] },
          secoes: {
            type: "array",
            description: "Secções: {tipo:texto,markdown} | {tipo:grafico,grafico:{tipo,labels,datasets}} | {tipo:tabela,colunas,linhas}",
            items: { type: "object" },
          },
        },
        required: ["titulo", "secoes"],
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_mistral_percepcao",
    categoria: "analise",
    titulo: "Mistral — OCR, áudio, visão",
    descricao: "OCR de PDF/imagem, transcrição de áudio e análise visual via API Mistral.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_mistral_percepcao",
      description: "Processa documentos, áudio ou imagens com Mistral (ocr, transcrever_audio, descrever_imagem, perguntar_documento).",
      parameters: {
        type: "object",
        properties: {
          modo: {
            type: "string",
            enum: ["ocr", "transcrever_audio", "descrever_imagem", "perguntar_documento"],
          },
          url: { type: "string", description: "URL pública do ficheiro" },
          base64: { type: "string", description: "Alternativa a url" },
          mime: { type: "string" },
          pergunta: { type: "string" },
        },
        required: ["modo"],
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_atualizar_lead",
    categoria: "registos",
    titulo: "Actualizar lead no CRM",
    descricao:
      "Grava campos permitidos na ficha do cliente (hub_leads_crm): estágio, score, valor, interesse, follow-up, tags, metadata.",
    recomendadoWhatsApp: true,
    mistralFunction: {
      name: "hub_atualizar_lead",
      description:
        "Actualiza a ficha do lead desta conversa no CRM (WhatsApp). O telefone já está no sistema — não peça número. Grave nome, e-mail, interesse_principal, valor_estimado, score, proxima_acao e metadata (fluxo, cidade, potencial) sempre que o cliente revelar algo novo, na mesma volta da resposta, sem anunciar «salvar no CRM». Não use estágios ganho/perdido. Envie só campos que mudaram.",
      parameters: {
        type: "object",
        properties: {
          estagio: {
            type: "string",
            description:
              "Slug do estágio comercial activo no pipeline (ver secção PIPELINES CRM no prompt). Não use ganho/perdido.",
          },
          score: {
            type: "integer",
            description: "Pontuação 0–100 (interesse/qualificação).",
            minimum: 0,
            maximum: 100,
          },
          valor_estimado: {
            type: "number",
            description: "Valor estimado do negócio (número, ex.: 150000).",
            minimum: 0,
          },
          nome: { type: "string", description: "Nome completo se o cliente informou." },
          telefone: {
            type: "string",
            description: "Telefone com DDD (só dígitos ou formatado). Grava em hub_leads_crm.",
          },
          email: { type: "string", description: "E-mail se informado." },
          lead_id: {
            type: "string",
            description:
              "UUID do lead (obrigatório no copiloto interno / superagente). No WhatsApp omita — usa o lead da conversa.",
          },
          interesse_principal: {
            type: "string",
            description: "Resumo curto do interesse (ex.: reforma cozinha, apto 3 quartos).",
          },
          proxima_acao: {
            type: "string",
            description: "Próximo passo combinado (ex.: enviar proposta, visita sábado).",
          },
          data_proxima_acao: {
            type: "string",
            description: "Data/hora ISO para follow-up (ex.: 2026-05-20T15:00:00Z).",
          },
          motivo_perda: {
            type: "string",
            description: "Documentar objeção (não altera estágio para perdido).",
          },
          tags_adicionar: {
            type: "array",
            items: { type: "string" },
            description: "Tags curtas a acrescentar (ex.: urgente, imobiliario).",
          },
          humor: { type: "string", description: "Tom detectado: neutro, positivo, irritado, etc." },
          cpf: { type: "string", description: "CPF só dígitos se o cliente forneceu." },
          endereco_completo: { type: "string", description: "Morada se informada." },
          metadata: {
            type: "object",
            description: "Chaves extra (merge JSON), ex.: mercado, quartos.",
          },
          preferencias: {
            type: "object",
            description: "Preferências (merge JSON), ex.: horario manhã.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_criar_negocio",
    categoria: "registos",
    titulo: "Criar negócio / orçamento no CRM",
    descricao:
      "Regista um negócio comercial para o lead actual (serviço do catálogo + valor). Gera conta a receber no financeiro quando configurado.",
    recomendadoWhatsApp: true,
    mistralFunction: {
      name: "hub_criar_negocio",
      description:
        "Cria negócio/orçamento no CRM para o lead desta conversa. Use quando o cliente aceitar orçamento ou pedir proposta formal. Informe serviço (nome ou catálogo) e valor em BRL.",
      parameters: {
        type: "object",
        properties: {
          servico_nome: {
            type: "string",
            description: "Nome do serviço no catálogo (ex.: Troca de tela, Assistência técnica).",
          },
          servico_catalogo_id: {
            type: "string",
            description: "UUID do item no catálogo, se souber.",
          },
          titulo: { type: "string", description: "Título opcional do negócio." },
          valor_estimado: {
            type: "number",
            description: "Valor em BRL acordado ou da tabela de preços.",
          },
          etapa: {
            type: "string",
            description: "Etapa inicial: novo, proposta, negociando (padrão: proposta).",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_registar_nota_lead",
    categoria: "registos",
    titulo: "Registar nota na linha do tempo",
    descricao:
      "Cria uma entrada de nota na linha do tempo do cliente no CRM (sem apagar nem alterar registos existentes). Útil em atendimento.",
    recomendadoWhatsApp: true,
    mistralFunction: {
      name: "hub_registar_nota_lead",
      description:
        "Regista uma nota na timeline do lead actual (tipo nota, origem IA). Não apaga dados. Texto deve ser factual e breve.",
      parameters: {
        type: "object",
        properties: {
          texto: {
            type: "string",
            description: "Texto da nota (conteúdo visível ao equipa no CRM).",
          },
        },
        required: ["texto"],
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_whatsapp_menu",
    categoria: "cliente",
    titulo: "Menu WhatsApp (botões, lista, enquete ou carrossel)",
    descricao:
      "Envia mensagem interactiva via UAZAPI ao número deste lead: botões, lista, enquete ou carrossel (rede finita OpenAPI: /send/menu e /send/carousel).",
    recomendadoWhatsApp: true,
    mistralFunction: {
      name: "hub_whatsapp_menu",
      description:
        "Envia menu interactivo no WhatsApp desta conversa (UAZAPI). Use quando precisar de escolhas claras: botões (poucas opções), lista (muitas linhas), enquete (selecção múltipla) ou carrossel (cartões com imagem e botões). O número é o do lead; só em agentes modo canal WhatsApp.",
      parameters: {
        type: "object",
        properties: {
          tipo: {
            type: "string",
            enum: ["button", "list", "poll", "carousel"],
            description:
              "button — respostas rápidas; list — lista com secções (use linhas que começam com [Título] na doc UAZAPI); poll — enquete; carousel — opções em texto (choices) ou cartões com imagem (cartoes_carrossel + /send/carousel).",
          },
          texto: {
            type: "string",
            description: "Texto principal da mensagem (cabeçalho do menu).",
          },
          opcoes: {
            type: "array",
            description:
              "Lista de choices (obrigatória para /send/menu). Formatos avançados de lista: ver OpenAPI UAZAPI (ex.: Título|id|subtítulo). Para carrossel só com cartoes_carrossel pode ser array vazio.",
            items: { type: "string" },
          },
          rodape: {
            type: "string",
            description: "Texto de rodapé opcional (footerText).",
          },
          texto_botao_lista: {
            type: "string",
            description: "Rótulo do botão que abre a lista (listButton); relevante para type list.",
          },
          max_opcoes_selecionaveis: {
            type: "integer",
            description: "Para enquetes: número máximo de opções que o utilizador pode escolher (selectableCount).",
            minimum: 1,
            maximum: 20,
          },
          url_imagem_botao: {
            type: "string",
            description: "URL da imagem em menus tipo button (imageButton).",
          },
          numero_destino: {
            type: "string",
            description: "Override opcional do número (DDI+…); por defeito usa telefone do lead no CRM.",
          },
          cartoes_carrossel: {
            type: "array",
            description:
              "Se preenchido com tipo carousel, envia via POST /send/carousel (cartões com imagem e botões). Cada cartão: texto_cartao, url_imagem opcional, botoes [{ id, rotulo, tipo: REPLY|URL|COPY|CALL }].",
            items: {
              type: "object",
              properties: {
                texto_cartao: { type: "string", description: "Texto do cartão (pode ter quebras de linha)." },
                url_imagem: { type: "string", description: "URL https da imagem do cartão." },
                botoes: {
                  type: "array",
                  description: "Botões do cartão (máx. ~3 por cartão no WhatsApp).",
                  items: {
                    type: "object",
                    properties: {
                      id: {
                        type: "string",
                        description: "Valor enviado no chat (REPLY), URL completa (URL), texto a copiar (COPY), telefone (CALL).",
                      },
                      rotulo: { type: "string", description: "Texto visível no botão." },
                      tipo: {
                        type: "string",
                        enum: ["REPLY", "URL", "COPY", "CALL"],
                        description: "REPLY — resposta; URL — abrir link; COPY — copiar; CALL — telefonar.",
                      },
                    },
                    required: ["id", "rotulo", "tipo"],
                  },
                },
              },
              required: ["texto_cartao", "botoes"],
            },
          },
        },
        required: ["tipo", "texto"],
        additionalProperties: false,
      },
    },
  },
] as const;

const IDS = new Set(HUB_AGENTE_FERRAMENTAS_CATALOGO.map((t) => t.id));

export function isHubAgenteFerramentaId(v: string): v is HubAgenteFerramentaId {
  return IDS.has(v as HubAgenteFerramentaId);
}

/** Aceita boolean JSONB e valores às vezes devolvidos como string/número (APIs legadas, cópias). */
function coalesceFerramentaBool(v: unknown): boolean | undefined {
  if (v === true || v === "true" || v === 1 || v === "1") return true;
  if (v === false || v === "false" || v === 0 || v === "0") return false;
  return undefined;
}

/** Mapa id → ativo; chaves desconhecidas são ignoradas. */
export function normalizarUsoFerramentasIa(raw: unknown): Partial<Record<HubAgenteFerramentaId, boolean>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<Record<HubAgenteFerramentaId, boolean>> = {};
  for (const [k, v] of Object.entries(o)) {
    if (!isHubAgenteFerramentaId(k)) continue;
    const b = coalesceFerramentaBool(v);
    if (b !== undefined) out[k] = b;
  }
  return out;
}

export function agenteRaciocinioAvancadoAtivo(
  uso: Record<string, boolean | undefined> | null | undefined
): boolean {
  return coalesceFerramentaBool(uso?.hub_raciocinio_avancado) === true;
}

export function ferramentasMistralParaAgente(
  uso: Partial<Record<HubAgenteFerramentaId, boolean>>
): Array<{ type: "function"; function: NonNullable<HubAgenteFerramentaCatalogo["mistralFunction"]> }> {
  const out: Array<{
    type: "function";
    function: NonNullable<HubAgenteFerramentaCatalogo["mistralFunction"]>;
  }> = [];
  for (const item of HUB_AGENTE_FERRAMENTAS_CATALOGO) {
    if (item.metaCapacidade || !item.mistralFunction) continue;
    if ((FERRAMENTAS_CRM_MOVED_TO_INTEGRADOR as readonly string[]).includes(item.id)) continue;
    if (uso[item.id] === true) {
      out.push({ type: "function", function: item.mistralFunction });
    }
  }
  return out;
}

/** Chaves `hub_custom_*` no JSON de uso (activação por agente). */
export function extrairUsoFerramentasCustomIa(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(o)) {
    if (!k.startsWith("hub_custom_")) continue;
    const b = coalesceFerramentaBool(v);
    if (b !== undefined) out[k] = b;
  }
  return out;
}

/** Chaves `hub_ext_*` no JSON de uso (activação por agente). */
export function extrairUsoFerramentasExtIa(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(o)) {
    if (!k.startsWith("hub_ext_")) continue;
    const b = coalesceFerramentaBool(v);
    if (b !== undefined) out[k] = b;
  }
  return out;
}

/** Chaves `hub_int_*` — integradores pré-definidos (Google Calendar, Gmail, Zendesk). */
export function extrairUsoFerramentasIntIa(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(o)) {
    if (!k.startsWith("hub_int_")) continue;
    const b = coalesceFerramentaBool(v);
    if (b !== undefined) out[k] = b;
  }
  return out;
}

/** Mapa estável para builtins + booleans para ferramentas custom/externas/integradores preservadas do `raw`. */
export function mergeUsoFerramentasComPadraoPreservandoCustom(raw: unknown): Record<string, boolean> {
  const base = mergeUsoFerramentasComPadrao(normalizarUsoFerramentasIa(raw));
  const custom = extrairUsoFerramentasCustomIa(raw);
  const ext = extrairUsoFerramentasExtIa(raw);
  const integ = extrairUsoFerramentasIntIa(raw);
  return sincronizarUsoCrmIntegrador({ ...base, ...custom, ...ext, ...integ });
}

export type FerramentaCustomDefMistral = {
  ferramenta_key: string;
  descricao_modelo: string;
  parametros_schema: Record<string, unknown>;
};

export type FerramentaExternaDefMistral = FerramentaCustomDefMistral;

export type FerramentaIntegradorDefMistral = FerramentaCustomDefMistral;

/** Lista completa para Mistral: catálogo fixo + custom + externas + integradores do tenant. */
export function ferramentasMistralListaParaAgente(
  uso: Record<string, boolean>,
  customDefs: FerramentaCustomDefMistral[],
  extDefs: FerramentaExternaDefMistral[] = [],
  intDefs: FerramentaIntegradorDefMistral[] = []
): MistralChatToolDefinition[] {
  const out: MistralChatToolDefinition[] = [];
  for (const item of HUB_AGENTE_FERRAMENTAS_CATALOGO) {
    if (item.metaCapacidade || !item.mistralFunction) continue;
    if ((FERRAMENTAS_CRM_MOVED_TO_INTEGRADOR as readonly string[]).includes(item.id)) continue;
    if (uso[item.id] === true) {
      out.push({ type: "function", function: item.mistralFunction });
    }
  }
  for (const c of customDefs) {
    if (uso[c.ferramenta_key] === true) {
      out.push({
        type: "function",
        function: {
          name: c.ferramenta_key,
          description: c.descricao_modelo,
          parameters: c.parametros_schema,
        },
      });
    }
  }
  for (const e of extDefs) {
    if (uso[e.ferramenta_key] === true) {
      out.push({
        type: "function",
        function: {
          name: e.ferramenta_key,
          description: e.descricao_modelo,
          parameters: e.parametros_schema,
        },
      });
    }
  }
  for (const i of intDefs) {
    if (uso[i.ferramenta_key] === true) {
      out.push({
        type: "function",
        function: {
          name: i.ferramenta_key,
          description: i.descricao_modelo,
          parameters: i.parametros_schema,
        },
      });
    }
  }
  return out;
}

/** Alias explícito quando só ferramentas externas são relevantes no caller. */
export function ferramentasMistralListaComExternas(
  uso: Record<string, boolean>,
  customDefs: FerramentaCustomDefMistral[],
  extDefs: FerramentaExternaDefMistral[]
): MistralChatToolDefinition[] {
  return ferramentasMistralListaParaAgente(uso, customDefs, extDefs);
}

export function catalogoBuiltinPorId(id: HubAgenteFerramentaId): HubAgenteFerramentaCatalogo | undefined {
  return HUB_AGENTE_FERRAMENTAS_CATALOGO.find((t) => t.id === id);
}

export function mergeUsoFerramentasComPadrao(
  uso: Partial<Record<HubAgenteFerramentaId, boolean>>
): Record<HubAgenteFerramentaId, boolean> {
  const base: Record<HubAgenteFerramentaId, boolean> = {
    hub_lead_resumo: false,
    hub_lead_memorias: false,
    hub_lead_lookup_por_telefone: false,
    hub_metricas_escritorio: false,
    hub_dados_empresa: false,
    hub_operacao_empresa: false,
    hub_raciocinio_avancado: false,
    hub_relatorio_html_simples: false,
    hub_superagente_dados: false,
    hub_superagente_artefato: false,
    hub_mistral_percepcao: false,
    hub_registar_nota_lead: false,
    hub_whatsapp_menu: false,
    hub_atualizar_lead: false,
    hub_criar_negocio: false,
  };
  for (const id of Object.keys(base) as HubAgenteFerramentaId[]) {
    if (coalesceFerramentaBool(uso[id]) === true) base[id] = true;
  }
  return base;
}

/**
 * Primeiro atendimento WhatsApp: ferramentas de leitura/escrita no CRM activadas por defeito.
 * Preserva hub_int_* / hub_ext_* / hub_custom_* do `uso` de entrada (não só builtins).
 */
export function mergeUsoFerramentasWhatsappCanal(
  uso: Partial<Record<string, boolean>>,
  modoOperacao?: string | null
): Record<string, boolean> {
  const full = mergeUsoFerramentasComPadraoPreservandoCustom(uso);
  const merged: Record<string, boolean> = { ...full };

  if (modoOperacao === "canal_whatsapp" || modoOperacao === "canal_email") {
    if (coalesceFerramentaBool(uso.hub_atualizar_lead) !== false) merged.hub_atualizar_lead = true;
    if (coalesceFerramentaBool(uso.hub_lead_memorias) !== false) merged.hub_lead_memorias = true;
    if (coalesceFerramentaBool(uso.hub_lead_resumo) !== false) merged.hub_lead_resumo = true;
    if (modoOperacao === "canal_whatsapp" && coalesceFerramentaBool(uso.hub_whatsapp_menu) === true) {
      merged.hub_whatsapp_menu = true;
    }
    if (coalesceFerramentaBool(uso.hub_registar_nota_lead) !== false) merged.hub_registar_nota_lead = true;
    if (coalesceFerramentaBool(uso.hub_criar_negocio) !== false) merged.hub_criar_negocio = true;

    if (coalesceFerramentaBool(uso[HUB_INT_CRM_ATUALIZAR_LEAD]) !== false) {
      merged[HUB_INT_CRM_ATUALIZAR_LEAD] = true;
    }
    if (coalesceFerramentaBool(uso[HUB_INT_CRM_REGISTAR_NOTA]) !== false) {
      merged[HUB_INT_CRM_REGISTAR_NOTA] = true;
    }
    if (coalesceFerramentaBool(uso[HUB_INT_CRM_CRIAR_NEGOCIO]) !== false) {
      merged[HUB_INT_CRM_CRIAR_NEGOCIO] = true;
    }

    // Google Workspace (agenda + e-mail) — activo por defeito em agentes de canal salvo desligado.
    if (coalesceFerramentaBool(uso.hub_int_gmail_enviar) !== false) merged.hub_int_gmail_enviar = true;
    if (coalesceFerramentaBool(uso.hub_int_gcal_criar_evento) !== false) {
      merged.hub_int_gcal_criar_evento = true;
    }
    if (coalesceFerramentaBool(uso.hub_int_gcal_listar_eventos) !== false) {
      merged.hub_int_gcal_listar_eventos = true;
    }
    if (coalesceFerramentaBool(uso.hub_int_gcal_listar_reservas_lead) !== false) {
      merged.hub_int_gcal_listar_reservas_lead = true;
    }
    if (coalesceFerramentaBool(uso.hub_int_gcal_cancelar_evento) !== false) {
      merged.hub_int_gcal_cancelar_evento = true;
    }
  }

  return merged;
}

/**
 * Agentes internos (jobs_internos): respeita só o que está gravado em uso_ferramentas_ia.
 * Defaults completos ficam no wizard (`pacoteUsoFerramentasSuperagenteInterno`), não aqui.
 */
export function mergeUsoFerramentasJobsInternos(
  uso: Partial<Record<string, boolean>>,
  modoOperacao?: string | null
): Record<string, boolean> {
  const merged = mergeUsoFerramentasComPadraoPreservandoCustom(uso);

  if (modoOperacao !== "jobs_internos") {
    return merged;
  }

  return sincronizarUsoCrmIntegrador(merged);
}

/** @deprecated Nenhuma ferramenta é forçada na UI — o gestor activa/desactiva livremente. */
export const HUB_FERRAMENTAS_FUNCIONARIO_IA_OBRIGATORIAS: HubAgenteFerramentaId[] = [];

export function ferramentaObrigatoriaFuncionarioIa(_id: string): boolean {
  return false;
}

/** Pacote inicial ao criar funcionário IA no wizard (tudo ligado por defeito; editável depois). */
export function pacoteUsoFerramentasSuperagenteInterno(): Record<string, boolean> {
  const pack: Record<string, boolean> = {
    [HUB_INT_CRM_CONSULTAR]: true,
    hub_metricas_escritorio: true,
    hub_raciocinio_avancado: true,
    hub_relatorio_html_simples: true,
    hub_superagente_artefato: true,
    hub_mistral_percepcao: true,
    [MEM0_SUPER_MEMORIA_KEY]: true,
    [MEM0_BUSCAR_KEY]: true,
  };
  for (const key of CRM_ENTIDADES_TOOL_KEYS) pack[key] = true;
  return pack;
}

/** Escolhe defaults de ferramentas conforme modo_operacao do agente. */
export function mergeUsoFerramentasPorModoOperacao(
  uso: Partial<Record<string, boolean>>,
  modoOperacao?: string | null
): Record<string, boolean> {
  if (modoOperacao === "jobs_internos") {
    return mergeUsoFerramentasJobsInternos(uso, modoOperacao);
  }
  return mergeUsoFerramentasWhatsappCanal(uso, modoOperacao);
}

export const HUB_FERRAMENTA_SECAO_LABEL: Record<HubFerramentaCategoria, string> = {
  cliente: "Dados do cliente nesta conversa",
  analise: "Análise e partilha",
  registos: "Registos no CRM",
  empresa: "Dados da empresa (agentes internos)",
};

/** Efeito em dados ou storage (UI / CRM — catálogo fixo no código). */
export type HubFerramentaNivelAcesso = "leitura" | "escrita";

export const HUB_FERRAMENTA_ACESSO: Record<HubAgenteFerramentaId, HubFerramentaNivelAcesso> = {
  hub_lead_resumo: "leitura",
  hub_lead_memorias: "leitura",
  hub_lead_lookup_por_telefone: "leitura",
  hub_metricas_escritorio: "leitura",
  hub_dados_empresa: "leitura",
  hub_operacao_empresa: "escrita",
  hub_raciocinio_avancado: "leitura",
  hub_relatorio_html_simples: "escrita",
  hub_superagente_dados: "leitura",
  hub_superagente_artefato: "escrita",
  hub_mistral_percepcao: "leitura",
  hub_registar_nota_lead: "escrita",
  hub_whatsapp_menu: "escrita",
  hub_atualizar_lead: "escrita",
  hub_criar_negocio: "escrita",
};
