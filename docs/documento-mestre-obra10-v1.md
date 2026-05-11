# OBRA10+ — Documento Mestre do Projeto

| Campo | Valor |
|--------|--------|
| **Versão** | 1.0 |
| **Data** | 08 de Maio de 2026 |
| **Cliente** | Obra10+ (Wendel Nice, CEO) |
| **Destinatários** | Time de Desenvolvimento (2 devs seniors) |
| **Meta de entrega** | 27 de Maio de 2026 |

**Fonte:** este ficheiro é a versão **completa** do Documento Mestre v1.0 (texto integral para o time — carta de abertura, árvore de pastas, cronograma expandido, tarefas com passos, débitos em prosa e conclusão na íntegra).

---

## Carta de abertura

Pessoal,

Este documento existe porque eu, Wendel, não sou desenvolvedor. Construí este sistema com apoio da IA Claude ao longo de várias sessões, aprendendo no caminho. Leiam com calma. Quando terminarem, terão o quadro completo e vamos alinhar prioridades juntos. Conta comigo, vocês fazem parte do time.

---

## Sumário executivo

Este documento existe porque eu, Wendel, não sou desenvolvedor. Construí este sistema com apoio da IA Claude ao longo de várias sessões, aprendendo no caminho. O resultado é um sistema robusto (1,2 GB, 29.332 linhas de código, 113 tabelas no banco), mas com fragilidades importantes que vocês precisam endereçar antes que cresçamos.

A meta é ambiciosa e clara: até **27 de Maio de 2026**, ter a plataforma **100% funcional para parceiros e fornecedores**. Tenho 2 devs seniors no time, então o prazo é apertado mas viável.

Este documento contém o necessário para entender o projeto do zero, replicar o raciocínio do produto, organizar o que existe, corrigir débitos técnicos, construir o que falta e entregar a **Fase 1** do produto. Está dividido em **15 seções** que vão da visão de produto até tarefas específicas e padrões de qualidade.

---

## Índice

1. Visão Geral do Produto  
2. Estado Atual do Sistema  
3. Arquitetura Técnica  
4. Hierarquia e Atores do Negócio  
5. Os 28 Agentes IA  
6. Funcionalidades Construídas  
7. Funcionalidades em Construção  
8. Visão Futura — O Sistema Completo  
9. Setores que Faltam Construir  
10. WhatsApp, Check-in e Pedido de Material  
11. Dashboards por Persona  
12. Multi-Empresa — Como Vai Funcionar  
13. Cronograma até 27/05  
14. O Que Eu Peço de Vocês (Tarefas Específicas)  
15. Padrões de Qualidade e Regras Supremas  

---

## 1. Visão geral do produto

### 1.1 O que é o Obra10+

O Obra10+ é uma agência de marketing/growth com uma plataforma de intermediação de parceiros acoplada. O diferencial: tudo é orquestrado por **agentes de Inteligência Artificial** que fazem o trabalho operacional de uma equipe humana inteira.

A plataforma **“Escritório Virtual”** é a interface visual onde o usuário vê os agentes IA trabalhando como se fossem funcionários numa empresa real. Cada agente tem cargo, personalidade, ciclos de trabalho, ferramentas e regras de autonomia.

### 1.2 O problema que resolvemos

Empresas pequenas e médias dos setores de construção, arquitetura e imobiliário precisam de:

- Marketing digital constante (anúncios, conteúdo, campanhas)  
- Atendimento ao cliente 24/7 (WhatsApp principalmente)  
- CRM para acompanhar leads e oportunidades  
- Gestão de fornecedores e parceiros  
- Controle de obras, projetos e materiais  

Mas elas não têm budget para montar uma equipe completa de marketing + atendimento + comercial + gestão. Nossa proposta: essas empresas contratam o Obra10+ e ganham instantaneamente uma **“equipe de IA”** trabalhando 24/7, monitorada por humanos quando preciso.

### 1.3 Filosofia do sistema

**Pilar 1 — Parâmetros pré-fixados**  
Cada agente tem cargo, área, nível e modelo de IA fixos. Isso permite que o prompt seja cacheável (economiza tokens). O sistema é mais barato de operar e aprende melhor com o tempo.

**Pilar 2 — IA observa, sugere, prepara; humano aprova**  
A IA nunca executa decisões financeiras, contratuais ou irreversíveis sozinha. Ela monta o “card” de aprovação com a análise pronta, e o humano aprova com 1 clique. Toda decisão crítica passa pela **Central de Aprovações**.

**Pilar 3 — CEO humano único**  
Wendel é o único CEO. Não existe agente IA com cargo de CEO. O `diretor_geral_ia` coordena, mas não decide pelo dono.

### 1.4 Visão de longo prazo

1. **Multi-tenancy completo:** cada empresa cliente cadastra-se e tem seu próprio Escritório Virtual personalizado.  
2. **Workflow de obra ponta a ponta:** da captação do imóvel até a venda do produto final.  
3. **Operação WhatsApp-first:** controle operacional pelo WhatsApp.  
4. **Painel visual de cada obra:** status, materiais, participantes.  
5. **Setores empresariais por IA:** marketing, comercial, financeiro, compras, projetos, obras, RH, etc.  

---

## 2. Estado atual do sistema

### 2.1 Onde está o código

| Contexto | Caminho |
|----------|---------|
| Pasta principal (versão ativa) | `C:\Users\wende\Documents\escritorio-virtual` |

**Versões e backups** (referências no documento original — máquina do Wendel):

