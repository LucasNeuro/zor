> Caminhos de ficheiros são relativos à raiz do repositório `escritorio-virtual/`.

# ESCRITÓRIO VIRTUAL OBRA10+ — MANIFEST DE PROTEÇÃO
# LEIA ANTES DE QUALQUER ALTERAÇÃO

## REGRA ABSOLUTA
Nunca reescreva um arquivo inteiro sem ler antes.
Sempre use str_replace ou patch — nunca overwrite completo.
O Codex (porta 3000) é INTOCÁVEL.

## MÓDULOS PROTEGIDOS

### NUNCA TOCAR SEM PERMISSÃO EXPLÍCITA
- lib/ia/engine.ts — motor de IA completo
- lib/ia/prompt-builder.ts — construtor de prompts
- app/api/whatsapp/webhook/route.ts — entrada de leads
- app/api/agentes/route.ts — CRUD de agentes

### TOCAR APENAS NO MÓDULO CORRETO

#### CRM (quando falar de CRM, só toque aqui):
- app/crm/leads/page.tsx
- app/crm/leads/[id]/page.tsx
- app/crm/atendimento/page.tsx
- app/crm/aprovacoes/page.tsx
- app/api/leads/route.ts

#### AGENTES (quando falar de agentes, só toque aqui):
- app/crm/agentes/page.tsx
- app/crm/agentes/[slug]/page.tsx
- app/crm/agentes/novo/page.tsx
- lib/ia/prompt-builder.ts

#### OFFICE/CANVAS (quando falar do escritório visual):
- app/office/page.tsx
- components/office/FFTAgentNode.tsx
- components/office/FFTLeadNode.tsx
- components/office/LiveMessageFeed.tsx
- components/office/DecisionPanel.tsx

#### PARCEIROS (quando falar de parceiros):
- app/crm/parceiros/
- app/api/parceiros/

#### TRÁFEGO (quando falar de tráfego/campanhas):
- app/crm/trafego/
- app/api/windsor/

#### CONTEÚDO (quando falar de conteúdo/copy):
- app/crm/conteudo/

#### CICLOS/AUTOMAÇÃO:
- app/crm/ciclos/page.tsx
- app/api/ciclos/

#### MOBILE:
- components/mobile/MobileShell.tsx
- components/mobile/MobileDetector.tsx
- components/PWAProvider.tsx

### BANCO DE DADOS (todas as tabelas — protegidas)
Nunca dropar tabelas. Só CREATE TABLE IF NOT EXISTS.
Só ALTER TABLE ADD COLUMN IF NOT EXISTS.

## VISUAL FFT
Cores: verde=#003b26, dourado=#c9a24a, fundo=#0d1117
Animações: aura-spin, aura-pulse, lead-pulse-red, lead-pulse-gold
NUNCA alterar globals.css sem preservar as animações FFT.
