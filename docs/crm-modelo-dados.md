# CRM Obra10+ — modelo de dados

Projeto Supabase: **OBRA10** (`zollengyqtmyhnbrkepu`). Toda tabela operacional inclui `tenant_id UUID → hub_tenants(id)` quando aplicável.

## Comercial

| Tabela | FKs principais | Notas |
|--------|----------------|-------|
| `hub_leads_crm` | `pessoa_id`, `tenant_id` | Estágios: novo → ganho/perdido |
| `hub_negocios` | `lead_id`, `pessoa_id`, `empresa_id`, `tenant_id` | Etapas: briefing, match, sit-down, concluido |
| `hub_atividades` | `lead_id`, `negocio_id` (opcional) | Timeline unificada |
| `hub_notas` | `lead_id` | Notas internas |
| `hub_propostas` | `lead_id`, `negocio_id`, `servico_id` | Status comercial |
| `hub_servicos` | — | Catálogo de serviços |
| `hub_memorias_lead` | `lead_id` | IA / qualificação |

## Cadastros e produtos

| Tabela | Uso |
|--------|-----|
| `hub_pessoas` | PF/PJ, vínculo lead |
| `hub_empresas` | CNPJ, acesso portal |
| `hub_imoveis` | Captação imobiliária |

## Obras e compras (Fase B)

| Tabela | Uso |
|--------|-----|
| `hub_obras` | Execução; `negocio_id`, `imovel_id` |
| `hub_obras_cronograma` | Fases % |
| `hub_obras_diario` | Registro diário |
| `hub_operarios_checkin` | cheguei/saí (WhatsApp) |
| `hub_obras_fotos` | Evidências |
| `hub_obras_ocorrencias` | Alertas |
| `hub_pedidos_material` | Compras por obra |

## Projetos e financeiro (Fases C–D)

| Tabela | Uso |
|--------|-----|
| `hub_projetos` | Projeto arquitetônico |
| `hub_projetos_fases` | Entregas |
| `hub_contas_pagar` / `hub_contas_receber` | Fluxo financeiro mínimo |

## KPIs e aprovações

| Tabela | Uso |
|--------|-----|
| `hub_kpis_definicao` | Slugs imutáveis |
| `hub_kpis_metas` | Metas por agente |
| `hub_kpis_resultados` | Medições (job `/api/crm/kpis/calcular`) |
| `hub_aprovacoes` | proposta, pedido_material, pagamento |

## Migrações

- `20260523120000_crm_integral_core.sql` — pacote principal
- `20260523150000_crm_rls_extended.sql` — RLS negócios/empresas/pessoas

Ver também [`crm-schema-audit-obra10.md`](./crm-schema-audit-obra10.md).
