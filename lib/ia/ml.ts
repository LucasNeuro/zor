// ============================================================
// ML — Machine Learning do Organismo
// REGRA ABSOLUTA: A IA NUNCA altera o sistema diretamente
// A IA só observa, analisa e sugere
// Toda alteração exige aprovação explícita do humano
// ============================================================
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { criarAprovacao } from "./aprovacoes";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function anthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

// ── CICLO PRINCIPAL DE ML ─────────────────────────────────────
// A IA APENAS OBSERVA E SUGERE — nunca altera nada
export async function rodarCicloML(): Promise<{
  observacoes: number;
  sugestoes: number;
  historicosAvaliados: number;
}> {
  const db = supabase();
  console.log("[ML] Iniciando ciclo de observação...");

  const { data: agentes } = await db
    .from("hub_agente_identidade")
    .select("agente_slug, nome, nivel")
    .eq("ativo", true);

  if (!agentes) return { observacoes: 0, sugestoes: 0, historicosAvaliados: 0 };

  let totalObservacoes = 0;
  let totalSugestoes = 0;

  for (const agente of agentes) {
    const slug = agente.agente_slug as string;
    const dados = await coletarDadosAgente(slug);
    if (!dados.amostras || (dados.amostras as number) < 10) continue;

    // Claude analisa e identifica padrões — SÓ OBSERVA
    const observacoes = await analisarComClaude(slug, agente.nome as string, dados);
    totalObservacoes += observacoes.length;

    for (const obs of observacoes) {
      if (obs.confianca < 0.6) continue;

      // Salva observação — apenas registro, nenhuma ação
      const { data: obsData } = await db
        .from("hub_ml_observacoes")
        .insert({
          agente_slug: slug,
          tipo: obs.tipo,
          descricao: obs.descricao,
          dados_observados: obs.dadosObservados,
          amostras: obs.amostras,
          periodo_inicio: obs.periodoInicio,
          periodo_fim: obs.periodoFim,
          confianca: obs.confianca,
        })
        .select("id")
        .single();

      if (!obsData) continue;

      // Claude gera sugestão — apenas proposta, sem execução
      const sugestao = await gerarSugestaoComClaude(slug, obs, dados);
      if (!sugestao) continue;

      const { data: hierarquia } = await db
        .from("hub_hierarquia")
        .select("supervisor_slug")
        .eq("agente_slug", slug)
        .single();

      const supervisorSlug = hierarquia?.supervisor_slug || "ceo";

      // Salva sugestão com status PENDENTE — aguarda humano
      const { data: sugestaoData } = await db
        .from("hub_ml_sugestoes")
        .insert({
          observacao_id: obsData.id,
          agente_slug: slug,
          supervisor_slug: supervisorSlug,
          tipo_mudanca: sugestao.tipomudanca,
          titulo: sugestao.titulo,
          o_que_observou: sugestao.oQueObservou,
          o_que_sugere: sugestao.oQueSugere,
          por_que: sugestao.porQue,
          impacto_estimado: sugestao.impactoEstimado,
          dados_antes: sugestao.dadosAntes,
          dados_depois: sugestao.dadosDepois,
          confianca: sugestao.confianca,
          amostras: sugestao.amostras,
          status: "pendente", // SEMPRE pendente — humano decide
        })
        .select("id")
        .single();

      // Cria card completo para aprovação humana
      // Card mostra EXATAMENTE o que será alterado se aprovado
      await criarAprovacao({
        tipo: "ajuste_agente",
        agenteSlug: supervisorSlug,
        descricao: sugestao.titulo as string,
        motivo: sugestao.oQueObservou as string,
        impacto: sugestao.impactoEstimado as string,
        recomendacao: sugestao.oQueSugere as string,
        confiancaIA: Math.round((sugestao.confianca as number) * 100),
        dados: {
          sugestao_id: sugestaoData?.id,
          agente_slug: slug,
          tipo_mudanca: sugestao.tipomudanca,
          mudanca_exata: {
            campo: sugestao.campoDireto,
            valor_atual: sugestao.dadosAntes,
            valor_proposto: sugestao.dadosDepois,
            tabela: sugestao.tabelaAfetada,
          },
          aviso: "Esta alteração SÓ será aplicada após sua confirmação explícita",
        },
      });

      totalSugestoes++;
    }
  }

  // Avalia históricos — Claude analisa resultado, mas não altera nada
  const historicosAvaliados = await avaliarHistoricos();

  console.log(`[ML] Ciclo concluído: ${totalObservacoes} observações, ${totalSugestoes} sugestões pendentes de aprovação humana`);
  return { observacoes: totalObservacoes, sugestoes: totalSugestoes, historicosAvaliados };
}

