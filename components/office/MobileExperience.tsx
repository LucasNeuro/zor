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
  hub_pessoas: { nome: string; telefone: string | null } | null
}

type Mensagem = {
  id: string
  remetente: string
  conteudo: string | null
  enviada_em: string
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
  { id: 1,  nome: 'Dir. Marketing', iniciais: 'DM', x: 167, y: 185, cor: '#8b5cf6', area: 'Diretoria', atividades: ['Revisando estratégia...','Aprovando campanha...','Em reunião executiva...'] },
  { id: 2,  nome: 'CEO',            iniciais: 'CE', x: 432, y: 185, cor: '#f97316', area: 'Diretoria', atividades: ['Analisando KPIs...','Tomando decisão...','Revisando metas...'] },
  { id: 3,  nome: 'Dir. Comercial', iniciais: 'DC', x: 700, y: 185, cor: '#3b82f6', area: 'Diretoria', atividades: ['Monitorando funil...','Aprovando proposta...','Revisando pipeline...'] },
  { id: 4,  nome: 'Ger. Marketing', iniciais: 'GM', x: 100, y: 450, cor: '#8b5cf6', area: 'Marketing', atividades: ['Criando briefing...','Revisando copy...','Planejando campanha...'] },
  { id: 5,  nome: 'Copywriter',     iniciais: 'CW', x: 160, y: 520, cor: '#8b5cf6', area: 'Marketing', atividades: ['Escrevendo copy...','Criando CTA...','Revisando roteiro...'] },
  { id: 6,  nome: 'Designer',       iniciais: 'DS', x: 220, y: 590, cor: '#8b5cf6', area: 'Marketing', atividades: ['Criando criativo...','Ajustando layout...','Exportando arte...'] },
  { id: 7,  nome: 'Social Media',   iniciais: 'SM', x: 100, y: 650, cor: '#8b5cf6', area: 'Marketing', atividades: ['Agendando post...','Respondendo DM...','Analisando alcance...'] },
  { id: 8,  nome: 'Motion IA',      iniciais: 'MI', x: 360, y: 450, cor: '#10b981', area: 'Conteúdo', atividades: ['Gravando reel...','Editando vídeo...','Criando animação...'] },
  { id: 9,  nome: 'Copy Gamma',     iniciais: 'CG', x: 435, y: 520, cor: '#10b981', area: 'Conteúdo', atividades: ['Criando legenda...','Revisando texto...','Gerando variações...'] },
  { id: 10, nome: 'Design Beta',    iniciais: 'DB', x: 500, y: 590, cor: '#10b981', area: 'Conteúdo', atividades: ['Desenvolvendo arte...','Criando thumbnail...','Ajustando cores...'] },
  { id: 11, nome: 'Copy Beta',      iniciais: 'CB', x: 360, y: 650, cor: '#10b981', area: 'Conteúdo', atividades: ['Escrevendo roteiro...','Criando headline...','Testando variação...'] },
  { id: 12, nome: 'Ger. Vendas',    iniciais: 'GV', x: 620, y: 450, cor: '#3b82f6', area: 'Comercial', atividades: ['Gerenciando pipeline...','Treinando SDR...','Revisando proposta...'] },
  { id: 13, nome: 'Tráfego B',      iniciais: 'TB', x: 695, y: 520, cor: '#3b82f6', area: 'Comercial', atividades: ['Ajustando lances...','Testando público...','Analisando CPL...'] },
  { id: 14, nome: 'Analytics',      iniciais: 'AN', x: 760, y: 590, cor: '#3b82f6', area: 'Comercial', atividades: ['Analisando dados...','Gerando relatório...','Identificando padrão...'] },
  { id: 15, nome: 'Closer',         iniciais: 'CL', x: 620, y: 650, cor: '#3b82f6', area: 'Comercial', atividades: ['Fechando proposta...','Negociando contrato...','Follow-up ativo...'] },
  { id: 16, nome: 'Social Ga.',     iniciais: 'SG', x: 100, y: 900, cor: '#f59e0b', area: 'Social', atividades: ['Criando stories...','Analisando engajamento...','Respondendo comentários...'] },
  { id: 17, nome: 'Agenda IA',      iniciais: 'AI', x: 175, y: 980, cor: '#f59e0b', area: 'Social', atividades: ['Organizando calendário...','Agendando conteúdo...','Planejando semana...'] },
  { id: 18, nome: 'Plano IA',       iniciais: 'PI', x: 100, y: 1060, cor: '#f59e0b', area: 'Social', atividades: ['Criando plano...','Definindo estratégia...','Mapeando conteúdo...'] },
  { id: 19, nome: 'Brief IA',       iniciais: 'BI', x: 430, y: 950, cor: '#6b7280', area: 'Reunião', atividades: ['Coletando briefing...','Em reunião...','Documentando...'] },
  { id: 20, nome: 'CRM IA',         iniciais: 'CR', x: 695, y: 900, cor: '#ef4444', area: 'CRM', atividades: ['Monitorando leads...','Atualizando CRM...','Analisando funil...'] },
  { id: 21, nome: 'CS',             iniciais: 'CS', x: 760, y: 980, cor: '#ef4444', area: 'CRM', atividades: ['Atendendo cliente...','Registrando contato...','Verificando SLA...'] },
  { id: 22, nome: 'SDR',            iniciais: 'SD', x: 695, y: 1060, cor: '#ef4444', area: 'CRM', atividades: ['Qualificando lead...','Fazendo follow-up...','Agendando reunião...'] },
  { id: 23, nome: 'Ger. Atend.',    iniciais: 'GA', x: 320, y: 1325, cor: '#10b981', area: 'Atendimento', atividades: ['Monitorando qualidade...','Verificando SLA...','Orientando equipe...'] },
  { id: 24, nome: 'Atendente',      iniciais: 'AA', x: 430, y: 1325, cor: '#10b981', area: 'Atendimento', atividades: ['Atendendo lead...','Coletando dados...','Encaminhando...'] },
  { id: 25, nome: 'Atendente B',    iniciais: 'AB', x: 140, y: 1360, cor: '#10b981', area: 'Atendimento', atividades: ['Respondendo WhatsApp...','Qualificando...','Registrando dados...'] },
]

