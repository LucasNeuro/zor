import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { HubAgenteFerramentaId } from "@/lib/hub/agente-ferramentas-registry";
import { isHubAgenteFerramentaId } from "@/lib/hub/agente-ferramentas-registry";
import { fetchFerramentaCustomPorKey } from "@/lib/hub/ferramentas-custom-db";
import {
  fetchFerramentaExternaPorKey,
  fetchIntegracaoComCredenciais,
} from "@/lib/hub/ferramentas-externas-db";
import { executarFerramentaHttp } from "@/lib/hub/executar-ferramenta-http";
import { smartPosProcessarResultadoFerramenta } from "@/lib/hub/smart-pos-ferramenta";
import { defaultTenantId } from "@/lib/tenant-default";
import { uazapiFetchJson } from "@/lib/whatsapp/uazapi-http";
import { buildHubLeadsCrmPatch } from "@/lib/hub/hub-leads-crm-atualizar";
import { criarNegocioParaLead } from "@/lib/crm/criar-negocio-from-lead";
import {
  formatarEstagiosPipelineParaPrompt,
  listarEstagiosPipelineParaIa,
} from "@/lib/crm/pipeline-estagios-ia";
import {
  telefoneConversaId,
  telefonesConversaEquivalentes,
  validarLeadTelefoneSessao,
} from "@/lib/crm/isolamento-conversa-lead";

export type FerramentaHubContexto = {
  leadId?: string | null;
  agenteSlug: string;
  tenantId?: string;
  /** Telefone WhatsApp da sessão (identificador global da conversa). */
  telefoneSessao?: string | null;
  /** hub_agente_identidade.modo_operacao — usado para gates de escrita seguros */
  modoOperacao?: string | null;
  /** Simulação interna do CRM — não envia WhatsApp real nem grava leads no funil. */
  simulacaoCanal?: boolean;
  /** Agente interno (copiloto/ciclo) — permite hub_dados_empresa. */
  agenteInterno?: boolean;
  /** Utilizador CRM — memória Mem0 do superagente interno. */
  usuarioCrmId?: string | null;
};

const FERRAMENTAS_CRM_LEAD_ESCRITA: HubAgenteFerramentaId[] = [
  "hub_atualizar_lead",
  "hub_criar_negocio",
  "hub_registar_nota_lead",
];

function respostaFerramentaPainelCopiloto(
  ferramenta: string,
  aviso: string,
  extra?: Record<string, unknown>
): string {
  return JSON.stringify({
    ok: true,
    simulacao: true,
    painel_copiloto: true,
    ferramenta,
    aviso,
    ...extra,
  });
}