// ── APLICAR MUDANÇA — SÓ APÓS DUPLA CONFIRMAÇÃO HUMANA ───────
// Esta função SÓ é chamada quando o humano confirma explicitamente
// Não é chamada automaticamente em nenhuma circunstância
export async function aplicarMudancaConfirmada(
  sugestaoId: string,
  confirmacaoHumana: string
): Promise<{
  sucesso: boolean;
  preview?: Record<string, unknown>;
  erro?: string;
  aguardandoConfirmacao?: boolean;
}> {
  const db = supabase();

  const { data: sugestao } = await db
    .from("hub_ml_sugestoes")
    .select("*")
    .eq("id", sugestaoId)
    .single();

  if (!sugestao) return { sucesso: false, erro: "Sugestão não encontrada" };

  const s = sugestao as Record<string, unknown>;

  // PRIMEIRA APROVAÇÃO — mostra preview detalhado do que vai mudar
  if (confirmacaoHumana === "primeira_aprovacao") {
    const preview = await gerarPreviewMudanca(s);

    await db
      .from("hub_ml_sugestoes")
      .update({ status: "aprovado_aguardando_confirmacao" })
      .eq("id", sugestaoId);

    return {
      sucesso: true,
      aguardandoConfirmacao: true,
      preview: {
        ...preview,
        aviso: "CONFIRME: Esta ação irá alterar o sistema. Não pode ser desfeita automaticamente.",
        o_que_muda: preview.descricaoDetalhada,
        impacto_tecnico: preview.impactoTecnico,
        requer_segunda_confirmacao: true,
      },
    };
  }

  // SEGUNDA CONFIRMAÇÃO — aplica de fato
  if (confirmacaoHumana === "confirmacao_final") {
    if (s.status !== "aprovado_aguardando_confirmacao") {
      return { sucesso: false, erro: "Aprovação não está no estado correto para confirmação" };
    }

    try {
      await executarMudancaNoSistema(s);

      await db.from("hub_ml_historico").insert({
        sugestao_id: sugestaoId,
        agente_slug: s.agente_slug,
        tipo_mudanca: s.tipo_mudanca,
        dados_aplicados: s.dados_depois,
        monitorar_ate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        resultado_kpi_antes: s.dados_antes,
      });

      await db.from("hub_acoes_ia").insert({
        agente_slug: "humano",
        tipo: "sugestao_criada",
        descricao: `Mudança aprovada e aplicada por humano: ${s.titulo}`,
        sucesso: true,
        metadata: {
          sugestao_id: sugestaoId,
          tipo: s.tipo_mudanca,
          aprovado_por: "wendel",
          aplicado_em: new Date().toISOString(),
        },
      });

      await db
        .from("hub_ml_sugestoes")
        .update({
          status: "aplicado",
          aprovado_por: "wendel",
          aprovado_em: new Date().toISOString(),
        })
        .eq("id", sugestaoId);

      return { sucesso: true };
    } catch (erro) {
      const errMsg = erro instanceof Error ? erro.message : "Erro ao aplicar mudança";
      return { sucesso: false, erro: errMsg };
    }
  }

  return { sucesso: false, erro: "Tipo de confirmação inválido" };
}

