# Inventário do menu lateral do CRM

> **Legado (pré-migração 2026-05-20).** Menu atual: [`menu-navegacao-consolidado.md`](menu-navegacao-consolidado.md) e código em [`lib/crm-nav-groups.ts`](../lib/crm-nav-groups.ts).

Este ficheiro descreve a estrutura **antiga** (6 gavetas · 18 itens) para referência histórica.

## Estrutura antiga

| Gaveta | Itens |
|--------|-------|
| Início | Dashboard, KPIs (`/crm/kpis`) |
| Pipeline e cadastros | Leads, Pessoas, Empresas, Imóveis, Negócios |
| Atendimento | Atendimento, Aprovações |
| Parceiros e mídia | Parceiros, Relatórios, Tráfego, Conteúdo |
| AI — Funcionários | Modelos, Ciclos IA, Canais, Ferramentas |
| Sistema | Configurações, Onboarding tenant |

## Rotas fora do menu antigo

`/crm/contatos`, `/crm/integracoes`, `/crm/agentes-reais` — passaram ao menu na migração consolidada (exceto Conteúdo, oculto).
