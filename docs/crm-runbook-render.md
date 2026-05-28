# Runbook CRM PDF — deploy Render

Ordem segura para alinhar o CRM aos PDFs Hub Obra10+ sem quebrar produção.

## 1. Migrations (Supabase linked)

Aplicar **nesta ordem** (aditivas):

1. `20260528120000_hub_crm_pdf_refinamento.sql` — `hub_logs`, colunas encaminhamento, `estagio_funil`, `hub_pessoas_empresas`
2. `20260620180000_hub_pipelines_vinculos.sql` (se ainda não aplicada)
3. `20260628120000_hub_pipeline_estagios_pdf_seed.sql` — seed 8 etapas leads + etapas por mercado

```bash
npx supabase db push
```

**Critério:** `GET /api/crm/pipelines?tipo=lead` → 8 colunas PDF; `?tipo=negocio&mercado=IMB` → etapas imobiliárias.

## 2. Staging / preview Render

Variáveis (Environment):

| Variável | Staging | Produção (fase inicial) |
|----------|---------|-------------------------|
| `CRM_PIPELINE_V2` | `true` | `false` → `true` após smoke |
| `CRM_ENCAMINHAMENTO_V2` | `true` | `false` → `true` |
| `CRM_PROXIMA_ACAO_OBRIGATORIA` | `false` | `false` |
| `CRM_LOGS_AUDITORIA` | `true` | `true` |

## 3. Smoke tests manuais

- [ ] Kanban leads: arrastar card → persiste etapa PDF (`em_atendimento`, etc.)
- [ ] Marcar **Perdido** sem motivo → erro 400
- [ ] **Encaminhar** lead → registo em `hub_encaminhamentos` + estágio `encaminhado`
- [ ] **Converter em negócio** → lead `convertido_negocio`, negócio `novo_negocio` no pipeline do mercado
- [ ] Kanban negócios: abas por mercado (IMB, ARQ, …) com colunas específicas
- [ ] Lead rápido: tipo de interesse altera campos visíveis
- [ ] Ficha pessoa/empresa: abas Resumo, Dados, Vínculos, Leads e negócios

## 4. Rollout produção

1. Deploy código com flags **desligadas** (`CRM_PIPELINE_V2=false`, `CRM_ENCAMINHAMENTO_V2=false`).
2. Aplicar migrations em produção.
3. Smoke em staging com flags `true`.
4. Ligar `CRM_PIPELINE_V2=true` em produção; monitorar 24h.
5. Ligar `CRM_ENCAMINHAMENTO_V2=true`.
6. Opcional: `CRM_PROXIMA_ACAO_OBRIGATORIA=true` após equipe treinada.

## 5. Rollback

- Desligar flags (comportamento legado na API).
- Dados em `estagio_funil`, `hub_logs` e encaminhamentos permanecem; não há DROP.

## Referências

- Matriz de aderência: [`crm-aderencia-pdfs.md`](./crm-aderencia-pdfs.md)
- Spec em código: [`lib/crm/pipelines.ts`](../lib/crm/pipelines.ts)
