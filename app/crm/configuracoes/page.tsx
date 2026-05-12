'use client'

export default function Configuracoes() {
  return (
    <div style={{ height: "100%", overflowY: "auto", background: "#0d1117", padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {[
        { titulo: 'Horário de Atendimento', desc: 'Defina janelas por dia da semana e canal' },
        { titulo: 'SLA por Canal', desc: 'WhatsApp, email, telefone — prazos diferentes' },
        { titulo: 'Modo da IA por Tipo de Lead', desc: 'Quando ativar, pausar ou escalar automaticamente' },
        { titulo: 'Comissões por Categoria', desc: 'Percentuais por tipo de negócio e parceiro' },
        { titulo: 'Cadência de Follow-up', desc: 'Intervalo, máximo de tentativas e regra de parada' },
        { titulo: 'Gatilhos de Escalada', desc: 'Condições para subir nível hierárquico' },
      ].map(item => (
        <div key={item.titulo} style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12, padding: '18px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{item.titulo}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{item.desc}</div>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 18 }}>›</span>
        </div>
      ))}
    </div>
  )
}
