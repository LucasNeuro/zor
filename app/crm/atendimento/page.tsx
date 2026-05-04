'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

type Lead = {
  id: string
  numero_visual: number
  fase: string
  status_visual: string
  score: number
  ia_ativa: boolean
  valor_estimado: number | null
  descricao_projeto: string | null
  tipo: string
  hub_pessoas: { nome: string; telefone: string | null } | null
}

type Conversa = { id: string; ultima_mensagem_preview: string | null; total_mensagens: number }
type Mensagem = { id: string; remetente: string; conteudo: string | null; enviada_em: string; ia_modelo: string | null }

const COR_STATUS: Record<string, string> = { critico: '#ef4444', quente: '#f97316', normal: '#10b981', frio: '#6b7280' }
const COR_TIPO: Record<string, string> = { imobiliario: '#8b5cf6', reforma: '#f97316', produto_servico: '#38bdf8', fornecedor: '#10b981' }
const FASE_LABEL: Record<string, string> = {
  entrada: 'Entrada', espera: 'Espera', qualificacao: 'Qualificação',
  apresentacao: 'Apresentação', negociacao: 'Negociação',
  fechamento: 'Fechamento', ganho: 'Ganho', perdido: 'Perdido'
}
const FASES_ORDEM = ['entrada','espera','qualificacao','apresentacao','negociacao','fechamento','ganho']
const SALAS: Record<string, string> = {
  entrada: 'main_entrance', espera: 'waiting_area', qualificacao: 'qualification_room',
  apresentacao: 'presentation_room', negociacao: 'negotiation_room',
  fechamento: 'closing_room', ganho: 'success_room',
}

