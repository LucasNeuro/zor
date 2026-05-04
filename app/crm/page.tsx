'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

type Lead = {
  id: string
  numero_visual: number
  fase: string
  status_visual: string
  score: number
  valor_estimado: number | null
  ia_ativa: boolean
  tipo: string
  hub_pessoas: { nome: string } | null
}

const FASES = [
  { key: 'entrada', label: 'Entrada', cor: '#6b7280', icone: '🚪' },
  { key: 'espera', label: 'Espera', cor: '#8b5cf6', icone: '⏳' },
  { key: 'qualificacao', label: 'Qualificação', cor: '#3b82f6', icone: '🔍' },
  { key: 'apresentacao', label: 'Apresentação', cor: '#f59e0b', icone: '📊' },
  { key: 'negociacao', label: 'Negociação', cor: '#f97316', icone: '🤝' },
  { key: 'fechamento', label: 'Fechamento', cor: '#10b981', icone: '✅' },
]

const COR_STATUS: Record<string, string> = {
  critico: '#ef4444', quente: '#f97316', normal: '#10b981', frio: '#6b7280'
}

export default function CRMDashboard() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from('hub_leads')
        .select('id, numero_visual, fase, status_visual, score, valor_estimado, ia_ativa, tipo, hub_pessoas(nome)')
        .order('score', { ascending: false })
      setLeads((data as unknown as Lead[]) || [])
      setLoading(false)
    }
    fetchData()

    const channel = supabase.channel('crm_dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hub_leads' }, fetchData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const criticos = leads.filter(l => l.status_visual === 'critico').length
  const valorTotal = leads.reduce((a, l) => a + (l.valor_estimado || 0), 0)
  const iaPausada = leads.filter(l => !l.ia_ativa).length
  const quentes = leads.filter(l => l.status_visual === 'quente').length

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20, minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.5px' }}>Dashboard</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: '3px 0 0' }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Link href="/crm/atendimento" style={{
          background: 'linear-gradient(135deg, #f97316, #ea580c)',
          color: '#fff', padding: '10px 18px', borderRadius: 10,
          textDecoration: 'none', fontSize: 13, fontWeight: 700,
          boxShadow: '0 4px 20px rgba(249,115,22,0.3)',
        }}>
          Atendimento →
        </Link>
      </div>

      {/* Semáforos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { label: 'Críticos', value: criticos, cor: criticos > 0 ? '#ef4444' : '#10b981', desc: criticos > 0 ? 'requerem ação imediata' : 'tudo sob controle' },
          { label: 'Quentes', value: quentes, cor: '#f97316', desc: 'alto potencial' },
          { label: 'IA Pausada', value: iaPausada, cor: iaPausada > 0 ? '#f59e0b' : '#10b981', desc: 'atendimento manual' },
          { label: 'Total', value: leads.length, cor: '#3b82f6', desc: 'leads no funil' },
        ].map(s => (
          <div key={s.label} style={{
            background: `${s.cor}10`,
            border: `1px solid ${s.cor}30`,
            borderRadius: 14, padding: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: s.cor, boxShadow: `0 0 8px ${s.cor}`,
              }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: s.cor, letterSpacing: '-2px', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>{s.desc}</div>
          </div>
        ))}
      </div>

      {/* Valor total */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(249,115,22,0.1), rgba(234,88,12,0.05))',
        border: '1px solid rgba(249,115,22,0.2)',
        borderRadius: 14, padding: '20px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>RECEITA EM JOGO</div>
          <div style={{ fontSize: 40, fontWeight: 800, color: '#f97316', letterSpacing: '-2px' }}>
            R$ {valorTotal.toLocaleString('pt-BR')}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>valor estimado total dos leads ativos</div>
        </div>
        <div style={{ fontSize: 60, opacity: 0.15 }}>💰</div>
      </div>

      {/* Funil ao vivo */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Funil ao Vivo
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {FASES.map(f => {
            const fLeads = leads.filter(l => l.fase === f.key)
            const pct = leads.length > 0 ? (fLeads.length / leads.length) * 100 : 0
            const valor = fLeads.reduce((a, l) => a + (l.valor_estimado || 0), 0)
            return (
              <div key={f.key} style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10, padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{ fontSize: 16, width: 24 }}>{f.icone}</span>
                <span style={{ fontSize: 13, color: '#fff', fontWeight: 500, width: 110 }}>{f.label}</span>
                <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: f.cor, borderRadius: 2, transition: 'width 0.6s ease' }} />
                </div>
                <span style={{ fontSize: 15, fontWeight: 800, color: fLeads.length > 0 ? '#fff' : 'rgba(255,255,255,0.2)', width: 24, textAlign: 'right' }}>{fLeads.length}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', width: 72, textAlign: 'right' }}>
                  {valor > 0 ? `R$${(valor/1000).toFixed(0)}k` : '—'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Lista de leads */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Leads por Urgência
        </div>
        {loading ? (
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13, padding: '20px 0' }}>Carregando...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {leads.map(lead => {
              const fase = FASES.find(f => f.key === lead.fase)
              return (
                <Link key={lead.id} href={`/crm/lead/${lead.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${lead.status_visual === 'critico' ? '#ef444430' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 10, padding: '12px 16px',
                    display: 'flex', alignItems: 'center', gap: 12,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  >
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: COR_STATUS[lead.status_visual] || '#6b7280',
                      boxShadow: lead.status_visual === 'critico' ? `0 0 8px #ef4444` : 'none',
                    }} />
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', width: 32, fontWeight: 600 }}>#{lead.numero_visual}</span>
                    <span style={{ flex: 1, fontSize: 13, color: '#fff', fontWeight: 500 }}>{lead.hub_pessoas?.nome || '—'}</span>
                    <span style={{
                      fontSize: 11, color: fase?.cor || '#fff',
                      background: `${fase?.cor}18`, padding: '2px 8px', borderRadius: 4, fontWeight: 500,
                    }}>{fase?.label || lead.fase}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', width: 72, textAlign: 'right' }}>
                      {lead.valor_estimado ? `R$${(lead.valor_estimado/1000).toFixed(0)}k` : '—'}
                    </span>
                    <span style={{
                      fontSize: 13, fontWeight: 800, width: 36, textAlign: 'right',
                      color: lead.score >= 70 ? '#10b981' : lead.score >= 40 ? '#f59e0b' : '#6b7280',
                    }}>{lead.score}</span>
                    {!lead.ia_ativa && (
                      <span style={{ fontSize: 10, color: '#f59e0b', background: '#f59e0b18', padding: '2px 6px', borderRadius: 4 }}>IA OFF</span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
