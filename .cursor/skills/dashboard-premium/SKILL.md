---
name: dashboard-premium
description: >
  Premium dashboard patterns—layout, KPI cards, charts, tables, dark mode—for professional analytics UX.
  Use for /crm screens, /office panels, real-time metrics, Recharts/Chart.js, and Obra10+ internal tools.
---

## Padrões de Dashboard Premium

LAYOUT:
- Sidebar colapsável com navegação por ícones
- Header com breadcrumb + ações contextuais
- Grid responsivo: métricas → gráficos → tabelas → alertas
- Área de notificações não intrusiva

MÉTRICAS (cards de KPI):
- Número grande (32-40px, bold)
- Label discreto acima (11px, uppercase, muted)
- Trend indicator (seta + % vs período anterior)
- Spark line ou mini gráfico inline
- Cor semântica: verde=bom, amarelo=atenção, vermelho=crítico

GRÁFICOS:
- Recharts ou Chart.js
- Tooltips ricos com contexto
- Animação de entrada suave (1s)
- Cores consistentes com design system
- Estados: loading skeleton → dados → empty state

TABELAS:
- Sorting em todas as colunas
- Filtros inline
- Paginação ou infinite scroll
- Row hover sutil
- Ações por linha (botões aparecem no hover)

CORES RECOMENDADAS (dark mode):
- Background: #0f172a (slate-900)
- Surface: #1e293b (slate-800)
- Border: rgba(255,255,255,0.08)
- Text primary: #f8fafc
- Text muted: #94a3b8
- Accent: #22c55e (verde) ou #3b82f6 (azul)
- Danger: #ef4444
- Warning: #f59e0b