const CAMPANHAS_MOCK = [
  { nome: 'Meta Ads — Reforma SP', cpl: 89, meta_cpl: 60, budget_usado: 4200, budget_total: 6000, roas: 2.4, status: 'ativo', criativo: 'Video Depoimento #3' },
  { nome: 'Google — Imobiliário', cpl: 54, meta_cpl: 60, budget_usado: 2100, budget_total: 3000, roas: 3.1, status: 'ativo', criativo: 'Banner Apartamento' },
  { nome: 'Meta — Produto/Serviço', cpl: 72, meta_cpl: 60, budget_usado: 1800, budget_total: 2000, roas: 1.8, status: 'atencao', criativo: 'Carrossel Serviços' },
]

const CRIATIVOS_MOCK = [
  { titulo: 'Video Depoimento Cliente', status: 'em_producao', responsavel: 'Motion IA', prazo: 'Hoje 18h', tipo: 'video' },
  { titulo: 'Copy Black Friday Reforma', status: 'revisao', responsavel: 'Copywriter', prazo: 'Amanhã', tipo: 'copy' },
  { titulo: 'Arte Stories Imobiliário', status: 'aprovado', responsavel: 'Designer', prazo: 'Concluído', tipo: 'arte' },
  { titulo: 'Roteiro Reel Antes/Depois', status: 'briefing', responsavel: 'Copy Gamma', prazo: 'Sex 18h', tipo: 'roteiro' },
]

const COR_STATUS: Record<string, string> = {
  critico: '#ef4444', quente: '#f97316', normal: '#10b981', frio: '#6b7280',
}
const COR_TIPO: Record<string, string> = {
  imobiliario: '#8b5cf6', reforma: '#f97316',
  produto_servico: '#38bdf8', fornecedor: '#10b981',
}
const FASE_LABEL: Record<string, string> = {
  entrada: 'Entrada', espera: 'Espera', qualificacao: 'Qualificação',
  apresentacao: 'Apresentação', negociacao: 'Negociação',
  fechamento: 'Fechamento', ganho: 'Ganho', perdido: 'Perdido',
}
const STATUS_CRIATIVO: Record<string, { label: string; cor: string }> = {
  em_producao: { label: 'Em Produção', cor: '#f59e0b' },
  revisao: { label: 'Em Revisão', cor: '#3b82f6' },
  aprovado: { label: 'Aprovado', cor: '#10b981' },
  briefing: { label: 'Briefing', cor: '#6b7280' },
}