function db(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function executarFerramentaHubBuiltin(
  toolName: HubAgenteFerramentaId,
  args: Record<string, unknown>,
  ctx: FerramentaHubContexto,
  supabase: SupabaseClient
): Promise<string> {
  const telSessao = telefoneConversaId(ctx.telefoneSessao ?? "");

  if (ctx.simulacaoCanal) {
    if (FERRAMENTAS_CRM_LEAD_ESCRITA.includes(toolName)) {
      return respostaFerramentaPainelCopiloto(
        toolName,
        "No Copiloto IA não grava leads, negócios nem notas no CRM. Isto só acontece na conversa WhatsApp real com o cliente."
      );
    }
    if (toolName === "hub_lead_resumo" && !ctx.leadId) {
      return respostaFerramentaPainelCopiloto(
        toolName,
        "Contacto fictício de simulação — sem card no funil de leads.",
        {
          lead: {
            nome: "Cliente (simulação)",
            telefone: telSessao.length >= 10 ? telSessao : null,
            estagio: "novo",
            valor_estimado: 0,
            interesse_principal: null,
            agente_responsavel: ctx.agenteSlug,
          },
        }
      );
    }
    if (toolName === "hub_lead_memorias" && !ctx.leadId) {
      return respostaFerramentaPainelCopiloto(toolName, "Sem memórias de lead — simulação sem registo CRM.", {
        memorias: [],
      });
    }
    if (toolName === "hub_lead_lookup_por_telefone" && !ctx.leadId) {
      return respostaFerramentaPainelCopiloto(toolName, "Sem lead real associado a este teste.", {
        encontrado: false,
      });
    }
  }

  if (telSessao.length >= 10 && ctx.leadId) {
    const isolamento = await validarLeadTelefoneSessao(supabase, ctx.leadId, telSessao);
    if (!isolamento.ok) {
      return JSON.stringify({ erro: isolamento.codigo, detalhe: isolamento.detalhe });
    }
  }

  switch (toolName) {
    case "hub_lead_resumo": {
      if (!ctx.leadId) {
        return JSON.stringify({ erro: "lead_id_ausente" });
      }
      const { data, error } = await supabase
        .from("hub_leads_crm")
        .select(
          "id, nome, telefone, estagio, valor_estimado, interesse_principal, agente_responsavel, humano_responsavel, atualizado_em, metadata"
        )
        .eq("id", ctx.leadId)
        .maybeSingle();
      if (error) return JSON.stringify({ erro: "supabase", detalhe: error.message });
      if (!data) return JSON.stringify({ erro: "lead_nao_encontrado", lead_id: ctx.leadId });
      const meta =
        data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
          ? { ...(data.metadata as Record<string, unknown>) }
          : {};
      const sessaoReiniciadaEm = meta.sessao_reiniciada_em;
      delete meta.conversa_turnos;
      for (const key of Object.keys(meta)) {
        if (/^fluxo/i.test(key) && key !== "fluxo_id") delete meta[key];
      }
      return JSON.stringify({
        lead: { ...data, metadata: meta },
        agente_slug_conversa: ctx.agenteSlug,
        sessao_reiniciada_em: sessaoReiniciadaEm ?? null,
        sessao_telefone: telSessao.length >= 10 ? telSessao : data.telefone ?? null,
        aviso: "Dados apenas deste contacto WhatsApp — não misturar com outros números.",
      });
    }
    case "hub_lead_memorias": {
      const limRaw = args.limite;
      const lim =
        typeof limRaw === "number" && Number.isFinite(limRaw)
          ? Math.min(10, Math.max(1, Math.floor(limRaw)))
          : 5;
      const { cutoffSessaoConversaMs } = await import("@/lib/ia/sessao-conversa-ttl");
      const cutoffIso = new Date(cutoffSessaoConversaMs()).toISOString();
      const { data, error } = await supabase
        .from("hub_memorias_lead")
        .select("chave, valor, confianca, criado_por, criado_em")
        .eq("lead_id", ctx.leadId)
        .gte("criado_em", cutoffIso)
        .order("confianca", { ascending: false })
        .limit(lim);
      if (error) return JSON.stringify({ erro: "supabase", detalhe: error.message });
      return JSON.stringify({ memorias: data ?? [] });
    }
    case "hub_lead_lookup_por_telefone": {
      const telRaw =
        typeof args.telefone === "string" && args.telefone.trim()
          ? args.telefone
          : telSessao.length >= 10
            ? telSessao
            : "";
      const telefone = telefoneConversaId(telRaw);
      if (telefone.length < 10) {
        return JSON.stringify({
          erro: "telefone_invalido",
          detalhe: "Use o telefone desta conversa ou hub_lead_resumo para a sessão actual.",
        });
      }

      if (telSessao.length >= 10 && !telefonesConversaEquivalentes(telefone, telSessao)) {
        return JSON.stringify({
          erro: "isolamento_sessao",
          detalhe:
            "Só é permitido consultar o telefone desta conversa. Para a ficha actual use hub_lead_resumo.",
        });
      }

      const { data: lead, error: eLead } = await supabase
        .from("hub_leads_crm")
        .select(
          "id, nome, telefone, estagio, score, valor_estimado, agente_responsavel, humano_responsavel, atualizado_em"
        )
        .eq("telefone", telefone)
        .maybeSingle();
      if (eLead) return JSON.stringify({ erro: "supabase", detalhe: eLead.message });
      if (!lead) return JSON.stringify({ ok: true, encontrado: false, telefone });

      const { data: pessoa, error: ePessoa } = await supabase
        .from("hub_pessoas")
        .select("id, codigo, nome, telefone, origem, atualizado_em")
        .eq("telefone", telefone)
        .maybeSingle();
      if (ePessoa) return JSON.stringify({ erro: "supabase", detalhe: ePessoa.message });

      return JSON.stringify({
        ok: true,
        encontrado: true,
        telefone,
        lead,
        pessoa: pessoa ?? null,
      });
    }
    case "hub_dados_empresa": {
      const ehInterno = ctx.agenteInterno === true || ctx.modoOperacao === "jobs_internos";
      if (!ehInterno) {
        return JSON.stringify({
          erro: "ferramenta_apenas_agente_interno",
          detalhe: "hub_dados_empresa só está disponível para agentes internos (jobs_internos).",
        });
      }
      const tenant = (ctx.tenantId && ctx.tenantId.trim()) || defaultTenantId();
      const { executarHubDadosEmpresa } = await import("@/lib/hub/hub-dados-empresa");
      return executarHubDadosEmpresa(supabase, tenant, args as import("@/lib/hub/hub-dados-empresa").HubDadosEmpresaArgs, {
        agenteSlug: ctx.agenteSlug,
      });
    }
    case "hub_operacao_empresa": {
      const ehInterno = ctx.agenteInterno === true || ctx.modoOperacao === "jobs_internos";
      if (!ehInterno) {
        return JSON.stringify({
          erro: "ferramenta_apenas_agente_interno",
          detalhe: "hub_operacao_empresa só está disponível para agentes internos (jobs_internos).",
        });
      }
      const tenant = (ctx.tenantId && ctx.tenantId.trim()) || defaultTenantId();
      const { executarHubOperacaoEmpresa } = await import("@/lib/hub/hub-operacao-empresa");
      return executarHubOperacaoEmpresa(
        supabase,
        tenant,
        args as import("@/lib/hub/hub-operacao-empresa").HubOperacaoEmpresaArgs,
        { agenteSlug: ctx.agenteSlug }
      );
    }
    case "hub_metricas_escritorio": {
      const tenant = (ctx.tenantId && ctx.tenantId.trim()) || defaultTenantId();
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();

      const { count: leadsTenant, error: e1 } = await supabase
        .from("hub_leads_crm")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenant);

      const { count: acoes7d, error: e2 } = await supabase
        .from("hub_acoes_ia")
        .select("*", { count: "exact", head: true })
        .eq("agente_slug", ctx.agenteSlug)
        .gte("criado_em", since);

      const { count: prompts7d, error: e3 } = await supabase
        .from("hub_prompt_logs")
        .select("*", { count: "exact", head: true })
        .eq("agente_slug", ctx.agenteSlug)
        .gte("criado_em", since);

      if (e1 || e2 || e3) {
        return JSON.stringify({
          erro: "supabase",
          detalhe: [e1?.message, e2?.message, e3?.message].filter(Boolean).join(" | ") || "contagem_falhou",
        });
      }

      return JSON.stringify({
        tenant_id: tenant,
        leads_total_no_tenant: leadsTenant ?? 0,
        acoes_ia_ultimos_7d_este_agente: acoes7d ?? 0,
        pedidos_inferencia_hub_ultimos_7d_este_agente: prompts7d ?? 0,
        nota: "Contagens agregadas; não substitui relatório financeiro nem detalhe por lead.",
      });
    }
    case "hub_relatorio_html_simples": {
      const titulo = typeof args.titulo === "string" ? args.titulo.trim() : "";
      const textoPlano = typeof args.texto_plano === "string" ? args.texto_plano.trim() : "";
      if (!titulo || !textoPlano) {
        return JSON.stringify({ erro: "titulo_e_texto_plano_obrigatorios" });
      }
      const tenant = (ctx.tenantId && ctx.tenantId.trim()) || defaultTenantId();
      const body = textoPlano
        .slice(0, 50_000)
        .split(/\r?\n/)
        .map((linha) => `<p>${escapeHtml(linha)}</p>`)
        .join("");
      const { carregarBrandingAgenteArtefato } = await import("@/lib/hub/superagente/artefato-branding");
      const { gerarHtmlArtefatoSimples } = await import("@/lib/hub/superagente/artefato-canvas");
      const { createClient } = await import("@supabase/supabase-js");
      const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
      const dbKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
      if (!dbUrl || !dbKey) return JSON.stringify({ erro: "supabase_nao_configurado" });
      const db = createClient(dbUrl, dbKey, { auth: { persistSession: false } });
      const branding = await carregarBrandingAgenteArtefato(db, tenant, ctx.agenteSlug);
      const html = gerarHtmlArtefatoSimples(titulo, body, branding);
      const { publicarArtefatoHtml } = await import("@/lib/hub/superagente/publicar-artefato-html");
      const pub = await publicarArtefatoHtml(html, {
        titulo,
        agenteSlug: ctx.agenteSlug,
        tenantId: tenant,
        telefoneGestor: ctx.telefoneSessao ?? null,
        metadata: { ferramenta: "hub_relatorio_html_simples" },
      });
      if (!pub.ok) return JSON.stringify({ erro: pub.erro });
      return JSON.stringify({
        ok: true,
        url_publica: pub.url,
        arquivo_id: pub.artefato_id,
      });
    }
    case "hub_superagente_dados": {
      const ehInterno = ctx.agenteInterno === true || ctx.modoOperacao === "jobs_internos";
      if (!ehInterno) {
        return JSON.stringify({
          erro: "ferramenta_apenas_agente_interno",
          detalhe: "hub_superagente_dados só está disponível para agentes internos.",
        });
      }
      const tenant = (ctx.tenantId && ctx.tenantId.trim()) || defaultTenantId();
      const { executarSuperagenteDados } = await import("@/lib/hub/superagente/dados-unificado");
      const acaoRaw = args.acao;
      const acao =
        typeof acaoRaw === "string" && acaoRaw.trim().toLowerCase() === "consultar"
          ? "consultar"
          : "catalogar";
      const colunas = Array.isArray(args.colunas)
        ? args.colunas.map((c) => String(c).trim()).filter(Boolean)
        : undefined;
      return executarSuperagenteDados(
        supabase,
        tenant,
        {
          acao,
          view: typeof args.view === "string" ? args.view : undefined,
          colunas,
          limite: typeof args.limite === "number" ? args.limite : Number(args.limite) || undefined,
          filtro_texto: typeof args.filtro_texto === "string" ? args.filtro_texto : undefined,
          filtro_coluna: typeof args.filtro_coluna === "string" ? args.filtro_coluna : undefined,
          categoria: typeof args.categoria === "string" ? args.categoria : undefined,
        },
        { agenteSlug: ctx.agenteSlug }
      );
    }
    case "hub_superagente_artefato": {
      const ehInterno = ctx.agenteInterno === true || ctx.modoOperacao === "jobs_internos";
      if (!ehInterno) {
        return JSON.stringify({
          erro: "ferramenta_apenas_agente_interno",
          detalhe: "hub_superagente_artefato só está disponível para agentes internos.",
        });
      }
      const tenant = (ctx.tenantId && ctx.tenantId.trim()) || defaultTenantId();
      const { publicarArtefatoCanvas } = await import("@/lib/hub/superagente/artefato-canvas");
      const titulo = typeof args.titulo === "string" ? args.titulo.trim() : "";
      const subtitulo = typeof args.subtitulo === "string" ? args.subtitulo.trim() : undefined;
      const temaRaw = typeof args.tema === "string" ? args.tema.trim().toLowerCase() : "";
      const tema = temaRaw === "claro" ? "claro" : "escuro";
      const secoesRaw = args.secoes;
      if (!titulo || !Array.isArray(secoesRaw) || secoesRaw.length === 0) {
        return JSON.stringify({ erro: "titulo_e_secoes_obrigatorios" });
      }

      const secoes = secoesRaw.slice(0, 12).map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const o = item as Record<string, unknown>;
        const tipo = String(o.tipo || "texto").trim().toLowerCase();
        if (tipo === "grafico" && o.grafico && typeof o.grafico === "object") {
          const g = o.grafico as Record<string, unknown>;
          const labels = Array.isArray(g.labels) ? g.labels.map((l) => String(l)) : [];
          const datasets = Array.isArray(g.datasets)
            ? g.datasets
                .map((d) => {
                  if (!d || typeof d !== "object") return null;
                  const ds = d as Record<string, unknown>;
                  return {
                    label: String(ds.label || "Série"),
                    data: Array.isArray(ds.data) ? ds.data.map((n) => Number(n) || 0) : [],
                    cor: typeof ds.cor === "string" ? ds.cor : undefined,
                  };
                })
                .filter(Boolean)
            : [];
          const tipoGraf = String(g.tipo || "bar").trim().toLowerCase();
          const tipos = new Set(["bar", "line", "pie", "doughnut"]);
          return {
            tipo: "grafico" as const,
            grafico: {
              tipo: tipos.has(tipoGraf) ? (tipoGraf as "bar" | "line" | "pie" | "doughnut") : "bar",
              titulo: typeof g.titulo === "string" ? g.titulo : undefined,
              labels,
              datasets: datasets as Array<{ label: string; data: number[]; cor?: string }>,
            },
          };
        }
        if (tipo === "tabela") {
          const colunas = Array.isArray(o.colunas) ? o.colunas.map((c) => String(c)) : [];
          const linhas = Array.isArray(o.linhas)
            ? o.linhas.map((row) =>
                Array.isArray(row) ? row.map((c) => String(c ?? "")) : []
              )
            : [];
          return { tipo: "tabela" as const, colunas, linhas };
        }
        return {
          tipo: "texto" as const,
          markdown: typeof o.markdown === "string" ? o.markdown : String(o.texto || ""),
        };
      }).filter(Boolean);

      if (!secoes.length) {
        return JSON.stringify({ erro: "secoes_invalidas" });
      }

      const pub = await publicarArtefatoCanvas(
        { titulo, subtitulo, tema, secoes: secoes as import("@/lib/hub/superagente/types").SecaoArtefatoSpec[] },
        {
          agenteSlug: ctx.agenteSlug,
          tenantId: tenant,
          telefoneGestor: ctx.telefoneSessao ?? null,
        }
      );
      if (!pub.ok) return JSON.stringify({ erro: pub.erro });
      return JSON.stringify({
        ok: true,
        url_publica: pub.url,
        arquivo_id: pub.arquivo_id,
        tipo: "artefato_canvas",
      });
    }
    case "hub_mistral_percepcao": {
      const { mistralIntegracaoDisponivel } = await import("@/lib/hub/mistral-integracao");
      if (!mistralIntegracaoDisponivel()) {
        return JSON.stringify({
          erro: "mistral_nao_configurado",
          detalhe:
            "Configure MISTRAL_API_KEY na plataforma e active «Percepção multimodal» em Integrações deste agente.",
        });
      }
      const { executarMistralPercepcao } = await import("@/lib/ia/mistral-multimodal");
      const modoRaw = typeof args.modo === "string" ? args.modo.trim().toLowerCase() : "";
      const modos = new Set(["ocr", "transcrever_audio", "descrever_imagem", "perguntar_documento"]);
      if (!modos.has(modoRaw)) {
        return JSON.stringify({ erro: "modo_invalido", modos: [...modos] });
      }
      return executarMistralPercepcao({
        modo: modoRaw as "ocr" | "transcrever_audio" | "descrever_imagem" | "perguntar_documento",
        url: typeof args.url === "string" ? args.url : undefined,
        base64: typeof args.base64 === "string" ? args.base64 : undefined,
        mime: typeof args.mime === "string" ? args.mime : undefined,
        pergunta: typeof args.pergunta === "string" ? args.pergunta : undefined,
      });
    }
    case "hub_atualizar_lead": {
      const ehInterno = ctx.agenteInterno === true || ctx.modoOperacao === "jobs_internos";
      if (!ehInterno && ctx.modoOperacao !== "canal_whatsapp") {
        return JSON.stringify({
          erro: "ferramenta_apenas_modo_atendimento_canal_whatsapp",
          modo_actual: ctx.modoOperacao ?? null,
        });
      }

      const leadIdArg = typeof args.lead_id === "string" ? args.lead_id.trim() : "";
      const leadId = ehInterno ? leadIdArg || ctx.leadId?.trim() || "" : ctx.leadId?.trim() || "";
      if (!leadId) {
        return JSON.stringify({
          erro: "lead_id_obrigatorio",
          detalhe: ehInterno
            ? "Informe lead_id (UUID) obtido com hub_operacao_empresa consultar/obter."
            : "Sem lead na sessão.",
        });
      }

      const tenantId = (ctx.tenantId && ctx.tenantId.trim()) || defaultTenantId();

      const { data: leadAtual, error: errLead } = await supabase
        .from("hub_leads_crm")
        .select(
          "id, pessoa_id, estagio, score, valor_estimado, tags, metadata, preferencias, nome, telefone, email, interesse_principal, tenant_id"
        )
        .eq("id", leadId)
        .maybeSingle();

      if (errLead) return JSON.stringify({ erro: "supabase", detalhe: errLead.message });
      if (!leadAtual) return JSON.stringify({ erro: "lead_nao_encontrado", lead_id: leadId });
      if (String(leadAtual.tenant_id) !== tenantId) {
        return JSON.stringify({ erro: "lead_fora_do_tenant" });
      }
      let estagiosPipeline: { slug: string; tipo_fecho: string }[] = [];
      try {
        const refs = await listarEstagiosPipelineParaIa(supabase, tenantId, "lead");
        estagiosPipeline = refs.map((e) => ({ slug: e.slug, tipo_fecho: e.tipo_fecho }));
      } catch {
        /* fallback lista fixa em buildHubLeadsCrmPatch */
      }

      const built = buildHubLeadsCrmPatch(args, leadAtual as Record<string, unknown>, {
        estagiosPipeline,
      });
      if (!built.ok) {
        return JSON.stringify({ erro: built.codigo ?? built.erro, detalhe: built.erro });
      }

      const { data: updated, error: errUp } = await supabase
        .from("hub_leads_crm")
        .update(built.patch)
        .eq("id", leadId)
        .select(
          "id, nome, telefone, email, estagio, score, valor_estimado, interesse_principal, proxima_acao, data_proxima_acao, tags, atualizado_em"
        )
        .maybeSingle();

      if (errUp) return JSON.stringify({ erro: "supabase", detalhe: errUp.message });
      if (!updated) return JSON.stringify({ erro: "lead_nao_atualizado" });

      const pessoaId =
        leadAtual.pessoa_id != null && String(leadAtual.pessoa_id).trim()
          ? String(leadAtual.pessoa_id).trim()
          : null;
      if (pessoaId && (built.patch.telefone || built.patch.email)) {
        const pessoaPatch: Record<string, unknown> = {};
        if (typeof built.patch.telefone === "string") pessoaPatch.telefone = built.patch.telefone;
        if (typeof built.patch.email === "string") pessoaPatch.email = built.patch.email;
        await supabase.from("hub_pessoas").update(pessoaPatch).eq("id", pessoaId);
      }

      if (
        built.estagioNovo &&
        built.estagioAnterior &&
        built.estagioNovo !== built.estagioAnterior
      ) {
        await supabase.from("hub_atividades").insert({
          lead_id: leadId,
          tipo: "status_change",
          descricao: `Estágio: ${built.estagioAnterior} → ${built.estagioNovo}`,
          feito_por: ctx.agenteSlug,
          feito_por_tipo: "ia",
          metadata: {
            origem: "hub_atualizar_lead",
            estagio_anterior: built.estagioAnterior,
            estagio_novo: built.estagioNovo,
          },
        });
      }

      await supabase.from("hub_acoes_ia").insert({
        agente_slug: ctx.agenteSlug,
        tipo: "memoria_salva",
        descricao: "Lead actualizado via hub_atualizar_lead",
        lead_id: leadId,
        sucesso: true,
        metadata: {
          ferramenta: "hub_atualizar_lead",
          campos: Object.keys(built.patch).filter((k) => k !== "atualizado_em" && k !== "ultimo_contato"),
        },
      });

      return JSON.stringify({
        ok: true,
        lead: updated,
        lead_id: leadId,
        campos_alterados: Object.keys(built.patch).filter(
          (k) => k !== "atualizado_em" && k !== "ultimo_contato"
        ),
        instrucao_agente:
          "Confirme ao utilizador os campos gravados com base neste JSON. Se pedirem para rever, chame hub_operacao_empresa obter com o mesmo lead_id.",
      });
    }
    case "hub_criar_negocio": {
      if (ctx.modoOperacao !== "canal_whatsapp") {
        return JSON.stringify({
          erro: "ferramenta_apenas_modo_atendimento_canal_whatsapp",
          modo_actual: ctx.modoOperacao ?? null,
        });
      }
      if (!ctx.leadId) {
        return JSON.stringify({ erro: "lead_id_ausente" });
      }

      const tenantId = (ctx.tenantId && ctx.tenantId.trim()) || defaultTenantId();
      const servicoNome =
        typeof args.servico_nome === "string" ? args.servico_nome.trim() : undefined;
      const servicoCatalogoId =
        typeof args.servico_catalogo_id === "string" ? args.servico_catalogo_id.trim() : undefined;
      const titulo = typeof args.titulo === "string" ? args.titulo.trim() : undefined;
      const etapa = typeof args.etapa === "string" ? args.etapa.trim() : "proposta";
      let valorEstimado: number | null = null;
      if (typeof args.valor_estimado === "number" && Number.isFinite(args.valor_estimado)) {
        valorEstimado = args.valor_estimado;
      }

      if (!servicoNome && !servicoCatalogoId) {
        return JSON.stringify({
          erro: "servico_obrigatorio",
          detalhe: "Informe servico_nome ou servico_catalogo_id do catálogo.",
        });
      }

      const result = await criarNegocioParaLead(supabase, {
        tenantId,
        leadId: ctx.leadId ?? undefined,
        servicoCatalogoId,
        servicoNome,
        titulo,
        valorEstimado,
        etapa,
        origem: ctx.simulacaoCanal ? "simulacao_ia" : "whatsapp_ia",
      });

      if (!result.ok) {
        return JSON.stringify({ erro: result.erro });
      }

      await supabase.from("hub_acoes_ia").insert({
        agente_slug: ctx.agenteSlug,
        tipo: "negocio_criado",
        descricao: `Negócio criado: ${result.titulo}`,
        lead_id: ctx.leadId,
        sucesso: true,
        metadata: {
          ferramenta: "hub_criar_negocio",
          negocio_id: result.negocioId,
          valor: result.valor,
          servico_id: result.servico?.id ?? null,
        },
      });

      return JSON.stringify({
        ok: true,
        negocio_id: result.negocioId,
        titulo: result.titulo,
        valor_estimado: result.valor,
        servico: result.servico
          ? { id: result.servico.id, nome: result.servico.nome, preco: result.servico.preco_referencia }
          : null,
        financeiro:
          "Conta a receber será gerada automaticamente se o trigger hub_negocios_sync_conta_receber estiver ativo.",
      });
    }
    case "hub_registar_nota_lead": {
      if (ctx.modoOperacao !== "canal_whatsapp") {
        return JSON.stringify({
          erro: "ferramenta_apenas_modo_atendimento_canal_whatsapp",
          modo_actual: ctx.modoOperacao ?? null,
        });
      }
      const textoBruto = typeof args.texto === "string" ? args.texto.trim() : "";
      if (!textoBruto) return JSON.stringify({ erro: "texto_obrigatorio" });
      const texto = textoBruto.slice(0, 8000);
      const { error } = await supabase.from("hub_atividades").insert({
        lead_id: ctx.leadId,
        tipo: "nota",
        descricao: texto,
        feito_por: ctx.agenteSlug,
        feito_por_tipo: "ia",
        metadata: { origem: "hub_registar_nota_lead" },
      });
      if (error) return JSON.stringify({ erro: "supabase", detalhe: error.message });
      return JSON.stringify({ ok: true, tipo: "nota_timeline" });
    }
    case "hub_whatsapp_menu": {
      if (ctx.modoOperacao !== "canal_whatsapp") {
        return JSON.stringify({
          erro: "ferramenta_apenas_modo_atendimento_canal_whatsapp",
          modo_actual: ctx.modoOperacao ?? null,
        });
      }

      const tipoRaw = args.tipo;
      const tipo =
        typeof tipoRaw === "string" ? tipoRaw.trim().toLowerCase() : "";
      const tiposMenu = new Set(["button", "list", "poll", "carousel"]);
      if (!tiposMenu.has(tipo)) {
        return JSON.stringify({ erro: "tipo_menu_invalido", permitidos: ["button", "list", "poll", "carousel"] });
      }

      const textoBruto = typeof args.texto === "string" ? args.texto.trim() : "";
      if (!textoBruto) return JSON.stringify({ erro: "texto_obrigatorio" });
      const texto = textoBruto.slice(0, 4000);

      const normOpcoes = (v: unknown): string[] => {
        if (!Array.isArray(v)) return [];
        return v
          .map((x) => (typeof x === "string" ? x.trim() : String(x ?? "").trim()))
          .filter((s) => s.length > 0)
          .slice(0, 50);
      };
      const opcoes = normOpcoes(args.opcoes);

      type CarouselCard = { text: string; image?: string; buttons: Array<{ id: string; text: string; type: string }> };
      const montarCarousel = (): CarouselCard[] | null => {
        const raw = args.cartoes_carrossel;
        if (!Array.isArray(raw) || raw.length === 0) return null;
        const out: CarouselCard[] = [];
        const tiposBtn = new Set(["REPLY", "URL", "COPY", "CALL"]);
        for (const item of raw.slice(0, 10)) {
          if (!item || typeof item !== "object" || Array.isArray(item)) continue;
          const o = item as Record<string, unknown>;
          const textCart =
            typeof o.texto_cartao === "string" ? o.texto_cartao.trim() : String(o.texto_cartao ?? "").trim();
          const image =
            typeof o.url_imagem === "string" && o.url_imagem.trim() ? o.url_imagem.trim().slice(0, 2000) : undefined;
          const botoesRaw = o.botoes;
          if (!textCart || !Array.isArray(botoesRaw)) continue;
          const buttons: CarouselCard["buttons"] = [];
          for (const b of botoesRaw.slice(0, 5)) {
            if (!b || typeof b !== "object" || Array.isArray(b)) continue;
            const br = b as Record<string, unknown>;
            const id = typeof br.id === "string" ? br.id.trim() : String(br.id ?? "").trim();
            const rotulo =
              typeof br.rotulo === "string" ? br.rotulo.trim() : String(br.rotulo ?? "").trim();
            const tRaw = typeof br.tipo === "string" ? br.tipo.trim().toUpperCase() : "REPLY";
            const tBtn = tiposBtn.has(tRaw) ? tRaw : "REPLY";
            if (!id || !rotulo) continue;
            buttons.push({ id: id.slice(0, 500), text: rotulo.slice(0, 120), type: tBtn });
          }
          if (buttons.length === 0) continue;
          const card: CarouselCard = { text: textCart.slice(0, 4000), buttons };
          if (image) card.image = image;
          out.push(card);
        }
        return out.length > 0 ? out : null;
      };

      const carouselCards = tipo === "carousel" ? montarCarousel() : null;
      const useCarouselEndpoint = Boolean(carouselCards && carouselCards.length > 0);

      if (!useCarouselEndpoint && opcoes.length === 0) {
        return JSON.stringify({
          erro: "opcoes_obrigatorias",
          nota: "Forneça `opcoes` (choices) para /send/menu ou `cartoes_carrossel` com tipo carousel para /send/carousel.",
        });
      }

      const overrideNum =
        typeof args.numero_destino === "string" ? args.numero_destino.replace(/\D/g, "") : "";
      let number = overrideNum;
      if (!number) {
        const { data: leadRow, error: el } = await supabase
          .from("hub_leads_crm")
          .select("telefone")
          .eq("id", ctx.leadId)
          .maybeSingle();
        if (el) return JSON.stringify({ erro: "supabase", detalhe: el.message });
        const tel =
          leadRow && typeof leadRow.telefone === "string" ? leadRow.telefone.replace(/\D/g, "") : "";
        number = tel;
      }
      if (!number) {
        return JSON.stringify({ erro: "numero_destino_ausente", nota: "Lead sem telefone ou override inválido." });
      }

      if (ctx.simulacaoCanal) {
        return JSON.stringify({
          ok: true,
          simulacao: true,
          aviso: "Menu simulado — não enviado ao WhatsApp real.",
          tipo,
          texto,
          opcoes,
          number,
        });
      }

      const { data: agenteRow, error: ea } = await supabase
        .from("hub_agente_identidade")
        .select("uazapi_instance_token")
        .eq("agente_slug", ctx.agenteSlug)
        .maybeSingle();
      if (ea) return JSON.stringify({ erro: "supabase", detalhe: ea.message });
      const instanceToken =
        agenteRow && typeof agenteRow.uazapi_instance_token === "string"
          ? agenteRow.uazapi_instance_token.trim()
          : "";
      if (!instanceToken) {
        return JSON.stringify({
          erro: "uazapi_token_instancia_ausente",
          nota: "Ligue a instância UAZAPI na ficha do agente.",
        });
      }

      if (useCarouselEndpoint && carouselCards) {
        const res = await uazapiFetchJson<unknown>("/send/carousel", {
          method: "POST",
          instanceToken,
          body: {
            number,
            text: texto,
            carousel: carouselCards,
          },
        });
        if (!res.ok) {
          return JSON.stringify({
            ok: false,
            endpoint: "/send/carousel",
            erro: "uazapi",
            detalhe: res.error,
            status: res.status,
            request: res.request,
          });
        }
        return JSON.stringify({
          ok: true,
          endpoint: "/send/carousel",
          status: res.status,
          resposta: res.data,
        });
      }

      const body: Record<string, unknown> = {
        number,
        type: tipo,
        text: texto,
        choices: opcoes,
      };

      const rodape = typeof args.rodape === "string" ? args.rodape.trim() : "";
      if (rodape) body.footerText = rodape.slice(0, 500);

      const listaBtn = typeof args.texto_botao_lista === "string" ? args.texto_botao_lista.trim() : "";
      if (listaBtn) body.listButton = listaBtn.slice(0, 120);

      if (tipo === "poll") {
        const ms = args.max_opcoes_selecionaveis;
        if (typeof ms === "number" && Number.isFinite(ms)) {
          body.selectableCount = Math.min(20, Math.max(1, Math.floor(ms)));
        }
      }

      const imgBtn = typeof args.url_imagem_botao === "string" ? args.url_imagem_botao.trim() : "";
      if (imgBtn) body.imageButton = imgBtn.slice(0, 2000);

      const resMenu = await uazapiFetchJson<unknown>("/send/menu", {
        method: "POST",
        instanceToken,
        body,
      });
      if (!resMenu.ok) {
        return JSON.stringify({
          ok: false,
          endpoint: "/send/menu",
          erro: "uazapi",
          detalhe: resMenu.error,
          status: resMenu.status,
          request: resMenu.request,
        });
      }
      return JSON.stringify({
        ok: true,
        endpoint: "/send/menu",
        status: resMenu.status,
        resposta: resMenu.data,
      });
    }
    default:
      return JSON.stringify({ erro: "ferramenta_builtin_desconhecida", nome: toolName });
  }
}

