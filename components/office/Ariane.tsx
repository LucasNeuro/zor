'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

type ArianeEstado = 'normal' | 'andando' | 'apresentando' | 'alerta' | 'duvida'

type ArianeProps = {
  estado?: ArianeEstado
  mensagem?: string
  tamanho?: number
  posicao?: { bottom?: number; right?: number; left?: number; top?: number }
  onClick?: () => void
}

const ESTADO_AUTOMATICO: { estado: ArianeEstado; mensagem: string; duracao: number }[] = [
  { estado: 'normal', mensagem: 'Monitorando campanhas...', duracao: 6000 },
  { estado: 'apresentando', mensagem: 'CPL Meta Ads em R$89 — acima da meta!', duracao: 5000 },
  { estado: 'alerta', mensagem: 'Budget 85% utilizado — atenção!', duracao: 4000 },
  { estado: 'andando', mensagem: 'Revisando estratégia de tráfego...', duracao: 5000 },
  { estado: 'duvida', mensagem: 'Analisando performance do conjunto B...', duracao: 4000 },
  { estado: 'apresentando', mensagem: 'Taxa de qualificação: 38% — meta 45%', duracao: 5000 },
  { estado: 'normal', mensagem: 'Ariane — Diretora de Marketing', duracao: 6000 },
]

export function Ariane({ estado, mensagem, tamanho = 80, onClick }: ArianeProps) {
  const [estadoAtual, setEstadoAtual] = useState<ArianeEstado>(estado || 'normal')
  const [mensagemAtual, setMensagemAtual] = useState(mensagem || 'Ariane — Diretora de Marketing')
  const [mostrarBolha, setMostrarBolha] = useState(true)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (estado) return

    const timer = setInterval(() => {
      setIdx(prev => {
        const proximo = (prev + 1) % ESTADO_AUTOMATICO.length
        setEstadoAtual(ESTADO_AUTOMATICO[proximo].estado)
        setMensagemAtual(ESTADO_AUTOMATICO[proximo].mensagem)
        setMostrarBolha(true)
        return proximo
      })
    }, ESTADO_AUTOMATICO[idx]?.duracao || 5000)

    return () => clearInterval(timer)
  }, [estado, idx])

  return (
    <div onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: onClick ? 'pointer' : 'default' }}>
      {mostrarBolha && mensagemAtual && (
        <div style={{ background: 'rgba(8,8,16,0.92)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 10, padding: '8px 12px', maxWidth: 180, fontSize: 11, color: '#fff', lineHeight: 1.4, textAlign: 'center', boxShadow: '0 4px 20px rgba(139,92,246,0.2)' }}>
          <div style={{ fontSize: 9, color: '#8b5cf6', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ariane · Dir. Marketing</div>
          {mensagemAtual}
        </div>
      )}
      <div style={{ width: tamanho, height: tamanho * 1.4, position: 'relative', filter: 'drop-shadow(0 4px 12px rgba(139,92,246,0.4))', transition: 'transform 0.3s ease', transform: estadoAtual === 'andando' ? 'translateX(-4px)' : 'translateX(0)' }}>
        <Image src={`/avatars/ariane/${estadoAtual}.png`} alt="Ariane" fill style={{ objectFit: 'contain' }} priority />
      </div>
      <div style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6, padding: '2px 8px', fontSize: 9, color: '#8b5cf6', fontWeight: 700, letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
        ARIANE ✦ DIR. MARKETING
      </div>
    </div>
  )
}