function calcOpacidade(lead: Lead): number {
  if (lead.status_visual === 'critico') return 1
  if (lead.status_visual === 'quente') return 1
  if (lead.status_visual === 'frio') return 0.4
  if (!lead.valor_estimado) return 0.6
  if (lead.score < 30) return 0.5
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
  const [alertas, setAlertas] = useState<{id:string;tipo:string;texto:string;tempo:string;cor:string}[]>([])
  const [horaAtual, setHoraAtual] = useState('')
  const [leadDrawer, setLeadDrawer] = useState<Lead | null>(null)
  const [agenteDrawer, setAgenteDrawer] = useState<typeof AGENTES[0] | null>(null)
  const [imgSize, setImgSize] = useState({ w: 430, h: 908 })
  const [bolhaAtiva, setBolhaAtiva] = useState<number | null>(null)
  const [bolhaTexto, setBolhaTexto] = useState('')
  const [leadAtend, setLeadAtend] = useState<Lead | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [texto, setTexto] = useState('')
  const [convId, setConvId] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Relógio
  useEffect(() => {
    const tick = () => setHoraAtual(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  // Leads do Supabase
  useEffect(() => {
    async function fetchLeads() {
      const { data } = await supabase
        .from('hub_leads')
        .select('id, numero_visual, fase, status_visual, score, valor_estimado, tipo, ia_ativa, hub_pessoas(nome, telefone)')
        .order('score', { ascending: false })
      setLeads((data as unknown as Lead[]) || [])
    }
    fetchLeads()
    const channel = supabase
      .channel('mobile_leads_v4')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hub_leads' }, fetchLeads)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Alertas do Supabase
  useEffect(() => {
    async function fetchAlertas() {
      const { data: decisoes } = await supabase
        .from('hub_decisoes')
        .select('id, titulo, severidade, criado_em')
        .eq('status', 'pendente')
        .order('criado_em', { ascending: false })
        .limit(3)

      const { data: slaLeads } = await supabase
        .from('hub_leads')
        .select('id, numero_visual, sla_violado, hub_pessoas(nome)')
        .eq('sla_violado', true)
        .limit(2)

      const lista: {id:string;tipo:string;texto:string;tempo:string;cor:string}[] = []

      if (decisoes) {
        decisoes.forEach((d: any) => {
          lista.push({
            id: d.id,
            tipo: d.severidade === 'critico' ? 'CRÍTICO' : 'ATENÇÃO',
            texto: d.titulo,
            tempo: 'agora',
            cor: d.severidade === 'critico' ? '#ef4444' : '#f59e0b',
          })
        })
      }

      if (slaLeads) {
        slaLeads.forEach((l: any) => {
          lista.push({
            id: l.id,
            tipo: 'SLA',
            texto: `${l.hub_pessoas?.nome} — SLA violado`,
            tempo: 'urgente',
            cor: '#ef4444',
          })
        })
      }

      if (lista.length === 0) {
        lista.push(
          { id: '1', tipo: 'INFO', texto: 'Budget Meta Ads 85% utilizado', tempo: '12min', cor: '#f59e0b' },
          { id: '2', tipo: 'INFO', texto: 'Sistema operando normalmente', tempo: '30min', cor: '#10b981' },
        )
      }

      setAlertas(lista)
    }
    fetchAlertas()
  }, [leads])

  // Bolhas de atividade dos agentes
  useEffect(() => {
    if (aba !== 1) return
    const interval = setInterval(() => {
      const ag = AGENTES[Math.floor(Math.random() * AGENTES.length)]
      const texto = ag.atividades[Math.floor(Math.random() * ag.atividades.length)]
      setBolhaAtiva(ag.id)
      setBolhaTexto(texto)
      setTimeout(() => setBolhaAtiva(null), 3000)
    }, 4000)
    return () => clearInterval(interval)
  }, [aba])

  const onImgLoad = useCallback(() => {
    if (imgRef.current) {
      setImgSize({ w: imgRef.current.offsetWidth, h: imgRef.current.offsetHeight })
    }
  }, [])

  function toScreen(xOrig: number, yOrig: number) {
    return {
      x: (xOrig / IMG_W) * imgSize.w,
      y: (yOrig / IMG_H) * imgSize.h,
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current)
    if (Math.abs(dx) > 60 && dy < 50) {
      if (dx < 0 && aba < 4) setAba(aba + 1)
      if (dx > 0 && aba > 0) setAba(aba - 1)
    }
  }

  async function selecionarLeadAtend(lead: Lead) {
    setLeadAtend(lead)
    setMensagens([])
    const { data: convs } = await supabase.from('hub_conversas').select('id').eq('lead_id', lead.id).order('aberta_em', { ascending: false }).limit(1)
    let cId: string | null = null
    if (convs && convs.length > 0) {
      cId = convs[0].id
    } else {
      const { data: nova } = await supabase.from('hub_conversas').insert({ lead_id: lead.id, pessoa_id: lead.id, canal: 'interno', status: 'ativa' }).select('id').single()
      cId = nova?.id || null
    }
    setConvId(cId)
    if (cId) {
      const { data: msgs } = await supabase.from('hub_mensagens').select('id, remetente, conteudo, enviada_em').eq('conversa_id', cId).order('enviada_em')
      setMensagens((msgs as Mensagem[]) || [])
    }
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function enviarMensagem() {
    if (!texto.trim() || !leadAtend || !convId) return
    const { data } = await supabase.from('hub_mensagens').insert({ conversa_id: convId, lead_id: leadAtend.id, pessoa_id: leadAtend.id, remetente: 'agente', tipo_conteudo: 'texto', conteudo: texto }).select('id, remetente, conteudo, enviada_em').single()
    if (data) setMensagens(p => [...p, data as Mensagem])
    setTexto('')
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const criticos = leads.filter(l => l.status_visual === 'critico').length
  const valorTotal = leads.reduce((a, l) => a + (l.valor_estimado || 0), 0)
  const iaAtiva = leads.filter(l => l.ia_ativa).length

  const leadsPorFase: Record<string, Lead[]> = {}
  leads.forEach(lead => {
    if (!leadsPorFase[lead.fase]) leadsPorFase[lead.fase] = []
    leadsPorFase[lead.fase].push(lead)
  })

  const ABAS = [
    { icone: '📊', label: 'Pulso' },
    { icone: '🏢', label: 'Escritório' },
    { icone: '💬', label: 'Atendimento' },
    { icone: '📣', label: 'Marketing' },
    { icone: '⚡', label: 'Feed' },
  ]

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
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
            {ABAS[aba].label}
          </div>
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
                  <div key={lead.id} onClick={() => { setLeadAtend(lead); setAba(2) }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#ef444420', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                      {lead.hub_pessoas?.nome?.[0] || '?'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{lead.hub_pessoas?.nome}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{FASE_LABEL[lead.fase]} · R${((lead.valor_estimado || 0) / 1000).toFixed(0)}k</div>
                    </div>
                    <span style={{ fontSize: 16, color: '#ef4444' }}>Atender →</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Funil ao Vivo</div>
              {['entrada','espera','qualificacao','apresentacao','negociacao','fechamento'].map(fase => {
                const count = (leadsPorFase[fase] || []).length
                const valor = (leadsPorFase[fase] || []).reduce((a, l) => a + (l.valor_estimado || 0), 0)
                return (
                  <div key={fase} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: count > 0 ? '#f97316' : 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: count > 0 ? '#fff' : 'rgba(255,255,255,0.3)', flex: 1 }}>{FASE_LABEL[fase]}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: count > 0 ? '#fff' : 'rgba(255,255,255,0.2)', width: 20, textAlign: 'right' }}>{count}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', width: 60, textAlign: 'right' }}>{valor > 0 ? `R$${(valor/1000).toFixed(0)}k` : '—'}</span>
                  </div>
                )
              })}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Alertas</div>
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

              {/* AGENTES */}
              {imgSize.w > 100 && AGENTES.map(ag => {
                const pos = toScreen(ag.x, ag.y)
                const temBolha = bolhaAtiva === ag.id
                return (
                  <div key={ag.id} onClick={() => setAgenteDrawer(ag)} style={{ position: 'absolute', left: pos.x, top: pos.y, transform: 'translate(-50%, -50%)', zIndex: 5, cursor: 'pointer' }}>
                    {temBolha && (
                      <div style={{
                        position: 'absolute', bottom: '100%', left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(8,8,16,0.92)', border: `1px solid ${ag.cor}60`,
                        borderRadius: 6, padding: '3px 7px', whiteSpace: 'nowrap',
                        fontSize: 8, color: '#fff', marginBottom: 4, zIndex: 30,
                      }}>
                        {bolhaTexto}
                      </div>
                    )}
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: `${ag.cor}30`,
                      border: `1.5px solid ${ag.cor}${temBolha ? 'ff' : '80'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 7, fontWeight: 800, color: '#fff',
                      boxShadow: temBolha ? `0 0 10px ${ag.cor}` : `0 0 4px ${ag.cor}40`,
                      transition: 'all 0.3s ease',
                    }}>
                      {ag.iniciais}
                    </div>
                  </div>
                )
              })}

              {/* LEADS */}
              {imgSize.w > 100 && leads.map((lead) => {
                const spawn = FASE_SPAWN[lead.fase]
                if (!spawn) return null
                const grupoFase = leadsPorFase[lead.fase] || []
                const idxNoGrupo = grupoFase.indexOf(lead)
                const totalNoGrupo = grupoFase.length
                const colunas = Math.min(totalNoGrupo, 3)
                const col = idxNoGrupo % colunas
                const row = Math.floor(idxNoGrupo / colunas)
                const offsetX = (col - (colunas - 1) / 2) * 28
                const offsetY = row * 28
                const pos = toScreen(spawn.x + offsetX, spawn.y + offsetY)
                const cor = COR_STATUS[lead.status_visual] || '#6b7280'
                const tamanho = calcTamanho(lead)
                return (
                  <div key={lead.id} onClick={() => setLeadDrawer(lead)} style={{
                    position: 'absolute', left: pos.x, top: pos.y,
                    transform: 'translate(-50%, -50%)', cursor: 'pointer', zIndex: 20,
                    opacity: calcOpacidade(lead),
                    filter: lead.status_visual === 'critico' ? 'drop-shadow(0 0 8px #ef4444)' : lead.status_visual === 'frio' ? 'grayscale(60%)' : 'none',
                  }}>
                    {lead.status_visual === 'critico' && (
                      <div style={{
                        position: 'absolute', left: '50%', top: '50%',
                        width: tamanho + 14, height: tamanho + 14,
                        border: '2px solid #ef4444', borderRadius: '50%',
                        animation: 'pulseRing 1.5s ease-out infinite',
                      }} />
                    )}
                    <div style={{
                      width: tamanho, height: tamanho, borderRadius: '50%',
                      background: `${COR_TIPO[lead.tipo] || '#6b7280'}40`,
                      border: `2.5px solid ${cor}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: tamanho * 0.38, fontWeight: 800, color: '#fff',
                      boxShadow: `0 0 12px ${cor}60`, position: 'relative',
                      animation: `floatBubble ${2.5 + lead.numero_visual * 0.3}s ease-in-out infinite`,
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
                )
              })}
            </div>

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

        {/* ABA 2 — ATENDIMENTO */}
        {aba === 2 && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {leadAtend ? (
              <>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => setLeadAtend(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: `${COR_STATUS[leadAtend.status_visual]}20`, border: `2px solid ${COR_STATUS[leadAtend.status_visual]}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {leadAtend.hub_pessoas?.nome?.[0] || '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{leadAtend.hub_pessoas?.nome}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{FASE_LABEL[leadAtend.fase]} · score {leadAtend.score}</div>
                  </div>
                  <Link href={`/crm/lead/${leadAtend.id}`} style={{ fontSize: 11, color: '#f97316', textDecoration: 'none', background: 'rgba(249,115,22,0.1)', padding: '5px 10px', borderRadius: 6 }}>
                    360 →
                  </Link>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {mensagens.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13, marginTop: 40 }}>Nenhuma mensagem ainda.</div>
                  ) : mensagens.map(msg => {
                    const isAgente = msg.remetente === 'agente' || msg.remetente === 'ia'
                    return (
                      <div key={msg.id} style={{ display: 'flex', justifyContent: isAgente ? 'flex-end' : 'flex-start' }}>
                        <div style={{ maxWidth: '75%', background: isAgente ? 'linear-gradient(135deg, #f97316, #ea580c)' : 'rgba(255,255,255,0.08)', borderRadius: isAgente ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: '10px 14px', fontSize: 13, color: '#fff', lineHeight: 1.5 }}>
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
                <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8 }}>
                  <input
                    value={texto}
                    onChange={e => setTexto(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && enviarMensagem()}
                    placeholder="Digite uma mensagem..."
                    style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none' }}
                  />
                  <button onClick={enviarMensagem} style={{ background: texto.trim() ? 'linear-gradient(135deg, #f97316, #ea580c)' : 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 10, padding: '10px 16px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    →
                  </button>
                </div>
              </>
            ) : (
              <div style={{ height: '100%', overflowY: 'auto', padding: '14px 16px 100px' }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 14, textAlign: 'center' }}>
                  {leads.length} conversas · toque para atender
                </div>
                {leads.map(lead => (
                  <div key={lead.id} onClick={() => selecionarLeadAtend(lead)} style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${COR_STATUS[lead.status_visual]}30`,
                    borderRadius: 14, padding: '14px', marginBottom: 10, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${COR_TIPO[lead.tipo] || '#6b7280'}20`, border: `2px solid ${COR_STATUS[lead.status_visual]}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                      {lead.hub_pessoas?.nome?.[0] || '?'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{lead.hub_pessoas?.nome || '—'}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span style={{ fontSize: 10, color: COR_STATUS[lead.status_visual], background: `${COR_STATUS[lead.status_visual]}18`, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>{lead.status_visual.toUpperCase()}</span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{FASE_LABEL[lead.fase]}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: lead.score >= 70 ? '#10b981' : lead.score >= 40 ? '#f59e0b' : '#6b7280' }}>{lead.score}</div>
                      {lead.valor_estimado && <div style={{ fontSize: 11, color: '#f97316', fontWeight: 600 }}>R${(lead.valor_estimado/1000).toFixed(0)}k</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA 3 — MARKETING */}
        {aba === 3 && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '14px 16px 100px' }}>

            {/* KPIs Marketing */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'CPL Médio', value: 'R$76', meta: 'meta R$60', cor: '#ef4444', ok: false },
                { label: 'Leads/Dia', value: '62', meta: '+24% hoje', cor: '#10b981', ok: true },
                { label: 'Taxa Qualif.', value: '38%', meta: 'meta 45%', cor: '#f59e0b', ok: false },
                { label: 'ROAS Médio', value: '2.4x', meta: 'meta 3x', cor: '#f59e0b', ok: false },
              ].map(kpi => (
                <div key={kpi.label} style={{ background: kpi.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.06)', border: `1px solid ${kpi.cor}25`, borderRadius: 12, padding: '14px' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{kpi.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: kpi.cor, letterSpacing: '-1px' }}>{kpi.value}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{kpi.meta}</div>
                </div>
              ))}
            </div>

            {/* Campanhas */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Campanhas Ativas</div>
              {CAMPANHAS_MOCK.map((camp, i) => {
                const pctBudget = (camp.budget_usado / camp.budget_total) * 100
                const corBudget = pctBudget > 85 ? '#ef4444' : pctBudget > 70 ? '#f59e0b' : '#10b981'
                const corCpl = camp.cpl > camp.meta_cpl ? '#ef4444' : '#10b981'
                return (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', flex: 1, marginRight: 8 }}>{camp.nome}</div>
                      <span style={{ fontSize: 10, color: camp.status === 'ativo' ? '#10b981' : '#f59e0b', background: camp.status === 'ativo' ? '#10b98118' : '#f59e0b18', padding: '2px 8px', borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>
                        {camp.status === 'ativo' ? 'ATIVO' : 'ATENÇÃO'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>CPL</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: corCpl }}>R${camp.cpl}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>ROAS</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{camp.roas}x</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>Budget R${camp.budget_usado.toLocaleString()} / R${camp.budget_total.toLocaleString()}</div>
                        <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pctBudget}%`, background: corBudget, borderRadius: 3 }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>🎨 {camp.criativo}</div>
                  </div>
                )
              })}
            </div>

            {/* Criativos e Copies */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Criativos & Copies</div>
              {CRIATIVOS_MOCK.map((c, i) => {
                const statusInfo = STATUS_CRIATIVO[c.status]
                const icone = c.tipo === 'video' ? '🎬' : c.tipo === 'copy' ? '✍️' : c.tipo === 'arte' ? '🎨' : '📝'
                return (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 12, opacity: c.status === 'aprovado' ? 0.6 : 1 }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{icone}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{c.titulo}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{c.responsavel} · {c.prazo}</div>
                    </div>
                    <span style={{ fontSize: 10, color: statusInfo.cor, background: `${statusInfo.cor}18`, padding: '3px 8px', borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>
                      {statusInfo.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ABA 4 — FEED */}
        {aba === 4 && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '14px 16px 100px' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 14, textAlign: 'center' }}>Eventos em tempo real</div>
            {[
              ...alertas.map(a => ({ ...a, icone: a.tipo === 'CRÍTICO' ? '🚨' : a.tipo === 'AÇÃO' ? '⚡' : a.tipo === 'SLA' ? '⏱️' : 'ℹ️' })),
              { id: 'f1', tipo: 'MATCH', texto: 'Lead #2 — match realizado com parceiro', tempo: '1min', cor: '#10b981', icone: '🤝' },
              { id: 'f2', tipo: 'COPY', texto: 'Copy Black Friday aprovada pela equipe', tempo: '5min', cor: '#8b5cf6', icone: '✅' },
              { id: 'f3', tipo: 'CRIATIVO', texto: 'Arte Stories Imobiliário publicada', tempo: '10min', cor: '#3b82f6', icone: '🎨' },
              { id: 'f4', tipo: 'LEAD', texto: 'Paulo Rodrigues chegou pela entrada', tempo: '18min', cor: '#6b7280', icone: '👤' },
            ].map((ev, i, arr) => (
              <div key={ev.id} style={{ display: 'flex', gap: 14, paddingBottom: 20, marginBottom: 20, borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${ev.cor}20`, border: `2px solid ${ev.cor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                    {ev.icone}
                  </div>
                  {i < arr.length - 1 && <div style={{ flex: 1, width: 1, background: 'rgba(255,255,255,0.06)', marginTop: 8 }} />}
                </div>
                <div style={{ paddingTop: 6 }}>
                  <div style={{ fontSize: 10, color: ev.cor, fontWeight: 700, marginBottom: 4 }}>{ev.tipo}</div>
                  <div style={{ fontSize: 15, color: '#fff', fontWeight: 500, lineHeight: 1.4, marginBottom: 4 }}>{ev.texto}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{ev.tempo}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Drawer do lead */}
      {leadDrawer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }} onClick={() => setLeadDrawer(null)}>
          <div style={{ width: '100%', background: '#0d0d1a', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, margin: '0 auto 20px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: `${COR_TIPO[leadDrawer.tipo] || '#6b7280'}25`, border: `2px solid ${COR_STATUS[leadDrawer.status_visual]}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff' }}>
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
                { label: 'Valor', value: leadDrawer.valor_estimado ? `R$${(leadDrawer.valor_estimado/1000).toFixed(0)}k` : '—', cor: '#f97316' },
              ].map(item => (
                <div key={item.label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '12px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: item.cor }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setLeadAtend(leadDrawer); setLeadDrawer(null); setAba(2); selecionarLeadAtend(leadDrawer) }} style={{ flex: 1, background: 'linear-gradient(135deg, #f97316, #ea580c)', border: 'none', borderRadius: 12, padding: '14px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
                💬 Atender agora
              </button>
              <Link href={`/crm/lead/${leadDrawer.id}`} style={{ flex: 1, textDecoration: 'none' }}>
                <div style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#fff' }}>
                  Lead 360 →
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Drawer do agente */}
      {agenteDrawer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }} onClick={() => setAgenteDrawer(null)}>
          <div style={{ width: '100%', background: '#0d0d1a', borderRadius: '20px 20px 0 0', padding: '24px 20px 36px', border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, margin: '0 auto 20px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: `${agenteDrawer.cor}25`, border: `2px solid ${agenteDrawer.cor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#fff' }}>
                {agenteDrawer.iniciais}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{agenteDrawer.nome}</div>
                <div style={{ fontSize: 12, color: agenteDrawer.cor, marginTop: 2 }}>{agenteDrawer.area}</div>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Atividade atual</div>
              <div style={{ fontSize: 14, color: '#fff' }}>{agenteDrawer.atividades[0]}</div>
            </div>
          </div>
        </div>
      )}

      {/* Nav inferior — 5 abas */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(8,8,16,0.97)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', paddingBottom: 'env(safe-area-inset-bottom)', zIndex: 100 }}>
        {ABAS.map((item, i) => (
          <button key={i} onClick={() => { setAba(i); setLeadDrawer(null); setAgenteDrawer(null) }} style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '10px 2px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, position: 'relative' }}>
            {aba === i && <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 24, height: 2, borderRadius: 1, background: '#f97316' }} />}
            <span style={{ fontSize: 20 }}>{item.icone}</span>
            <span style={{ fontSize: 9, fontWeight: aba === i ? 700 : 400, color: aba === i ? '#f97316' : 'rgba(255,255,255,0.35)' }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