/** Resultado string para o modelo (JSON ou texto após smart layer). */
export async function executarFerramentaHub(
  toolName: string,
  argsJson: string,
  ctx: FerramentaHubContexto
): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    const p = JSON.parse(argsJson || "{}");
    if (p && typeof p === "object" && !Array.isArray(p)) args = p as Record<string, unknown>;
  } catch {
    return JSON.stringify({ erro: "argumentos_json_invalidos" });
  }

  const supabase = db();
  const tenant = (ctx.tenantId && ctx.tenantId.trim()) || defaultTenantId();

  try {
    if (toolName.startsWith("hub_int_")) {
      const { executarFerramentaIntegrador } = await import("@/lib/hub/executar-integrador");
      return executarFerramentaIntegrador(supabase, tenant, toolName, args, {
        leadId: ctx.leadId ?? undefined,
        telefone: ctx.telefoneSessao,
        agenteSlug: ctx.agenteSlug,
        agenteInterno: ctx.agenteInterno === true,
        usuarioCrmId: ctx.usuarioCrmId,
        tenantId: tenant,
      });
    }

    if (toolName.startsWith("hub_ext_")) {
      const row = await fetchFerramentaExternaPorKey(supabase, tenant, toolName);
      if (!row) {
        return JSON.stringify({ erro: "ferramenta_externa_nao_encontrada", chave: toolName });
      }
      const pack = await fetchIntegracaoComCredenciais(supabase, tenant, row.integracao_id);
      if (!pack) {
        return JSON.stringify({ erro: "integracao_nao_encontrada", integracao_id: row.integracao_id });
      }
      return await executarFerramentaHttp({
        ferramenta: row,
        integracao: pack.integracao,
        credenciais: pack.credenciais,
        args,
      });
    }

    if (toolName.startsWith("hub_custom_")) {
      const row = await fetchFerramentaCustomPorKey(supabase, tenant, toolName);
      if (!row) {
        return JSON.stringify({ erro: "ferramenta_custom_nao_encontrada", chave: toolName });
      }
      if (!isHubAgenteFerramentaId(row.builtin_impl)) {
        return JSON.stringify({ erro: "builtin_impl_invalido", valor: row.builtin_impl });
      }
      const raw = await executarFerramentaHubBuiltin(row.builtin_impl, args, ctx, supabase);
      if (row.smart_provider === "mistral" || row.smart_provider === "gemini") {
        const instr =
          row.smart_prompt?.trim() ||
          "Resuma e estruture estes dados para o assistente principal, em português, sem inventar factos.";
        const pos = await smartPosProcessarResultadoFerramenta({
          provider: row.smart_provider,
          model: row.smart_model,
          instrucoes: instr,
          payloadBruto: raw,
        });
        if (!pos.ok) {
          return raw;
        }
        return pos.texto;
      }
      return raw;
    }

    if (!isHubAgenteFerramentaId(toolName)) {
      return JSON.stringify({ erro: "ferramenta_desconhecida", nome: toolName });
    }

    return await executarFerramentaHubBuiltin(toolName, args, ctx, supabase);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro_execucao";
    return JSON.stringify({ erro: "excecao", detalhe: msg });
  }
}
