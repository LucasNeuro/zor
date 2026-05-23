# CRM operacional — checklist mínimo

## `.env.local` obrigatório

- `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (projeto **OBRA10**)
- `INTERNAL_API_KEY` = `NEXT_PUBLIC_INTERNAL_API_KEY`
- `DEFAULT_TENANT_ID` / `NEXT_PUBLIC_TENANT_ID` = `00000000-0000-4000-8000-000000000001`

## WhatsApp + IA (para fluxo automático)

- `MISTRAL_API_KEY` ou `ANTHROPIC_API_KEY`
- `UAZAPI_BASE_URL` + `UAZAPI_INSTANCE_TOKEN`
- `CRON_SECRET` + `NEXT_PUBLIC_APP_URL`

## Migrações OBRA10 (aplicar com)

```bash
npx supabase db query --linked -f supabase/migrations/20260523120000_crm_integral_core.sql
npx supabase db query --linked -f supabase/migrations/20260523170000_obra10_runtime_essencial.sql
```

## Cron KPIs (produção)

`vercel.json` chama `POST /api/crm/kpis/calcular` às :15 de cada hora. Defina `CRON_SECRET` no Vercel (o cron envia `Authorization: Bearer …`).

## Validar

1. `/crm` — cards + **Pipeline comercial** (novo)
2. `/crm/leads` — kanban; ficha com aba **Propostas** e **Criar negócio**
3. `/crm/negocios` — kanban + detalhe
4. `/crm/atendimento` — inbox (após mensagem na fila)
5. `/crm/aprovacoes` — cards com schema alinhado
