import { supabase } from "@/lib/supabase/client";

/** Lead enriquecido para kanban / lista CRM (espelha `app/crm/leads/page.tsx`). */
export type CrmLeadRow = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  origem: string | null;
  campanha: string | null;
  estagio: string;
  estagio_funil?: string | null;
  estagio_atendimento?: string | null;
  score: number;
  valor_estimado: number;
  agente_responsavel: string | null;
  humano_responsavel: string | null;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  motivo_perda: string | null;
  tags: string[];
  criado_em: string;
  atualizado_em: string;
  pessoa_id?: string | null;
  codigo?: string | null;
  metadata?: unknown;
  pipeline_id?: string | null;
  _pessoa_codigo?: string | null;
  _email_exibicao?: string | null;
  ultima_mensagem_fila?: string | null;
  ultima_mensagem_fila_em?: string | null;
  ultima_mensagem_email?: string | null;
  ultima_mensagem_email_em?: string | null;
  ultimo_assunto_email?: string | null;
  tem_resposta_humana?: boolean;
  pessoa_cidade?: string | null;
  pessoa_estado?: string | null;
};

/** Carrega todos os leads do tenant (view enriquecida + pipeline_id). */
export async function fetchCrmLeadsList(): Promise<CrmLeadRow[]> {
  const vw = await supabase
    .from("vw_hub_leads_crm_enriquecido")
    .select("*")
    .order("criado_em", { ascending: false });

  if (!vw.error && vw.data) {
    const rawRows = vw.data as Record<string, unknown>[];
    const ids = rawRows
      .map((r) => (r.id != null ? String(r.id) : null))
      .filter(Boolean) as string[];
    const pipelineMap = new Map<string, string | null>();

    if (ids.length) {
      const { data: baseRows } = await supabase
        .from("hub_leads_crm")
        .select("id, pipeline_id")
        .in("id", ids);
      for (const row of baseRows || []) {
        pipelineMap.set(String(row.id), row.pipeline_id != null ? String(row.pipeline_id) : null);
      }
    }

    return rawRows.map((r) => {
      const {
        pessoa_codigo,
        pessoa_nome_completo: _pn,
        email_exibicao,
        ...base
      } = r;
      const leadId = r.id != null ? String(r.id) : null;
      const emailDisp =
        email_exibicao != null && String(email_exibicao).trim()
          ? String(email_exibicao).trim()
          : null;
      return {
        ...(base as Omit<CrmLeadRow, "_pessoa_codigo" | "_email_exibicao">),
        _pessoa_codigo: pessoa_codigo != null ? String(pessoa_codigo) : null,
        _email_exibicao: emailDisp,
        pipeline_id:
          r.pipeline_id != null
            ? String(r.pipeline_id)
            : leadId
              ? (pipelineMap.get(leadId) ?? null)
              : null,
        ultima_mensagem_fila:
          r.ultima_mensagem_fila != null ? String(r.ultima_mensagem_fila) : null,
        ultima_mensagem_fila_em:
          r.ultima_mensagem_fila_em != null ? String(r.ultima_mensagem_fila_em) : null,
        pessoa_cidade: r.pessoa_cidade != null ? String(r.pessoa_cidade) : null,
        pessoa_estado: r.pessoa_estado != null ? String(r.pessoa_estado) : null,
        metadata: r.metadata,
      };
    });
  }

  const { data } = await supabase.from("hub_leads_crm").select("*").order("criado_em", { ascending: false });
  const raw = (data || []) as CrmLeadRow[];
  const pids = [...new Set(raw.map((r) => r.pessoa_id).filter(Boolean))] as string[];
  const map = new Map<string, { codigo: string | null; email: string | null }>();
  if (pids.length) {
    const { data: pes } = await supabase.from("hub_pessoas").select("id, codigo, email").in("id", pids);
    for (const p of pes || []) {
      map.set(String(p.id), {
        codigo: p.codigo != null ? String(p.codigo) : null,
        email: p.email != null ? String(p.email) : null,
      });
    }
  }
  return raw.map((r) => {
    const pe = r.pessoa_id ? map.get(r.pessoa_id) : undefined;
    const emailLead = (r.email && String(r.email).trim()) || "";
    const emailP = (pe?.email && String(pe.email).trim()) || "";
    return {
      ...r,
      _pessoa_codigo: pe?.codigo ?? null,
      _email_exibicao: emailLead || emailP || null,
    };
  });
}
