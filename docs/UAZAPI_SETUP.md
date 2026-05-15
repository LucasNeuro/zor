# UAZAPI — WhatsApp (único provedor)

O escritório virtual usa **apenas UAZAPI** para envio e receção de mensagens WhatsApp.

## Variáveis (`.env.local` / Vercel)

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

1. No painel UAZAPI, configure o webhook para:
   - **URL:** `https://<teu-dominio>/api/whatsapp/webhook`
   - **Eventos:** mensagens recebidas (`message` / `messages`).
2. Em produção, defina `WEBHOOK_SECRET` no Vercel. O Next aceita:
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
