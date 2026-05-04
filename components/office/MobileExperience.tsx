'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'

type Lead = {
  id: string
  numero_visual: number
  fase: string
  status_visual: string
  score: number
  valor_estimado: number | null
  tipo: string
  ia_ativa: boolean
  sla_violado?: boolean
  hub_pessoas: { nome: string; telefone: string | null } | null
}

type Alerta = {
  id: string
  tipo: string
  texto: string
  tempo: string
  cor: string
}

const IMG_W = 863
const IMG_H = 1822

const FASE_SPAWN: Record<string, { x: number; y: number }> = {
  entrada:      { x: 432, y: 1700 },
  espera:       { x: 690, y: 1380 },
  qualificacao: { x: 695, y: 480  },
  apresentacao: { x: 430, y: 970  },
  negociacao:   { x: 695, y: 970  },
  fechamento:   { x: 695, y: 970  },
  ganho:        { x: 435, y: 480  },
  perdido:      { x: 175, y: 480  },
}

const AGENTES = [
  { id: 1,  iniciais: 'DM', x: 167,  y: 185,  cor: '#8b5cf6', dept: 'marketing' },
  { id: 2,  iniciais: 'CE', x: 432,  y: 185,  cor: '#f97316', dept: 'executivo' },
  { id: 3,  iniciais: 'DC', x: 700,  y: 185,  cor: '#3b82f6', dept: 'comercial' },
  { id: 4,  iniciais: 'GM', x: 100,  y: 450,  cor: '#8b5cf6', dept: 'marketing' },
  { id: 5,  iniciais: 'CW', x: 160,  y: 520,  cor: '#8b5cf6', dept: 'marketing' },
  { id: 6,  iniciais: 'DS', x: 220,  y: 590,  cor: '#8b5cf6', dept: 'marketing' },
  { id: 7,  iniciais: 'SM', x: 100,  y: 650,  cor: '#8b5cf6', dept: 'marketing' },
  { id: 8,  iniciais: 'MI', x: 360,  y: 450,  cor: '#10b981', dept: 'conteudo' },
  { id: 9,  iniciais: 'CG', x: 435,  y: 520,  cor: '#10b981', dept: 'conteudo' },
  { id: 10, iniciais: 'DB', x: 500,  y: 590,  cor: '#10b981', dept: 'conteudo' },
  { id: 11, iniciais: 'CB', x: 360,  y: 650,  cor: '#10b981', dept: 'conteudo' },
  { id: 12, iniciais: 'GV', x: 620,  y: 450,  cor: '#3b82f6', dept: 'comercial' },
  { id: 13, iniciais: 'TB', x: 695,  y: 520,  cor: '#3b82f6', dept: 'comercial' },
  { id: 14, iniciais: 'AN', x: 760,  y: 590,  cor: '#3b82f6', dept: 'comercial' },
  { id: 15, iniciais: 'CL', x: 620,  y: 650,  cor: '#3b82f6', dept: 'comercial' },
  { id: 16, iniciais: 'SG', x: 100,  y: 900,  cor: '#f59e0b', dept: 'conteudo' },
  { id: 17, iniciais: 'AI', x: 175,  y: 980,  cor: '#f59e0b', dept: 'marketing' },
  { id: 18, iniciais: 'PI', x: 100,  y: 1060, cor: '#f59e0b', dept: 'marketing' },
  { id: 19, iniciais: 'BI', x: 430,  y: 950,  cor: '#6b7280', dept: 'marketing' },
  { id: 20, iniciais: 'CR', x: 695,  y: 900,  cor: '#ef4444', dept: 'crm' },
  { id: 21, iniciais: 'CS', x: 760,  y: 980,  cor: '#ef4444', dept: 'crm' },
  { id: 22, iniciais: 'SD', x: 695,  y: 1060, cor: '#ef4444', dept: 'crm' },
  { id: 23, iniciais: 'GA', x: 320,  y: 1325, cor: '#10b981', dept: 'crm' },
  { id: 24, iniciais: 'AA', x: 430,  y: 1325, cor: '#10b981', dept: 'crm' },
  { id: 25, iniciais: 'AB', x: 140,  y: 1360, cor: '#10b981', dept: 'crm' },
]

