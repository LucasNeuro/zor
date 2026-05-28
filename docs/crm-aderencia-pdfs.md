# Aderência CRM — PDFs Hub Obra10+

Matriz **requisito → sistema atual** (branch `feature/escritorio-visual`, pós-sync com produção).  
Fontes: *Hub_Obra10_Funil_Operacional_CRM.pdf* e *Hub_Obra10_Documento_Funcional_Consolidado.pdf*.

## Checklist deploy (atualizar após cada ambiente)

| Item | Local | Staging | Produção |
|------|-------|---------|----------|
| Migration `20260528120000_hub_crm_pdf_refinamento.sql` | repo ✓ | ☐ | ☐ |
| Migration `20260628120000_hub_pipeline_estagios_pdf_seed.sql` | repo ✓ | ☐ | ☐ |
| `CRM_PIPELINE_V2=true` | `.env.local` | ☐ | ☐ |
| `CRM_ENCAMINHAMENTO_V2=true` | ☐ | ☐ | ☐ |
| Smoke kanban leads (8 etapas) | ☐ | ☐ | ☐ |
| Analytics — funil leads (8 linhas, zeros visíveis) | ☐ | ☐ | ☐ |
| Analytics — funil negócios (aba mercado + `?mercado=`) | ☐ | ☐ | ☐ |

Aplicar migrations: `npx supabase link` + `npx supabase db push` (ver [crm-runbook-render.md](crm-runbook-render.md)).

## Legenda

| Status | Significado |
|--------|-------------|
| OK | Implementado e utilizável em produção |
| PARCIAL | Existe, mas não cobre o PDF |
| GAP | Não implementado |
| LEGADO | Manter; não remover sem plano |

---

## Resumo executivo

| Área | Situação |
|------|----------|
| Entidades (lead, pessoa, empresa, negócio, imóvel) | **OK / PARCIAL** |
| Funil de leads (PDF) | **OK** — código + seed; aplicar migration em prod |
| Funis de negócio por mercado (PDF) | **OK** — seed por mercado; validar após `db push` |
| Encaminhamento antifraude | **OK** — API V2 + modal; flag `CRM_ENCAMINHAMENTO_V2` |
| Atendimento / WhatsApp / agentes | **OK** |
| Financeiro, obras, projetos | **PARCIAL** — módulos existem, fichas incompletas |
| Homologação sem duplicar “parceiro” | **PARCIAL** — `hub_parceiros` + pessoas/empresas |
| Pipelines configuráveis | **OK** — `hub_pipelines` + etapas PDF em `pipelines.ts` |

---

## Entidades

| Requisito PDF | Tabela / API | UI | Status |
|---------------|--------------|-----|--------|
| Lead (entrada, ≠ negócio) | `hub_leads_crm` | `/crm/leads`, `/crm/atendimento` | OK |
| Pessoa PF permanente | `hub_pessoas` | `/crm/pessoas` | OK (abas Resumo, Dados, Vínculos, Leads/negócios) |
| Empresa PJ | `hub_empresas` | `/crm/empresas` | OK (mesmas abas) |
| Vínculo pessoa–empresa | `hub_pessoas_empresas` | fichas + `/api/crm/*/vinculos` | PARCIAL (tabela após migration) |
| Negócio (centro) | `hub_negocios` | `/crm/negocios` | OK |
| Vínculos negócio | `hub_negocio_vinculos` | API + detalhe | PARCIAL |
| Imóvel / ativo | `hub_imoveis` | `/crm/imoveis` | OK |
| Homologação em pessoa/empresa | status + `hub_parceiros` | `/crm/parceiros` | PARCIAL |
| Próxima ação | colunas `proxima_acao` em lead | leads/atendimento | PARCIAL (sem tabela dedicada) |
| Encaminhamento | `hub_encaminhamentos` | dashboard, APIs | PARCIAL |
| Logs de mudança de etapa | `hub_logs` + `registrarLogCrm` | API leads/negócios | OK (flag `CRM_LOGS_AUDITORIA`) |
| Projetos / obras | APIs + `/crm/projetos`, `/crm/obras` | PARCIAL |

---

## Funis — PDF vs código atual

### Funil de leads (PDF — 8 etapas)

| PDF | Código atual (`ESTAGIOS_PADRAO` / seed) |
|-----|----------------------------------------|
| Novo | `novo` ✓ |
| Em atendimento | — **GAP** |
| Aguardando resposta | — **GAP** |
| Qualificando | `qualificando` ✓ |
| Encaminhado | — **GAP** (existe encaminhamento, não estágio) |
| Convertido em negócio | — **GAP** (existe API converter; estágio não) |
| Perdido | `perdido` ✓ |
| Spam ou inválido | — **GAP** |
| *(extra no código)* | `qualificado`, `proposta`, `negociando`, `fechamento`, `ganho` |

### Funil de negócios por mercado (PDF)

Cada mercado no PDF tem **10–12 etapas próprias** (ex.: imobiliário: contato validado → documentação → fechado).  
O seed `20260620183000_hub_pipelines_seed_mercados.sql` replica os **mesmos 8 estágios genéricos** em todos os mercados → **GAP de conteúdo**, não de infraestrutura.

