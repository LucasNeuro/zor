'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'

type Lead = {
  id: string
  numero_visual: number
  fase: string
  status_visual: string
  score: number
  valor_estimado: number | null
  tipo: string
  ia_ativa: boolean
  sala_canvas?: string
  hub_pessoas: { nome: string; telefone: string | null } | null
}

type Alerta = {
  id: string
  tipo: string
  texto: string
  tempo: string
  cor: string
}

const FASE_LABEL: Record<string, string> = {
  entrada: 'Entrada', espera: 'Espera', qualificacao: 'Qualificação',
  apresentacao: 'Apresentação', negociacao: 'Negociação',
  fechamento: 'Fechamento', ganho: 'Ganho', perdido: 'Perdido'
}

const COR_STATUS: Record<string, string> = {
  critico: '#ef4444', quente: '#f97316', normal: '#10b981', frio: '#6b7280'
}

const COR_TIPO: Record<string, string> = {
  imobiliario: '#8b5cf6', reforma: '#f97316',
  produto_servico: '#38bdf8', fornecedor: '#10b981'
}

const SALAS = [
  { id: 'main_entrance', label: 'Entrada', icone: '🚪' },
  { id: 'waiting_area', label: 'Espera', icone: '⏳' },
  { id: 'qualification_room', label: 'Qualificação', icone: '🔍' },
  { id: 'presentation_room', label: 'Apresentação', icone: '📊' },
  { id: 'negotiation_room', label: 'Negociação', icone: '🤝' },
  { id: 'closing_room', label: 'Fechamento', icone: '✅' },
]

