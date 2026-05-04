import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export type ModeloIA = 'claude-haiku-4-5-20251001' | 'claude-sonnet-4-6' | 'claude-opus-4-6'

// ============================================================
// FUNÇÃO PRINCIPAL — Gera resposta completa para uma mensagem
// ============================================================
export async function processarMensagem({
  leadId,
  conversaId,
  mensagemUsuario,
  agenteSlug = 'atendente',
}: {
  leadId: string
  conversaId: string
  mensagemUsuario: string
  agenteSlug?: string
}) {
  const inicio = Date.now()

  try {
    // 1. Carregar dados do lead
    const { data: lead } = await supabase
      .from('hub_leads')
      .select('*, hub_pessoas(*)')
      .eq('id', leadId)
      .single()

    if (!lead) throw new Error('Lead não encontrado')

    // 2. Carregar identidade do agente
    const { data: agente } = await supabase
      .from('hub_agente_identidade')
      .select('*')
      .eq('agente_slug', agenteSlug)
      .single()

    if (!agente) throw new Error('Agente não encontrado')

    // 3. Carregar configuração do agente
    const { data: config } = await supabase
      .from('hub_agente_configuracao')
      .select('*')
      .eq('agente_slug', agenteSlug)
      .single()

    // 4. Verificar horário de operação
    const agora = new Date()
    const horaAtual = agora.getHours() * 60 + agora.getMinutes()
    const inicioOp = parseInt(config?.horario_inicio?.split(':')[0] || '8') * 60
    const fimOp = parseInt(config?.horario_fim?.split(':')[0] || '18') * 60
    const dentroHorario = horaAtual >= inicioOp && horaAtual <= fimOp

    // 5. Carregar histórico de mensagens
    const { data: historico } = await supabase
      .from('hub_mensagens')
      .select('remetente, conteudo, enviada_em')
      .eq('conversa_id', conversaId)
      .order('enviada_em', { ascending: false })
      .limit(10)

    // 6. Carregar memória do lead
    const { data: memoria } = await supabase
      .from('hub_memorias_lead')
      .select('*')
      .eq('lead_id', leadId)
      .single()

    // 7. Verificar regras de negócio
    const modelo = await selecionarModelo(lead, agente)

    // 8. Montar o system prompt dinâmico
    const systemPrompt = montarSystemPrompt({
      agente,
      lead,
      memoria,
      dentroHorario,
      config,
    })

    // 9. Montar histórico para o prompt
    const mensagensHistorico = (historico || []).reverse().map((msg: any) => ({
      role: (msg.remetente === 'lead' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: msg.conteudo || '',
    }))

    // 10. Chamar a Claude API
    const response = await anthropic.messages.create({
      model: modelo,
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        ...mensagensHistorico,
        { role: 'user', content: mensagemUsuario },
      ],
    })

    const resposta = response.content[0].type === 'text' ? response.content[0].text : ''
    const tempoResposta = Date.now() - inicio

    // 11. Registrar no log
    await supabase.from('hub_prompt_logs').insert({
      lead_id: leadId,
      conversa_id: conversaId,
      agente_slug: agenteSlug,
      system_prompt: systemPrompt,
      mensagem_usuario: mensagemUsuario,
      resposta_ia: resposta,
      modelo_usado: modelo,
      tokens_input: response.usage.input_tokens,
      tokens_output: response.usage.output_tokens,
      custo_estimado_brl: calcularCusto(modelo, response.usage.input_tokens, response.usage.output_tokens),
      tempo_resposta_ms: tempoResposta,
    })

    // 12. Salvar mensagem no banco
    await supabase.from('hub_mensagens').insert({
      conversa_id: conversaId,
      lead_id: leadId,
      pessoa_id: lead.pessoa_id,
      remetente: 'ia',
      tipo_conteudo: 'texto',
      conteudo: resposta,
    })

    // 13. Atualizar memória do lead
    await atualizarMemoria(leadId, mensagemUsuario, resposta)

    return { resposta, modelo, tempoResposta }

  } catch (error) {
    console.error('Erro no processarMensagem:', error)
    throw error
  }
}