// ── GERAR PREVIEW DETALHADO ───────────────────────────────────
async function gerarPreviewMudanca(sugestao: Record<string, unknown>): Promise<Record<string, unknown>> {
  const tipo = sugestao.tipo_mudanca as string;
  const dadosDepois = sugestao.dados_depois as Record<string, unknown>;
  const dadosAntes = sugestao.dados_antes as Record<string, unknown>;

  const previews: Record<string, Record<string, unknown>> = {
    script: {
      descricaoDetalhada: `Vai reordenar scripts do agente ${sugestao.agente_slug}`,
      impactoTecnico: `Altera coluna 'ordem' na tabela hub_scripts`,
      campos_alterados: ["ordem"],
      tabela: "hub_scripts",
      reversivel: true,
      como_reverter: "Basta reordenar os scripts novamente",
    },
    horario: {
      descricaoDetalhada: `Vai alterar horário de ${dadosAntes.horario_atual} para ${dadosDepois.horario_novo}`,
      impactoTecnico: `Altera colunas 'horario_inicio' e 'horario_fim' na tabela hub_agente_configuracao`,
      campos_alterados: ["horario_inicio", "horario_fim"],
      tabela: "hub_agente_configuracao",
      reversivel: true,
      como_reverter: "Basta alterar os horários de volta",
    },
    modelo: {
      descricaoDetalhada: `Vai trocar modelo de ${dadosAntes.modelo_atual} para ${dadosDepois.modelo_novo}`,
      impactoTecnico: `Altera coluna 'modelo_padrao' na tabela hub_agente_identidade`,
      campos_alterados: ["modelo_padrao"],
      tabela: "hub_agente_identidade",
      reversivel: true,
      alerta_custo: dadosDepois.modelo_novo === "claude-opus-4-5" ? "Opus custa 60x mais que Haiku" : null,
    },
    tom: {
      descricaoDetalhada: `Vai alterar tom de comunicação para '${dadosDepois.tom_novo}'`,
      impactoTecnico: `Altera coluna 'tom' na tabela hub_agente_configuracao`,
      campos_alterados: ["tom"],
      tabela: "hub_agente_configuracao",
      reversivel: true,
    },
    personalidade: {
      descricaoDetalhada: `Vai alterar humor ${dadosAntes.humor} → ${dadosDepois.humor_novo} e personalidade ${dadosAntes.personalidade} → ${dadosDepois.personalidade_nova}`,
      impactoTecnico: `Altera colunas 'humor' e 'personalidade' na tabela hub_personalidade`,
      campos_alterados: ["humor", "personalidade"],
      tabela: "hub_personalidade",
      reversivel: true,
    },
    contexto: {
      descricaoDetalhada: "Vai atualizar o prompt base do agente com novas informações",
      impactoTecnico: `Altera coluna 'system_prompt_base' na tabela hub_agente_identidade`,
      campos_alterados: ["system_prompt_base"],
      tabela: "hub_agente_identidade",
      reversivel: true,
      nota: "O prompt anterior será salvo no histórico antes de substituir",
    },
    escalada: {
      descricaoDetalhada: "Vai ajustar os critérios que determinam quando o agente escala para humano",
      impactoTecnico: `Altera coluna 'criterios_escalonamento' na tabela hub_hierarquia`,
      campos_alterados: ["criterios_escalonamento"],
      tabela: "hub_hierarquia",
      reversivel: true,
    },
  };

  return previews[tipo] || {
    descricaoDetalhada: "Mudança configurada — revise os dados antes de confirmar",
    impactoTecnico: "Verifique os campos que serão alterados",
    reversivel: false,
  };
}

// ── EXECUTAR MUDANÇA NO SISTEMA ───────────────────────────────
// Chamada APENAS após dupla confirmação humana
async function executarMudancaNoSistema(sugestao: Record<string, unknown>): Promise<void> {
  const db = supabase();
  const slug = sugestao.agente_slug as string;
  const dados = sugestao.dados_depois as Record<string, unknown>;
  const tipo = sugestao.tipo_mudanca as string;

  await salvarEstadoAnterior(slug, tipo, sugestao.dados_antes as Record<string, unknown>);

  switch (tipo) {
    case "script":
      if (dados.promover_script_id) await db.from("hub_scripts").update({ ordem: 1 }).eq("id", dados.promover_script_id);
      if (dados.rebaixar_script_id) await db.from("hub_scripts").update({ ordem: 99 }).eq("id", dados.rebaixar_script_id);
      break;
    case "horario":
      await db.from("hub_agente_configuracao").update({ horario_inicio: dados.horario_inicio, horario_fim: dados.horario_fim }).eq("agente_slug", slug);
      break;
    case "modelo":
      await db.from("hub_agente_identidade").update({ modelo_padrao: dados.modelo_novo }).eq("agente_slug", slug);
      break;
    case "tom":
      await db.from("hub_agente_configuracao").update({ tom: dados.tom_novo }).eq("agente_slug", slug);
      break;
    case "personalidade":
      await db.from("hub_personalidade").update({ humor: dados.humor_novo, personalidade: dados.personalidade_nova }).eq("agente_slug", slug);
      break;
    case "contexto":
      await db.from("hub_agente_identidade").update({ system_prompt_base: dados.system_prompt_novo }).eq("agente_slug", slug);
      break;
    case "escalada":
      await db.from("hub_hierarquia").update({ criterios_escalonamento: dados.criterios_novos }).eq("agente_slug", slug);
      break;
    default:
      throw new Error(`Tipo de mudança '${tipo}' não suportado para execução automática`);
  }
}