export default function MobileExperience() {
  const [aba, setAba] = useState(0)
  const [leads, setLeads] = useState<Lead[]>([])
  const [leadSelecionado, setLeadSelecionado] = useState<Lead | null>(null)
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [horaAtual, setHoraAtual] = useState('')
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  useEffect(() => {
    const tick = () => setHoraAtual(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    async function fetchLeads() {
      const { data } = await supabase
        .from('hub_leads')
        .select('id, numero_visual, fase, status_visual, score, valor_estimado, tipo, ia_ativa, sala_canvas, hub_pessoas(nome, telefone)')
        .order('score', { ascending: false })
      setLeads((data as unknown as Lead[]) || [])
    }
    fetchLeads()
    const channel = supabase
      .channel('mobile_leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hub_leads' }, fetchLeads)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    setAlertas([
      { id: '1', tipo: 'CRÍTICO', texto: 'Roberto Alves sem resposta há 2h', tempo: 'agora', cor: '#ef4444' },
      { id: '2', tipo: 'AÇÃO', texto: 'Carlos Menezes pronto para apresentação', tempo: '3min', cor: '#f97316' },
      { id: '3', tipo: 'INFO', texto: 'Ana Ferreira entrou em negociação', tempo: '8min', cor: '#10b981' },
      { id: '4', tipo: 'ALERTA', texto: 'Budget Meta Ads 85% utilizado', tempo: '12min', cor: '#f59e0b' },
      { id: '5', tipo: 'INFO', texto: 'Paulo Rodrigues chegou ao escritório', tempo: '18min', cor: '#3b82f6' },
    ])
  }, [])

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current)
    if (Math.abs(dx) > 60 && dy < 50) {
      if (dx < 0 && aba < 3) setAba(aba + 1)
      if (dx > 0 && aba > 0) setAba(aba - 1)
    }
  }

  const criticos = leads.filter(l => l.status_visual === 'critico').length
  const valorTotal = leads.reduce((a, l) => a + (l.valor_estimado || 0), 0)
  const iaAtiva = leads.filter(l => l.ia_ativa).length

  const salaGroups = SALAS.map(s => ({
    ...s,
    leads: leads.filter(l => l.sala_canvas === s.id ||
      (s.id === 'main_entrance' && l.fase === 'entrada') ||
      (s.id === 'waiting_area' && l.fase === 'espera') ||
      (s.id === 'qualification_room' && l.fase === 'qualificacao') ||
      (s.id === 'presentation_room' && l.fase === 'apresentacao') ||
      (s.id === 'negotiation_room' && l.fase === 'negociacao') ||
      (s.id === 'closing_room' && l.fase === 'fechamento')
    )
  }))

  return (
    <div
      style={{
        width: '100%', height: '100dvh',
        background: '#080810',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', position: 'relative',
        fontFamily: 'var(--font-geist-sans, system-ui)',
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header fixo */}
      <div style={{
        padding: '16px 20px 12px',
        background: 'linear-gradient(180deg, #0d0d18 0%, transparent 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, zIndex: 10,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
            obra10+
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
            Command Center
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {criticos > 0 && (
            <div style={{
              background: '#ef444420', border: '1px solid #ef4444',
              borderRadius: 20, padding: '4px 10px',
              fontSize: 12, fontWeight: 700, color: '#ef4444',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#ef4444',
                boxShadow: '0 0 6px #ef4444',
                animation: 'pulse 1s infinite',
              }} />
              {criticos} crítico{criticos > 1 ? 's' : ''}
            </div>
          )}
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>
            {horaAtual}
          </div>
        </div>
      </div>

      {/* Conteúdo da aba */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* ABA 0 — PULSO */}
        {aba === 0 && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '8px 20px 100px' }}>

            {/* KPIs grandes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Leads Ativos', value: leads.length, cor: '#fff', bg: 'rgba(255,255,255,0.05)' },
                { label: 'Críticos', value: criticos, cor: criticos > 0 ? '#ef4444' : '#10b981', bg: criticos > 0 ? '#ef444415' : '#10b98115' },
                { label: 'Receita em Jogo', value: `R$${(valorTotal/1000).toFixed(0)}k`, cor: '#f97316', bg: '#f9731615' },
                { label: 'IA Ativa', value: `${iaAtiva}/${leads.length}`, cor: '#3b82f6', bg: '#3b82f615' },
              ].map(kpi => (
                <div key={kpi.label} style={{
                  background: kpi.bg,
                  border: `1px solid ${kpi.cor}25`,
                  borderRadius: 16, padding: '18px 16px',
                }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>{kpi.label}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: kpi.cor, letterSpacing: '-1px', lineHeight: 1 }}>
                    {kpi.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Funil compacto */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16, padding: '16px', marginBottom: 16,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Funil ao Vivo
              </div>
              {salaGroups.slice(0, 5).map(sala => (
                <div key={sala.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 14, width: 20 }}>{sala.icone}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', flex: 1 }}>{sala.label}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {sala.leads.map(l => (
                      <div key={l.id} style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: COR_STATUS[l.status_visual] || '#6b7280',
                        boxShadow: l.status_visual === 'critico' ? '0 0 6px #ef4444' : 'none',
                      }} />
                    ))}
                    {sala.leads.length === 0 && (
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>—</span>
                    )}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', width: 20, textAlign: 'right' }}>
                    {sala.leads.length}
                  </span>
                </div>
              ))}
            </div>

            {/* Alertas recentes */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16, padding: '16px',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Alertas
              </div>
              {alertas.map(a => (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  paddingBottom: 12, marginBottom: 12,
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: a.cor, marginTop: 5, flexShrink: 0,
                    boxShadow: `0 0 6px ${a.cor}`,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: a.cor, fontWeight: 700, marginBottom: 2 }}>{a.tipo}</div>
                    <div style={{ fontSize: 13, color: '#fff', lineHeight: 1.4 }}>{a.texto}</div>
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{a.tempo}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA 1 — ESCRITÓRIO */}
        {aba === 1 && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '8px 20px 100px' }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 16, textAlign: 'center' }}>
              Distribuição dos leads por sala
            </div>
            {salaGroups.map(sala => (
              <div key={sala.id} style={{
                background: 'rgba(255,255,255,0.03)',
                border: sala.leads.length > 0 ? '1px solid rgba(249,115,22,0.2)' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: 14, padding: '16px', marginBottom: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: sala.leads.length > 0 ? 12 : 0 }}>
                  <span style={{ fontSize: 22 }}>{sala.icone}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{sala.label}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                      {sala.leads.length} lead{sala.leads.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  {sala.leads.length > 0 && (
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'rgba(249,115,22,0.15)',
                      border: '2px solid #f97316',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 800, color: '#f97316',
                    }}>
                      {sala.leads.length}
                    </div>
                  )}
                </div>
                {sala.leads.map(lead => (
                  <div key={lead.id} onClick={() => { setLeadSelecionado(lead); setAba(2) }} style={{
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 10, padding: '10px 12px',
                    marginBottom: 6, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10,
                    border: `1px solid ${COR_STATUS[lead.status_visual]}25`,
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: COR_STATUS[lead.status_visual] || '#6b7280',
                      boxShadow: lead.status_visual === 'critico' ? `0 0 8px ${COR_STATUS[lead.status_visual]}` : 'none',
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 13, color: '#fff', fontWeight: 500, flex: 1 }}>
                      {lead.hub_pessoas?.nome || '—'}
                    </span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>#{lead.numero_visual}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>›</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ABA 2 — LEADS */}
        {aba === 2 && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '8px 20px 100px' }}>
            {leadSelecionado ? (
              <div>
                <button onClick={() => setLeadSelecionado(null)} style={{
                  background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
                  fontSize: 14, cursor: 'pointer', marginBottom: 16, padding: 0,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  ← Voltar
                </button>
                <div style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${COR_TIPO[leadSelecionado.tipo] || '#6b7280'}40`,
                  borderRadius: 20, padding: '24px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%',
                      background: `${COR_TIPO[leadSelecionado.tipo] || '#6b7280'}25`,
                      border: `2px solid ${COR_TIPO[leadSelecionado.tipo] || '#6b7280'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 24, fontWeight: 800, color: '#fff',
                    }}>
                      {leadSelecionado.hub_pessoas?.nome?.[0] || '?'}
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>
                        {leadSelecionado.hub_pessoas?.nome || '—'}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                        #{leadSelecionado.numero_visual} · {FASE_LABEL[leadSelecionado.fase]}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      { label: 'Score', value: `${leadSelecionado.score}pts`, cor: leadSelecionado.score >= 70 ? '#10b981' : '#f59e0b' },
                      { label: 'Status', value: leadSelecionado.status_visual, cor: COR_STATUS[leadSelecionado.status_visual] },
                      { label: 'Valor', value: leadSelecionado.valor_estimado ? `R$${(leadSelecionado.valor_estimado/1000).toFixed(0)}k` : '—', cor: '#f97316' },
                      { label: 'IA', value: leadSelecionado.ia_ativa ? 'Ativa' : 'Pausada', cor: leadSelecionado.ia_ativa ? '#10b981' : '#f59e0b' },
                    ].map(item => (
                      <div key={item.label} style={{
                        background: 'rgba(255,255,255,0.04)',
                        borderRadius: 12, padding: '14px',
                      }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>{item.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: item.cor }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                  {leadSelecionado.hub_pessoas?.telefone && (
                    <a href={`tel:${leadSelecionado.hub_pessoas.telefone}`} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      marginTop: 16, background: '#25D366',
                      borderRadius: 12, padding: '14px',
                      color: '#fff', textDecoration: 'none',
                      fontSize: 14, fontWeight: 600,
                    }}>
                      📞 Ligar para {leadSelecionado.hub_pessoas.nome.split(' ')[0]}
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 16, textAlign: 'center' }}>
                  {leads.length} leads · ordenados por urgência
                </div>
                {leads.map(lead => (
                  <div key={lead.id} onClick={() => setLeadSelecionado(lead)} style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${COR_STATUS[lead.status_visual]}30`,
                    borderRadius: 14, padding: '16px',
                    marginBottom: 10, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 14,
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: `${COR_TIPO[lead.tipo] || '#6b7280'}20`,
                      border: `2px solid ${COR_STATUS[lead.status_visual] || '#6b7280'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                      {lead.hub_pessoas?.nome?.[0] || '?'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 3 }}>
                        {lead.hub_pessoas?.nome || '—'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 10, color: COR_STATUS[lead.status_visual],
                          background: `${COR_STATUS[lead.status_visual]}18`,
                          padding: '2px 6px', borderRadius: 4, fontWeight: 600,
                        }}>
                          {lead.status_visual.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                          {FASE_LABEL[lead.fase]}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: 16, fontWeight: 700,
                        color: lead.score >= 70 ? '#10b981' : lead.score >= 40 ? '#f59e0b' : '#6b7280',
                      }}>
                        {lead.score}
                      </div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>score</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA 3 — FEED */}
        {aba === 3 && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '8px 20px 100px' }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 16, textAlign: 'center' }}>
              Eventos em tempo real
            </div>
            {alertas.map((a, i) => (
              <div key={a.id} style={{
                display: 'flex', gap: 14, paddingBottom: 20,
                borderBottom: i < alertas.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                marginBottom: 20,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: `${a.cor}20`, border: `2px solid ${a.cor}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14,
                  }}>
                    {a.tipo === 'CRÍTICO' ? '🚨' : a.tipo === 'AÇÃO' ? '⚡' : a.tipo === 'ALERTA' ? '⚠️' : 'ℹ️'}
                  </div>
                  {i < alertas.length - 1 && (
                    <div style={{ flex: 1, width: 1, background: 'rgba(255,255,255,0.06)', marginTop: 8 }} />
                  )}
                </div>
                <div style={{ paddingTop: 6 }}>
                  <div style={{ fontSize: 10, color: a.cor, fontWeight: 700, marginBottom: 4 }}>{a.tipo}</div>
                  <div style={{ fontSize: 15, color: '#fff', fontWeight: 500, lineHeight: 1.4, marginBottom: 4 }}>
                    {a.texto}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{a.tempo}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nav inferior */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'rgba(8,8,16,0.95)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 100,
      }}>
        {[
          { icone: '📊', label: 'Pulso' },
          { icone: '🏢', label: 'Escritório' },
          { icone: '👥', label: 'Leads' },
          { icone: '⚡', label: 'Feed' },
        ].map((item, i) => (
          <button key={i} onClick={() => { setAba(i); setLeadSelecionado(null) }} style={{
            flex: 1, background: 'none', border: 'none', cursor: 'pointer',
            padding: '12px 4px 10px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            position: 'relative',
          }}>
            {aba === i && (
              <div style={{
                position: 'absolute', top: 0, left: '50%',
                transform: 'translateX(-50%)',
                width: 32, height: 2, borderRadius: 1,
                background: '#f97316',
              }} />
            )}
            <span style={{ fontSize: 22 }}>{item.icone}</span>
            <span style={{
              fontSize: 10, fontWeight: aba === i ? 700 : 400,
              color: aba === i ? '#f97316' : 'rgba(255,255,255,0.35)',
            }}>
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