// ============================================================
// MONTAR SYSTEM PROMPT DINÂMICO — 4 CAMADAS
// ============================================================
function montarSystemPrompt({ agente, lead, memoria, dentroHorario, config }: any) {
  const nome = lead.hub_pessoas?.nome || 'o cliente'
  const fase = lead.fase || 'entrada'
  const score = lead.score || 0
  const valor = lead.valor_estimado ? `R$${(lead.valor_estimado/1000).toFixed(0)}k` : 'não informado'
  const status = lead.status_visual || 'normal'

  return `
${agente.system_prompt_base}

═══════════════════════════════════════
CAMADA 2 — CONTEXTO DO LEAD
═══════════════════════════════════════
Nome: ${nome}
Fase atual: ${fase}
Status: ${status}
Score: ${score}/100
Valor estimado: ${valor}
Tipo: ${lead.tipo || 'não identificado'}
IA ativa: ${lead.ia_ativa ? 'sim' : 'não'}

${memoria ? `
Dados coletados: ${JSON.stringify(memoria.dados_coletados || {})}
Preferências detectadas: ${JSON.stringify(memoria.preferencias_detectadas || {})}
Nível de engajamento: ${memoria.nivel_engajamento}/10
Humor predominante: ${memoria.humor_predominante || 'não detectado'}
Resumo anterior: ${memoria.resumo_ia || 'primeira interação'}
` : 'Primeira interação com este lead.'}

═══════════════════════════════════════
CAMADA 3 — REGRAS OPERACIONAIS
═══════════════════════════════════════
Horário atual: ${new Date().toLocaleTimeString('pt-BR')}
Dentro do horário: ${dentroHorario ? 'SIM' : 'NÃO'}
SLA máximo primeira resposta: ${config?.sla_primeira_resposta_min || 5} minutos
SLA máximo resposta seguinte: ${config?.sla_resposta_seguinte_min || 15} minutos
Escalar para: ${config?.escalar_para || 'gerente_atendimento'} se necessário

Não pode dizer: ${agente.nunca_dizer?.join(', ')}
Sempre incluir: ${agente.sempre_dizer?.join(', ')}

${!dentroHorario ? `IMPORTANTE: Fora do horário comercial. Mensagem de ausência: ${config?.mensagem_fora_horario}` : ''}

═══════════════════════════════════════
CAMADA 4 — INSTRUÇÕES FINAIS
═══════════════════════════════════════
- Responda APENAS como ${agente.nome}
- Tom: ${agente.tom_voz}
- Máximo 3 parágrafos curtos
- Use o nome do cliente quando apropriado
- Se não souber, escale para ${config?.escalar_para || 'o supervisor'}
- Nunca invente informações
- Idioma: português brasileiro
`.trim()
}

// ============================================================
// SELECIONAR MODELO BASEADO NO LEAD E REGRAS
// ============================================================
async function selecionarModelo(lead: any, agente: any): Promise<ModeloIA> {
  if (lead.valor_estimado > 200000) return 'claude-sonnet-4-6'
  if (lead.status_visual === 'critico') return 'claude-sonnet-4-6'
  if (lead.status_visual === 'quente') return 'claude-sonnet-4-6'
  if (lead.score < 30) return 'claude-haiku-4-5-20251001'
  return agente.modelo_padrao === 'sonnet' ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001'
}

// ============================================================
// CALCULAR CUSTO ESTIMADO EM BRL
// ============================================================
function calcularCusto(modelo: string, inputTokens: number, outputTokens: number): number {
  const taxas: Record<string, { input: number; output: number }> = {
    'claude-haiku-4-5-20251001': { input: 0.00000025, output: 0.00000125 },
    'claude-sonnet-4-6': { input: 0.000003, output: 0.000015 },
    'claude-opus-4-6': { input: 0.000015, output: 0.000075 },
  }
  const taxa = taxas[modelo] || taxas['claude-haiku-4-5-20251001']
  const custoUSD = (inputTokens * taxa.input) + (outputTokens * taxa.output)
  return custoUSD * 5.75 // conversão aproximada para BRL
}

// ============================================================
// ATUALIZAR MEMÓRIA DO LEAD
// ============================================================
async function atualizarMemoria(leadId: string, mensagemUsuario: string, resposta: string) {
  const { data: existing } = await supabase
    .from('hub_memorias_lead')
    .select('id')
    .eq('lead_id', leadId)
    .single()

  if (existing) {
    await supabase.from('hub_memorias_lead')
      .update({ atualizado_em: new Date().toISOString() })
      .eq('lead_id', leadId)
  } else {
    await supabase.from('hub_memorias_lead')
      .insert({ lead_id: leadId, nivel_engajamento: 5 })
  }
}
