import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mergeLeadTimelineEvents,
  parseConversaTurnos,
  type LeadTimelineEvent,
} from "@/lib/crm/lead-timeline";
import { normalizarTelefone } from "@/lib/crm/pessoa-cadastro";
import type { ClienteCrmResumo, CrmResumoLead, CrmResumoNegocio } from "@/lib/crm/cliente-crm-resumo-types";

const LEAD_SELECT =
  "id, nome, telefone, estagio, estagio_funil, metadata, criado_em";
const NEGOCIO_SELECT =
  "id, codigo, titulo, etapa, status, valor_estimado, lead_id, criado_em";

function dedupeLeads(rows: CrmResumoLead[]): CrmResumoLead[] {
  const map = new Map<string, CrmResumoLead>();
  for (const row of rows) map.set(row.id, row);
  return [...map.values()].sort(
    (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()
  );
}

async function leadsPorTelefone(
  supabase: SupabaseClient,
  telefone: string | null | undefined
): Promise<CrmResumoLead[]> {
  const digits = normalizarTelefone(telefone || "");
  if (digits.length < 8) return [];

  const suffix = digits.slice(-8);
  const { data } = await supabase
    .from("hub_leads_crm")
    .select(LEAD_SELECT)
    .or(`telefone.ilike.%${suffix},telefone.ilike.%${digits}%`)
    .order("criado_em", { ascending: false })
    .limit(10);

  return (data ?? []) as CrmResumoLead[];
}

async function buildTimelineForLeads(
  supabase: SupabaseClient,
  leads: CrmResumoLead[],
  negocioIds: string[],
  extraLogs: { entidade: string; entidade_id: string }[] = []
): Promise<LeadTimelineEvent[]> {
  const leadIds = [...new Set(leads.map((l) => l.id))];
  if (leadIds.length === 0 && negocioIds.length === 0 && extraLogs.length === 0) {
    return [];
  }

  const [
    atividadesLead,
    atividadesNegocio,
    mensagens,
    logsLead,
    logsNegocio,
    encaminhamentos,
    ...extraLogResults
  ] = await Promise.all([
    leadIds.length > 0
      ? supabase
          .from("hub_atividades")
          .select("*")
          .in("lead_id", leadIds)
          .order("criado_em", { ascending: false })
          .limit(80)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    negocioIds.length > 0
      ? supabase
          .from("hub_atividades")
          .select("*")
          .in("negocio_id", negocioIds)
          .order("criado_em", { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    leadIds.length > 0
      ? supabase
          .from("hub_fila_mensagens")
          .select(
            "id, direcao, conteudo, agente_responsavel, agente_id, remetente_numero, criado_em, enviada_em"
          )
          .in("lead_id", leadIds)
          .order("criado_em", { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    leadIds.length > 0
      ? supabase
          .from("hub_logs")
          .select("*")
          .eq("entidade", "lead")
          .in("entidade_id", leadIds)
          .order("criado_em", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    negocioIds.length > 0
      ? supabase
          .from("hub_logs")
          .select("*")
          .eq("entidade", "negocio")
          .in("entidade_id", negocioIds)
          .order("criado_em", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    leadIds.length > 0
      ? supabase
          .from("hub_encaminhamentos")
          .select("*")
          .in("lead_id", leadIds)
          .order("criado_em", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ...extraLogs.map((log) =>
      supabase
        .from("hub_logs")
        .select("*")
        .eq("entidade", log.entidade)
        .eq("entidade_id", log.entidade_id)
        .order("criado_em", { ascending: false })
        .limit(20)
    ),
  ]);

  const atividades = [
    ...(atividadesLead.data ?? []),
    ...(atividadesNegocio.data ?? []),
  ];
  const logs = [
    ...(logsLead.data ?? []),
    ...(logsNegocio.data ?? []),
    ...extraLogResults.flatMap((r) => r.data ?? []),
  ];

  const conversaTurnos = leads.flatMap((l) => parseConversaTurnos(l.metadata));

  return mergeLeadTimelineEvents({
    atividades,
    mensagens: mensagens.data ?? [],
    logs,
    encaminhamentos: encaminhamentos.data ?? [],
    conversaTurnos,
  });
}

export async function buildCrmResumoForPessoa(
  supabase: SupabaseClient,
  pessoaId: string
): Promise<ClienteCrmResumo> {
  const { data: pessoa } = await supabase
    .from("hub_pessoas")
    .select("id, telefone")
    .eq("id", pessoaId)
    .maybeSingle();

  const [{ data: leadsPessoa }, { data: negociosRaw }, leadsTel] = await Promise.all([
    supabase
      .from("hub_leads_crm")
      .select(LEAD_SELECT)
      .eq("pessoa_id", pessoaId)
      .order("criado_em", { ascending: false })
      .limit(20),
    supabase
      .from("hub_negocios")
      .select(NEGOCIO_SELECT)
      .eq("pessoa_id", pessoaId)
      .order("criado_em", { ascending: false })
      .limit(30),
    leadsPorTelefone(supabase, pessoa?.telefone),
  ]);

  const leads = dedupeLeads([...(leadsPessoa ?? []), ...leadsTel] as CrmResumoLead[]);
  const negocios = (negociosRaw ?? []) as CrmResumoNegocio[];

  const negocioIds = negocios.map((n) => n.id);
  const timeline_events = await buildTimelineForLeads(supabase, leads, negocioIds, [
    { entidade: "pessoa", entidade_id: pessoaId },
  ]);

  return { leads, negocios, timeline_events };
}

export async function buildCrmResumoForEmpresa(
  supabase: SupabaseClient,
  empresaId: string
): Promise<ClienteCrmResumo> {
  const [{ data: negociosRaw }, { data: vinculos }] = await Promise.all([
    supabase
      .from("hub_negocios")
      .select(NEGOCIO_SELECT)
      .eq("empresa_id", empresaId)
      .order("criado_em", { ascending: false })
      .limit(30),
    supabase
      .from("hub_pessoas_empresas")
      .select("pessoa_id")
      .eq("empresa_id", empresaId)
      .limit(50),
  ]);

  const negocios = (negociosRaw ?? []) as CrmResumoNegocio[];
  const pessoaIds = (vinculos ?? []).map((v) => String(v.pessoa_id)).filter(Boolean);

  const leadChunks: CrmResumoLead[][] = [];

  if (pessoaIds.length > 0) {
    const { data } = await supabase
      .from("hub_leads_crm")
      .select(LEAD_SELECT)
      .in("pessoa_id", pessoaIds)
      .order("criado_em", { ascending: false })
      .limit(20);
    leadChunks.push((data ?? []) as CrmResumoLead[]);
  }

  const leadIdsFromNegocios = negocios
    .map((n) => n.lead_id)
    .filter((id): id is string => Boolean(id));

  if (leadIdsFromNegocios.length > 0) {
    const { data } = await supabase
      .from("hub_leads_crm")
      .select(LEAD_SELECT)
      .in("id", leadIdsFromNegocios);
    leadChunks.push((data ?? []) as CrmResumoLead[]);
  }

  const leads = dedupeLeads(leadChunks.flat());

  const negocioIds = negocios.map((n) => n.id);
  const timeline_events = await buildTimelineForLeads(supabase, leads, negocioIds, [
    { entidade: "empresa", entidade_id: empresaId },
  ]);

  return { leads, negocios, timeline_events };
}
