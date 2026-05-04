import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processarMensagem } from '@/lib/ia/engine'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET — verificação do webhook pelo Meta
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 })
  }

  return NextResponse.json({ status: 'Webhook Obra10+ ativo' })
}

// POST — receber mensagens do Meta WhatsApp Business API
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Ignorar notificações que não são de mensagens WA
    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ status: 'ignored' })
    }

    const value = body.entry?.[0]?.changes?.[0]?.value

    if (!value?.messages?.length) {
      return NextResponse.json({ status: 'no_messages' })
    }

    const msg     = value.messages[0]
    const contato = value.contacts?.[0]

    // Só processar texto por ora
    if (msg.type !== 'text') {
      return NextResponse.json({ status: 'non_text_ignored' })
    }

    const numero      = msg.from as string
    const mensagem    = (msg.text?.body as string) || ''
    const whatsappId  = msg.id as string
    const nomeMeta    = (contato?.profile?.name as string) || 'Novo contato'

    if (!numero || !mensagem) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const numeroLimpo = numero.replace(/\D/g, '')

    // Buscar ou criar pessoa
    let { data: pessoa } = await supabase
      .from('hub_pessoas')
      .select('id')
      .eq('telefone', numeroLimpo)
      .maybeSingle()

    if (!pessoa) {
      const { data } = await supabase
        .from('hub_pessoas')
        .insert({ nome: nomeMeta, telefone: numeroLimpo, tipo: 'lead' })
        .select('id')
        .single()
      pessoa = data
    }

    // Buscar ou criar lead
    let { data: lead } = await supabase
      .from('hub_leads')
      .select('id, fase, status_visual, score, valor_estimado')
      .eq('pessoa_id', pessoa?.id)
      .maybeSingle()

    if (!lead) {
      const { data } = await supabase
        .from('hub_leads')
        .insert({
          pessoa_id:     pessoa?.id,
          fase:          'entrada',
          status_visual: 'normal',
          score:         10,
          ia_ativa:      true,
          tipo:          'nao_identificado',
        })
        .select('id, fase, status_visual, score, valor_estimado')
        .single()
      lead = data
    }

    // Buscar ou criar conversa ativa
    let { data: conversa } = await supabase
      .from('hub_conversas')
      .select('id')
      .eq('lead_id', lead?.id)
      .eq('status', 'ativa')
      .maybeSingle()

    if (!conversa) {
      const { data } = await supabase
        .from('hub_conversas')
        .insert({
          lead_id:   lead?.id,
          pessoa_id: pessoa?.id,
          canal:     'whatsapp',
          status:    'ativa',
        })
        .select('id')
        .single()
      conversa = data
    }

    // Salvar mensagem do lead
    await supabase.from('hub_mensagens').insert({
      conversa_id:   conversa?.id,
      lead_id:       lead?.id,
      pessoa_id:     pessoa?.id,
      remetente:     'lead',
      tipo_conteudo: 'texto',
      conteudo:      mensagem,
    })

    // Processar com IA
    const resultado = await processarMensagem({
      leadId:   lead?.id!,
      mensagem: mensagem,
      canal:    "whatsapp",
      telefone: numeroLimpo,
      nome:     nomeMeta,
      metadata: { conversaId: conversa?.id, whatsappMessageId: whatsappId },
    })

    // TODO: enviar resultado.resposta pelo Meta API
    // await enviarMensagemMeta(numeroLimpo, resultado.resposta)

    return NextResponse.json({ success: true, modelo: resultado.modelo })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