- `C:\Users\wende\OneDrive\Documentos\obra10+ sistema backup\`  
- `C:\Users\wende\Documents\Codex\backups\obra10-central-operacional_2026-05-01_20-09-46`  
- `C:\Users\wende\Documents\backup_escritorio_20260508_2033.tar.gz` (~57 MB)  
- Cópia OneDrive na Área de Trabalho com o mesmo nome `.tar.gz`  

**Nota:** o projeto antes se chamava **“office”** e foi renomeado para **escritorio-virtual**. O nome `/office` ainda pode aparecer na rota da URL.

### 2.2 Estado do controle de versão (Git)

- Repositório git local (`.git` inicializado)  
- Branch ativa: `feature/escritorio-visual` (não `main`)  
- Sem remote configurado para GitHub/GitLab  
- Commits recentes só no PC do Wendel  
- Vercel: deploy via CLI (`npx vercel --prod`), não por push de branch  

**Risco:** perda de commits se o computador falhar; histórico Vercel não substitui backup completo de código.

### 2.3 Estado do servidor (Vercel)

| Item | Valor |
|------|--------|
| URL pública | https://escritorio-virtual-xi.vercel.app |
| Project ID | prj_xwKS3ai1ER5AHdJrjwrjj9dUV5c0 |
| Conta | wendelnice-devs-projects |
| Status (ref. 08/05/2026) | No ar; último deploy ~**13 h** antes da data do documento |

**Variáveis de ambiente em produção:**

| Variável | Status |
|----------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Definida |
| `EVOLUTION_API_URL` | Definida |
| `EVOLUTION_API_KEY` | Definida |
| `EVOLUTION_INSTANCE` | Definida |
| `ANTHROPIC_API_KEY` | **Faltando** — causa raiz da IA não responder leads do WhatsApp |

### 2.4 Estado do banco de dados (Supabase)

| Item | Valor |
|------|--------|
| Project ID | cdjlqsznerdhwqyunodl |
| Total de tabelas | 113 |

| Categoria | Quantidade | Observação |
|-----------|------------|------------|
| Hub (core) | 71 | Prefixo `hub_` |
| CRM moderno | 7 | `crm_*` |
| Legado / genéricas | 35 | Auditar / possivelmente arquivar |

Backups: `pg_cron` a cada 30 minutos; 900+ backups acumulados.

### 2.5 Estado do WhatsApp (Evolution API)

- **Hospedagem:** Railway — projeto **lovely-commitment**.  
- **Plano:** trial gratuito (28 dias **ou** ~US$ 4,67 — o que ocorrer primeiro, conforme doc).  
- **Status:** online; 3/3 serviços (Redis, Evolution API, Postgres).  
- **Histórico:** quedas em **04/05 ~22h39**, recuperação automática.  
- **Tráfego:** **8** leads reais recebidos; **0** mensagens enviadas pelo sistema (IA não respondeu — falta `ANTHROPIC_API_KEY` em produção).  

### 2.6 Status das funcionalidades

| Módulo | Status |
|--------|--------|
| Webhook WhatsApp recebendo mensagens | Funcional |
| Criação de leads automaticamente | Funcional |
| Escritório Virtual visual (canvas 3D) | Funcional |
| Agentes IA cadastrados no banco | 28 agentes |
| Ciclos IA cadastrados | 8 ciclos (3 com bug) |
| IA respondendo lead automaticamente | Falha (sem API key) |
| Ciclos rodando autônomos | Nunca executaram (`total_execucoes = 0`) |
| Hub de Parceiros | Parcial |
| CRM (leads, atendimento, KPIs) | Funcional; KPIs zerados |
| Dashboard agentes/relatórios | Parcial |
| Mobile responsivo | Não implementado |
| Multi-empresa | Não implementado |
| Cadastro empreiteiras CNPJ | Não implementado |
| Operários CPF + check-in WhatsApp | Não implementado |
| Pedido de material por WhatsApp | Não implementado |
| Cotação automática com fornecedores | Não implementado |
| Painel visual de cada obra | Não implementado |
| Fluxo Imóvel → Projeto → Obra → Produto | Não implementado |

### 2.7 Débitos técnicos identificados

| ID | Débito | Severidade | Notas |
|----|--------|------------|--------|
| 1 | HMAC desligado no webhook WhatsApp | ALTA | Commit 9313dd7; reativar com secret entre Evolution e webhook |
| 2 | 5 rotas API sem autenticação | MÉDIA | Commits `d55c020` e `65ee954`; rotas como `/api/whatsapp`, `/api/hub/cargos`, `/api/hub/agentes`, `/api/crm/atendimento`, `/api/health` — token interno / checagem de origem |
| 3 | 3 ciclos IA com slug `diretor` inexistente | ALTA | Slugs válidos: `diretor_comercial`, `diretor_operacoes`, `diretor_geral_ia` |
| 4 | Agentes duplicados (`ariane` / `diretora_marketing`) | BAIXA | Arquivar ou renomear |
| 5 | Branch ativa errada (`feature/escritorio-visual`) | MÉDIA | Padronizar `main` para produção |
| 6 | Sem GitHub remote | ALTA | Fonte da verdade e colaboração |
| 7 | Backup automático (Google Drive) não implementado | ALTA | Apenas pg_cron + OneDrive |
| 8 | 35 tabelas legadas | BAIXA | Auditar; não deletar |
| 9 | 14 KPIs definidos; `hub_kpis_resultados` vazia | MÉDIA | Falta job de cálculo |
| 10 | Tabelas de negócio vazias | ALTA | `hub_negocios`, `hub_empresas`, `hub_imoveis`, `hub_parceiros`, etc. |

### 2.7.1 Débitos — texto integral (como no documento original)

**Débito 1 — HMAC desligado no webhook WhatsApp**  
Severidade: **ALTA**. Origem: commit `9313dd7` em 07/05/2026. A validação de assinatura HMAC do webhook foi desligada temporariamente para debug pré-reunião. Hoje qualquer pessoa pode mandar requisição falsa para o webhook se souber a URL. **Solução:** reativar HMAC com gestão de chave secreta entre Evolution API e o webhook.

**Débito 2 — 5 rotas API expostas sem autenticação**  
Severidade: **MÉDIA**. Origem: commits `d55c020` e `65ee954`. Rotas como `/api/whatsapp`, `/api/hub/cargos`, `/api/hub/agentes`, `/api/crm/atendimento`, `/api/health` estão liberadas no proxy sem checagem de origem ou auth. **Solução:** migrar para fetch helper global com autenticação por token interno.

**Débito 3 — 3 ciclos IA apontando para slug inexistente**  
Severidade: **ALTA** (importa quando os ciclos forem ativados). Os ciclos “Diretor — Análise Matinal”, “Diretor — Análise Noturna” e “Diretor — Tráfego 6h” usam `agente_slug = 'diretor'`, mas esse slug não existe em `hub_agente_identidade`. Slugs reais incluem `diretor_comercial`, `diretor_operacoes`, `diretor_geral_ia`. **Solução:** decidir qual diretor herda cada ciclo (ver secção 14) e fazer `UPDATE`.

**Débito 4 — Agentes duplicados**  
Severidade: **BAIXA**. `ariane` e `diretora_marketing` têm o mesmo cargo “Diretora de Marketing”. Provavelmente um deve ser arquivado ou renomeado.

**Débito 5 — Branch errada como ativa**  
Severidade: **MÉDIA**. Branch ativa `feature/escritorio-visual`; não existe `main` configurada como produção de forma padrão. **Solução:** padronizar fluxo Git.

**Débito 6 — Sem GitHub remote**  
Severidade: **ALTA**. Código apenas no PC do Wendel + builds Vercel. **Solução:** remote GitHub (ou equivalente) como fonte de verdade.

**Débito 7 — Backup automático não funciona**  
Severidade: **ALTA**. Backup prometido (ex.: Google Drive) não implementado. Confiável hoje: `pg_cron` no Supabase + sincronização de ficheiros (ex.: OneDrive).

**Débito 8 — 35 tabelas legadas**  
Severidade: **BAIXA**. Auditar: usar, migrar ou arquivar. **Regra suprema:** nunca `DELETE` — `ativo=false` ou `legacy_*`.

**Débito 9 — 14 KPIs definidos mas resultados vazios**  
Severidade: **MÉDIA**. `hub_kpis_definicao` preenchida; `hub_kpis_resultados` zerada. Falta job de cálculo automático.

**Débito 10 — 5+ tabelas de negócio vazias**  
Severidade: **ALTA**. `hub_negocios`, `hub_empresas`, `hub_imoveis`, `hub_parceiros` e outras sem registos impedem fluxo completo.

---

## 3. Arquitetura técnica

### 3.1 Stack tecnológico

| Camada | Tecnologia | Versão |
|--------|------------|--------|
| Frontend | Next.js | 16.2.4 |
| UI | React | 19 |
| Linguagem | TypeScript | 5.x |
| Estilo | Tailwind CSS | 4 |
| Banco | PostgreSQL (Supabase) | 15+ |
| Auth | Supabase Auth | — |
| LLM | Anthropic (Haiku / Sonnet / Opus) | — |
| WhatsApp | Evolution API (self-hosted) | — |
| Marketing data | Windsor.ai | — |
| MCP | Cursor / integrações documentação | — |
| App hosting | Vercel | — |
| WhatsApp hosting | Railway | — |

### 3.2 Estrutura de pastas (integral)

```text
escritorio-virtual/
├── app/                           # Páginas Next.js (App Router)
│   ├── crm/                       # Módulo CRM
│   │   ├── page.tsx               # Dashboard principal
│   │   ├── leads/                 # Lista de leads
│   │   ├── contatos/              # Pessoas/contatos
│   │   ├── empresas/              # Empresas cadastradas
│   │   ├── negocios/              # Negócios/oportunidades
│   │   ├── parceiros/             # Hub de parceiros
│   │   ├── kpis/                  # KPIs e métricas
│   │   ├── relatorios/            # Relatórios
│   │   ├── atendimento/           # Tela de atendimento
│   │   ├── conteudo/              # Conteúdo/copy
│   │   ├── ciclos/                # Configuração de ciclos IA
│   │   ├── aprovacoes/            # Central de Aprovações
│   │   └── configuracoes/         # Configurações
│   ├── office/                    # Escritório Virtual visual
│   ├── agentes/                   # Catálogo de agentes IA
│   ├── comando/                   # Painel de comando
│   ├── parceiro/                  # Cadastro de parceiros via token
│   └── api/                       # Endpoints de API (evolui com o projeto)
│       ├── whatsapp/webhook/      # Webhook do WhatsApp
│       ├── hub/agentes/           # CRUD de agentes (lista + detalhe por slug)
│       ├── hub/cargos/
│       ├── ciclos/                # Execução de ciclos
│       │   ├── atendente/
│       │   ├── gerente/
│       │   └── diretor/
│       ├── ml/aprovar/            # ML/aprovações
│       ├── validar/cpf/
│       ├── validar/cnpj/
│       └── windsor/campanhas/     # Integração Windsor.ai
├── components/                    # Componentes React reutilizáveis
│   └── office/                    # Componentes do escritório virtual
├── lib/                           # Lógica de negócio
│   ├── agent-prompts.ts           # Prompts dos agentes IA (~67KB)
│   ├── office-intelligence.ts     # Inteligência do escritório (~24KB)
│   ├── personality-matrix.ts      # Matriz de personalidade (~21KB)
│   ├── agent-states.ts            # Estados dos agentes (~14KB)
│   └── ia/                        # Engine de IA
│       └── prompt-builder.ts      # Montagem de prompts em camadas
└── public/                        # Assets estáticos
    └── avatars/                   # Avatares dos agentes (ex.: Ariane)