const ATIVIDADES: Record<string, string[]> = {
  marketing: ['Criando copy...', 'Revisando anúncio...', 'Analisando métricas...', 'Briefing cliente...', 'Ajustando campanha...'],
  conteudo:  ['Editando vídeo...', 'Agendando post...', 'Gravando reel...', 'Criando thumbnail...', 'Publicando story...'],
  comercial: ['Qualificando lead...', 'Fechando proposta...', 'Follow-up...', 'Pipeline atualizado...', 'Reunião de vendas...'],
  crm:       ['Atendendo cliente...', 'Registrando contato...', 'SLA monitorado...', 'Triagem de leads...', 'Atualizando CRM...'],
  executivo: ['Revisando metas...', 'Aprovando estratégia...', 'Reunião diretoria...'],
}

const COR_STATUS: Record<string, string> = {
  critico: '#ef4444', quente: '#f97316', normal: '#10b981', frio: '#6b7280',
}
const COR_TIPO: Record<string, string> = {
  imobiliario: '#8b5cf6', reforma: '#f97316', produto_servico: '#38bdf8', fornecedor: '#10b981',
}
const FASE_LABEL: Record<string, string> = {
  entrada: 'Entrada', espera: 'Espera', qualificacao: 'Qualificação',
  apresentacao: 'Apresentação', negociacao: 'Negociação',
  fechamento: 'Fechamento', ganho: 'Ganho', perdido: 'Perdido',
}

function calcOpacidade(lead: Lead): number {
  if (lead.status_visual === 'critico' || lead.status_visual === 'quente') return 1
  if (lead.status_visual === 'frio') return 0.4
  if (!lead.valor_estimado || lead.score < 30) return 0.55
  return 0.85
}

function calcTamanho(lead: Lead): number {
  if (lead.score >= 70) return 36
  if (lead.score >= 40) return 30
  return 26
}

