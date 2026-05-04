'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

type Lead = {
  id: string; codigo: string; numero_visual: number; tipo: string
  prefixo_mercado: string; fase: string; status_visual: string
  score: number; temperatura: number; ia_ativa: boolean
  valor_estimado: number | null; descricao_projeto: string | null
  sla_horas: number; sla_violado: boolean; criado_em: string; atualizado_em: string
  hub_pessoas: { nome: string; telefone: string | null; email: string | null; cidade: string | null; estado: string | null; origem: string | null } | null
}

const TABS = ['Visão Geral','Histórico','Conversas','Negócios','Parceiros','Ações']
const FASE_LABEL: Record<string,string> = { entrada:'Entrada',espera:'Espera',qualificacao:'Qualificação',apresentacao:'Apresentação',negociacao:'Negociação',fechamento:'Fechamento',ganho:'Ganho',perdido:'Perdido' }
const COR_TIPO: Record<string,string> = { imobiliario:'#8b5cf6',reforma:'#f97316',produto_servico:'#38bdf8',fornecedor:'#10b981' }
const COR_STATUS: Record<string,string> = { critico:'#ef4444',quente:'#f97316',normal:'#10b981',frio:'#6b7280' }

export default function Lead360() {
  const { id } = useParams<{ id: string }>()
  const [lead, setLead] = useState<Lead | null>(null)
  const [tab, setTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [mensagens, setMensagens] = useState<{id:string;remetente:string;conteudo:string|null;enviada_em:string}[]>([])

  useEffect(() => {
    async function fetchLead() {
      const { data } = await supabase.from('hub_leads')
        .select('*, hub_pessoas(nome,telefone,email,cidade,estado,origem)')
        .eq('id', id).single()
      setLead(data as unknown as Lead)
      setLoading(false)
    }
    fetchLead()
  }, [id])

  useEffect(() => {
    if (tab !== 2 || !lead) return
    async function fetchMsgs() {
      const { data: convs } = await supabase.from('hub_conversas').select('id').eq('lead_id', lead!.id).limit(1)
      if (convs && convs.length > 0) {
        const { data: msgs } = await supabase.from('hub_mensagens').select('id,remetente,conteudo,enviada_em').eq('conversa_id', convs[0].id).order('enviada_em')
        setMensagens((msgs as unknown as {id:string;remetente:string;conteudo:string|null;enviada_em:string}[]) || [])
      }
    }
    fetchMsgs()
  }, [tab, lead])

  if (loading) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'rgba(255,255,255,0.3)',fontSize:14 }}>Carregando Lead 360...</div>
  if (!lead) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'rgba(255,255,255,0.3)',fontSize:14 }}>Lead não encontrado.</div>

  const corTipo = COR_TIPO[lead.tipo] || '#6b7280'

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'18px 24px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',gap:14 }}>
        <Link href="/crm/atendimento" style={{ color:'rgba(255,255,255,0.3)',textDecoration:'none',fontSize:22,lineHeight:1 }}>←</Link>
        <div style={{ width:46,height:46,borderRadius:'50%',background:`${corTipo}20`,border:`2px solid ${corTipo}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:800,color:'#fff',flexShrink:0 }}>
          {lead.hub_pessoas?.nome?.[0] || '?'}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <h1 style={{ fontSize:18,fontWeight:800,color:'#fff',margin:0,letterSpacing:'-0.3px' }}>{lead.hub_pessoas?.nome || '—'}</h1>
            <span style={{ fontSize:11,color:corTipo,background:`${corTipo}18`,padding:'2px 8px',borderRadius:4,fontWeight:700 }}>{lead.prefixo_mercado}</span>
            <span style={{ fontSize:11,color:'rgba(255,255,255,0.3)' }}>#{lead.numero_visual}</span>
          </div>
          <div style={{ fontSize:12,color:'rgba(255,255,255,0.35)',marginTop:2 }}>{FASE_LABEL[lead.fase]} · Score {lead.score} · {lead.codigo}</div>
        </div>
        <div style={{ display:'flex',gap:8 }}>
          {lead.sla_violado && <div style={{ fontSize:11,color:'#ef4444',background:'#ef444418',padding:'5px 10px',borderRadius:6,fontWeight:700 }}>⚠ SLA Violado</div>}
          {!lead.ia_ativa && <div style={{ fontSize:11,color:'#f59e0b',background:'#f59e0b18',padding:'5px 10px',borderRadius:6,fontWeight:700 }}>IA Pausada</div>}
          <div style={{ fontSize:11,color:COR_STATUS[lead.status_visual],background:`${COR_STATUS[lead.status_visual]}18`,padding:'5px 10px',borderRadius:6,fontWeight:700 }}>{lead.status_visual}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'0 24px' }}>
        {TABS.map((t,i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            background:'none',border:'none',cursor:'pointer',padding:'11px 14px',fontSize:13,
            fontWeight:tab===i?700:400,color:tab===i?'#f97316':'rgba(255,255,255,0.4)',
            borderBottom:tab===i?'2px solid #f97316':'2px solid transparent',transition:'all 0.15s',
          }}>{t}</button>
        ))}
      </div>

      {/* Conteúdo */}
      <div style={{ flex:1,overflowY:'auto',padding:'22px 24px' }} className="panel-scroll">
        {tab === 0 && (
          <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10 }}>
              {[
                {label:'Nome',value:lead.hub_pessoas?.nome||'—'},
                {label:'Telefone',value:lead.hub_pessoas?.telefone||'—'},
                {label:'Email',value:lead.hub_pessoas?.email||'—'},
                {label:'Cidade',value:lead.hub_pessoas?.cidade?`${lead.hub_pessoas.cidade}/${lead.hub_pessoas.estado}`:'—'},
                {label:'Origem',value:lead.hub_pessoas?.origem||'—'},
                {label:'Tipo',value:lead.tipo},
              ].map(item => (
                <div key={item.label} style={{ background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:10,padding:'12px 14px' }}>
                  <div style={{ fontSize:10,color:'rgba(255,255,255,0.35)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.5px' }}>{item.label}</div>
                  <div style={{ fontSize:14,color:'#fff',fontWeight:500 }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10 }}>
              {[
                {label:'Valor Estimado',value:lead.valor_estimado?`R$ ${lead.valor_estimado.toLocaleString('pt-BR')}`:'—',cor:'#f97316'},
                {label:'Score',value:`${lead.score}pts`,cor:lead.score>=70?'#10b981':'#f59e0b'},
                {label:'Temperatura',value:`${lead.temperatura}%`,cor:lead.temperatura>=70?'#f97316':'#6b7280'},
                {label:'SLA',value:`${lead.sla_horas}h`,cor:lead.sla_violado?'#ef4444':'#10b981'},
              ].map(item => (
                <div key={item.label} style={{ background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:10,padding:'14px' }}>
                  <div style={{ fontSize:10,color:'rgba(255,255,255,0.35)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.5px' }}>{item.label}</div>
                  <div style={{ fontSize:24,fontWeight:800,color:item.cor,letterSpacing:'-1px' }}>{item.value}</div>
                </div>
              ))}
            </div>
            {lead.descricao_projeto && (
              <div style={{ background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:10,padding:'16px' }}>
                <div style={{ fontSize:10,color:'rgba(255,255,255,0.35)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.5px' }}>Descrição do Projeto</div>
                <div style={{ fontSize:14,color:'rgba(255,255,255,0.8)',lineHeight:1.6 }}>{lead.descricao_projeto}</div>
              </div>
            )}
          </div>
        )}
        {tab === 1 && (
          <div style={{ display:'flex',flexDirection:'column',gap:0 }}>
            {[
              {icone:'🟢',texto:`Lead criado — tipo ${lead.tipo}`,tempo:lead.criado_em},
              {icone:'📍',texto:`Fase atual: ${FASE_LABEL[lead.fase]}`,tempo:lead.atualizado_em},
              {icone:lead.ia_ativa?'🤖':'⏸',texto:lead.ia_ativa?'IA ativa e respondendo':'IA pausada — atendimento manual',tempo:lead.atualizado_em},
            ].map((ev,i) => (
              <div key={i} style={{ display:'flex',gap:14,paddingBottom:20 }}>
                <div style={{ display:'flex',flexDirection:'column',alignItems:'center',flexShrink:0 }}>
                  <div style={{ fontSize:20 }}>{ev.icone}</div>
                  {i<2 && <div style={{ flex:1,width:1,background:'rgba(255,255,255,0.07)',marginTop:6 }} />}
                </div>
                <div style={{ paddingTop:2 }}>
                  <div style={{ fontSize:13,color:'#fff',fontWeight:500 }}>{ev.texto}</div>
                  <div style={{ fontSize:11,color:'rgba(255,255,255,0.3)',marginTop:2 }}>{new Date(ev.tempo).toLocaleString('pt-BR')}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 2 && (
          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            {mensagens.length === 0 ? (
              <div style={{ color:'rgba(255,255,255,0.3)',fontSize:13,textAlign:'center',marginTop:40 }}>Nenhuma mensagem ainda.</div>
            ) : mensagens.map(msg => {
              const isAgente = msg.remetente==='agente'||msg.remetente==='ia'
              return (
                <div key={msg.id} style={{ display:'flex',justifyContent:isAgente?'flex-end':'flex-start' }}>
                  <div style={{ maxWidth:'70%',background:isAgente?'linear-gradient(135deg,#f97316,#ea580c)':'rgba(255,255,255,0.07)',borderRadius:isAgente?'18px 18px 4px 18px':'18px 18px 18px 4px',padding:'10px 14px',fontSize:13,color:'#fff',lineHeight:1.5 }}>
                    {msg.conteudo}
                    <div style={{ fontSize:9,color:'rgba(255,255,255,0.5)',marginTop:4,textAlign:'right' }}>{new Date(msg.enviada_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {tab === 3 && <div style={{ color:'rgba(255,255,255,0.3)',fontSize:13,textAlign:'center',marginTop:40 }}>Nenhum negócio criado ainda.</div>}
        {tab === 4 && <div style={{ color:'rgba(255,255,255,0.3)',fontSize:13,textAlign:'center',marginTop:40 }}>Nenhum parceiro vinculado ainda.</div>}
        {tab === 5 && (
          <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
            {[
              {label:'Avançar fase no funil',cor:'#f97316',href:'/crm/atendimento'},
              {label:'Abrir conversa de atendimento',cor:'#3b82f6',href:'/crm/atendimento'},
              {label:'Criar negócio vinculado',cor:'#10b981',href:'#'},
              {label:'Vincular parceiro',cor:'#8b5cf6',href:'/crm/parceiros'},
            ].map(a => (
              <Link key={a.label} href={a.href} style={{ textDecoration:'none' }}>
                <div style={{ background:`${a.cor}10`,border:`1px solid ${a.cor}30`,borderRadius:10,padding:'14px 18px',fontSize:13,color:a.cor,fontWeight:700,cursor:'pointer' }}>
                  {a.label} →
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
