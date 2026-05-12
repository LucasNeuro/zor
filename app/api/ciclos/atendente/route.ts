import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cronRequestAuthorized } from "@/lib/cron-auth";
import { parseFollowupFromCicloConfiguracoes } from "@/lib/hub-ciclos-configuracoes";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function gerarAlerta(tipo: string, agente: string, titulo: string, mensagem: string, dados: Record<string, unknown> = {}, leadId?: string) {
  await supabase.from("hub_alertas").insert({
    tipo, agente_slug: agente, titulo, mensagem, dados,
    lead_id: leadId || null,
  });

  if (tipo === "critico") {
    const { data: contatos } = await supabase
      .from("hub_contatos_notificacao")
      .select("*")
      .eq("ativo", true)
      .eq("notificar_critico", true);

    if (contatos && process.env.EVOLUTION_API_URL) {
      for (const c of contatos) {
        if (c.tipo === "whatsapp") {
          try {
            await fetch(`${process.env.EVOLUTION_API_URL}/message/sendText/obra10plus`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "apikey": process.env.EVOLUTION_API_KEY! },
              body: JSON.stringify({ number: c.valor, text: `🔴 *CRÍTICO — Obra10+*\n\n${titulo}\n\n${mensagem}` }),
            });
          } catch (e) { console.error("Erro notificação:", e); }
        }
      }
    }
  }
}

async function cicloFollowup(runtime: ReturnType<typeof parseFollowupFromCicloConfiguracoes>) {
  const agora = new Date();
  const acoes: string[] = [];

  const { data: leads } = await supabase
    .from("hub_leads_crm")
    .select("id, nome, telefone, estagio, followup_passo, followup_pausado, ultimo_followup, atualizado_em, metadata")
    .not("estagio", "in", '("ganho","perdido","arquivado")')
    .eq("followup_pausado", false)
    .is("humano_responsavel", null);

  if (!leads || leads.length === 0) return { acoes, total: 0 };

  for (const lead of leads) {
    const mercado = (lead.metadata as Record<string, unknown>)?.mercado as string || "geral";
    const passo = (lead.followup_passo || 0) + 1;

    const { data: config } = await supabase
      .from("hub_followup_config")
      .select("*")
      .or(`mercado.eq.${mercado},mercado.eq.geral`)
      .eq("passo", passo)
      .eq("ativo", true)
      .order("mercado", { ascending: false })
      .limit(1)
      .single();

    if (!config) continue;

    const ultimoContato = lead.ultimo_followup
      ? new Date(lead.ultimo_followup)
      : new Date(lead.atualizado_em);
    const horasPassadas = (agora.getTime() - ultimoContato.getTime()) / 3600000;

    let horasNecessarias = config.horas_espera;
    if (runtime.horasPorPasso?.length) {
      const idx = Math.min(passo - 1, runtime.horasPorPasso.length - 1);
      const ov = runtime.horasPorPasso[idx];
      if (typeof ov === "number" && ov > 0) {
        horasNecessarias = ov;
      }
    }

    if (horasPassadas < horasNecessarias) continue;

    if (passo > 3 && horasPassadas > runtime.arquivarAposHoras) {
      await supabase
        .from("hub_leads_crm")
        .update({ estagio: "arquivado", followup_pausado: true })
        .eq("id", lead.id);
      acoes.push(`Lead ${lead.nome} arquivado após ${Math.round(runtime.arquivarAposHoras / 24)}d sem resposta`);
      continue;
    }

    const nome = lead.nome.split(" ")[0];
    const mensagem = config.mensagem_template
      .replace("{nome}", nome)
      .replace("{mercado}", mercado);

    await supabase.from("hub_fila_mensagens").insert({
      lead_id: lead.id,
      agente_id: "atendente",
      canal: "whatsapp",
      direcao: "saida",
      conteudo: mensagem,
      status: "pendente_envio",
      metadata: { tipo: "followup", passo, mercado },
    });

    if (lead.telefone && process.env.EVOLUTION_API_URL) {
      try {
        await fetch(`${process.env.EVOLUTION_API_URL}/message/sendText/obra10plus`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": process.env.EVOLUTION_API_KEY! },
          body: JSON.stringify({ number: lead.telefone, text: mensagem }),
        });
      } catch (e) { console.error("Erro envio follow-up:", e); }
    }

    await supabase
      .from("hub_leads_crm")
      .update({
        followup_passo: passo,
        ultimo_followup: agora.toISOString(),
        proximo_followup: new Date(agora.getTime() + horasNecessarias * 3600000 * 2).toISOString(),
      })
      .eq("id", lead.id);

    acoes.push(`Follow-up passo ${passo} enviado para ${lead.nome}`);
  }

  return { acoes, total: acoes.length };
}

