# UAZAPI — WhatsApp (único provedor)

O escritório virtual usa **apenas UAZAPI** para envio e receção de mensagens WhatsApp.

## Deploy no Render

1. **Supabase (antes do go-live):** aplicar migrações, em especial `20260605120000_ensure_hub_leads_crm_tenant.sql` (coluna `tenant_id` em `hub_leads_crm`). Depois: Dashboard → API → **Reload schema**.
2. **Web service** (`render.yaml`): definir variáveis listadas no topo do ficheiro; `NEXT_PUBLIC_APP_URL` = `https://<seu-servico>.onrender.com` (sem barra final).
3. **Após deploy:** em cada agente WhatsApp, selecionar **cidade do proxy** (região do número) → **Guardar região** → **QR / pareamento** (sincroniza webhook). Valores ficam em `hub_agente_identidade` (migração `20260619100000_hub_agente_uazapi_proxy.sql`).
4. **Segredo do webhook:** defina `WEBHOOK_SECRET` no Render. Ao parear/atualizar o agente, o app regista na UAZAPI a URL `…/api/whatsapp/webhook?wh=<segredo>` (o parâmetro `wh` vem de `WEBHOOK_SECRET_QUERY_PARAM`). Opcional: o mesmo valor no header `x-webhook-secret` no painel UAZAPI.
5. **Teste:** `npm run smoke:webhook` (local) ou enviar mensagem real no WhatsApp e confirmar log `POST /api/whatsapp/webhook` no Render.

## Logs estruturados no Render (diagnóstico WhatsApp)

Cada mensagem inbound gera linhas JSON no stdout (uma por evento), com `traceId` para correlacionar.

**Filtros úteis no Live Tail:**

| Filtro | Significado |
|--------|-------------|
| `"scope":"whatsapp_webhook"` | Só fluxo do webhook |
| `"event":"wa.webhook.received"` | UAZAPI chegou ao servidor |
| `"event":"wa.webhook.auth_failed"` | Segredo `?wh=` / header errado |
| `"event":"wa.webhook.resolver_ignored"` | Instância não mapeada / não connected |
| `"event":"wa.webhook.lead_failed"` | Erro ao criar lead (ex. `tenant_id`) |
| `"event":"wa.webhook.ia_ok"` | IA respondeu |
| `"event":"wa.webhook.send_text"` | Tentativa envio UAZAPI |
| `"outcome":"ok"` | Fluxo concluído com sucesso |

Variável opcional: `LOG_LEVEL=debug` (default `info`).

**Importante:** logs do webhook aparecem no **terminal do servidor** (Render Logs / `npm run dev`), não no Console do browser (F12).

## Variáveis (`.env.local` / Render / Vercel)

```env
UAZAPI_BASE_URL=https://SUBDOMINIO.uazapi.com
UAZAPI_INSTANCE_TOKEN=token_da_instancia_no_painel_uazapi

WEBHOOK_SECRET=valor_longo_aleatorio
WEBHOOK_SECRET_HEADER=x-webhook-secret
WHATSAPP_VERIFY_TOKEN=opcional_meta_style_get
```

- **Envio:** `POST {UAZAPI_BASE_URL}/send/text` com header `token` = `UAZAPI_INSTANCE_TOKEN`, body `{ "number": "5511...", "text": "..." }`.
- **Código:** `lib/whatsapp/uazapi-send.ts`, `lib/whatsapp/whatsapp-send.ts`.

## Webhook (mensagens recebidas)

1. No painel UAZAPI (webhook global ou por instância):
   - **URL:** `https://<teu-dominio>/api/whatsapp/webhook?wh=<WEBHOOK_SECRET>` (o CRM sincroniza ao clicar **Actualizar estado** / **Sincronizar webhook**).
   - **Eventos:** `messages` (e opcionalmente `connection`).
   - **Excluir:** `wasSentByApi` + `isGroupYes` — **nunca** `wasNotSentByApi` (bloqueia mensagens dos clientes).
2. Em produção, defina `WEBHOOK_SECRET` no Render/Vercel. O Next aceita:
   - Query na URL (`?wh=<segredo>`) — **recomendado**; sincronizado automaticamente ao conectar o agente.
   - Header customizado (`WEBHOOK_SECRET_HEADER`, default `x-webhook-secret`) com o mesmo valor.
   - `Authorization: Bearer <WEBHOOK_SECRET>`.
   - HMAC SHA-256 do body em `x-hub-signature-256` ou `x-signature` (`sha256=<hex>`).
3. Local (só dev): `WEBHOOK_SKIP_SIGNATURE_VERIFY=true` — **não** use em produção.

**Parser:** apenas payload **UAZAPI** (`lib/whatsapp/webhook-inbound.ts`). Formato Evolution (`messages.upsert`) não é mais suportado.

## Testar envio manual

```bash
curl -X POST "https://SUBDOMINIO.uazapi.com/send/text" \
  -H "Content-Type: application/json" \
  -H "token: SEU_INSTANCE_TOKEN" \
  -d '{"number":"5511999990000","text":"Teste Obra10+"}'
```

## Fluxo no app

```
WhatsApp → UAZAPI → POST /api/whatsapp/webhook
  → CRM (lead, fila, atividades)
  → IA (lib/ia/engine + prompt-builder)
  → whatsappSendText → UAZAPI /send/text
```

Spec OpenAPI de referência: `docs/uazapi-openapi-spec (16).yaml`.

## Dry-run (desenvolvimento)

Sem `UAZAPI_*` configurado, em `next dev` a Central de atendimento pode gravar mensagens no CRM sem enviar (`WHATSAPP_DRY_RUN=1` força o mesmo comportamento).
