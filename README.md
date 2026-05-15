# Escritório Virtual — Obra10+

Plataforma Next.js (App Router) + Supabase para CRM, agentes IA, parceiros e automações WhatsApp.

## Requisitos

- Node.js 20+
- Conta Supabase (URL + anon key + **service role** para rotas server-side)
- (Opcional) Anthropic API, UAZAPI (WhatsApp), Windsor.ai — conforme features ativas

## Desenvolvimento local

O documento mestre pede **porta 3001+** (evitar conflito com outros serviços na 3000):

```bash
npm install
npm run dev
```

Abra [http://localhost:3001](http://localhost:3001).

**TLS em `npm run dev`:** o comando **`npm run dev`** arranca o Next com `NODE_TLS_REJECT_UNAUTHORIZED=0` só nesse processo, para o servidor conseguir fazer `fetch` ao Supabase em PCs com antivírus/proxy SSL (caso contrário o login pode falhar após `signInWithPassword` com “fetch failed”). **`npm run build` / `npm start`** não usam isto. Se não precisares do workaround: `npm run dev:strict-tls`. Em empresas, a solução “certa” continua a ser `NODE_EXTRA_CA_CERTS` com o PEM raiz — ver [`.env.example`](.env.example).

## Variáveis de ambiente

| Variável | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente/browser |
| `SUPABASE_SERVICE_ROLE_KEY` | APIs server (`/api/*`, webhooks) — **não** expor no cliente |
| `NEXT_PUBLIC_APP_URL` | URLs absolutas (WhatsApp, links); em produção o dispatch (`/api/cron/dispatch-ciclos`) usa esta origem nos pedidos internos a `/api/ciclos/*` |
| `DISPATCH_CICLOS_URL` | (Opcional no Cron Job / scheduler) URL completa para `GET /api/cron/dispatch-ciclos`; se vazio, ver `.env.example` e `scripts/render-dispatch-ciclos.sh` (`NEXT_PUBLIC_APP_URL` + caminho) |
| `CRON_SECRET` | Protege ciclos (`/api/ciclos/*`) e geração de link do portal parceiro em produção |
| `PORTAL_HMAC_SECRET` | (Opcional) Assinatura do link `/parceiro/dashboard`; padrão: `CRON_SECRET` |
| `ANTHROPIC_API_KEY` | Respostas IA |
| `UAZAPI_BASE_URL` / `UAZAPI_INSTANCE_TOKEN` | Envio e instância WhatsApp (UAZAPI) |
| `WEBHOOK_SECRET` | Validação do webhook UAZAPI (HMAC ou header) — ver [`docs/UAZAPI_SETUP.md`](docs/UAZAPI_SETUP.md) |
| `WINDSOR_API_KEY` | Ciclo de tráfego (métricas de campanha) |
| `INTERNAL_API_KEY` | Chave para rotas `/api/*` quando não há sessão CRM (crons, scripts, alguns `fetch` do cliente) |
| `NEXT_PUBLIC_INTERNAL_API_KEY` | Mesmo valor exposto ao browser — usado em `lib/internal-api-headers.ts` |
| `LOGIN_REQUIRE_PUBLIC_USERS_ROW` | `true` — exige `public.users` com `auth_id`, `status = Ativo` (`record_status`) e e-mail igual ao Auth |
| `LOGIN_ENFORCE_APP_USERS` | Alias do anterior (mesmo efeito); use o nome que preferir na equipe |
| `LOGIN_ALLOWED_APP_ROLES` | (Opcional) Papéis permitidos no login (vírgula), p.ex. `owner,admin`; compara com `public.users.role` (valores do enum `app_role` no Postgres, case-insensitive) |
| `DEFAULT_TENANT_ID` | UUID do tenant padrão nas escritas server-side (padrão: Obra10 fixo da migração) |
| `PORTAL_VERIFY_RATE_MAX` / `PORTAL_VERIFY_RATE_WINDOW_MS` | Rate limit do POST `/api/parceiros/portal/verify` |

Modelo de variáveis (sem segredos): copie [`.env.example`](.env.example) para `.env.local`.

## Login e logout (plataforma)

Fluxo em produção e em local (`/office`, `/crm`, `/login`):

1. **Utilizador** acede a `/login`, faz login com **email + senha** (Supabase Auth — provider Email).
2. O browser chama `POST /api/auth/crm-session` com o `access_token` da sessão Supabase. A rota valida o token em `/auth/v1/user` (mesma identidade que o Supabase Auth) e grava o cookie **httpOnly** `obra10_crm_access`. Controlo adicional de acesso é opcional via `public.users` (variáveis `LOGIN_*` abaixo), não via lista de e-mails em ambiente.
3. O **`proxy.ts`** (Next.js 16) corre antes das rotas: para **`/office/*`** e **`/crm/*`** exige esse cookie válido; caso contrário redireciona para `/login?next=…`. Para rotas `/api/*` protegidas, aceita **ou** o cookie de sessão **ou** o header `x-api-key` (= `INTERNAL_API_KEY`) — útil para crons e integrações sem “login humano”.
4. **Logout:** o botão “Sair” no layout do CRM chama `DELETE /api/auth/crm-session` (limpa o cookie) e `supabase.auth.signOut()` (limpa a sessão no cliente).

**Tabela `public.users` (app):** o `POST /api/auth/crm-session` valida alinhamento com o schema (`auth_id` → `auth.users`, `email`, `role` → `app_role`, `status` → `record_status`):

- Com **`LOGIN_ENFORCE_APP_USERS=true`** ou **`LOGIN_REQUIRE_PUBLIC_USERS_ROW=true`**: exige linha com `auth_id` = UUID em **Authentication**, `status` compatível com **Ativo**, e e-mail da sessão igual ao **`users.email`**.
- Com **`LOGIN_ALLOWED_APP_ROLES=owner,admin`** (exemplo): além disso, `role` tem de estar na lista (valores do enum `app_role` no Postgres).

**Recomendação:** defina **owner/admin** (e outros papéis) na coluna **`role`** quando usar `LOGIN_ENFORCE_APP_USERS` / `LOGIN_ALLOWED_APP_ROLES`; acrescente novos valores ao enum com `ALTER TYPE public.app_role ADD VALUE ...` quando necessário. Cada utilizador: **Auth** (e-mail/senha) e, se a verificação estiver ligada, linha em **`public.users`** com o mesmo **e-mail** e **`auth_id`** coerente.
 [http://localhost:3001/login](http://localhost:3001/login) → após sucesso, [http://localhost:3001/office](http://localhost:3001/office) (ou `?next=` para outra rota interna).

## Proxy (`proxy.ts`)

Rotas **`/office/*`** e **`/crm/*`** exigem cookie de sessão válido (mesma regra que acima). Rotas `/api/*` exigem header `x-api-key` igual a `INTERNAL_API_KEY` **ou** esse cookie, exceto as documentadas em [`proxy.ts`](proxy.ts): WhatsApp webhook, health, verificação do portal parceiro, validação CPF/CNPJ, ciclos agendados, `GET /api/ml/ciclo`, `POST`/`DELETE /api/auth/crm-session` (auth própria nas handlers ou rota pública controlada).

## RLS multi-tenant (Supabase)

Após aplicar `20260509120000_*.sql`, rode em ordem:

- `20260510130000_rls_tenant_pilot.sql` — funções `app_tenant_id()` (claim JWT `tenant_id`) e políticas em `hub_leads_crm`, `hub_parceiros`, `hub_agente_identidade`, `hub_fila_mensagens`, `hub_tenants`.
- `20260510140000_hub_cotacoes.sql` — tabelas `hub_cotacoes_*` + RLS.

**Claim JWT:** no Supabase Auth, inclua `tenant_id` no JWT (template de claims) para utilizadores `authenticated` de tenants não padrão. O papel `anon` continua restrito ao tenant Obra10 legado nas políticas piloto.

## Agendamento dos ciclos IA (qualquer hospedeiro)

As rotas **`/api/ciclos/*`** e **`/api/ml/ciclo`** são HTTP normais; o **agendamento** é que tem de existir no teu deploy.

- **Só na Vercel:** o ficheiro [`vercel.json`](vercel.json) declara *Cron Jobs* que chamam essas URLs. O header `x-vercel-cron: 1` é aceite por [`lib/cron-auth.ts`](lib/cron-auth.ts) em produção.
- **Render (recomendado — um só agendamento):** Blueprint em [`render.yaml`](render.yaml) ([documentação Blueprint](https://render.com/docs/infrastructure-as-code)): *web service* `escritorio-virtual` + *Cron Job* `dispatch-ciclos-cron` (Docker mínimo com `curl`, agenda exemplo **`*/5 * * * *`** UTC). O cron corre [`scripts/render-dispatch-ciclos.sh`](scripts/render-dispatch-ciclos.sh) com **`Authorization: Bearer`** igual ao **`CRON_SECRET`** do web service (`fromService` no Blueprint). Variáveis do web service devem seguir [`.env.example`](.env.example) (no mínimo Supabase + **`NEXT_PUBLIC_APP_URL`** + **`CRON_SECRET`**). Opcional no cron (painel): **`DISPATCH_CICLOS_URL`** — URL completa para `/api/cron/dispatch-ciclos`; se omitires, usa **`NEXT_PUBLIC_APP_URL`** herdada + caminho (ver script).
- **VPS, Docker, etc. sem Blueprint:** o `vercel.json` **não corre**. Usa **`crontab`** + `curl`, ou um scheduler externo.
- **Um único tick (recomendado em escala):** agenda **só** `GET` ou `POST` **`/api/cron/dispatch-ciclos`** a cada **1–5 min** (com `Authorization: Bearer $CRON_SECRET`). Esse endpoint lê `hub_ciclos_ia` (`tipo=programado`, `ativo`, `cron_expressao` / `intervalo_minutos`) e chama internamente `/api/ciclos/{diretor|gerente|atendente}?ciclo=...&hub_ciclo_id=...` só quando o ciclo está “devido”. O servidor usa **`NEXT_PUBLIC_APP_URL`** como origem desses `fetch` internos ([`app/api/cron/dispatch-ciclos/route.ts`](app/api/cron/dispatch-ciclos/route.ts)). Podes acrescentar quantos ciclos e agentes quiseres na tabela; **agentes novos** devem ter `configuracoes.dispatch` `{ "api": "diretor"|"gerente"|"atendente", "ciclo": "<chave já implementada>" }` ou um `agente_slug` / `nome` alinhado aos heurísticos em `lib/ciclos-dispatch.ts`. Query opcional: `dry_run=1` (só JSON, sem executar). Em desenvolvimento, `dry_run` também evita `fetch` quando não há URL base.

### Render só Cron Job (fallback manual no Dashboard)

Se o *web service* já existir e quiseres apenas o agendamento:

1. Cria um **[Cron Job](https://render.com/docs/cronjobs)** no mesmo repositório (runtime **Docker**).
2. **Dockerfile:** aponta para [`scripts/Dockerfile.dispatch-ciclos-cron`](scripts/Dockerfile.dispatch-ciclos-cron) com **Docker build context** em **`scripts`** (como no [`render.yaml`](render.yaml)).
3. **Schedule:** por exemplo `*/5 * * * *` (UTC).
4. **Command:** `/bin/sh /app/render-dispatch-ciclos.sh` (equivale ao `dockerCommand` do Blueprint).
5. **Environment:** **`CRON_SECRET`** (igual ao da app em produção) e **`NEXT_PUBLIC_APP_URL`** **ou** **`DISPATCH_CICLOS_URL`** (URL completa do endpoint); ver [`.env.example`](.env.example).

Notas de plano: Cron Jobs na Render não usam instância **free** (mínimo pago/prorrateado); o Blueprint pode atualizar serviços existentes com o mesmo `name` ([referência](https://render.com/docs/blueprint-spec)).

Em **produção** (`NODE_ENV=production`), sem Vercel, cada chamada tem de levar **`CRON_SECRET`**: `Authorization: Bearer <CRON_SECRET>`, ou header `x-cron-secret`, ou query `?secret=` (ver `cronRequestAuthorized`). Em desenvolvimento local o auth do cron está relaxado.

**Referência de rotas e horários** (espelha o que está em `vercel.json`; ajusta o *host* para `NEXT_PUBLIC_APP_URL`):

| Caminho | Schedule (UTC típico no repo) |
|--------|-------------------------------|
| `/api/ciclos/gerente?ciclo=relatorio_manha` | `0 8 * * *` |
| `/api/ciclos/diretor?ciclo=analise_manha` | `0 7 * * *` |
| `/api/ciclos/diretor?ciclo=analise_noite` | `0 19 * * *` |
| `/api/ciclos/diretor?ciclo=trafego` | `0 */6 * * *` |
| `/api/ciclos/atendente?ciclo=followup` | `*/30 * * * *` |
| `/api/ciclos/atendente?ciclo=sla` | `*/15 * * * *` |
| `/api/ml/ciclo?acao=kpis` | `5 * * * *` |

Exemplo (VPS): `curl -s -H "Authorization: Bearer $CRON_SECRET" "https://seu-dominio/api/ciclos/diretor?ciclo=analise_manha"`

### Link do portal do parceiro

O CRM usa `GET /api/parceiros/<uuid>/portal-link` com **`x-api-key`** (`NEXT_PUBLIC_INTERNAL_API_KEY`) ou, para operadores, `Authorization: Bearer <CRON_SECRET>`:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" "$NEXT_PUBLIC_APP_URL/api/parceiros/<UUID>/portal-link"
```

## Banco de dados

Scripts de referência em `lib/supabase/*.sql`. Migração alinhada ao documento mestre:

- `supabase/migrations/20260509120000_hub_ciclos_slugs_e_tenants.sql` — `hub_tenants`, `tenant_id` piloto, slugs `diretor_*` em `hub_ciclos_ia`.
- `supabase/migrations/20260510130000_rls_tenant_pilot.sql` — RLS piloto.
- `supabase/migrations/20260510140000_hub_cotacoes.sql` — cotações fornecedor + RLS.
- `supabase/migrations/20260511120000_app_role_owner_admin.sql` — valores opcionais `owner` / `admin` no enum `app_role` (login + coluna `users.role`).

Se o **Dashboard** não conseguir apagar utilizadores (**"Database error loading user"**), usa o SQL [`docs/sql/delete-auth-users-by-email.sql`](docs/sql/delete-auth-users-by-email.sql) e volta a criar com o script de provisionamento.

## Backup

Workflow GitHub Actions: `.github/workflows/supabase-backup.yml`. Configure o secret `DATABASE_URL` (connection string Postgres do Supabase) no repositório.

## Documentação

Tudo em [`docs/`](docs/) — ver índice em [`docs/README.md`](docs/README.md).

Inclui: documento mestre (duas variantes em Markdown), UAZAPI/WhatsApp, manifest, relatórios, status, fases, backlog, schema de contexto e checklists.

**Cursor Agent:** skills do projeto em [`.cursor/skills/`](.cursor/skills/) (design, dashboards, marketing, agentes IA) — ver [`.cursor/skills/README.md`](.cursor/skills/README.md).

## Scripts

```bash
npm run build   # build de produção
npm run start   # servir build
npm run test    # Vitest (cron-auth, portal, rate limit)
```
