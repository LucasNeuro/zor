'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

type Parceiro = {
  id: string
  codigo: string
  especialidade: string
  status_homologacao: string
  transparency_score: number
  performance_score: number
  fit_score: number
  disponivel: boolean
  leads_ativos: number
  capacidade_leads: number
  hub_pessoas: { nome: string; cidade: string | null; estado: string | null } | null
}

const STATUS_COR: Record<string, string> = {
  aprovado: '#10b981', pendente: '#f59e0b',
  documentacao: '#3b82f6', entrevista: '#8b5cf6',
  suspenso: '#ef4444', reprovado: '#6b7280',
}

export default function Parceiros() {
  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from('hub_parceiros')
        .select('*, hub_pessoas(nome, cidade, estado)')
        .order('transparency_score', { ascending: false })
      setParceiros((data as unknown as Parceiro[]) || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>Parceiros</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: '4px 0 0' }}>
            Rede homologada · {parceiros.length} parceiros
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: 40 }}>Carregando...</div>
      ) : parceiros.length === 0 ? (
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12, padding: '40px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🤝</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
            Nenhum parceiro cadastrado ainda.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {parceiros.map(p => (
            <div key={p.id} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12, padding: '18px',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'rgba(16,185,129,0.15)',
                  border: '2px solid rgba(16,185,129,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, color: '#fff',
                }}>
                  {p.hub_pessoas?.nome?.[0] || '?'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{p.hub_pessoas?.nome || '—'}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{p.especialidade}</div>
                </div>
                <div style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 4, fontWeight: 600,
                  color: STATUS_COR[p.status_homologacao] || '#6b7280',
                  background: `${STATUS_COR[p.status_homologacao] || '#6b7280'}18`,
                }}>
                  {p.status_homologacao}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { label: 'Transparência', val: p.transparency_score },
                  { label: 'Performance', val: p.performance_score },
                  { label: 'Fit', val: p.fit_score },
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{
                      fontSize: 18, fontWeight: 700,
                      color: s.val >= 80 ? '#10b981' : s.val >= 50 ? '#f59e0b' : '#ef4444',
                    }}>{s.val}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 6, padding: '8px 10px',
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: p.disponivel ? '#10b981' : '#ef4444',
                }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                  {p.disponivel ? 'Disponível' : 'Indisponível'} · {p.leads_ativos}/{p.capacidade_leads} leads
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