Infraestrutura pronta: `hub_pipelines`, `hub_pipeline_estagios`, API `/api/crm/pipelines`.

### Analytics (`/crm/analytics`)

| Requisito | Implementação |
|-----------|----------------|
| Funil de leads — 8 etapas PDF sempre visíveis | `FUNIL_LEAD_ETAPAS` em `aggregateAnalytics` + `FunilOperacionalChart` (contagem `0` à direita) |
| Snapshot operacional (não cascata de conversão) | Subtítulo no card de leads |
| Funil de negócios por mercado | `GET /api/crm/analytics?mercado=IMB` + `buildFunilNegociosPorMercado` (`ETAPAS_NEGOCIO_POR_MERCADO` / estágios BD) |
| Escolha obrigatória de mercado | `PipelineTabsBar`; sem aba seleccionada, placeholder no card |
| Ordem das etapas de negócio | Pipeline `hub_pipeline_estagios` por `mercado_sigla`; fallback `pipelines.ts` |

---

## Regras PDF vs sistema

| Regra PDF | Sistema | Status |
|-----------|---------|--------|
| Lead perdido exige motivo | `motivo_perda` + validação parcial na API | PARCIAL |
| Lead → negócio com vínculo | `POST /api/crm/leads/[id]/converter-negocio` | OK |
| Encaminhamento: quem, quando, IA/humano | `hub_encaminhamentos` campos mínimos | PARCIAL |
| Próxima ação obrigatória para avançar | coluna existe; bloqueio global | GAP |
| Follow-up automático (aguardando resposta) | — | GAP |
| Negócio ganho → derivados (obra, projeto…) | links em UI; automação | GAP |
| IA não encaminha sem validação humana | fluxo aprovações / agentes | PARCIAL |

---

## O que já pode usar (sem quebrar produção)

1. **Pipelines por mercado** — UI em `/crm/leads` (`PipelineTabsBar`) + API; ajustar estágios via migration seed **aditiva** (novos slugs, mapeamento legado).
2. **Conversão lead → negócio** — botão/API existentes; alinhar estágio visual “convertido”.
3. **Atendimento + WhatsApp** — manter; PDF complementa regras de estágio, não substitui canal.
4. **Financeiro / obras / projetos** — evoluir fichas; não renomear tabelas em uso.

---

## Plano seguro de aplicação (recomendado)

### Fase 1 — Banco (só aditivo)

- Nova migration: estágios PDF em `hub_pipeline_estagios` (por `slug` de pipeline).
- Colunas opcionais em `hub_leads_crm`: `estagio_legacy`, mapeamento `estagio` antigo → novo.
- Expandir `hub_encaminhamentos`: `autorizado_por`, `sugestao_ia`, `status_retorno`, etc.
- **Não** dropar `estagio` nem CHECK até mapeamento 100%.

### Fase 2 — API (compatível)

- PATCH lead: aceitar slugs novos + antigos; validar motivo em `perdido` / `spam`.
- Feature flag `CRM_FUNIL_PDF_V1` (default off em produção até validar).
- Logs em tabela nova `hub_logs` ou reutilizar `hub_atividades`.

### Fase 3 — UI

- Kanban leads com 8 colunas PDF.
- Kanban negócios lendo estágios do pipeline do mercado selecionado.
- Motivos de perda (lista fechada do PDF).
- Encaminhar: modal com campos obrigatórios do PDF.

### Fase 4 — Automação (opcional)

- Cron/job: lead em “aguardando resposta” → tarefa follow-up.
- Webhook WhatsApp: transição “em atendimento” na primeira resposta.

---

## Legado (não remover)

- `hub_leads` + canvas `/office`
- Rotas `/api/leads` antigas
- `hub_parceiros` e fluxo de homologação atual
- Pipelines com slugs `novo`…`perdido` já em produção

---

## Referência rápida de código

| Tema | Arquivo |
|------|---------|
| Spec PDF (etapas, motivos) | `lib/crm/pipelines.ts` |
| Mapeamento legado ↔ funil | `lib/crm/estagio-map.ts` |
| Regras lead / negócio | `lib/crm/lead-rules.ts`, `lib/crm/negocio-rules.ts` |
| Flags | `lib/crm/feature-flags.ts` |
| Migration PDF refinamento | `supabase/migrations/20260528120000_hub_crm_pdf_refinamento.sql` |
| Seed etapas PDF | `supabase/migrations/20260628120000_hub_pipeline_estagios_pdf_seed.sql` |
| API pipelines | `app/api/crm/pipelines/route.ts` |
| UI leads | `app/crm/leads/page.tsx` |
| Converter negócio | `app/api/crm/leads/[id]/converter-negocio/route.ts` |
| Lead por tipo interesse | `lib/crm/lead-campos-por-tipo.ts`, `LeadRapidoSideover` |
| Funil analytics (PDF) | `lib/crm/funil-analytics.ts`, `components/crm/FunilOperacionalChart.tsx` |
| API analytics | `app/api/crm/analytics/route.ts`, `lib/crm/analytics-aggregate.ts` |
| UI analytics | `components/crm/CrmAnalyticsDashboard.tsx` |

Ver também: [crm-operacional-checklist.md](crm-operacional-checklist.md), [crm-runbook-render.md](crm-runbook-render.md).
