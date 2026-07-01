import type { SupabaseClient } from "@supabase/supabase-js";
import type { FerramentaHubContexto } from "@/lib/hub/executar-ferramenta-ia";
import { defaultTenantId } from "@/lib/tenant-default";
import type { HarnessSurface } from "@/lib/harness/types";

export type DelegateToAgentParams = {
  supabase: SupabaseClient;
  tenantId: string;
  agenteOrigemSlug: string;
  agenteDestinoSlug: string;
  brief: string;
  surfaceOrigem: HarnessSurface;
  sessionId?: string | null;
  leadId?: string | null;
  contextoExtra?: Record<string, unknown>;
};

async function agenteExiste(
  supabase: SupabaseClient,
  tenantId: string,
  slug: string
): Promise<{ nome: string; modo_operacao: string | null; modelo: string } | null> {
  const { data } = await supabase
    .from("hub_agente_identidade")
    .select("nome, modo_operacao, modelo_padrao, ativo")
    .eq("agente_slug", slug)
    .eq("tenant_id", tenantId)
    .eq("ativo", true)
    .maybeSingle();

  if (!data) return null;
  return {
    nome: String(data.nome ?? slug),
    modo_operacao: (data.modo_operacao as string | null) ?? null,
    modelo: String(data.modelo_padrao ?? "mistral-small-latest"),
  };
}

export async function delegarTrabalhoParaAgente(
  params: DelegateToAgentParams
): Promise<{ ok: boolean; delegacao_id?: string; resposta?: string; erro?: string }> {
  const brief = params.brief.trim().slice(0, 4000);
  if (!brief) return { ok: false, erro: "brief_vazio" };

  if (params.agenteDestinoSlug === params.agenteOrigemSlug) {
    return { ok: false, erro: "nao_delegar_para_si_mesmo" };
  }

  const destino = await agenteExiste(
    params.supabase,
    params.tenantId,
    params.agenteDestinoSlug
  );
  if (!destino) return { ok: false, erro: "agente_destino_nao_encontrado" };

  const { data: delegacao, error: errDel } = await params.supabase
    .from("hub_harness_delegations")
    .insert({
      tenant_id: params.tenantId,
      session_id: params.sessionId ?? null,
      agente_origem_slug: params.agenteOrigemSlug,
      agente_destino_slug: params.agenteDestinoSlug,
      lead_id: params.leadId ?? null,
      surface_origem: params.surfaceOrigem,
      brief,
      contexto_json: params.contextoExtra ?? {},
      status: "running",
    })
    .select("id")
    .maybeSingle();

  if (errDel || !delegacao?.id) {
    return { ok: false, erro: errDel?.message ?? "falha_criar_delegacao" };
  }

  const delegacaoId = delegacao.id as string;

  try {
    const modo = destino.modo_operacao ?? "";
    const ehInterno = modo === "jobs_internos" || modo === "";

    if (ehInterno) {
      const { runHarnessHost } = await import("@/lib/harness/host");
      const snapshot = JSON.stringify(
        {
          delegacao_de: params.agenteOrigemSlug,
          surface_origem: params.surfaceOrigem,
          lead_id: params.leadId ?? null,
          ...params.contextoExtra,
        },
        null,
        0
      ).slice(0, 3000);

      const out = await runHarnessHost({
        supabase: params.supabase,
        modelo: destino.modelo,
        agenteNome: destino.nome,
        agenteSlug: params.agenteDestinoSlug,
        tenantId: params.tenantId,
        historico: [],
        mensagemUsuario: brief,
        trigger: "copiloto",
        canalInterno: "copiloto_crm",
        snapshot,
      });

      await params.supabase
        .from("hub_harness_delegations")
        .update({
          status: "completed",
          resultado_texto: out.texto.slice(0, 12000),
          concluido_em: new Date().toISOString(),
        })
        .eq("id", delegacaoId);

      return { ok: true, delegacao_id: delegacaoId, resposta: out.texto };
    }

    if (!params.leadId) {
      await params.supabase
        .from("hub_harness_delegations")
        .update({
          status: "failed",
          erro: "lead_id_obrigatorio_para_agente_canal",
          concluido_em: new Date().toISOString(),
        })
        .eq("id", delegacaoId);
      return { ok: false, erro: "lead_id_obrigatorio_para_agente_canal" };
    }

    const { processarMensagem } = await import("@/lib/ia/engine");
    const out = await processarMensagem({
      leadId: params.leadId,
      mensagem: brief,
      canal: params.surfaceOrigem === "email_lead" ? "email" : "whatsapp",
      tenantId: params.tenantId,
      agenteSlugHint: params.agenteDestinoSlug,
      metadata: {
        harness_delegacao: true,
        agente_origem: params.agenteOrigemSlug,
        delegacao_id: delegacaoId,
      },
    });

    const texto = out.resposta ?? "";
    await params.supabase
      .from("hub_harness_delegations")
      .update({
        status: out.sucesso ? "completed" : "failed",
        resultado_texto: texto.slice(0, 12000),
        erro: out.erro ?? null,
        concluido_em: new Date().toISOString(),
      })
      .eq("id", delegacaoId);

    if (!out.sucesso) return { ok: false, delegacao_id: delegacaoId, erro: out.erro };
    return { ok: true, delegacao_id: delegacaoId, resposta: texto };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await params.supabase
      .from("hub_harness_delegations")
      .update({
        status: "failed",
        erro: msg.slice(0, 500),
        concluido_em: new Date().toISOString(),
      })
      .eq("id", delegacaoId);
    return { ok: false, delegacao_id: delegacaoId, erro: msg };
  }
}

export async function transferirLeadParaAgente(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    leadId: string;
    agenteOrigemSlug: string;
    agenteDestinoSlug: string;
    resumo?: string;
  }
): Promise<{ ok: boolean; erro?: string }> {
  const dest = params.agenteDestinoSlug.trim();
  if (!dest) return { ok: false, erro: "agente_destino_vazio" };

  const { data: lead } = await supabase
    .from("hub_leads_crm")
    .select("id, metadata")
    .eq("id", params.leadId)
    .eq("tenant_id", params.tenantId)
    .maybeSingle();

  if (!lead) return { ok: false, erro: "lead_nao_encontrado" };

  const metaBase =
    lead.metadata && typeof lead.metadata === "object" && !Array.isArray(lead.metadata)
      ? (lead.metadata as Record<string, unknown>)
      : {};

  const agora = new Date().toISOString();
  const { error } = await supabase
    .from("hub_leads_crm")
    .update({
      agente_responsavel: dest,
      metadata: {
        ...metaBase,
        transfer_agente_destino: dest,
        transfer_agente_origem: params.agenteOrigemSlug,
        transfer_agente_em: agora,
        ...(params.resumo ? { transfer_resumo: params.resumo.slice(0, 500) } : {}),
      },
      atualizado_em: agora,
    })
    .eq("id", params.leadId);

  if (error) return { ok: false, erro: error.message };

  await supabase.from("hub_atividades").insert({
    lead_id: params.leadId,
    tipo: "ia_acao",
    descricao: `Conversa transferida para agente ${dest}`,
    feito_por: params.agenteOrigemSlug,
    feito_por_tipo: "ia",
    tenant_id: params.tenantId,
    metadata: {
      acao: "harness_transfer_lead",
      agente_destino: dest,
      resumo: params.resumo?.slice(0, 300) ?? null,
    },
  });

  return { ok: true };
}

export type HarnessToolContext = FerramentaHubContexto & {
  sessionId?: string | null;
  harnessSurface?: FerramentaHubContexto["harnessSurface"];
};