// ── SALVAR ESTADO ANTERIOR ────────────────────────────────────
async function salvarEstadoAnterior(slug: string, tipo: string, dadosAntes: Record<string, unknown>): Promise<void> {
  const db = supabase();
  await db.from("hub_ml_historico").insert({
    agente_slug: slug,
    tipo_mudanca: `backup_antes_${tipo}`,
    dados_aplicados: dadosAntes,
    resultado_kpi_antes: dadosAntes,
    monitorar_ate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
}

// ── AVALIAR HISTÓRICOS ────────────────────────────────────────
// Claude avalia resultados — apenas analisa, não altera nada
async function avaliarHistoricos(): Promise<number> {
  const db = supabase();
  const client = anthropic();

  const { data: historicos } = await db
    .from("hub_ml_historico")
    .select("*")
    .lte("monitorar_ate", new Date().toISOString())
    .is("encerrado_em", null)
    .not("tipo_mudanca", "like", "backup_%");

  if (!historicos || historicos.length === 0) return 0;

  for (const historico of historicos) {
    const h = historico as Record<string, unknown>;
    const dadosDepois = await coletarDadosAgente(h.agente_slug as string);

    const prompt = `Avalie se esta mudança aplicada no sistema funcionou.

TIPO DE MUDANÇA: ${h.tipo_mudanca}
DADOS ANTES: ${JSON.stringify(h.resultado_kpi_antes)}
DADOS APÓS 7 DIAS: ${JSON.stringify(dadosDepois)}

Retorne JSON:
{
  "funcionou": true/false,
  "impacto_real": "descrição objetiva do que mudou nos dados",
  "aprendizado": "o que o sistema deve aprender para sugestões futuras",
  "recomendacao": "manter a mudança, reverter ou ajustar?"
}

IMPORTANTE: Apenas avalie. Não sugira novas alterações aqui.`;

    try {
      const resposta = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      });

      const texto = resposta.content[0].type === "text" ? resposta.content[0].text : "{}";
      const avaliacao = JSON.parse(texto.replace(/```json|```/g, "").trim());

      await db.from("hub_ml_historico").update({
        resultado_kpi_depois: dadosDepois,
        funcionou: avaliacao.funcionou,
        impacto_real: avaliacao.impacto_real,
        aprendizado: avaliacao.aprendizado,
        encerrado_em: new Date().toISOString(),
      }).eq("id", h.id);

      if (avaliacao.funcionou) {
        await db.from("hub_ml_padroes").insert({
          tipo: h.tipo_mudanca as string,
          agente_id: h.agente_slug,
          padrao: h.dados_aplicados,
          score: 0.8,
          amostras: 1,
          confianca: 0.7,
          ativo: true,
        });
      }

      // Se não funcionou, cria sugestão de reversão — ainda aguarda aprovação
      if (!avaliacao.funcionou && avaliacao.recomendacao?.includes("reverter")) {
        await criarAprovacao({
          tipo: "ajuste_agente",
          agenteSlug: "ceo",
          descricao: `Mudança não funcionou — recomendo reverter: ${h.tipo_mudanca}`,
          motivo: avaliacao.impacto_real,
          impacto: "Reversão para estado anterior pode recuperar performance",
          recomendacao: avaliacao.recomendacao,
          confiancaIA: 90,
          dados: {
            historico_id: h.id,
            agente_slug: h.agente_slug,
            tipo: h.tipo_mudanca,
            estado_anterior: h.resultado_kpi_antes,
            aviso: "Esta sugestão de reversão também requer sua aprovação explícita",
          },
        });
      }
    } catch (erro) {
      console.error("[ML] Erro ao avaliar histórico:", erro);
    }
  }

  return historicos.length;
}

