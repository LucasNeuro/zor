# Auditoria schema OBRA10 (`zollengyqtmyhnbrkepu`)

**Data:** 2026-05-22  
**Fonte:** `npx supabase db query --linked` + inventário `docs/documento-mestre-obra10-v1.md`

## Tabelas `hub_*` no remoto (antes do pacote integral)

| Tabela | Estado |
|--------|--------|
| `hub_tenants` | OK |
| `hub_leads_crm` | OK (ensure 20260522130000) |
| `hub_negocios` | OK (ensure 20260522120000) |
| `hub_empresas` | OK (ensure 20260522140000) |
| `hub_pessoas` | OK |
| `hub_atividades` | OK (só `lead_id`; faltava `negocio_id`) |
| Admin/signup (`hub_admins`, `hub_partner_org_*`, …) | OK (fora do CRM operacional) |

## Ausentes no remoto (aplicadas em `20260523120000_crm_integral_core.sql`)

- Comercial: `hub_notas`, `hub_servicos`, `hub_propostas`, `hub_memorias_lead`
- Produtos: `hub_imoveis`
- Atendimento: `hub_aprovacoes` (tipos reais)
- KPIs: `hub_kpis_definicao`, `hub_kpis_metas`, `hub_kpis_resultados`
- Obras: `hub_obras`, `hub_obras_cronograma`, `hub_obras_diario`, `hub_operarios_checkin`, `hub_obras_fotos`, `hub_obras_ocorrencias`
- Compras: `hub_pedidos_material` (+ ligação a `hub_cotacoes_pedidos` se existir)
- Projetos: `hub_projetos`, `hub_projetos_fases`
- Financeiro: `hub_contas_pagar`, `hub_contas_receber`
- Generalização: `hub_atividades.negocio_id`, `tenant_id` em tabelas novas

## Divergência de projeto

- Doc histórico: `cdjlqsznerdhwqyunodl`
- Desenvolvimento atual: **OBRA10** `zollengyqtmyhnbrkepu` (`.env.local` + migrações `ensure_*`)

## Próxima verificação

```bash
npx supabase db query --linked "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'hub_%' ORDER BY 1;"
```