export default function MobileExperience() {
  const [aba, setAba] = useState(0)
  const [leads, setLeads] = useState<Lead[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [horaAtual, setHoraAtual] = useState('')
  const [leadDrawer, setLeadDrawer] = useState<Lead | null>(null)
  const [imgSize, setImgSize] = useState({ w: 430, h: 908 })
  const [agenteAtivo, setAgenteAtivo] = useState<{ id: number; texto: string } | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
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
        .select('id, numero_visual, fase, status_visual, score, valor_estimado, tipo, ia_ativa, sla_violado, hub_pessoas(nome, telefone)')
        .order('score', { ascending: false })
      const leadsData = (data as unknown as Lead[]) || []
      setLeads(leadsData)

      // Alertas reais baseados nos dados do banco
      const novosAlertas: Alerta[] = []
      leadsData.filter(l => l.status_visual === 'critico' || l.sla_violado).slice(0, 3).forEach(l => {
        novosAlertas.push({
          id: l.id,
          tipo: 'CRÍTICO',
          texto: `${l.hub_pessoas?.nome || 'Lead'} — ${FASE_LABEL[l.fase] || l.fase}${l.sla_violado ? ' · SLA violado' : ''}`,
          tempo: 'agora',
          cor: '#ef4444',
        })
      })
      leadsData.filter(l => l.status_visual === 'quente' && !l.sla_violado).slice(0, 2).forEach(l => {
        novosAlertas.push({
          id: `q-${l.id}`,
          tipo: 'AÇÃO',
          texto: `${l.hub_pessoas?.nome || 'Lead'} pronto para ${FASE_LABEL[l.fase] || l.fase}`,
          tempo: `score ${l.score}`,
          cor: '#f97316',
        })
      })
      if (novosAlertas.length === 0) {
        novosAlertas.push({ id: 'ok', tipo: 'INFO', texto: 'Todos os leads dentro do SLA', tempo: 'agora', cor: '#10b981' })
      }
      setAlertas(novosAlertas)
    }
    fetchLeads()
    const channel = supabase
      .channel('mobile_leads_v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hub_leads' }, fetchLeads)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Bolhas de atividade rotativas (somente na aba Escritório)
  useEffect(() => {
    if (aba !== 1) return
    const interval = setInterval(() => {
      const ag = AGENTES[Math.floor(Math.random() * AGENTES.length)]
      const frases = ATIVIDADES[ag.dept] || ATIVIDADES.marketing
      const texto = frases[Math.floor(Math.random() * frases.length)]
      setAgenteAtivo({ id: ag.id, texto })
      setTimeout(() => setAgenteAtivo(null), 3000)
    }, 4000)
    return () => clearInterval(interval)
  }, [aba])

  const onImgLoad = useCallback(() => {
    if (imgRef.current) setImgSize({ w: imgRef.current.offsetWidth, h: imgRef.current.offsetHeight })
  }, [])

  function toScreen(xOrig: number, yOrig: number) {
    return { x: (xOrig / IMG_W) * imgSize.w, y: (yOrig / IMG_H) * imgSize.h }
  }

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

  // Agrupar leads por fase para posicionamento organizado no mapa
  const leadsPorFase: Record<string, Lead[]> = {}
  leads.forEach(lead => {
    if (!leadsPorFase[lead.fase]) leadsPorFase[lead.fase] = []
    leadsPorFase[lead.fase].push(lead)
  })

  const criticos = leads.filter(l => l.status_visual === 'critico').length
  const valorTotal = leads.reduce((a, l) => a + (l.valor_estimado || 0), 0)
  const iaAtiva = leads.filter(l => l.ia_ativa).length

  return (
    <div
      style={{ width: '100%', height: '100dvh', background: '#080810', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'var(--font-geist-sans, system-ui)' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>obra10+</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Command Center</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {criticos > 0 && (
            <div style={{ background: '#ef444420', border: '1px solid #ef4444', borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px #ef4444' }} />
              {criticos} crítico{criticos > 1 ? 's' : ''}
            </div>
          )}
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>{horaAtual}</div>
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, overflow: 'hidden' }}>

        {/* ABA 0 — PULSO */}
        {aba === 0 && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '14px 16px 100px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[
                { label: 'Leads Ativos', value: leads.length, cor: '#fff', bg: 'rgba(255,255,255,0.05)' },
                { label: 'Críticos', value: criticos, cor: criticos > 0 ? '#ef4444' : '#10b981', bg: criticos > 0 ? '#ef444415' : '#10b98115' },
                { label: 'Receita em Jogo', value: `R$${(valorTotal / 1000).toFixed(0)}k`, cor: '#f97316', bg: '#f9731615' },
                { label: 'IA Ativa', value: `${iaAtiva}/${leads.length}`, cor: '#3b82f6', bg: '#3b82f615' },
              ].map(kpi => (
                <div key={kpi.label} style={{ background: kpi.bg, border: `1px solid ${kpi.cor}25`, borderRadius: 14, padding: '16px 14px' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{kpi.label}</div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: kpi.cor, letterSpacing: '-1px', lineHeight: 1 }}>{kpi.value}</div>
                </div>
              ))}
            </div>
            {criticos > 0 && (
              <div style={{ background: '#ef444410', border: '1px solid #ef444430', borderRadius: 14, padding: '14px', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>⚠ Atenção Imediata</div>
                {leads.filter(l => l.status_visual === 'critico').map(lead => (
                  <div key={lead.id} onClick={() => setLeadDrawer(lead)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#ef444420', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                      {lead.hub_pessoas?.nome?.[0] || '?'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{lead.hub_pessoas?.nome}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{FASE_LABEL[lead.fase]} · R${((lead.valor_estimado || 0) / 1000).toFixed(0)}k</div>
                    </div>
                    <span style={{ fontSize: 18, color: '#ef4444' }}>›</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Alertas em tempo real</div>
              {alertas.map((a, i) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingBottom: i < alertas.length - 1 ? 12 : 0, marginBottom: i < alertas.length - 1 ? 12 : 0, borderBottom: i < alertas.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: a.cor, marginTop: 5, flexShrink: 0, boxShadow: `0 0 6px ${a.cor}` }} />
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
          <div style={{ height: '100%', overflowY: 'auto', position: 'relative' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <img
                ref={imgRef}
                src="/sprites/office-mobile-bg.png"
                alt="Escritório Obra10+"
                onLoad={onImgLoad}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />

              {/* AGENTES nas mesas com breathe + bolha de atividade */}
              {imgSize.w > 100 && AGENTES.map(ag => {
                const pos = toScreen(ag.x, ag.y)
                const isAtivo = agenteAtivo?.id === ag.id
                return (
                  <div key={ag.id} style={{ position: 'absolute', left: pos.x, top: pos.y, transform: 'translate(-50%, -50%)', zIndex: 5 }}>
                    {isAtivo && (
                      <div style={{
                        position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
                        background: `${ag.cor}ee`, color: '#fff', fontSize: 8, fontWeight: 600,
                        padding: '3px 7px', borderRadius: 6, whiteSpace: 'nowrap', zIndex: 30,
                        boxShadow: `0 2px 8px ${ag.cor}60`, animation: 'fadeIn 0.2s ease',
                      }}>
                        {agenteAtivo.texto}
                      </div>
                    )}
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: `${ag.cor}30`, border: `1.5px solid ${ag.cor}80`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 7, fontWeight: 800, color: '#fff',
                      boxShadow: `0 0 6px ${ag.cor}40`,
                      animation: `breathe ${2 + (ag.id * 0.2) % 2}s ease-in-out infinite`,
                    }}>
                      {ag.iniciais}
                    </div>
                  </div>
                )
              })}

              {/* LEADS nas salas — agrupados por fase em grid organizado */}
              {imgSize.w > 100 && leads.map((lead) => {
                const spawn = FASE_SPAWN[lead.fase]
                if (!spawn) return null
                const pos = toScreen(spawn.x, spawn.y)
                const cor = COR_STATUS[lead.status_visual] || '#6b7280'
                const opacidade = calcOpacidade(lead)
                const tamanho = calcTamanho(lead)
                const grupoFase = leadsPorFase[lead.fase] || []
                const idxNoGrupo = grupoFase.indexOf(lead)
                const totalNoGrupo = grupoFase.length
                const colunas = Math.min(totalNoGrupo, 3)
                const col = idxNoGrupo % colunas
                const row = Math.floor(idxNoGrupo / colunas)
                const espacamento = 28
                const offsetX = (col - (colunas - 1) / 2) * espacamento
                const offsetY = row * espacamento
                return (
                  <div key={lead.id}>
                    {lead.status_visual === 'critico' && (
                      <div style={{
                        position: 'absolute',
                        left: pos.x + offsetX, top: pos.y + offsetY,
                        width: tamanho + 12, height: tamanho + 12,
                        borderRadius: '50%', border: '2px solid #ef4444',
                        animation: 'pulseRing 1.5s ease-out infinite',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 19, pointerEvents: 'none',
                      }} />
                    )}
                    <div
                      onClick={() => setLeadDrawer(lead)}
                      style={{
                        position: 'absolute',
                        left: pos.x + offsetX, top: pos.y + offsetY,
                        transform: 'translate(-50%, -50%)',
                        cursor: 'pointer', zIndex: 20,
                        opacity: opacidade,
                        filter: lead.status_visual === 'critico' ? 'drop-shadow(0 0 8px #ef4444)' : lead.status_visual === 'frio' ? 'grayscale(60%)' : 'none',
                        animation: `floatBubble ${2 + (idxNoGrupo * 0.3) % 2}s ease-in-out infinite`,
                      }}
                    >
                      <div style={{
                        width: tamanho, height: tamanho, borderRadius: '50%',
                        background: `${COR_TIPO[lead.tipo] || '#6b7280'}40`,
                        border: `2.5px solid ${cor}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: tamanho * 0.38, fontWeight: 800, color: '#fff',
                        boxShadow: `0 0 12px ${cor}60`, position: 'relative',
                      }}>
                        {lead.hub_pessoas?.nome?.[0] || '?'}
                        <div style={{
                          position: 'absolute', top: -5, right: -5,
                          width: 14, height: 14, borderRadius: '50%',
                          background: cor, border: '1.5px solid #080810',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 7, fontWeight: 800, color: '#fff',
                        }}>
                          {lead.numero_visual}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legenda fixa */}
            <div style={{
              position: 'fixed', bottom: 70, left: 12, right: 12,
              background: 'rgba(8,8,16,0.9)', backdropFilter: 'blur(10px)',
              borderRadius: 10, padding: '8px 14px',
              display: 'flex', gap: 14, justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.08)', zIndex: 50,
            }}>
              {[
                { cor: '#ef4444', label: 'Crítico' },
                { cor: '#f97316', label: 'Quente' },
                { cor: '#10b981', label: 'Normal' },
                { cor: '#6b7280', label: 'Frio' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.cor }} />
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA 2 — LEADS */}
        {aba === 2 && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '14px 16px 100px' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 14, textAlign: 'center' }}>
              {leads.length} leads · ordenados por urgência
            </div>
            {leads.map(lead => (
              <div key={lead.id} onClick={() => setLeadDrawer(lead)} style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${COR_STATUS[lead.status_visual]}30`,
                borderRadius: 14, padding: '14px', marginBottom: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
                opacity: calcOpacidade(lead),
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: `${COR_TIPO[lead.tipo] || '#6b7280'}20`,
                  border: `2px solid ${COR_STATUS[lead.status_visual] || '#6b7280'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 800, color: '#fff',
                }}>
                  {lead.hub_pessoas?.nome?.[0] || '?'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                    {lead.hub_pessoas?.nome || '—'}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: COR_STATUS[lead.status_visual], background: `${COR_STATUS[lead.status_visual]}18`, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                      {lead.status_visual.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{FASE_LABEL[lead.fase]}</span>
                    {!lead.ia_ativa && <span style={{ fontSize: 10, color: '#f59e0b', background: '#f59e0b18', padding: '2px 6px', borderRadius: 4 }}>IA OFF</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: lead.score >= 70 ? '#10b981' : lead.score >= 40 ? '#f59e0b' : '#6b7280' }}>
                    {lead.score}
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>score</div>
                  {lead.valor_estimado && (
                    <div style={{ fontSize: 11, color: '#f97316', marginTop: 2, fontWeight: 600 }}>
                      R${(lead.valor_estimado / 1000).toFixed(0)}k
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ABA 3 — FEED */}
        {aba === 3 && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '14px 16px 100px' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 14, textAlign: 'center' }}>Eventos em tempo real</div>
            {alertas.map((a, i) => (
              <div key={a.id} style={{ display: 'flex', gap: 14, paddingBottom: 20, marginBottom: 20, borderBottom: i < alertas.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${a.cor}20`, border: `2px solid ${a.cor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                    {a.tipo === 'CRÍTICO' ? '🚨' : a.tipo === 'AÇÃO' ? '⚡' : a.tipo === 'ALERTA' ? '⚠️' : 'ℹ️'}
                  </div>
                  {i < alertas.length - 1 && <div style={{ flex: 1, width: 1, background: 'rgba(255,255,255,0.06)', marginTop: 8 }} />}
                </div>
                <div style={{ paddingTop: 6 }}>
                  <div style={{ fontSize: 10, color: a.cor, fontWeight: 700, marginBottom: 4 }}>{a.tipo}</div>
                  <div style={{ fontSize: 15, color: '#fff', fontWeight: 500, lineHeight: 1.4, marginBottom: 4 }}>{a.texto}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{a.tempo}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Drawer do lead */}
      {leadDrawer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }} onClick={() => setLeadDrawer(null)}>
          <div style={{ width: '100%', background: '#0d0d1a', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, margin: '0 auto 20px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: `${COR_TIPO[leadDrawer.tipo] || '#6b7280'}25`, border: `2px solid ${COR_STATUS[leadDrawer.status_visual] || '#6b7280'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                {leadDrawer.hub_pessoas?.nome?.[0] || '?'}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{leadDrawer.hub_pessoas?.nome}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>#{leadDrawer.numero_visual} · {FASE_LABEL[leadDrawer.fase]}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Score', value: `${leadDrawer.score}pts`, cor: leadDrawer.score >= 70 ? '#10b981' : '#f59e0b' },
                { label: 'Status', value: leadDrawer.status_visual, cor: COR_STATUS[leadDrawer.status_visual] },
                { label: 'Valor', value: leadDrawer.valor_estimado ? `R$${(leadDrawer.valor_estimado / 1000).toFixed(0)}k` : '—', cor: '#f97316' },
              ].map(item => (
                <div key={item.label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '12px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: item.cor }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Link href="/crm/atendimento" style={{ flex: 1, textDecoration: 'none' }}>
                <div style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', borderRadius: 12, padding: '14px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                  💬 Atender agora
                </div>
              </Link>
              <Link href={`/crm/lead/${leadDrawer.id}`} style={{ flex: 1, textDecoration: 'none' }}>
                <div style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#fff' }}>
                  Lead 360 →
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Nav inferior */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(8,8,16,0.97)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', paddingBottom: 'env(safe-area-inset-bottom)', zIndex: 100 }}>
        {[
          { icone: '📊', label: 'Pulso' },
          { icone: '🏢', label: 'Escritório' },
          { icone: '👥', label: 'Leads' },
          { icone: '⚡', label: 'Feed' },
        ].map((item, i) => (
          <button key={i} onClick={() => { setAba(i); setLeadDrawer(null) }} style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '12px 4px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative' }}>
            {aba === i && <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 28, height: 2, borderRadius: 1, background: '#f97316' }} />}
            <span style={{ fontSize: 22 }}>{item.icone}</span>
            <span style={{ fontSize: 10, fontWeight: aba === i ? 700 : 400, color: aba === i ? '#f97316' : 'rgba(255,255,255,0.35)' }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
