# Deploy no Render — Escritório Virtual (CRM Waje)

Guia passo a passo para subir a app no Render (projeto vazio) e ligar o WhatsApp via UAZAPI.

## Pré-requisitos

- Repositório Git (GitHub/GitLab) com o código em `escritorio-virtual/`
- Projeto Supabase com migrações aplicadas
- Conta UAZAPI com servidor (ex. `https://fitbot.uazapi.com`)
- Tokens UAZAPI: **Admin Token** + **Instance Token** da instância WhatsApp

---

## 1. Criar serviços no Render

### Opção A — Blueprint (recomendado)

1. Render Dashboard → **New** → **Blueprint**
2. Conectar o repositório Git
3. Apontar para `render.yaml` na raiz de `escritorio-virtual`
4. Render cria 3 serviços:
   - `escritorio-virtual` (Web)
   - `whatsapp-job-worker` (Worker)
   - `dispatch-ciclos-cron` (Cron)

### Opção B — Manual (só Web Service)

1. **New** → **Web Service**
2. Runtime: **Node**
3. Build: `npm install && npm run build`
4. Start: `npm run start`
5. Root directory: pasta do projeto (se o repo tiver subpasta)

---

## 2. Variáveis de ambiente (Web Service)

No Render → serviço `escritorio-virtual` → **Environment**:

| Variável | Exemplo / notas |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave anon |
| `SUPABASE_SERVICE_ROLE_KEY` | service role (segredo) |
| `NEXT_PUBLIC_APP_URL` | `https://seu-app.onrender.com` **sem barra final** |
| `WEBHOOK_SECRET` | string longa aleatória (mesmo valor na URL UAZAPI) |
| `WEBHOOK_SECRET_HEADER` | `x-webhook-secret` |
| `UAZAPI_BASE_URL` | `https://fitbot.uazapi.com` |
| `UAZAPI_ADMIN_TOKEN` | token admin do painel UAZAPI |
| `UAZAPI_INSTANCE_TOKEN` | token da instância WhatsApp |
| `MISTRAL_API_KEY` | IA no webhook |
| `CRON_SECRET` | Bearer para cron jobs |
| `DEFAULT_TENANT_ID` | `00000000-0000-4000-8000-000000000001` |
| `INTERNAL_API_KEY` | chave interna API |
| `NEXT_PUBLIC_INTERNAL_API_KEY` | **mesmo valor** que `INTERNAL_API_KEY` |
| `NEXT_PUBLIC_TENANT_ID` | mesmo que `DEFAULT_TENANT_ID` |

### Worker `whatsapp-job-worker`

Repetir: Supabase, `UAZAPI_BASE_URL`, `UAZAPI_INSTANCE_TOKEN`, `MISTRAL_API_KEY`, `DEFAULT_TENANT_ID`.

---

## 3. Deploy

1. **Save** nas variáveis
2. **Manual Deploy** ou push no Git
3. Aguardar build (`npm run build`) terminar com sucesso
4. Abrir `https://seu-app.onrender.com` e fazer login no CRM

---

## 4. Webhook global UAZAPI

A app recebe mensagens em:

```
https://seu-app.onrender.com/api/whatsapp/webhook?wh=SEU_WEBHOOK_SECRET
```

**Não usar** `/webhook/uazapi` — essa rota não existe neste app.

### Configurar no painel UAZAPI

1. Servidor **fitbot** → **Webhook Global**
2. **Habilitado:** ON
3. **Method:** POST
4. **URL:** URL acima (com `?wh=` igual a `WEBHOOK_SECRET` do Render)
5. **Eventos:** `messages`, `connection`
6. **Excluir:** apenas `wasSentByApi`
7. **Não excluir:** `isGroupYes` (necessário para transferência em grupo)
8. **Nunca usar:** `wasNotSentByApi`

### Ou sincronizar automaticamente

Com `.env` local (ou após deploy, via CRM):

```bash
npm run sync:uazapi-webhook
```

Ou no CRM: **Agentes** → agente WhatsApp → **Sincronizar webhook** (requer `UAZAPI_ADMIN_TOKEN` no servidor).

---

## 5. Conectar WhatsApp

1. CRM → **Agentes** → agente (ex. fitbot / maria)
2. Escolher região/proxy → **Guardar**
3. **QR / pareamento** — escanear com o telefone
4. Confirmar status **online** no painel UAZAPI

---

## 6. Verificar

```bash
npm run diagnose:webhook
```

No Render **Logs**, filtrar `"scope":"whatsapp_webhook"` e enviar mensagem de teste no WhatsApp.

Checklist:

- [ ] `POST /api/whatsapp/webhook` com status 200 nos logs
- [ ] Lead criado/atualizado no CRM
- [ ] **Assumir** mostra nome do utilizador logado (não "wendel")
- [ ] **Transferir para vendedor** sem HTTP 401 (token UAZAPI válido)

---

## 7. Migração Supabase (handoff humano)

Aplicar migração que remove placeholder legado:

```sql
-- 20260621220000_clear_legacy_humano_wendel.sql
UPDATE hub_leads_crm SET humano_responsavel = NULL
WHERE lower(trim(humano_responsavel)) = 'wendel';
```

Leads em atendimento humano devem usar **Assumir** — grava o nome do utilizador logado via `users.auth_id`.

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| HTTP 401 ao criar grupo | `UAZAPI_BASE_URL` + `UAZAPI_INSTANCE_TOKEN` corretos; reconectar QR |
| Webhook não chega | URL `/api/whatsapp/webhook?wh=...`; Render service online |
| Badge "Humano: Wendel" | Migração acima + clicar **Assumir** de novo |
| IA não responde | Worker `whatsapp-job-worker` a correr; `MISTRAL_API_KEY` definida |

Ver também: [UAZAPI_SETUP.md](./UAZAPI_SETUP.md)
