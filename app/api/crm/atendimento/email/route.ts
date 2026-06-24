import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  leadTemConversaAtiva,
  loadLeadsCrmEnriquecidos,
} from "@/lib/crm/load-leads-crm-enriquecidos";
import { leadEhCanalEmail } from "@/lib/crm/lead-canal";
import { defaultTenantId, tenantIdFromRequest, tenantScopeOrFilter } from "@/lib/tenant-default";
import {
  EMAIL_CHANNEL_DISABLED_CODE,
  EMAIL_CHANNEL_DISABLED_MESSAGE,
  isEmailChannelEnabled,
} from "@/lib/feature-flags";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type EmailPreview = {
  ultima_mensagem_email: string | null;
  ultima_mensagem_email_em: string | null;
  ultimo_assunto_email: string | null;
  tem_resposta_humana: boolean;
};

async function carregarPreviewsEmail(
  supabase: ReturnType<typeof db>,
  leadIds: string[]
): Promise<Map<string, EmailPreview>> {
  const map = new Map<string, EmailPreview>();
  if (!leadIds.length) return map;

  const { data: conversas } = await supabase
    .from("hub_conversas")
    .select("id, lead_id")
    .in("lead_id", leadIds)
    .eq("canal", "email");

  const convIds = (conversas ?? []).map((c) => c.id).filter(Boolean) as string[];
  const convPorLead = new Map<string, string[]>();
  for (const c of conversas ?? []) {
    const lid = c.lead_id != null ? String(c.lead_id) : "";
    const cid = c.id != null ? String(c.id) : "";
    if (!lid || !cid) continue;
    const list = convPorLead.get(lid) ?? [];
    list.push(cid);
    convPorLead.set(lid, list);
  }

  if (!convIds.length) return map;

  const { data: mensagens } = await supabase
    .from("hub_mensagens")
    .select("conversa_id, conteudo, remetente, enviada_em, email_subject")
    .in("conversa_id", convIds)
    .order("enviada_em", { ascending: false, nullsFirst: false })
    .limit(500);

  const convToLead = new Map<string, string>();
  for (const [leadId, ids] of convPorLead) {
    for (const id of ids) convToLead.set(id, leadId);
  }

  const humanoPorLead = new Set<string>();
  const ultimaPorLead = new Map<string, { conteudo: string; em: string; subject: string | null }>();

  for (const row of mensagens ?? []) {
    const convId = row.conversa_id != null ? String(row.conversa_id) : "";
    const leadId = convToLead.get(convId);
    if (!leadId) continue;

    const remetente = String(row.remetente ?? "");
    if (remetente === "humano") humanoPorLead.add(leadId);

    if (!ultimaPorLead.has(leadId)) {
      ultimaPorLead.set(leadId, {
        conteudo: String(row.conteudo ?? "").trim(),
        em: String(row.enviada_em ?? ""),
        subject:
          typeof row.email_subject === "string" && row.email_subject.trim()
            ? row.email_subject.trim()
            : null,
      });
    }
  }

  for (const leadId of leadIds) {
    const ultima = ultimaPorLead.get(leadId);
    map.set(leadId, {
      ultima_mensagem_email: ultima?.conteudo ?? null,
      ultima_mensagem_email_em: ultima?.em ?? null,
      ultimo_assunto_email: ultima?.subject ?? null,
      tem_resposta_humana: humanoPorLead.has(leadId),
    });
  }

  return map;
}

export async function GET(request: NextRequest) {
  try {
    if (!isEmailChannelEnabled()) {
      return NextResponse.json(
        { error: EMAIL_CHANNEL_DISABLED_MESSAGE, code: EMAIL_CHANNEL_DISABLED_CODE, leads: [] },
        { status: 503 }
      );
    }

    const supabase = db();
    const { searchParams } = new URL(request.url);
    const estagioAtendimento = searchParams.get("estagio_atendimento");
    const apenasHumanos = searchParams.get("apenas_humanos") === "1";
    const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
    const tenantFilter = tenantScopeOrFilter(tenantId);

    const { data: convRows } = await supabase
      .from("hub_conversas")
      .select("lead_id")
      .eq("canal", "email")
      .not("lead_id", "is", null);

    const leadIdsComEmail = new Set<string>(
      (convRows ?? [])
        .map((r) => (r.lead_id != null ? String(r.lead_id) : ""))
        .filter(Boolean)
    );

    const { rows, error } = await loadLeadsCrmEnriquecidos(supabase, tenantFilter, {
      skipView: true,
    });
    if (error) {
      return NextResponse.json({ error, leads: [] }, { status: 500 });
    }

    let filtered = rows.filter((row) => {
      const id = row.id != null ? String(row.id) : "";
      const ehEmail =
        leadEhCanalEmail({
          origem: row.origem != null ? String(row.origem) : null,
          email: row.email != null ? String(row.email) : null,
          telefone: row.telefone != null ? String(row.telefone) : null,
          metadata: row.metadata,
        }) || (id && leadIdsComEmail.has(id));
      if (!ehEmail) return false;
      return leadTemConversaAtiva(row, leadIdsComEmail);
    });

    if (estagioAtendimento && estagioAtendimento !== "todos") {
      filtered = filtered.filter((row) => {
        const est =
          row.estagio_atendimento != null ? String(row.estagio_atendimento) : "novo";
        return est === estagioAtendimento;
      });
    }

    const ids = filtered.map((r) => String(r.id)).filter(Boolean);
    const previews = await carregarPreviewsEmail(supabase, ids);

    let leads = filtered.map((row) => {
      const id = String(row.id);
      const preview = previews.get(id);
      const r = row;
      return {
        ...r,
        estagio: r.estagio != null ? String(r.estagio) : "novo",
        estagio_atendimento:
          r.estagio_atendimento != null ? String(r.estagio_atendimento) : "novo",
        _pessoa_codigo:
          r._pessoa_codigo != null
            ? String(r._pessoa_codigo)
            : r.pessoa_codigo != null
              ? String(r.pessoa_codigo)
              : null,
        ultima_mensagem_email: preview?.ultima_mensagem_email ?? null,
        ultima_mensagem_email_em: preview?.ultima_mensagem_email_em ?? null,
        ultimo_assunto_email: preview?.ultimo_assunto_email ?? null,
        tem_resposta_humana: preview?.tem_resposta_humana ?? false,
      };
    });

    if (apenasHumanos) {
      leads = leads.filter((l) => l.tem_resposta_humana);
    }

    return NextResponse.json({ leads, canal: "email" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg, leads: [] }, { status: 500 });
  }
}
