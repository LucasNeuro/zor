# Rollout — Agentes WhatsApp (Fases 1–3)

Guia operacional para ativar e manter agentes de conversação WhatsApp com playbook híbrido, conhecimento tenant e Mistral reasoning.

---

## Variáveis de ambiente (Render / `.env`)

| Variável | Valor recomendado | Notas |
|----------|-------------------|-------|
| `MISTRAL_API_KEY` | *(obrigatório)* | Motor IA no webhook e worker |
| `MISTRAL_MODEL` | `mistral-small-latest` | Modelo default dos agentes |
| `MISTRAL_REASONING_EFFORT` | `none` (prod) / `high` (staging) | `none` = mais rápido; `high` = raciocínio explícito |
| `MISTRAL_REASONING_EFFORT_PLAYBOOK_IA_ONLY` | `1` | Só aplica reasoning em turnos `playbook_ia` |
| `PLAYBOOK_HYBRID_IA` | `1` | Fluxo dinâmico + IA (default ligado) |
| `PLAYBOOK_MENU_UAZAPI_ENHANCE` | ver abaixo | Menus UAZAPI list/button |
| `HUB_CONHECIMENTO_AUTO_REGEN_ANALISE` | `1` (opcional) | Regenera análise após reindex de doc |
| `MISTRAL_CHAT_TIMEOUT_MS` | `30000` | Worker + webhook |
| `MISTRAL_CHAT_RETRIES` | `1` | Retries em 429/5xx |

### Exemplo mínimo Render (web + worker)

```env
MISTRAL_API_KEY=...
MISTRAL_MODEL=mistral-small-latest
MISTRAL_REASONING_EFFORT=none
MISTRAL_REASONING_EFFORT_PLAYBOOK_IA_ONLY=1
PLAYBOOK_HYBRID_IA=1
PLAYBOOK_MENU_UAZAPI_ENHANCE=1
HUB_CONHECIMENTO_AUTO_REGEN_ANALISE=1
```

---

## `PLAYBOOK_MENU_UAZAPI_ENHANCE` — política 0 vs 1

| Valor | Comportamento |
|-------|---------------|
| **`1`** (default) | Menus WhatsApp via UAZAPI com listas (até 5 itens) e botões (até 2). Requer playbook publicado no bucket. |
| **`0`** | Desliga enhancement de menu; respostas só texto. Use se a instância UAZAPI não suporta list/button ou em debug. |

**Quando usar `0`:** instância antiga, erros de envio de menu, ou teste A/B de latência.

**Quando usar `1`:** produção com playbook publicado e `hub_whatsapp_menu` ativo no agente.

---

## Checklist por agente

1. **Preset** — Aplicar preset WA conversação (`wa-conversacao`) no wizard CRM.
2. **Conhecimento tenant** — Upload de docs da empresa em `/crm/conhecimento`; aguardar status `pronto`.
3. **Análise do negócio** — Gerar análise (ou `HUB_CONHECIMENTO_AUTO_REGEN_ANALISE=1` após updates).
4. **Gerar fluxo** — No wizard: «Gerar fluxo» a partir do playbook + análise.
5. **Publicar** — Publicar playbook no bucket (`hub_agente_playbook` / storage).
6. **Validar** — `npm run validar:whatsapp` ou smoke manual no número.

---

## Marcadores de log

Procure nos logs do worker (`whatsapp-job-worker`) e `hub_prompt_logs.metadata`:

| Marcador | Significado |
|----------|-------------|
| `hybrid_ia: true` | Turno passou pelo fluxo dinâmico com desvio para IA |
| `motor: playbook_ia` | Resposta gerada pela IA com contexto de playbook |
| `motor: playbook_flow` | Resposta determinística do fluxo (sem LLM) |
| `motor: llm_prompt` | IA sem bloco de fluxo playbook |

Exemplo metadata fila: `{ "motor": "playbook_ia", "hybrid_ia": true, "feito_por": "engine" }`.

---

## Quando regenerar análise + fluxo após update de docs

| Evento | Ação |
|--------|------|
| Novo documento indexado | Análise fica `desatualizada`; regenerar análise no CRM ou ativar auto-regen |
| Documento reprocessado (`/processar`) | API retorna `analise_desatualizada: true` |
| Documento excluído | Análise limpa se não restarem docs `pronto` |
| Análise regenerada | **Regenerar fluxo** no wizard — o fluxo usa síntese da análise |
| Playbook alterado manualmente | Republicar; fluxo pode precisar de novo «Gerar fluxo» |

**Ordem recomendada:** doc pronto → análise atualizada → gerar fluxo → publicar.

Agentes já em produção passam a usar chunks RAG atualizados automaticamente após reindex; a **análise** e o **fluxo visual** exigem regeneração manual (ou auto-regen da análise via env).

---

## Mistral reasoning (`reasoning_effort`)

- `MISTRAL_REASONING_EFFORT=high` envia `reasoning_effort: "high"` à API Mistral.
- Com `MISTRAL_REASONING_EFFORT_PLAYBOOK_IA_ONLY=1`, só turnos `playbook_ia` usam reasoning.
- Chunks `thinking` na resposta são descartados; só `text` vai para o WhatsApp.
- Histórico multi-turno guarda texto final (não thinking), preservando o fluxo existente.

---

## Verificação pós-deploy

```bash
npm run test
npm run build
npm run validar:whatsapp
npm run verify:mistral
```
