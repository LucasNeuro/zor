# Navegação lateral do CRM

## Objetivo

Reduzir rolagem na sidebar, manter a marca Obra10+ e o acesso ao Escritório virtual, com visual alinhado ao produto (tom escuro, verde de destaque).

**Fonte de verdade do menu:** [`lib/crm-nav-groups.ts`](../lib/crm-nav-groups.ts) (`CRM_NAV_GROUPS`).  
**Especificação de produto:** [`menu-navegacao-consolidado.md`](menu-navegacao-consolidado.md).

## Visão Geral ⊂ CRM

A gaveta **Visão Geral** (`/crm`, Analytics, Relatórios) é o painel executivo **dentro** do módulo `/crm` — não duplicar um item “CRM” só nessa gaveta. Entrada global: logo Obra10+ → `/crm`; Escritório Virtual → `/office`.

## Estrutura (gavetas · 2026-05)

1. **Visão Geral** — Dashboard, Analytics, Relatórios (export CSV por entidade)  
2. **Vendas** — Leads (kanban), Negócios (kanban + detalhe)  
3. **Cadastros** — Pessoas, Empresas, Parceiros  
4. **Produtos** — Imóveis  
5. **Obras** — Obras, Pedidos de material (`/crm/obras`, `/crm/pedidos`)  
6. **Projetos** — `/crm/projetos`  
7. **Financeiro** — Visão financeira (dashboard), Contas a pagar/receber  
8. **Atendimento** — Inbox, Canais, Aprovações  
9. **Marketing** — Campanhas (`/crm/trafego`)  
10. **IA & Automação** — Agentes, Automações, Ferramentas, Copiloto (badge)  
11. **Sistema** — Configurações, Integrações, Onboarding (admin)

Conteúdo (`/crm/conteudo`) permanece fora do menu até estar funcional.

## Comportamento

### Desktop (`md+`)

- Sidebar com gavetas (acordeão); gaveta da rota ativa reabre ao navegar.
- Menu filtrado por papel: **Onboarding** só para `owner` / `admin`.
- Toggle expandir/recolher persiste em `localStorage` (`crm-sidebar-expanded`).

### Mobile

- Drawer com as mesmas gavetas filtradas.

## Redirects

- `/crm/kpis` → `/crm/analytics` (permanente, `next.config.ts` + página legado).

## Histórico

| Data | Alteração |
|------|-----------|
| 2026-05-11 | Gavetas (acordeão), toggle, documento criado. |
| 2026-05-20 | Migração menu consolidado; `CRM_NAV_GROUPS` em `lib/crm-nav-groups.ts`. |
| 2026-05-22 | Gavetas Obras, Projetos, Financeiro; plano integral CRM (ver `crm-modelo-dados.md`, `crm-fluxos.md`). |