```

**Nota para o repositório atual:** o número exato de rotas em `app/api/` pode ser maior que no diagrama; validar com `app/api/**/route.ts` no código. O desenho acima reflete a intenção arquitetural do documento original.

### 3.3 Fluxo de dados principal (WhatsApp → IA)

Diagrama em cadeia (documento original):

```text
WhatsApp (cliente)
    ↓
Evolution API (Railway)
    ↓ (webhook POST)
Next.js /api/whatsapp/webhook (Vercel)
    ↓
identifica intenção/mercado
    ↓
busca ou cria lead em hub_leads_crm
    ↓
busca agente apropriado em hub_agente_identidade
    ↓
constrói prompt em camadas (lib/ia/prompt-builder.ts)
    ↓ (chama Anthropic)
Claude API (Haiku ou Sonnet)
    ↓
recebe resposta
    ↓
grava nas tabelas (após CMD-OBS-1, quando ativo), por exemplo:
    - hub_prompt_logs
    - hub_conversas
    - hub_mensagens
    - hub_ciclos_log
    - hub_ciclos_ia (incrementa total_execucoes)
    - hub_fila_mensagens
    - hub_acoes_ia
    - hub_memorias_lead
    - hub_atividades
    ↓
envia resposta de volta
    ↓
Evolution API → WhatsApp do cliente
```

Resumo: WhatsApp → Evolution API → `POST` webhook Next.js (**`/api/whatsapp/webhook`**) → identificação de intenção/mercado → lead em **`hub_leads_crm`** → agente em **`hub_agente_identidade`** → **`lib/ia/prompt-builder.ts`** → Anthropic (Claude) → resposta persistida (pós **CMD-OBS-1**, quando ativo), incluindo entre outras:

- `hub_prompt_logs`  
- `hub_conversas`  
- `hub_mensagens`  
- `hub_ciclos_log`  
- `hub_ciclos_ia` (ex.: `total_execucoes`)  
- `hub_fila_mensagens`  
- `hub_acoes_ia`  
- `hub_memorias_lead`  
- `hub_atividades`  

→ envio da resposta → Evolution → WhatsApp do cliente.

### 3.4 Engine de prompts em 7 camadas

| Camada | Fonte | O que adiciona ao prompt |
|--------|--------|---------------------------|
| 1 — Identidade | `hub_agente_identidade` + `hub_personalidade` | Cargo, `system_prompt_base`, personalidade |
| 2 — Conhecimento | `hub_agente_conhecimento` | Empresa, serviços, objeções, exemplos |
| 3 — Mercado | Parâmetro | Linguagem por segmento (imobiliário, reforma, etc.) |
| 4 — Regras | `hub_regras_ia` + campos do agente | `nao_pode_fazer`, `sempre_dizer`, `nunca_dizer` |
| 5 — Memórias | `hub_memorias_lead` | Top memórias por confiança (ex.: 5) |
| 6 — Etapa do fluxo | Parâmetro | Contexto da etapa atual |
| 7 — Universais | Hardcoded | Limite de linhas, nunca inventar dados, etc. |

### 3.5 Modelos de IA por nível

| Nível | Cargo | Modelo padrão | Modelo crítico |
|-------|--------|---------------|----------------|
| 1 | CEO IA / Diretor Geral | Opus / Haiku | Opus / Sonnet |
| 2 | Diretores | Sonnet | Sonnet ou Opus |
| 3 | Gerentes / gestores | Sonnet | Sonnet ou Opus |
| 4 | Operadores | Haiku | Sonnet |
| 5 | Especialistas auxiliares | Sonnet ou Haiku | Sonnet |

**Regra de negócio:** mercado **imobiliário** (decisão de alto valor) → todos os agentes usam **modelo_crítico**; demais mercados → **modelo_padrao**.

*(Cargos e slugs detalhados na seção 5.)*

---

## 4. Hierarquia e atores do negócio

### 4.1 Quem usa o sistema

1. **CEO humano único (Wendel)** — único dono real; aprova decisões financeiras, contratuais e críticas; vê empresas, parceiros e leads; define regras globais.  

2. **Empresas clientes (multi-tenant futuro)** — contratam o Obra10+ e têm Escritório Virtual isolado (imobiliárias, construtoras, arquitetura, reforma).  

3. **Parceiros (definição Wendel)** — **imobiliárias e corretores**; trazem leads/oportunidades; comissão por intermediação; homologação; CPF ou CNPJ; veem só seus leads e comissões.  

4. **Fornecedores (definição Wendel)** — profissionais/serviços para obra por área (arquitetura, engenharia, empreiteiras, marcenaria, elétrica, hidráulica, pintura, cerâmica, materiais/lojas, serralheria, vidraçaria…). Não são “clientes” do marketing; têm **CNPJ**, podem ter funcionários (CPFs), recebem pedidos e cotações, são avaliados por performance.  

5. **Operários** — funcionários de empreiteiras; **CPF**; só WhatsApp; check-in/out, pedido de material, fotos; sem UI obrigatória.  

6. **Clientes finais** — compram serviço (PF ou PJ); WhatsApp com IA; aprovam orçamentos pelo WhatsApp.  

### 4.2 Fluxo de negócio completo (visão Wendel)

Sequência idealizada de uma obra ponta a ponta:

1. **Captação do imóvel** — Arquiteto A (parceiro) cadastra imóvel → `hub_imoveis`.  
2. **Venda do imóvel** — Corretor B vende → status do imóvel; comissão; oportunidade de projeto.  
3. **Projeto arquitetônico** — Arquiteto C (fornecedor) fecha projeto → cadastro no sistema; comissão.  
4. **Venda da obra** — Obra10+ vende execução → contrato.  
5. **Venda de produtos/cenário** — produtos para o projeto (móveis, decoração, etc.).  
6. **Execução da obra** — empreiteiras (fornecedoras) com CNPJ; operários com CPF.  
7. **Check-in dos operários** — WhatsApp (“cheguei”) → painel da obra; tempo trabalhado.  
8. **Pedido de material** — WhatsApp → tarefa → notificações → cotação com fornecedores → card de aprovação → confirmação e entrega.  
9. **Painel visual da obra** — presença, materiais, cronograma, fotos, decisões pendentes em tempo real.

### 4.3 Estrutura hierárquica no banco

- `hub_hierarquia`  
- `hub_pessoas`, `hub_empresas`, `hub_profissionais`, `hub_responsabilidades`  

---

## 5. Os 28 agentes IA

### 5.1 Visão geral

28 agentes em 5 níveis hierárquicos, com cargo, personalidade, conhecimento, regras e ciclos.

### 5.2 Tabela de agentes (por nível)

**Nível 1 — Comando**

| Slug | Cargo | Modelo | Função |
|------|-------|--------|--------|
| `ceo` | CEO IA | Opus 4.7 | **Proibido usar** — Wendel é o CEO único |
| `diretor_geral_ia` | Diretor Geral IA | Haiku 4.5 | Coordena agentes; prepara cards de aprovação para Wendel |

**Nível 2 — Diretoria**

| Slug | Cargo | Modelo | Função / nota |
|------|-------|--------|----------------|
| `ariane` | Diretora de Marketing | Sonnet 4.6 | Marketing; personagem visual no canvas |
| `diretora_marketing` | Diretora de Marketing | Sonnet 4.6 | **Duplicata** de Ariane — arquivar ou renomear |
| `diretor_comercial` | Diretor Comercial | Sonnet 4.6 | Área comercial e vendas |
| `diretor_operacoes` | Diretor de Operações | Sonnet 4.6 | Operações; tráfego/infra (possível) |

**Nível 3 — Gerência**

| Slug | Cargo | Modelo | Função |
|------|-------|--------|--------|
| `gerente_atendimento` | Gerente de Atendimento | Sonnet 4.6 | Supervisiona atendimento |
| `gerente_vendas` | Gerente de Vendas | Sonnet 4.6 | Supervisiona vendas |
| `gestor_conteudo` | Gestor de Conteúdo | Sonnet 4.6 | Aprova copy e arte antes de publicar |
| `gestor_projetos` | Gestor de Projetos | Sonnet 4.6 | Acompanha projetos em andamento |
| `gestor_trafego` | Gestor de Tráfego | Sonnet 4.6 | Campanhas Meta/Google |

**Nível 4 — Operação**

| Slug | Cargo | Modelo | Função |
|------|-------|--------|--------|
| `sdr` | Qualificador de Leads | Haiku 4.5 | Primeiro contato; qualificação |
| `atendente` | Atendente de Primeiro Contato | Haiku 4.5 | Atende leads qualificados |
| `closer` | Closer | Haiku 4.5 | Fecha negociação |
| `cs` | Customer Success | Haiku 4.5 | Pós-venda; retenção |
| `crm_ia` | CRM IA | Haiku 4.5 | Manutenção da base CRM |
| `analista_trafego_meta` | Analista de Tráfego Meta | Haiku 4.5 | Análise diária Meta Ads |
| `analista_trafego_google` | Analista de Tráfego Google | Haiku 4.5 | Análise diária Google Ads |
| `analytics_ia` | Analytics IA | Haiku 4.5 | Consolida dados; relatórios |
| `copywriter` | Copywriter | Haiku 4.5 | Textos para anúncios |
| `designer` | Designer | Haiku 4.5 | Artes para campanhas |
| `motion_designer` | Motion Designer | Haiku 4.5 | Vídeos para anúncios |
| `social_media` | Social Media | Haiku 4.5 | Posts em redes |
| `revisor_ia` | Revisor IA | Haiku 4.5 | Qualidade dos outputs |
| `dev_ia` | Dev IA | Haiku 4.5 | Tarefas técnicas auxiliares |

**Nível 5 — Especialistas auxiliares**

| Slug | Cargo | Modelo | Função |
|------|-------|--------|--------|
| `estrategista` | Estrategista Digital | Sonnet 4.6 | Estratégia de longo prazo |
| `monitor_qualidade` | Monitor de Qualidade | Haiku 4.5 | Qualidade dos outputs |
| `pesquisador` | Pesquisador | Haiku 4.5 | Concorrência e tendências |

### 5.3 Os 8 ciclos IA configurados

| # | Nome | Agente | Tipo | Frequência | Status |
|---|------|--------|------|------------|--------|
| 1 | SDR — Resposta Imediata | `sdr` | contínuo | webhook | OK |
| 2 | Atendente — Monitor SLA | `atendente` | programado | 2 min | OK |
| 3 | Atendente — Follow-up | `atendente` | programado | 30 min | OK |
| 4 | Gerente — Supervisão | `gerente_atendimento` | programado | 30 min | OK |
| 5 | Gerente — Relatório Matinal | `gerente_atendimento` | programado | 08h | OK |
| 6 | Diretor — Análise Matinal | `diretor` (inválido) | programado | 07h | Bug slug |
| 7 | Diretor — Análise Noturna | `diretor` (inválido) | programado | 19h | Bug slug |
| 8 | Diretor — Tráfego 6h | `diretor` (inválido) | programado | 6h | Bug slug |

**Todos com `total_execucoes = 0`:** autonomia ainda não comprovada em execução.

### 5.4 Por que os ciclos não rodam

1. **SDR (contínuo):** dispara pelo webhook com lead novo, mas sem **`ANTHROPIC_API_KEY`** em produção a chamada Claude não completa o ciclo.  
2. **Programados:** no repositório ativo existem **crons no `vercel.json`** que chamam `/api/ciclos/atendente`, `/api/ciclos/gerente`, `/api/ciclos/diretor` e `/api/ml/ciclo`. Em produção, **`cronRequestAuthorized`** aceita o header **`x-vercel-cron: 1`** (injetado pelo Vercel nas invocações de cron) ou **`CRON_SECRET`** (Bearer / query / header). Em **plano Hobby** do Vercel, crons podem não estar disponíveis — confirmar no dashboard.  
3. **Slug `diretor` inexistente:** corrigido na migração **`supabase/migrations/20260509120000_hub_ciclos_slugs_e_tenants.sql`** (`diretor` → `diretor_geral_ia` / `diretor_operacoes` conforme nome do ciclo). Aplicar no Supabase se ainda não aplicado.  
4. **Bug de contagem (até 2026-05-11):** a rota **atendente** usava `.single()` com `ilike` rígido no nome do ciclo; se o seed tiver outro texto, **`hub_ciclos_ia.total_execucoes` nunca subia**. A rota **gerente** não atualizava `hub_ciclos_ia` nem `hub_ciclos_log`. **Correção no código:** lookup tolerante em `atendente` e registo completo em `gerente`.

---

## 6. Funcionalidades construídas

### 6.1 Módulo CRM (parcialmente funcional)

**Localização:** `app/crm/`

#### 6.1.1 Dashboard CRM (`/crm`)

- Visão geral de KPIs (atendimento, parceiros, conversão).  
- Cards com números principais.  
- **Bug conhecido:** fontes muito pequenas (10–11px) e `overflow-hidden` cortando conteúdo (diagnosticado, não corrigido).

#### 6.1.2 Atendimento (`/crm/atendimento`)

- Lista de leads em atendimento; filtros por estágio.  
- Correções em 07/05 (bugs empilhados).  
- **Status:** funcional com 8 leads reais.

#### 6.1.3 Leads e pessoas

- `/crm/leads`, `/crm/pessoas`, `/crm/contatos`.

#### 6.1.4 Empresas

- `/crm/empresas` — cadastro PJ.

#### 6.1.5 Negócios e oportunidades

- `/crm/negocios` — estrutura existe; tabela com 0 registros.

#### 6.1.6 Hub de Parceiros (`/crm/parceiros`)

- Cadastro, homologação, performance, convites, captação.  
- **Status:** 10+ tabelas no banco; interface parcial.

#### 6.1.7 KPIs (`/crm/kpis`)

- 14 KPIs em `hub_kpis_definicao`; `hub_kpis_resultados` vazio.  
- **Status:** visual existe; cálculo automático não roda.

#### 6.1.8 Relatórios (`/crm/relatorios`)

- Tela existe; construção faltando; sem dados.

#### 6.1.9 Ciclos (`/crm/ciclos`)

- 8 ciclos cadastrados; visual OK; **ciclos não executam**.

#### 6.1.10 Aprovações (`/crm/aprovacoes`)

- Central de Aprovações; 3 cards mockados.  
- **Status:** visual OK; sem aprovações reais.

#### 6.1.11 Configurações (`/crm/configuracoes`)

- Tela existe; construção faltando.

### 6.2 Escritório Virtual (`/office`)

- Canvas isométrico; ~25 agentes em salas; Ariane com 5 poses.  
- Painel lateral com leads em tempo real; abas Office / Analytics; botões Aprovações, Alertas, Atendimento.  
- Mobile: 5 abas (Escritório, Marketing, Atendimento, Comando, Analytics).  
- **Componentes:** `OfficeCanvas.tsx`, `MobileExperience.tsx`, `Ariane.tsx`.

### 6.3 Módulo Agentes (`/agentes`)

- Catálogo dos 28 agentes (cargo, descrição, status, modelo).

### 6.4 Painel de Comando (`/comando`)

- Visão executiva: métricas, decisões pendentes, alertas.

### 6.5 Cadastro de Parceiros (`/parceiro`)

- Auto-cadastro via token; fluxo de homologação.

### 6.6 Webhook WhatsApp

- **`app/api/whatsapp/webhook/route.ts`** — recebe Evolution API; intenção/mercado; lead em `hub_leads_crm`; agente; prompt em camadas; Anthropic; resposta via Evolution; (CMD-OBS-1) observabilidade em 5 tabelas.

### 6.7 Outras APIs

- `/api/hub/agentes` — listagem e criação; detalhe/edição/arquivar por slug em `/api/hub/agentes/[slug]` (ver código em `app/api/hub/agentes/`).  
- `/api/hub/cargos`, `/api/hub/empresas`, `/api/hub/leads` (conforme implementado no repositório).  
- `/api/ciclos/atendente`, `/api/ciclos/gerente`, `/api/ciclos/diretor`  
- `/api/ml/aprovar`, `/api/validar/cpf`, `/api/validar/cnpj`, `/api/windsor/campanhas`, `/api/health`  

---

## 7. Funcionalidades em construção

### 7.1 Observabilidade do webhook (CMD-OBS-1)

- **Status:** código pronto (commit `0978a3e`), aguardando deploy no Vercel.  
- Após chamada bem-sucedida à Anthropic: `hub_prompt_logs`, `hub_conversas`, `hub_mensagens` (2 inserts), `hub_ciclos_log`, `hub_ciclos_ia` (incremento).  
- Cada `INSERT` em try/catch isolado — falha silenciosa não interrompe o webhook.

### 7.2 Resposta automática da IA

- **Status:** bloqueado por configuração — falta `ANTHROPIC_API_KEY` no Vercel (produção).  
- Comando sugerido: `npx vercel env add ANTHROPIC_API_KEY production` → redeploy → teste com lead real.

---

## 8. Visão futura — o sistema completo

Esta seção descreve o sistema completo idealizado (não é escopo exclusivo da Fase 1).

### 8.1 Multi-tenancy

Cada empresa cliente com Escritório Virtual próprio. No cadastro: `tenant_id` único; branding; agentes ativos; equipe humana; parceiros e fornecedores; IA contextualizada.  
**Implicação:** tabelas de dados com `tenant_id` para isolamento.

### 8.2 Escritórios virtuais por setor

- **Imobiliária:** corretor virtual, gestor de imóveis, captador, qualificador; vitrines e agendamento.  
- **Empreiteira:** gestor de obra, comprador, RH, financeiro; pedidos de material, operários, cronograma.  
- **Arquitetura:** assistente de projeto, prospector, especificador; projetos e orçamento.

### 8.3 Dashboards gerenciais

- **Obra (visual):** participantes, materiais, cronograma, fotos, decisões.  
- **Financeiro:** faturamento, custos por obra, margens, contas a pagar/receber, comissões.  
- **Compras:** estoque, pedidos, fornecedores, cotações, preços históricos.  
- **Projetos:** Kanban, fases, pendências, entregas.  
- **Comercial:** leads por origem, funil, negócios, parceiros/vendedores.  
- **Marketing (parcial hoje):** campanhas, CPL, ROAS, criativos (Windsor / APIs).

### 8.4 Sistema de aprovações universal

Expandir Central de Aprovações para: pagamento a fornecedor; comissão a parceiro; pedido de material acima de limite; novo parceiro/fornecedor; campanha; proposta acima de limite.  
Cada card: resumo, recomendação IA, documentos, Aprovar / Reprovar / Pedir informações.

---

## 9. Setores que faltam construir

### 9.1 Financeiro

**Agentes sugeridos:** `analista_financeiro`, `controller`, `cobranca_ia`, `pagamentos_ia`.  
**Funcionalidades:** contas a pagar/receber; conciliação; DRE; fluxo de caixa; comissões; NF; integração bancária (PIX, boleto).  
**Tabelas sugeridas:** `hub_contas_pagar`, `hub_contas_receber`, `hub_pagamentos`, `hub_recebimentos`, `hub_dre_mensal`, `hub_notas_fiscais`.

### 9.2 Compras

**Agentes:** `comprador_ia`, `negociador_ia`, `recebedor`.  
**Funcionalidades:** cotação automática; comparativo; aprovação; entrega; histórico de preços; avaliação.  
**Tabelas:** `hub_pedidos_material`, `hub_cotacoes`, `hub_cotacoes_respostas`, `hub_recebimentos_obra`, `hub_avaliacoes_fornecedor`.

### 9.3 Obras / execução

**Agentes:** `gestor_obra_ia`, `mestre_obra_ia`, `seguranca_ia`, `qualidade_obra_ia`.  
**Funcionalidades:** cadastro de obra; cronograma; ponto via WhatsApp; diário de obra; pedidos vinculados; operário ↔ empreiteira ↔ obra; relatório semanal ao cliente.  
**Tabelas:** `hub_obras`, `hub_obras_cronograma`, `hub_obras_diario`, `hub_operarios_checkin`, `hub_obras_ocorrencias`, `hub_obras_fotos`.

### 9.4 Projetos / arquitetura

**Agentes:** `assistente_projeto_ia`, `especificador_ia`, `revisor_projeto_ia`.  
**Funcionalidades:** projeto por cliente; fases; especificação; orçamento; visualização; revisões.  
**Tabelas:** `hub_projetos`, `hub_projetos_fases`, `hub_projetos_especificacoes`, `hub_projetos_revisoes`.

### 9.5 Imobiliária

**Agentes:** `corretor_ia`, `captador_ia`, `avaliador_ia`, `agendador_visitas_ia`.  
**Funcionalidades:** imóveis com fotos e valor; vitrine; visitas; propostas; comissões.  
**Existente:** `hub_imoveis` (vazia); `properties` (legada).

### 9.6 Administrativo / RH

**Agentes:** `rh_ia`, `juridico_ia`, `documentos_ia`.  
**Funcionalidades:** funcionários; contratos; ponto; documentos; vencimentos.

### 9.7 Pós-venda / CS

Expandir agente `cs`: onboarding, NPS, chamados, manutenção pós-obra, indicações.

---

## 10. WhatsApp, check-in e pedido de material

### 10.1 Filosofia

Operários, prestadores e clientes finais sem interface visual obrigatória — **WhatsApp-first**. A IA traduz mensagens casuais em ações.

### 10.2 Comandos sugeridos (visão completa)

**Operários (exemplos):**

| Mensagem (exemplo) | Ação |
|--------------------|------|
| “cheguei” | Check-in na obra atual |
| “saí” / “saindo” | Check-out |
| “preciso de 5 latas de tinta amanhã” | Pedido de material |
| “está faltando massa corrida” | Pedido prioritário |
| Foto | Anexo ao diário da obra |
| “concluí parede 3” | Atualização de cronograma |
| “problema com o piso” | Ocorrência |

**Clientes:** saudação + interesse → lead / SDR; “aprovado” → confirmação de etapa; “como está minha obra?” → resumo com fotos.

**Parceiros / fornecedores:** cotação com valor e prazo; confirmação de entrega; “novo lead …” registrado pelo parceiro.

### 10.3 Identificação automática

- **Quem:** telefone em `hub_pessoas`, `hub_profissionais`, `hub_parceiros`, `hub_empresas`; se não achar → lead novo (SDR).  
- **Contexto:** obra atual do operário; múltiplas obras → IA pergunta; parceiro com vários leads → confirmação.

### 10.4 Fluxo detalhado de pedido de material

Exemplo: operário João envia *“Preciso 5 latas tinta branca amanhã”*.

1. Webhook recebe; identifica João pelo telefone.  
2. IA resolve vínculos (`hub_profissionais` → empreiteira; `hub_operarios_checkin` ou cadastro → **obra atual**).  
3. Insert em `hub_pedidos_material` (obra, operário, empreiteira, item, quantidade, unidade, prazo, status `novo`).  
4. Notificações WhatsApp: gestor da obra, comprador da empresa cliente; confirmação curta ao operário.  
5. Busca fornecedores (ex.: `hub_empresas` com setor/tinta, região, ativos) — ex. **top 3**.  
6. Mensagens automáticas aos fornecedores com escopo da cotação e endereço/prazo.  
7. Fornecedores respondem em momentos diferentes; IA estrutura respostas.  
8. Persistência em `hub_cotacoes_respostas` (ou equivalente futuro).  
9. Card em `hub_aprovacoes` (tipo `pedido_material`, resumo, recomendação IA, tabela de cotações, valor total).  
10. Wendel (ou delegado autorizado) **aprova em 1 clique**.  
11. IA confirma pedido com fornecedor escolhido.  
12. Reserva em contas a pagar (módulo financeiro futuro).  
13. No recebimento na obra: confirmação (“recebi N unidades — ok”); baixa e liberação de pagamento.  
14. Painel da obra reflete estado em tempo real.

*(Tabelas `hub_pedidos_material`, `hub_cotacoes`, obras e check-in ainda não existem na maior parte — ver seção 10.5.)*

### 10.5 Tabelas necessárias

Muitas ainda **não existem:** `hub_obras`, `hub_operarios_checkin`, `hub_pedidos_material`, `hub_cotacoes`, `hub_cotacoes_respostas`, `hub_recebimentos_obra`, `hub_contas_pagar`.  
**Existentes:** `hub_empresas`, `hub_pessoas`, `hub_aprovacoes`, `hub_atividades`, `hub_log`.

### 10.6 Check-in / check-out

Mensagem → verificação de `obra_atual` → registro em `hub_operarios_checkin` (`entrada` / `saida`) → painel atualiza presença → horas trabalhadas; parâmetros opcionais (geolocalização, foto, alerta de atraso).

---

## 11. Dashboards por persona

### 11.1 Wendel (CEO — visão global)

Receita vs meta; pipeline; top oportunidades; aprovações pendentes; alertas; custo de tokens por agente; clientes ativos; saúde do sistema.

### 11.2 Empresa cliente

Leads; funil; obras; aprovações; parceiros e fornecedores; faturamento.

### 11.3 Comercial

Origem de leads; funil e tempo em cada estágio; leads parados; perdas; performance dos agentes IA.

### 11.4 Marketing

Meta/Google (investimento, CPL, CTR, ROAS, criativos, campanhas); fontes Windsor/Supermetrics/MCP conforme integrações.

### 11.5 Compras

Pedidos abertos; cotações; comparativo; ranking de fornecedores; alertas de prazo; histórico de preço.

### 11.6 Financeiro

Faturamento; custo e margem por obra; contas a pagar/receber; inadimplência; comissões.

### 11.7 Obra (visual)

Mapa do canteiro; avatares dos presentes; frentes; materiais; decisões; foto do dia; cronograma; alertas.

### 11.8 Hub parceiros (Wendel)

Ativos por mercado; homologação; match rate; tempo até fechamento; NPS; comissões; alertas de parceiros sem match.

### 11.9 Dashboard parceiro (restrito)

Leads próprios; matches; comissões; pagamentos; desempenho.

### 11.10 Dashboard fornecedor (restrito)

Cotações pendentes; confirmados; entregues; faturamento; avaliação; histórico.

---

## 12. Multi-empresa — como vai funcionar

### 12.1 Conceito

Cada empresa cliente recebe `tenant_id`, Escritório Virtual personalizado, agentes configuráveis, isolamento de dados, cadastro de parceiros/fornecedores e clientes próprios.

### 12.2 Onboarding de nova empresa cliente

1. Formulário: razão social, CNPJ, endereço, setor, plano, e-mail do responsável.  
2. Sistema cria `tenant_id`, linhas com escopo do tenant, login, defaults por setor.  
3. Wizard: branding, agentes ativos, primeiros parceiros/fornecedores, WhatsApp Business.  
4. Operação.

### 12.3 Implementação técnica

- **Estratégia:** multi-tenancy por linha (um banco, `tenant_id` em tabelas `hub_*`).  
- **Passos:** coluna `tenant_id` NOT NULL; `hub_tenants`; **RLS** no Supabase; queries sempre filtradas; JWT com `tenant_id`; contexto no frontend.  
- **Migração:** dados atuais como tenant raiz **OBRA10**; RLS gradual; testes com 2 tenants antes de produção multi-cliente.

---

## 13. Cronograma até 27/05/2026

**Referência:** hoje no documento original **08/05/2026**; meta **27/05/2026** (**19 dias corridos**); **2 devs seniors** + IA assistente + Wendel (PO/CEO).

### 13.1 Premissas

- Devs em tempo integral; Wendel para validações diárias.  
- Acesso a banco, repositório e deploy.  
- Decisões de produto em até **24 h**.

### 13.2 Fases sugeridas (resumo)

| Fase | Janela | Objetivo | Entregas principais |
|------|--------|----------|---------------------|
| **0 — Setup e saneamento** | 08–10/05 | Organizar antes de construir | Backup (já feito 08/05); GitHub remote; Vercel via push (`main`); backup diário (Drive/Actions); `ANTHROPIC_API_KEY`; HMAC webhook; auditar legado; corrigir slugs dos 3 ciclos; duplicata Ariane; README; **staging** separado |
| **1 — IA operacional** | 10–13/05 | Ciclos e resposta | Resposta ao lead em **menos de 30 s**; **8 ciclos** com `total_execucoes` maior que zero; KPIs automáticos; aprovações reais (sem mocks); CRM com dados reais; **mobile mínimo** |
| **2 — Parceiros** | 13–17/05 | Parceiros operando | Cadastro/homologação completo; login + dashboard restrito; leads app + WhatsApp; distribuição IA; comissões e notificações WhatsApp |
| **3 — Fornecedores** | 17–22/05 | Cotações | Cadastro por área; tags; CNPJ + CPFs; login fornecedor; UI de cotação; fluxo pedido → cotação → comparativo → aprovação → confirmação; avaliação |
| **4 — Multi-empresa básico** | 22–25/05 | Multi-tenant | `tenant_id` em `hub_*`; onboarding; personalização básica do office; **RLS** Supabase; piloto Wendel + 1 cliente |
| **5 — Polimento** | 25–27/05 | Go-live | E2E com piloto; bugs críticos; performance; doc usuário; termos/privacidade; monitoramento; plano de rollback |

### 13.2.1 Detalhamento das fases (texto integral)

**Fase 0 — Setup e saneamento (08–10/05) — 3 dias**  
Objetivo: organizar a casa antes de construir.

- Backup do projeto feito (referência: 08/05).  
- Configurar GitHub remote.  
- Configurar Vercel para deploy automático via push (branch `main`).  
- Configurar backup automático diário (Google Drive ou GitHub Actions).  
- Adicionar `ANTHROPIC_API_KEY` no Vercel (~5 min).  
- Reativar HMAC do webhook.  
- Auditar tabelas legadas; marcar quais arquivar.  
- Corrigir slug dos 3 ciclos do Diretor.  
- Resolver duplicata `ariane` vs `diretora_marketing`.  
- Documentação de setup do projeto (README).  
- Configurar ambiente de **staging** separado de produção.

**Fase 1 — IA operacional (10–13/05) — 4 dias**  
Objetivo: os 8 ciclos rodando autonomamente; leads sendo respondidos.

- IA respondendo lead WhatsApp em **menos de 30 segundos**.  
- Os **8 ciclos** rodando (todos com `total_execucoes` maior que zero).  
- KPIs calculados automaticamente.  
- Aprovações reais geradas pela IA (substituir mocks).  
- Dashboard CRM com dados reais.  
- Mobile responsivo (mínimo).

**Fase 2 — Parceiros (13–17/05) — 5 dias**  
Objetivo: parceiros (imobiliárias e corretores) cadastram-se e operam.

- Fluxo completo cadastro/homologação de parceiro.  
- Login para parceiros com dashboard restrito.  
- Parceiro cadastra leads via app + WhatsApp.  
- IA distribui leads para parceiros automaticamente.  
- Painel de comissões.  
- Cálculo automático de comissão por venda.  
- Notificações por WhatsApp para parceiros.

**Fase 3 — Fornecedores (17–22/05) — 6 dias**  
Objetivo: fornecedores cadastrados, recebendo cotações.

- Cadastro de fornecedores por área (arquitetura, engenharia, empreiteira, etc.).  
- Categorização e tags.  
- Estrutura empresa + funcionários (CNPJ + CPFs).  
- Login fornecedor com dashboard restrito.  
- Sistema de cotação (interface).  
- Workflow: pedido → cotação automática → comparação → aprovação → confirmação.  
- Avaliação de fornecedor.

**Fase 4 — Multi-empresa básico (22–25/05) — 4 dias**  
Objetivo: plataforma suporta mais de uma empresa cliente.

- Modelo multi-tenant com `tenant_id` nas tabelas `hub_*` pertinentes.  
- Onboarding de nova empresa cliente.  
- Personalização básica do Escritório Virtual por empresa.  
- RLS configurado no Supabase.  
- Cadastro de Wendel + 1 cliente piloto.

**Fase 5 — Polimento e validação (25–27/05) — 3 dias**  
Objetivo: sistema pronto para uso real.

- Testes end-to-end com cliente piloto real.  
- Bugs críticos corrigidos.  
- Performance otimizada.  
- Documentação para usuário final.  
- Termo de uso, privacidade.  
- Logs e monitoramento configurados.  
- Plano de contingência (rollback).

### 13.3 O que não cabe em 27/05 (fases futuras)

- **Junho:** check-in operário WhatsApp; pedido material WhatsApp; cotação automática end-to-end.  
- **Julho:** painel visual por obra; workflow imóvel → projeto → obra → produto.  
- **Agosto:** setores financeiro/compras/projetos amplos; múltiplos escritórios virtuais por setor.  
- **9+:** pós-venda completo; app nativo; integrações (banco, NFe); marketplace de parceiros.

---

## 14. O que eu peço de vocês — tarefas específicas

### 14.1 Tarefas imediatas (até 10/05)

**TAREFA 1 — Auditoria geral e diagnóstico próprio**  
- **Prazo:** 09/05 fim do dia · **Quem:** ambos os devs.  
- Não confiar só neste documento: navegar código, rodar local, listar o que funciona ou não.  
- **Entregas:** documento curto (1–2 páginas) com observações próprias; lista de bugs; sugestões arquiteturais; estimativa para cumprir **27/05**.

**TAREFA 2 — Configurar GitHub**  
- **Prazo:** 09/05 · **Quem:** 1 dev.  
- **Passos (documento original):** criar organização “obra10” (ou similar) no GitHub; adicionar Wendel como owner; criar repositório `escritorio-virtual` (privado); adicionar os 2 devs como admins; push do código atual; configurar branch protection: `main` precisa de PR review; configurar `.gitignore` direito (sem expor secrets).  
- Resumo: org (ex.: `obra10`), repo privado, Wendel owner, devs admins, push atual, **branch protection** em `main`, `.gitignore` sem secrets.

**TAREFA 3 — Conectar Vercel ao GitHub**  
- **Prazo:** 09/05 · **Quem:** mesmo da Tarefa 2.  
- **Passos (documento original):** conectar projeto Vercel ao GitHub; branch `main` = produção; branch `develop` = staging (criar); Pull Request gera preview deploy automático; garantir que push em `main` faz deploy automático.

**TAREFA 4 — Backup automático**  
- **Prazo:** 10/05 · **Quem:** 1 dev.  
- **Sugestão (documento original):** GitHub Actions que faz dump do banco Supabase + zip do código; salva em release no GitHub ou em bucket S3 ou em pasta no Google Drive; e-mail de confirmação semanal para Wendel.

**TAREFA 5 — Adicionar API key Anthropic**  
- **Prazo:** 09/05 · **Quem:** 1 dev.  
- **Passos (documento original):** `npx vercel env add ANTHROPIC_API_KEY production`; pegar valor do `.env.local` ou pedir a Wendel; redeploy; testar com lead real (Wendel manda mensagem WhatsApp); confirmar resposta automática chegando.

**TAREFA 6 — Reativar HMAC do webhook**  
- **Prazo:** 10/05 · **Quem:** 1 dev.  
- **Passos (documento original):** gerar secret HMAC novo; configurar na Evolution API (Railway); configurar no Vercel; reativar validação no código; testar que mensagem válida passa e falsa rejeita.

**TAREFA 7 — Corrigir slugs dos 3 ciclos do Diretor**  
- **Prazo:** 10/05 · **Quem:** 1 dev (com decisão Wendel).  
- **Decisão de produto necessária (Wendel):** “Diretor — Análise Matinal” → qual diretor? “Diretor — Análise Noturna” → qual? “Diretor — Tráfego 6h” → qual?  
- **Sugestão:** análises matinal e noturna → `diretor_geral_ia`; tráfego 6h → `diretor_operacoes` ou criar `diretor_marketing` separado.  
- Técnico: ciclos com `agente_slug = 'diretor'` → `UPDATE` para slug existente em `hub_agente_identidade`.

**TAREFA 8 — Auditar tabelas legadas (35)**  
- **Prazo:** 10/05 · **Quem:** 1 dev.  
- **Para cada tabela:** é usada pelo código atual? tem dados importantes? migrar para padrão `hub_*` ou marcar como `_legacy`?  
- **Regra suprema:** nunca `DELETE`; sempre `ativo=false` ou rename para `legacy_*`.  

### 14.2 Tarefas de construção (10–27/05)

Seguir o cronograma da **Seção 13**.

Para cada fase:

- **Diário:** atualização rápida (3 linhas: o que fiz hoje; o que farei amanhã; bloqueios).  
- **Semanal:** demo das entregas.  
- **Cada deploy:** validação em **staging** antes de produção.

### 14.3 Decisões de produto (Wendel)

1. Slug dos **3 ciclos do Diretor** (urgente).  
2. **Duplicata** `ariane` vs `diretora_marketing`.  
3. Hierarquia de **planos** (Starter, Pro, Enterprise) — preços e diferenças.  
4. **Logo**, paleta e **nome final** do produto.  
5. **Permissões** granulares (quem vê/aprova o quê).  
6. **Política de comissão** de parceiros (% padrão e regras).  
7. **SLA** de resposta da IA (tempo máximo para responder lead).

O time pode relembrar Wendel dessas decisões conforme as fases avançam.

### 14.4 Modo de trabalho

**Comunicação**

- Canal dedicado (Slack, grupo WhatsApp, Discord — a definir).  
- Stand-up **assíncrono** diário ~9h: ontem / hoje / bloqueios (**3 linhas**).  
- Reunião semanal **~30 min** (ex.: sextas).  
- Decisões de produto: perguntar a Wendel; resposta em até **24 h**.

**Código**

- Tudo via **Pull Request**; sem push direto em `main`.  
- **2 revisores** por PR quando possível (entre os dois devs).  
- **Tag** de proteção antes de mudanças grandes.  
- **Nunca DELETE** — `ativo=false` ou equivalente.

**Banco**

- Migrations versionadas; sem `DROP TABLE` agressivo; backup antes de mudanças grandes.

**Segurança**

- Sem secrets no git; **HMAC** ativo no webhook; **RLS** no Supabase nas tabelas pertinentes; **audit logs** em mudanças críticas.

---

## 15. Padrões de qualidade e regras supremas

### 15.1 Proteção e backup

1. Porta **3000** reservada ao projeto **Codex** — dev local em **3001+**.  
2. Tag de proteção antes de mudanças grandes.  
3. **Nunca DELETE** — usar `ativo=false` ou arquivamento reversível.  
4. Testar reversão antes de mudança destrutiva.  
5. Proteger contexto em operações longas.  

### 15.2 Escopo

6. Escopo cirúrgico — só o combinado.  
7. Não implantar tudo de uma vez.  
8. Meta-regra: escopo + backup + permissão + log + teste + impacto + ambiente.  

### 15.3 Decisão

9. Dinheiro/contrato/comissão/status: **sempre** via Central de Aprovações (não só IA).  
10. Decisão técnica pura: time decide com critério.  
11. Perguntas ao Wendel: com sugestão + justificativa em 1 linha.  
12. Se quebrar: parar, rollback, replanejar.  

### 15.4 Comunicação

13. Comunicação direta.  
14. Sugestões com justificativa.  
15. Validação humana pós-deploy antes da próxima mudança.  

### 15.5 Ambiente

16. Local: porta 3001+.  
17. Não tocar em `C:\Users\wende\Documents\Codex`.  

### 15.6 Tempo

18. Timeout por tarefa: 15 min (simples), 30 min (complexa).  
19. Avisar Wendel em sessões longas.  

### 15.7 Operacional

20. Progresso em `hub_caderno`.  
21. Revisão de segurança periódica.  
22. Aviso 85% capacidade do chat — salvar contexto.  
23. Novas regras úteis: propor implantação.  
24. Conflito entre regras: sinalizar.  
25. Handoff: registro completo no `hub_caderno`.  

### 15.8 Palavras-gatilho

- **“salva isso”** → gravar no `hub_caderno`  
- **“continua”** → próximo passo sem perguntar  
- **“voltei”** → nova sessão; ler caderno  
- **“errado”** → parar; validar com `SELECT`  
- **“redundância”** → backup triplo  
- **“handoff”** → registro completo  
- **“confio em você”** → decisão delegada (raro)  

---

## Conclusão

Pessoal,

Esse é o quadro completo. Sei que é muita informação, mas eu não tinha como passar nada disso só por chat ou reunião. Agora vocês têm:

- O contexto completo do produto  
- O estado real do código e do banco  
- Os débitos técnicos identificados  
- A visão futura  
- O cronograma até 27/05  
- Tarefas específicas que peço da equipe  
- As regras que regem o projeto  

**Próximos passos imediatos**

1. Vocês leem isso com calma (**1–2 horas**).  
2. Auditam o sistema vocês mesmos (**1 dia**).  
3. Me dão um retorno: *“consigo entregar a meta de 27/05”* ou *“preciso mudar isso e aquilo no plano”*.  
4. A gente alinha numa reunião curta (**30 min**).  
5. Começamos a **Fase 0**.

Estou disponível para qualquer pergunta, hoje, amanhã ou no fim de semana. Não travem de me perguntar nada. Vamos fazer isso acontecer juntos. Conta comigo.

**Wendel — CEO, Obra10+**  
Documento gerado em **08/05/2026**. Versão **1.0**. Para alterações ou dúvidas: contatar Wendel diretamente.

---

*Arquivo em `docs/` como referência canónica do time; alinhar decisões de produto e prioridades com este texto.*