export default function Atendimento() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [leadSel, setLeadSel] = useState<Lead | null>(null)
  const [conversa, setConversa] = useState<Conversa | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [filtro, setFiltro] = useState<'todas'|'critico'|'ia_off'>('todas')
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchLeads = useCallback(async () => {
    const { data } = await supabase
      .from('hub_leads')
      .select('id, numero_visual, fase, status_visual, score, ia_ativa, valor_estimado, descricao_projeto, tipo, hub_pessoas(nome, telefone)')
      .order('score', { ascending: false })
    setLeads((data as unknown as Lead[]) || [])
  }, [])

  useEffect(() => {
    fetchLeads()
    const ch = supabase.channel('atend_leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hub_leads' }, fetchLeads)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchLeads])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensagens])

  async function selecionarLead(lead: Lead) {
    setLeadSel(lead)
    setMensagens([])
    setConversa(null)

    const { data: convs } = await supabase
      .from('hub_conversas')
      .select('id, ultima_mensagem_preview, total_mensagens')
      .eq('lead_id', lead.id)
      .order('aberta_em', { ascending: false })
      .limit(1)

    let convId: string

    if (convs && convs.length > 0) {
      convId = convs[0].id as string
      setConversa(convs[0] as Conversa)
    } else {
      const { data: nova } = await supabase
        .from('hub_conversas')
        .insert({ lead_id: lead.id, pessoa_id: lead.id, canal: 'interno', status: 'ativa' })
        .select('id, ultima_mensagem_preview, total_mensagens')
        .single()
      convId = (nova as Conversa).id
      setConversa(nova as Conversa)
    }

    const { data: msgs } = await supabase
      .from('hub_mensagens')
      .select('id, remetente, conteudo, enviada_em, ia_modelo')
      .eq('conversa_id', convId)
      .order('enviada_em')
    setMensagens((msgs as unknown as Mensagem[]) || [])
  }

  async function enviar() {
    if (!texto.trim() || !leadSel || !conversa || enviando) return
    setEnviando(true)
    const { data } = await supabase
      .from('hub_mensagens')
      .insert({ conversa_id: conversa.id, lead_id: leadSel.id, pessoa_id: leadSel.id, remetente: 'agente', tipo_conteudo: 'texto', conteudo: texto })
      .select('id, remetente, conteudo, enviada_em, ia_modelo')
      .single()
    if (data) setMensagens(p => [...p, data as unknown as Mensagem])
    setTexto('')
    setEnviando(false)
  }

  async function avancarFase() {
    if (!leadSel) return
    const idx = FASES_ORDEM.indexOf(leadSel.fase)
    if (idx < 0 || idx >= FASES_ORDEM.length - 1) return
    const novaFase = FASES_ORDEM[idx + 1]
    await supabase.from('hub_leads')
      .update({ fase: novaFase, sala_canvas: SALAS[novaFase] || 'main_entrance', atualizado_em: new Date().toISOString() })
      .eq('id', leadSel.id)
    setLeadSel(p => p ? { ...p, fase: novaFase } : null)
    setLeads(p => p.map(l => l.id === leadSel.id ? { ...l, fase: novaFase } : l))
  }

  const leadsFiltrados = leads.filter(l =>
    filtro === 'critico' ? l.status_visual === 'critico' :
    filtro === 'ia_off' ? !l.ia_ativa : true
  )

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* COLUNA ESQUERDA — Lista */}
      <div style={{ width: 280, borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 10 }}>Conversas</div>
          <div style={{ display: 'flex', gap: 5 }}>
            {(['todas','critico','ia_off'] as const).map(f => (
              <button key={f} onClick={() => setFiltro(f)} style={{
                fontSize: 10, padding: '4px 8px', borderRadius: 5, cursor: 'pointer', fontWeight: filtro === f ? 700 : 400,
                background: filtro === f ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.04)',
                border: filtro === f ? '1px solid rgba(249,115,22,0.4)' : '1px solid rgba(255,255,255,0.08)',
                color: filtro === f ? '#f97316' : 'rgba(255,255,255,0.4)',
              }}>
                {f === 'todas' ? 'Todas' : f === 'critico' ? '🔴 Crítico' : 'IA Off'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }} className="panel-scroll">
          {leadsFiltrados.map(lead => (
            <div key={lead.id} onClick={() => selecionarLead(lead)} style={{
              padding: '12px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              cursor: 'pointer',
              background: leadSel?.id === lead.id ? 'rgba(249,115,22,0.08)' : 'transparent',
              borderLeft: leadSel?.id === lead.id ? '3px solid #f97316' : '3px solid transparent',
              transition: 'all 0.15s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: `${COR_TIPO[lead.tipo] || '#6b7280'}20`,
                  border: `2px solid ${COR_STATUS[lead.status_visual] || '#6b7280'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: '#fff',
                }}>
                  {lead.hub_pessoas?.nome?.[0] || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {lead.hub_pessoas?.nome || '—'}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                    {FASE_LABEL[lead.fase]} · score {lead.score}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: COR_STATUS[lead.status_visual], boxShadow: lead.status_visual === 'critico' ? '0 0 6px #ef4444' : 'none' }} />
                  {!lead.ia_ativa && <span style={{ fontSize: 8, color: '#f59e0b', background: '#f59e0b18', padding: '1px 4px', borderRadius: 3 }}>IA OFF</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* COLUNA CENTRO — Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {leadSel ? (
          <>
            {/* Header chat */}
            <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                background: `${COR_TIPO[leadSel.tipo] || '#6b7280'}25`,
                border: `2px solid ${COR_TIPO[leadSel.tipo] || '#6b7280'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 800, color: '#fff',
              }}>
                {leadSel.hub_pessoas?.nome?.[0] || '?'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{leadSel.hub_pessoas?.nome || '—'}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                  {FASE_LABEL[leadSel.fase]} · #{leadSel.numero_visual} · score {leadSel.score}
                </div>
              </div>
              <Link href={`/crm/lead/${leadSel.id}`} style={{
                fontSize: 11, color: '#f97316', textDecoration: 'none',
                background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)',
                padding: '6px 12px', borderRadius: 7,
              }}>
                Lead 360 →
              </Link>
            </div>

            {/* Próximo passo */}
            {FASES_ORDEM.indexOf(leadSel.fase) < FASES_ORDEM.length - 1 && (
              <div style={{
                padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 12,
                background: 'rgba(249,115,22,0.05)', borderBottom: '1px solid rgba(249,115,22,0.12)',
              }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', flex: 1 }}>
                  Próxima fase: <strong style={{ color: '#f97316' }}>{FASE_LABEL[FASES_ORDEM[FASES_ORDEM.indexOf(leadSel.fase) + 1]]}</strong>
                </span>
                <button onClick={avancarFase} style={{
                  fontSize: 11, color: '#fff', background: 'linear-gradient(135deg, #f97316, #ea580c)',
                  border: 'none', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 700,
                }}>
                  Avançar →
                </button>
              </div>
            )}

            {/* Mensagens */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }} className="panel-scroll">
              {mensagens.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13, marginTop: 60 }}>
                  Nenhuma mensagem ainda.
                </div>
              ) : mensagens.map(msg => {
                const isAgente = msg.remetente === 'agente' || msg.remetente === 'ia'
                return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: isAgente ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '70%',
                      background: isAgente ? 'linear-gradient(135deg, #f97316, #ea580c)' : 'rgba(255,255,255,0.07)',
                      borderRadius: isAgente ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      padding: '10px 14px', fontSize: 13, color: '#fff', lineHeight: 1.5,
                    }}>
                      {msg.remetente === 'ia' && (
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginBottom: 4, fontWeight: 700 }}>
                          🤖 IA {msg.ia_modelo?.toUpperCase()}
                        </div>
                      )}
                      {msg.conteudo}
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 4, textAlign: 'right' }}>
                        {new Date(msg.enviada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10 }}>
              <input
                value={texto}
                onChange={e => setTexto(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar()}
                placeholder={leadSel.ia_ativa ? 'Sugestão da IA aparecerá aqui após integração...' : 'IA pausada — digite livremente...'}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                  padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none',
                }}
              />
              <button onClick={enviar} disabled={enviando || !texto.trim()} style={{
                background: texto.trim() ? 'linear-gradient(135deg, #f97316, #ea580c)' : 'rgba(255,255,255,0.05)',
                border: 'none', borderRadius: 10, padding: '10px 18px',
                color: texto.trim() ? '#fff' : 'rgba(255,255,255,0.3)',
                fontSize: 13, fontWeight: 700, cursor: texto.trim() ? 'pointer' : 'default',
              }}>
                {enviando ? '...' : 'Enviar'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'rgba(255,255,255,0.15)' }}>
            <div style={{ fontSize: 56 }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Selecione um lead</div>
            <div style={{ fontSize: 12 }}>para ver a conversa completa</div>
          </div>
        )}
      </div>

      {/* COLUNA DIREITA — Painel do lead */}
      {leadSel && (
        <div style={{ width: 260, borderLeft: '1px solid rgba(255,255,255,0.06)', overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }} className="panel-scroll">
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Painel do Lead</div>

          {/* Score circular */}
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12, padding: '14px', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
              background: `conic-gradient(#f97316 ${leadSel.score * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#0d0d1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#f97316' }}>
                {leadSel.score}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Score</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                {leadSel.score >= 70 ? '🔥 Alto potencial' : leadSel.score >= 40 ? '⚡ Médio' : '❄️ Baixo'}
              </div>
            </div>
          </div>

          {/* Dados */}
          {[
            { label: 'Telefone', value: leadSel.hub_pessoas?.telefone || '—' },
            { label: 'Tipo', value: leadSel.tipo },
            { label: 'Fase', value: FASE_LABEL[leadSel.fase] },
            { label: 'Valor Est.', value: leadSel.valor_estimado ? `R$ ${leadSel.valor_estimado.toLocaleString('pt-BR')}` : '—' },
            { label: 'Status', value: leadSel.status_visual },
          ].map(item => (
            <div key={item.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>{item.label}</div>
              <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{item.value}</div>
            </div>
          ))}

          {leadSel.descricao_projeto && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>Projeto</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{leadSel.descricao_projeto}</div>
            </div>
          )}

          <Link href={`/crm/lead/${leadSel.id}`} style={{
            display: 'block', textAlign: 'center',
            background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)',
            borderRadius: 8, padding: '10px', color: '#f97316',
            textDecoration: 'none', fontSize: 12, fontWeight: 700,
          }}>
            Abrir Lead 360 →
          </Link>

          <Link href="/office" style={{
            display: 'block', textAlign: 'center',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '10px', color: 'rgba(255,255,255,0.4)',
            textDecoration: 'none', fontSize: 12,
          }}>
            🏢 Ver no Escritório Virtual
          </Link>
        </div>
      )}
    </div>
  )
}
