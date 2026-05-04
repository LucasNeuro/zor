import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, HubLead } from '@/lib/supabase/client'

export type LeadComPessoa = HubLead & {
  hub_pessoas: {
    nome: string
    telefone: string | null
    email: string | null
    whatsapp_id: string | null
  }
}

export function useSupabaseLeads() {
  const [leads, setLeads] = useState<LeadComPessoa[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [realtimeAtivo, setRealtimeAtivo] = useState(false)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const fetchLeads = useCallback(async () => {
    try {
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('hub_leads')
        .select(`*, hub_pessoas (nome, telefone, email, whatsapp_id)`)
        .order('numero_visual', { ascending: true })
      if (fetchError) throw fetchError
      setLeads((data as LeadComPessoa[]) || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar leads'
      setError(message)
      console.error('[useSupabaseLeads] Erro ao buscar:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeads()

    const channel = supabase
      .channel('hub_leads_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hub_leads' }, () => {
        fetchLeads()
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useSupabaseLeads] Realtime ativo')
          setRealtimeAtivo(true)
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.log('[useSupabaseLeads] Realtime indisponível, usando polling')
          setRealtimeAtivo(false)
          if (!pollingRef.current) {
            pollingRef.current = setInterval(() => {
              fetchLeads()
            }, 5000)
          }
        }
      })

    return () => {
      supabase.removeChannel(channel)
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [fetchLeads])

  const avancarFase = useCallback(async (leadId: string, novaFase: HubLead['fase'], novaSala: string) => {
    const { error: updateError } = await supabase
      .from('hub_leads')
      .update({ fase: novaFase, sala_canvas: novaSala, atualizado_em: new Date().toISOString() })
      .eq('id', leadId)
    if (updateError) throw updateError
    fetchLeads()
  }, [fetchLeads])

  const atualizarPosicao = useCallback(async (leadId: string, x: number, y: number) => {
    const { error: updateError } = await supabase
      .from('hub_leads')
      .update({ posicao_x: x, posicao_y: y, atualizado_em: new Date().toISOString() })
      .eq('id', leadId)
    if (updateError) throw updateError
  }, [])

  const toggleIA = useCallback(async (leadId: string, ativa: boolean, motivo?: string) => {
    const { error: updateError } = await supabase
      .from('hub_leads')
      .update({
        ia_ativa: ativa,
        ia_pausada_motivo: ativa ? null : (motivo || 'Pausada manualmente'),
        ia_pausada_em: ativa ? null : new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', leadId)
    if (updateError) throw updateError
    fetchLeads()
  }, [fetchLeads])

  return { leads, loading, error, realtimeAtivo, refetch: fetchLeads, avancarFase, atualizarPosicao, toggleIA }
}