// ── MEDIR KPIs ────────────────────────────────────────────────
// Apenas lê dados e registra — não altera nada
export async function medirKPIs(agenteSlug: string): Promise<void> {
  const db = supabase();

  const { data: metas } = await db
    .from("hub_kpis_metas")
    .select("*")
    .eq("agente_slug", agenteSlug)
    .eq("ativo", true);

  if (!metas) return;

  for (const meta of metas) {
    const m = meta as Record<string, unknown>;
    const valor = await calcularKPI(agenteSlug, m.kpi_slug as string);
    if (valor === null) continue;

    const nivelAlerta = determinarNivelAlerta(valor, m);

    await db.from("hub_kpis_resultados").insert({
      kpi_slug: m.kpi_slug,
      agente_slug: agenteSlug,
      valor,
      periodo_inicio: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      periodo_fim: new Date().toISOString(),
      dentro_da_meta: nivelAlerta === "ok",
      nivel_alerta: nivelAlerta,
    });

    if (nivelAlerta !== "ok" && m.alertar_slug) {
      await criarAprovacao({
        tipo: "ajuste_agente",
        agenteSlug: m.alertar_slug as string,
        descricao: `KPI "${m.kpi_slug}" fora da meta — agente ${agenteSlug}`,
        motivo: `Valor atual: ${valor} | Meta: ${m.valor_meta} | Nível: ${nivelAlerta}`,
        impacto: nivelAlerta === "critico" ? "Requer ação imediata" : "Monitorar",
        dados: {
          kpi: m.kpi_slug,
          valor,
          meta: m.valor_meta,
          nivel: nivelAlerta,
          agente: agenteSlug,
          aviso: "O sistema NÃO tomou nenhuma ação automática. Esta decisão é sua.",
        },
      });
    }
  }
}

// ── COBRAR SUBORDINADOS ───────────────────────────────────────
// Supervisores analisam e reportam — apenas sugerem, não agem
export async function cobrarSubordinados(supervisorSlug: string): Promise<void> {
  const db = supabase();
  const client = anthropic();

  const { data: responsabilidades } = await db
    .from("hub_responsabilidades")
    .select("*")
    .eq("supervisor_slug", supervisorSlug)
    .eq("ativo", true);

  if (!responsabilidades || responsabilidades.length === 0) return;

  const porSubordinado: Record<string, Record<string, unknown>[]> = {};
  responsabilidades.forEach((r: Record<string, unknown>) => {
    const sub = r.subordinado_slug as string;
    if (!porSubordinado[sub]) porSubordinado[sub] = [];
    porSubordinado[sub].push(r);
  });

  for (const [subordinadoSlug, kpis] of Object.entries(porSubordinado)) {
    const resultados = await Promise.all(
      kpis.map(async (r: Record<string, unknown>) => {
        const { data } = await db
          .from("hub_kpis_resultados")
          .select("*")
          .eq("agente_slug", subordinadoSlug)
          .eq("kpi_slug", r.kpi_slug)
          .order("criado_em", { ascending: false })
          .limit(1)
          .single();
        return { kpi: r, resultado: data };
      })
    );

    const foraDaMeta = resultados.filter(r => r.resultado?.nivel_alerta !== "ok");
    if (foraDaMeta.length === 0) continue;

    const prompt = `Você é o supervisor ${supervisorSlug} do Escritório Virtual Obra10+.
Analise a performance do subordinado ${subordinadoSlug}.

KPIs FORA DA META:
${JSON.stringify(foraDaMeta.map(f => ({
  kpi: f.kpi.kpi_slug,
  valor_atual: f.resultado?.valor,
  meta: f.kpi.valor_meta,
  nivel: f.resultado?.nivel_alerta,
  descricao: f.kpi.descricao,
})), null, 2)}

Gere relatório JSON:
{
  "titulo": "título do alerta",
  "resumo": "resumo em 2 linhas com dados específicos",
  "problemas": ["problemas identificados com dados"],
  "sugestoes_para_humano": ["sugestões de ação para o gestor avaliar"],
  "urgencia": "baixa|media|alta|critica"
}

IMPORTANTE: Você apenas reporta e sugere. Não tome nenhuma ação.
Retorne APENAS o JSON.`;

    try {
      const resposta = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      });

      const texto = resposta.content[0].type === "text" ? resposta.content[0].text : "{}";
      const relatorio = JSON.parse(texto.replace(/```json|```/g, "").trim());

      if (relatorio.urgencia === "critica" || relatorio.urgencia === "alta") {
        await criarAprovacao({
          tipo: "ajuste_agente",
          agenteSlug: supervisorSlug,
          descricao: relatorio.titulo,
          motivo: relatorio.resumo,
          impacto: `${foraDaMeta.length} KPIs fora da meta — urgência ${relatorio.urgencia}`,
          recomendacao: relatorio.sugestoes_para_humano.join(" | "),
          dados: {
            subordinado: subordinadoSlug,
            relatorio,
            kpis_fora: foraDaMeta,
            aviso: "O supervisor IA identificou problemas. Nenhuma ação foi tomada. Você decide.",
          },
        });
      }
    } catch (erro) {
      console.error("[ML] Erro ao gerar relatório de cobrança:", erro);
    }
  }
}

