# Arquitetura de Navegação — CRM Operacional com IA

> Documento de produto (proposta A). **Versão consolidada (A + análise de mercado):** [`menu-navegacao-consolidado.md`](menu-navegacao-consolidado.md).  
> Implementação no código: `NAV_GROUPS` em `app/crm/layout.tsx`.

## Visão do Produto

O sistema deixa de ser apenas um CRM tradicional e passa a ser posicionado como:

> Plataforma operacional de vendas, atendimento e automação com IA.

A estrutura de navegação deve refletir:

- fluxo operacional real do usuário
- clareza comercial
- escalabilidade futura
- separação entre operação humana e automação IA
- facilidade de onboarding
- padrão visual de mercado (HubSpot, Intercom, Zendesk, Salesforce, PipeDrive)

---

## Estrutura Principal da Sidebar

### 1. Visão Geral

Área de acompanhamento executivo e operacional.

**Objetivo:** visão rápida — performance, métricas, atividades, saúde da operação.

| Item | Rota | Finalidade |
|------|------|------------|
| Dashboard | `/crm` | Resumo operacional geral |
| Analytics | `/crm/analytics` | KPIs, métricas e tendências |
| Relatórios | `/crm/relatorios` | Exportações, CSVs e análises |

### 2. Comercial

Gestão de oportunidades e relacionamento comercial.

**Objetivo:** captação, pipeline, relacionamento, negociação.

| Item | Rota | Finalidade |
|------|------|------------|
| Leads | `/crm/leads` | Entrada e qualificação |
| Negócios | `/crm/negocios` | Pipeline comercial |
| Pessoas | `/crm/pessoas` | Contatos individuais |
| Empresas | `/crm/empresas` | Organizações/clientes |

**Observações:** leads convertem para Pessoa/Empresa/Negócio; negócios com kanban, funil, automações IA, timeline (futuro).

### 3. Operações

Central operacional de atendimento e execução.

| Item | Rota | Finalidade |
|------|------|------------|
| Inbox | `/crm/atendimento` | Central de conversas |
| Aprovações | `/crm/aprovacoes` | Decisões humanas |
| Contatos | `/crm/contatos` | Contatos operacionais |

**Futuro:** SLA, distribuição automática, IA no atendimento, filas, omnichannel.

### 4. Produtos

Gestão de ativos (separado do CRM puro).

| Item | Rota | Finalidade |
|------|------|------------|
| Imóveis | `/crm/imoveis` | Gestão de catálogo |

**Futuro:** disponibilidade, calendário, mídia, documentos, portal.

### 5. Marketing

Aquisição, campanhas e parceiros.

| Item | Rota | Finalidade |
|------|------|------------|
| Campanhas | `/crm/trafego` | Meta/Google/tráfego |
| Conteúdo | `/crm/conteudo` | Copy e conteúdo |
| Parceiros | `/crm/parceiros` | Rede parceira |

**Futuro:** campanhas ↔ leads, origem, funil por campanha, ROI.

### 6. IA & Automação

Núcleo inteligente da plataforma.

| Item | Rota | Finalidade |
|------|------|------------|
| Agentes IA | `/crm/agentes` | Gestão de agentes |
| Automações | `/crm/ciclos` | Fluxos automáticos |
| Canais | `/crm/canais` | WhatsApp e integrações |
| Ferramentas | `/crm/ferramentas` | Skills/tools IA |
| Copiloto | `/crm/agentes-reais` | IA operacional global |

### 7. Sistema

Administração técnica.

| Item | Rota | Finalidade |
|------|------|------------|
| Configurações | `/crm/configuracoes` | Regras operacionais |
| Integrações | `/crm/integracoes` | APIs e serviços |
| Usuários & Permissões | `/crm/usuarios` | Controle de acesso |
| Onboarding | `/crm/onboarding-tenant` | Configuração inicial |

---

## Árvore final

```text
Visão Geral
├── Dashboard
├── Analytics
└── Relatórios

Comercial
├── Leads
├── Negócios
├── Pessoas
└── Empresas

Operações
├── Inbox
├── Aprovações
└── Contatos

Produtos
└── Imóveis

Marketing
├── Campanhas
├── Conteúdo
└── Parceiros

IA & Automação
├── Agentes IA
├── Automações
├── Canais
├── Ferramentas
└── Copiloto

Sistema
├── Configurações
├── Integrações
├── Usuários & Permissões
└── Onboarding
```

---

## Posicionamento estratégico

O diferencial **não** é o CRM em si, e sim:

- IA operacional
- WhatsApp integrado
- automação e agentes
- operação unificada

O CRM é a **camada de relacionamento**, não o produto principal.

---

## Decisões de implementação (confirmadas)

- **Analytics:** `/crm/analytics` com redirect permanente de `/crm/kpis`.
- **Usuários:** `/crm/usuarios` no menu com página placeholder até RBAC completo.

## Mapa de migração (código atual → alvo)

| Antes (gaveta / item) | Depois (gaveta / item) | Rota | Notas |
|----------------------|------------------------|------|-------|
| Início / Dashboard | Visão Geral / Dashboard | `/crm` | — |
| Início / KPIs | Visão Geral / Analytics | `/crm/analytics` | Hoje: `/crm/kpis` — criar redirect ou mover pasta |
| Parceiros e mídia / Relatórios | Visão Geral / Relatórios | `/crm/relatorios` | Só mudança de gaveta |
| Pipeline / Leads | Comercial / Leads | `/crm/leads` | Reordenar: Negócios antes de Pessoas no menu |
| Pipeline / Negócios | Comercial / Negócios | `/crm/negocios` | — |
| Pipeline / Pessoas | Comercial / Pessoas | `/crm/pessoas` | — |
| Pipeline / Empresas | Comercial / Empresas | `/crm/empresas` | — |
| Pipeline / Imóveis | Produtos / Imóveis | `/crm/imoveis` | Nova gaveta |
| Atendimento / Atendimento | Operações / Inbox | `/crm/atendimento` | Só rótulo |
| Atendimento / Aprovações | Operações / Aprovações | `/crm/aprovacoes` | — |
| — (fora do menu) | Operações / Contatos | `/crm/contatos` | Entra no menu |
| Parceiros e mídia / Tráfego | Marketing / Campanhas | `/crm/trafego` | Só rótulo |
| Parceiros e mídia / Conteúdo | Marketing / Conteúdo | `/crm/conteudo` | — |
| Parceiros e mídia / Parceiros | Marketing / Parceiros | `/crm/parceiros` | — |
| AI — Funcionários / Modelos | IA & Automação / Agentes IA | `/crm/agentes` | Rótulo |
| AI — Funcionários / Ciclos IA | IA & Automação / Automações | `/crm/ciclos` | Rótulo |
| AI — Funcionários / Canais | IA & Automação / Canais | `/crm/canais` | — |
| AI — Funcionários / Ferramentas | IA & Automação / Ferramentas | `/crm/ferramentas` | — |
| — (fora do menu) | IA & Automação / Copiloto | `/crm/agentes-reais` | Placeholder hoje |
| Sistema / Configurações | Sistema / Configurações | `/crm/configuracoes` | — |
| — (fora do menu) | Sistema / Integrações | `/crm/integracoes` | Entra no menu |
| — (não existe) | Sistema / Usuários & Permissões | `/crm/usuarios` | **Nova rota/página** |
| Sistema / Onboarding tenant | Sistema / Onboarding | `/crm/onboarding-tenant` | Rótulo |
