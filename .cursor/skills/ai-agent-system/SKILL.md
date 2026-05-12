---
name: ai-agent-system
description: >
  Defines multi-agent architecture (hierarchy, handoffs, alerts), quality system prompts, and Claude API patterns.
  Use when implementing or refactoring IA agents, lib/ia/*, webhook orchestration, hub_agente_* flows, or Anthropic integration.
---

## Arquitetura de Agentes IA

HIERARQUIA OBRIGATÓRIA:
- Nível 1 (Estratégico): define metas, aprova decisões críticas
- Nível 2 (Coordenação): transforma estratégia em execução
- Nível 3 (Execução): produz entregáveis especializados
- Nível 4 (Atendimento): front-line com usuários/leads

SYSTEM PROMPT DE QUALIDADE:
Cada agente deve ter:
1. Identidade clara (quem é, personalidade)
2. Papel específico (o que faz)
3. Responsabilidades listadas
4. Limites claros (o que NÃO faz)
5. Interações definidas (com quem conversa)
6. Formato de resposta padrão

REGRAS GLOBAIS (todos os agentes):
- Nunca prometer resultado garantido
- Nunca enviar sem revisão
- Nunca ignorar dados incompletos
- Sempre alertar problemas
- Toda tarefa precisa de responsável

## Integração com Claude API

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

async function runAgent(agentId: string, userMessage: string) {
  const systemPrompt = getAgentSystemPrompt(agentId);

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}
```

## Padrões de Comunicação entre Agentes

HANDOFF (passagem de tarefa):
```typescript
interface AgentHandoff {
  fromAgent: string;
  toAgent: string;
  taskId: string;
  context: string;
  priority: "low" | "normal" | "high" | "critical";
  deadline?: Date;
}
```

ALERTA (problema detectado):
```typescript
interface AgentAlert {
  agentId: string;
  severity: "info" | "warning" | "critical";
  message: string;
  requiresAction: boolean;
  escalateTo?: string;
  timestamp: Date;
}
```

## Estados de Agente

- `trabalhando`: executando tarefa ativa
- `aguardando`: esperando input ou aprovação
- `em_reuniao`: colaboração multi-agente ativa
- `conversando`: troca de informação bilateral
- `comemorando`: tarefa concluída com sucesso
- `pausado`: sem tarefa ativa no momento
- `alerta`: problema detectado, requer atenção

## Governança

- Score 85-100: verde — operação normal
- Score 70-84: amarelo — monitoramento
- Score < 70: vermelho — intervenção necessária

Auditoria obrigatória:
- Log de cada decisão com timestamp
- Rastro de aprovações na cadeia hierárquica
- Histórico de alertas emitidos e resolvidos
