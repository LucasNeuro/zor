import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processarMensagem } from '@/lib/ia/engine'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Extrair dados da mensagem (formato Z-API)
    const numero = body.phone || body.from || ''
    const mensagem = body.text?.message || body.body || ''
    const whatsappId = body.messageId || ''

    if (!numero || !mensagem) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    // Limpar número
    const numeroLimpo = numero.replace(/\D/g, '')

    // Verificar se pessoa já existe
    let { data: pessoa } = await supabase
      .from('hub_pessoas')
      .select('id')
      .eq('telefone', numeroLimpo)
      .single()

    // Se não existe, criar
    if (!pessoa) {
      const { data: novaPessoa } = await supabase
        .from('hub_pessoas')
        .insert({
          nome: 'Novo contato',
          telefone: numeroLimpo,
          tipo: 'lead',
        })
        .select('id')
        .single()
      pessoa = novaPessoa
    }

    // Verificar se lead já existe
    let { data: lead } = await supabase
      .from('hub_leads')
      .select('id, fase, status_visual')
      .eq('pessoa_id', pessoa?.id)
      .single()

    // Se não existe, criar
    if (!lead) {
      const { data: novoLead } = await supabase
        .from('hub_leads')
        .insert({
          pessoa_id: pessoa?.id,
          fase: 'entrada',
          status_visual: 'normal',
          score: 10,
          ia_ativa: true,
          tipo: 'nao_identificado',
        })
        .select('id, fase, status_visual')
        .single()
      lead = novoLead
    }

    // Verificar conversa ativa
    let { data: conversa } = await supabase
      .from('hub_conversas')
      .select('id')
      .eq('lead_id', lead?.id)
      .eq('status', 'ativa')
      .single()

    if (!conversa) {
      const { data: novaConversa } = await supabase
        .from('hub_conversas')
        .insert({
          lead_id: lead?.id,
          pessoa_id: pessoa?.id,
          canal: 'whatsapp',
          status: 'ativa',
        })
        .select('id')
        .single()
      conversa = novaConversa
    }

    // Salvar mensagem do lead
    await supabase.from('hub_mensagens').insert({
      conversa_id: conversa?.id,
      lead_id: lead?.id,
      pessoa_id: pessoa?.id,
      remetente: 'lead',
      tipo_conteudo: 'texto',
      conteudo: mensagem,
    })

    // Adicionar na fila
    await supabase.from('hub_fila_mensagens').insert({
      lead_id: lead?.id,
      conversa_id: conversa?.id,
      whatsapp_message_id: whatsappId,
      remetente_numero: numeroLimpo,
      conteudo: mensagem,
      status: 'processando',
      agente_responsavel: 'atendente',
    })

    // Processar com IA
    const agenteSlug = lead?.fase === 'qualificacao' ? 'sdr' : 'atendente'

    const { resposta } = await processarMensagem({
      leadId: lead?.id!,
      conversaId: conversa?.id!,
      mensagemUsuario: mensagem,
      agenteSlug,
    })

    // TODO: Enviar resposta pelo Z-API
    // await enviarMensagemZAPI(numeroLimpo, resposta)

    return NextResponse.json({ success: true, resposta })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Webhook ativo', sistema: 'Obra10+' })
}
