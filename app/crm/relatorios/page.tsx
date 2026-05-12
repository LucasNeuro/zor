'use client'

export default function Relatorios() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" style={{ background: "#0d1117" }}>
      <div className="flex flex-col gap-6 px-4 py-6 md:px-6">
      {[
        { titulo: 'Funil de Conversão', desc: 'Taxa por etapa, tempo médio e valor', icone: '📊' },
        { titulo: 'Performance dos Atendentes', desc: 'SLA, satisfação e volume por agente', icone: '👥' },
        { titulo: 'Receita em Risco', desc: 'Leads críticos com valor estimado', icone: '⚠️' },
        { titulo: 'ROI de Campanhas', desc: 'CPL, ROAS e conversão por canal', icone: '📈' },
        { titulo: 'Rede de Parceiros', desc: 'Volume, comissões e Transparency Score', icone: '🤝' },
        { titulo: 'Auditoria de Decisões', desc: 'Log imutável de todas as ações críticas', icone: '🔒' },
      ].map(item => (
        <div key={item.titulo} style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12, padding: '18px 20px',
          display: 'flex', alignItems: 'center', gap: 16,
          cursor: 'pointer',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
        >
          <div style={{ fontSize: 28 }}>{item.icone}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{item.titulo}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{item.desc}</div>
          </div>
          <button style={{
            fontSize: 11, color: '#f97316',
            background: 'rgba(249,115,22,0.1)',
            border: '1px solid rgba(249,115,22,0.2)',
            borderRadius: 6, padding: '6px 12px',
            cursor: 'pointer', fontWeight: 600,
          }}>
            Exportar
          </button>
        </div>
      ))}
      </div>
    </div>
  )
}