// ── HELPERS ───────────────────────────────────────────────────
async function coletarDadosAgente(slug: string): Promise<Record<string, unknown>> {
  const db = supabase();
  const h72 = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

  const [logs, scripts, acoes, fila] = await Promise.all([
    db.from("hub_prompt_logs").select("*").eq("agente_id", slug).gte("criado_em", h72),
    db.from("hub_scripts").select("*").eq("agente_slug", slug),
    db.from("hub_acoes_ia").select("*").eq("agente_slug", slug).gte("criado_em", h72),
    db.from("hub_fila_mensagens").select("*").eq("agente_id", slug).gte("criado_em", h72),
  ]);

  const totalLogs = logs.data?.length || 0;
  const convertidos = logs.data?.filter((l: Record<string, unknown>) => l.converteu).length || 0;
  const custoTotal = logs.data?.reduce((s: number, l: Record<string, unknown>) => s + (l.custo_brl as number || 0), 0) || 0;
  const latenciaMedia = totalLogs > 0
    ? (logs.data?.reduce((s: number, l: Record<string, unknown>) => s + (l.latencia_ms as number || 0), 0) || 0) / totalLogs
    : 0;

  const porHora: Record<number, { total: number; convertidos: number }> = {};
  logs.data?.forEach((l: Record<string, unknown>) => {
    const hora = new Date(l.criado_em as string).getHours();
    if (!porHora[hora]) porHora[hora] = { total: 0, convertidos: 0 };
    porHora[hora].total++;
    if (l.converteu) porHora[hora].convertidos++;
  });

  return {
    amostras: totalLogs,
    periodo: "72h",
    taxaConversao: totalLogs > 0 ? (convertidos / totalLogs) * 100 : 0,
    custoTotal,
    custoMedio: totalLogs > 0 ? custoTotal / totalLogs : 0,
    latenciaMedia,
    porHora,
    totalAcoes: acoes.data?.length || 0,
    mensagensFila: fila.data?.length || 0,
    erros: logs.data?.filter((l: Record<string, unknown>) => l.erro).length || 0,
    scripts: scripts.data?.map((s: Record<string, unknown>) => ({
      id: s.id,
      uso_count: s.uso_count,
      conversoes: s.conversoes,
      taxa: s.uso_count ? (s.conversoes as number || 0) / (s.uso_count as number) : 0,
    })),
  };
}

async function analisarComClaude(slug: string, nome: string, dados: Record<string, unknown>): Promise<Array<{
  tipo: string; descricao: string; dadosObservados: Record<string, unknown>;
  amostras: number; periodoInicio: string; periodoFim: string; confianca: number; agenteSlug: string;
}>> {
  const client = anthropic();
  const agora = new Date().toISOString();
  const h72 = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

  const prompt = `Você é o sistema de observação de ML do Escritório Virtual Obra10+.
Analise os dados de performance do agente "${nome}" (${slug}) e identifique padrões.

DADOS:
${JSON.stringify(dados, null, 2)}

Retorne JSON com array de observações. Cada uma:
{
  "tipo": "script_melhor|script_pior|horario_ideal|horario_ruim|modelo_melhor|retrabalho_padrao|conversao_padrao",
  "descricao": "descrição clara e objetiva do padrão",
  "dadosObservados": {},
  "amostras": 0,
  "periodoInicio": "${h72}",
  "periodoFim": "${agora}",
  "confianca": 0
}

REGRAS: Mínimo 10 amostras. Confiança mínima 0.5. Você APENAS OBSERVA.
Retorne APENAS o JSON.`;

  try {
    const resposta = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
    const texto = resposta.content[0].type === "text" ? resposta.content[0].text : "[]";
    const obs = JSON.parse(texto.replace(/```json|```/g, "").trim());
    return Array.isArray(obs) ? obs.map((o: Record<string, unknown>) => ({ ...o, agenteSlug: slug }) as {
      tipo: string; descricao: string; dadosObservados: Record<string, unknown>;
      amostras: number; periodoInicio: string; periodoFim: string; confianca: number; agenteSlug: string;
    }) : [];
  } catch {
    return [];
  }
}