async function cicloSLA() {
  const alertas: string[] = [];
  const limite15min = new Date(Date.now() - 15 * 60000).toISOString();

  const { data: msgs15 } = await supabase
    .from("hub_fila_mensagens")
    .select("*, lead:hub_leads_crm(nome, telefone)")
    .eq("direcao", "entrada")
    .eq("status", "pendente")
    .lt("criado_em", limite15min);

  for (const msg of msgs15 || []) {
    const lead = msg.lead as Record<string, unknown>;
    const mins = Math.round((Date.now() - new Date(msg.criado_em).getTime()) / 60000);

    const { data: alertaExiste } = await supabase
      .from("hub_alertas")
      .select("id")
      .eq("lead_id", msg.lead_id)
      .eq("tipo", "critico")
      .eq("resolvido", false)
      .gte("criado_em", new Date(Date.now() - 30 * 60000).toISOString())
      .single();

    if (alertaExiste) continue;

    await gerarAlerta(
      mins > 30 ? "critico" : "importante",
      "gerente_atendimento",
      `Lead sem resposta há ${mins} minutos`,
      `${lead?.nome || "Lead"} enviou mensagem e aguarda resposta há ${mins} min.\n"${(msg.conteudo as string)?.slice(0, 80)}"`,
      { lead_id: msg.lead_id, minutos: mins },
      msg.lead_id
    );

    alertas.push(`Alerta SLA: ${lead?.nome} — ${mins}min`);
  }

  return { alertas, total: alertas.length };
}

/** Resolve linha em hub_ciclos_ia (nomes variam no seed — evita .single() falhar e total_execucoes ficar sempre 0). */
async function resolveAtendenteCicloId(ciclo: string): Promise<string | undefined> {
  const mode = ciclo === "sla" ? "sla" : "followup";
  const patterns =
    mode === "followup"
      ? ["%Follow-up%", "%Follow up%", "%followup%", "%follow-up%", "%Followup%"]
      : ["%SLA%", "%Monitor SLA%", "%monitor%", "%sla%", "%SLA %"];

  for (const pat of patterns) {
    const { data } = await supabase
      .from("hub_ciclos_ia")
      .select("id")
      .eq("agente_slug", "atendente")
      .eq("tipo", "programado")
      .ilike("nome", pat)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  const { data: rows } = await supabase
    .from("hub_ciclos_ia")
    .select("id, nome")
    .eq("agente_slug", "atendente")
    .eq("tipo", "programado");

  if (!rows?.length) return undefined;

  if (mode === "followup") {
    const row = rows.find((r) => /follow|followup|follow-up/i.test(String(r.nome ?? "")));
    return row?.id as string | undefined;
  }
  const row = rows.find((r) => /sla|monitor|tempo|resposta/i.test(String(r.nome ?? "")));
  return row?.id as string | undefined;
}

export async function GET(request: NextRequest) {
  const ciclo = request.nextUrl.searchParams.get("ciclo") || "followup";

  if (!cronRequestAuthorized(request)) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  const inicio = Date.now();

  const cicloId = await resolveAtendenteCicloId(ciclo);
  const cicloConfig = cicloId ? { id: cicloId } : null;

  let followupRuntime = parseFollowupFromCicloConfiguracoes(undefined);
  if (ciclo === "followup" && cicloId) {
    const { data: cicloRow } = await supabase
      .from("hub_ciclos_ia")
      .select("configuracoes")
      .eq("id", cicloId)
      .maybeSingle();
    followupRuntime = parseFollowupFromCicloConfiguracoes(cicloRow?.configuracoes);
  }

  const logRes = await supabase.from("hub_ciclos_log").insert({
    ciclo_id: cicloConfig?.id ?? null,
    agente_slug: "atendente",
    status: "rodando",
  }).select("id").single();

  try {
    let resultado;
    if (ciclo === "followup") resultado = await cicloFollowup(followupRuntime);
    else if (ciclo === "sla") resultado = await cicloSLA();
    else resultado = { acoes: [], total: 0 };

    const status = resultado.total > 0 ? "sucesso" : "sem_acao";

    if (logRes.data) {
      const res = resultado as Record<string, unknown>;
      await supabase.from("hub_ciclos_log").update({
        status,
        finalizado_em: new Date().toISOString(),
        acoes_tomadas: res.acoes || [],
        alertas_gerados: res.alertas || [],
      }).eq("id", logRes.data.id);
    }

    if (cicloConfig?.id) {
      const { data: rowAt } = await supabase
        .from("hub_ciclos_ia")
        .select("total_execucoes")
        .eq("id", cicloConfig.id)
        .maybeSingle();
      await supabase
        .from("hub_ciclos_ia")
        .update({
          ultimo_ciclo: new Date().toISOString(),
          ultimo_status: status,
          total_execucoes: (rowAt?.total_execucoes ?? 0) + 1,
        })
        .eq("id", cicloConfig.id);
    }

    return NextResponse.json({ ok: true, ciclo, duracao_ms: Date.now() - inicio, ...resultado });
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message : "Erro desconhecido";
    if (logRes.data) await supabase.from("hub_ciclos_log").update({ status: "erro", erro: msg, finalizado_em: new Date().toISOString() }).eq("id", logRes.data.id);
    return NextResponse.json({ ok: false, erro: msg }, { status: 500 });
  }
}

export const POST = GET;