async function gerarSugestaoComClaude(
  slug: string,
  observacao: Record<string, unknown>,
  dados: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const client = anthropic();

  const prompt = `Você é o sistema de ML do Escritório Virtual Obra10+.
Com base nesta observação, gere uma SUGESTÃO para análise humana.

OBSERVAÇÃO:
${JSON.stringify(observacao, null, 2)}

DADOS DO AGENTE:
${JSON.stringify(dados, null, 2)}

Gere JSON:
{
  "tipomudanca": "script|horario|modelo|tom|personalidade|contexto|escalada",
  "titulo": "título curto",
  "oQueObservou": "o que os dados mostram",
  "oQueSugere": "o que recomenda mudar",
  "porQue": "justificativa com dados",
  "impactoEstimado": "impacto esperado com percentuais",
  "dadosAntes": {},
  "dadosDepois": {},
  "campoDireto": "nome do campo que seria alterado",
  "tabelaAfetada": "nome da tabela no banco",
  "confianca": 0,
  "amostras": 0
}

Esta é apenas uma SUGESTÃO para o humano avaliar. Retorne APENAS o JSON.`;

  try {
    const resposta = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const texto = resposta.content[0].type === "text" ? resposta.content[0].text : "";
    return JSON.parse(texto.replace(/```json|```/g, "").trim());
  } catch {
    return null;
  }
}

async function calcularKPI(slug: string, kpiSlug: string): Promise<number | null> {
  const db = supabase();
  const h1 = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const h24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  switch (kpiSlug) {
    case "tempo_primeira_resposta": {
      const { data } = await db.from("hub_fila_mensagens").select("criado_em, agendado_para").eq("agente_id", slug).eq("direcao", "saida").gte("criado_em", h1).limit(50);
      if (!data || data.length === 0) return null;
      const tempos = data.map((m: Record<string, unknown>) => (new Date(m.criado_em as string).getTime() - new Date(m.agendado_para as string).getTime()) / 1000);
      return tempos.reduce((a, b) => a + b, 0) / tempos.length;
    }
    case "taxa_retrabalho": {
      const { data } = await db.from("hub_scripts").select("uso_count, conversoes").eq("agente_slug", slug);
      if (!data || data.length === 0) return null;
      const totalUsos = data.reduce((s: number, sc: Record<string, unknown>) => s + (sc.uso_count as number || 0), 0);
      const totalConv = data.reduce((s: number, sc: Record<string, unknown>) => s + (sc.conversoes as number || 0), 0);
      return totalUsos > 0 ? 100 - (totalConv / totalUsos) * 100 : 0;
    }
    case "custo_tokens_dia": {
      const { data } = await db.from("hub_prompt_logs").select("custo_brl").eq("agente_id", slug).gte("criado_em", h24);
      if (!data) return 0;
      return data.reduce((s: number, l: Record<string, unknown>) => s + (l.custo_brl as number || 0), 0);
    }
    case "leads_sem_resposta": {
      const { data } = await db.from("hub_fila_mensagens").select("id").eq("agente_id", slug).eq("status", "pendente").eq("direcao", "entrada").lt("agendado_para", new Date(Date.now() - 5 * 60 * 1000).toISOString());
      return data?.length || 0;
    }
    default:
      return null;
  }
}

function determinarNivelAlerta(valor: number, meta: Record<string, unknown>): "ok" | "atencao" | "critico" {
  const metaValor = meta.valor_meta as number;
  const atencao = meta.valor_atencao as number;
  const critico = meta.valor_critico as number;
  const kpiSlug = meta.kpi_slug as string;
  const menorMelhor = ["tempo_primeira_resposta", "taxa_retrabalho", "custo_tokens_dia", "leads_sem_resposta", "taxa_erro_qualificacao", "cpl_atual"];
  if (menorMelhor.includes(kpiSlug)) {
    if (critico && valor >= critico) return "critico";
    if (atencao && valor >= atencao) return "atencao";
    return valor <= metaValor ? "ok" : "atencao";
  } else {
    if (critico && valor <= critico) return "critico";
    if (atencao && valor <= atencao) return "atencao";
    return valor >= metaValor ? "ok" : "atencao";
  }
}
