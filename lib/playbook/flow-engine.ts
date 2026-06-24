import { mensagemEhSaudacaoSimples } from "@/lib/whatsapp/menu-triagem-uazapi";
import { mensagemJaIndicaIntentTriagem } from "@/lib/whatsapp/menu-intent";

function menuTypeForStep(step: FlowMenuStep): "list" | "button" {
  if (step.menu_type === "button" || step.menu_type === "list") return step.menu_type;
  return step.choices.length <= 3 ? "button" : "list";
}

/** Tenta mapear texto livre do cliente a uma opção do menu (ex.: «quero fazer pedido» → delivery). */
function resolverEscolhaMenuPorTexto(mensagem: string, choices: FlowMenuChoice[]): string | null {
  const t = mensagem.trim().toLowerCase();
  if (!t) return null;

  const byPattern = (pred: (c: FlowMenuChoice) => boolean) => choices.find(pred)?.id ?? null;

  if (mensagemJaIndicaIntentTriagem(t)) {
    const pedido = byPattern(
      (c) =>
        /pedido|delivery|entrega|card[aá]pio|encomenda/i.test(c.label) ||
        /pedido|delivery|cardapio|encomenda/i.test(c.id)
    );
    if (pedido) return pedido;
  }

  if (/\bretirar\b|\bbalc[aã]o\b|\bbuscar\b/.test(t)) {
    const ret = byPattern((c) => /retirada|balc[aã]o|buscar/i.test(c.label) || /retirada|balcao/i.test(c.id));
    if (ret) return ret;
  }

  if (/\batendente\b|\bhumano\b|\bpessoa\b/.test(t)) {
    const humano = byPattern((c) => /atendente|humano|pessoa/i.test(c.label) || /humano|atendente/i.test(c.id));
    if (humano) return humano;
  }

  for (const c of choices) {
    const lab = c.label.trim().toLowerCase();
    if (lab.length >= 4 && t.includes(lab)) return c.id;
  }

  return null;
}

export type FlowPendingMenu = {
  text: string;
  menuType: "list" | "button";
  choices: string[];
  listButton?: string;
  /** Rodapé UAZAPI — nome comercial do tenant (ex.: Cantina Nova). */
  footerText?: string;
};

export type FlowEngineResult =
  | { handled: false }
  | { handled: true; skipIa: boolean; step?: string; pendingMenu?: FlowPendingMenu };

export type FlowEngineStepType =
  | "await_name"
  | "send_text"
  | "send_media"
  | "menu"
  | "ask_text"
  | "branch_imob_sub"
  | "complete";

type BaseStep = {
  id: string;
  type: FlowEngineStepType;
};

export type FlowAwaitNameStep = BaseStep & {
  type: "await_name";
  prompt: string;
  invalid_prompt?: string;
  answer_key?: string;
  next_step: string;
};

export type FlowSendTextStep = BaseStep & {
  type: "send_text";
  text: string;
  next_step?: string;
};

export type FlowSendMediaStep = BaseStep & {
  type: "send_media";
  media_type: "image" | "document" | "video";
  file: string;
  caption?: string;
  next_step?: string;
};

export type FlowMenuChoice = {
  id: string;
  label: string;
  next_step?: string;
};

export type FlowMenuStep = BaseStep & {
  type: "menu";
  text: string;
  menu_type?: "list" | "button";
  list_button?: string;
  choices: FlowMenuChoice[];
  answer_key?: string;
  invalid_prompt?: string;
  next_step?: string;
};

export type FlowAskTextValidator = "text" | "email";

export type FlowAskTextStep = BaseStep & {
  type: "ask_text";
  prompt: string;
  answer_key: string;
  next_step: string;
  min_length?: number;
  allow_media?: boolean;
  validator?: FlowAskTextValidator;
  invalid_prompt?: string;
};

export type FlowBranchImobSubStep = BaseStep & {
  type: "branch_imob_sub";
  source_key?: string;
  answer_key?: string;
  routes: Record<string, string>;
  default_step?: string;
  invalid_prompt?: string;
};

import type { FlowCompleteTransfer } from "@/lib/playbook/flow-transfer-actions";

export type FlowCompleteStep = BaseStep & {
  type: "complete";
  text?: string;
  /** Permite encadear mensagem ou outro passo após conclusão/transferência. */
  next_step?: string;
  transfer?: FlowCompleteTransfer;
};

export type FlowEngineStep =
  | FlowAwaitNameStep
  | FlowSendTextStep
  | FlowSendMediaStep
  | FlowMenuStep
  | FlowAskTextStep
  | FlowBranchImobSubStep
  | FlowCompleteStep;

export type FlowEngineDefinition = {
  start_step: string;
  steps: Record<string, FlowEngineStep>;
};

export type FlowEngineInput = {
  step: string | null;
  answers: Record<string, string>;
  mensagem: string;
  menuChoiceId?: string | null;
  tipoMidia: string;
};

export type FlowEnginePersistPatch = {
  step?: string | null;
  answers?: Record<string, string>;
  active?: boolean;
  complete?: boolean;
  resetAnswers?: boolean;
};

export type FlowEngineAdapter = {
  sendText: (text: string) => Promise<void>;
  sendMedia?: (args: {
    mediaType: "image" | "document" | "video";
    file: string;
    caption?: string;
  }) => Promise<{ ok: boolean; erro?: string }>;
  sendMenu: (args: {
    text: string;
    menuType: "list" | "button";
    listButton?: string;
    choices: string[];
  }) => Promise<{ ok: boolean; erro?: string }>;
  resolveChoiceId: (mensagem: string, menuChoiceId?: string | null) => string | null;
  persistState: (patch: FlowEnginePersistPatch) => Promise<void>;
  onNameCaptured?: (name: string) => Promise<void>;
  onStepComplete?: (stepId: string, answers: Record<string, string>) => Promise<void>;
  /** Quando true: só avança estado/CRM; texto ao cliente vem da IA (skipIa=false). */
  stateOnly?: boolean;
};

function skipIaForAdapter(adapter: FlowEngineAdapter): boolean {
  return !adapter.stateOnly;
}

export function mensagemPareceNome(mensagem: string): boolean {
  const t = mensagem.trim();
  if (t.length < 2 || t.length > 60) return false;
  if (mensagemEhSaudacaoSimples(t)) return false;
  if (/^\d+$/.test(t)) return false;
  if (t.includes("@")) return false;
  return true;
}

const NOME_FLUXO_PATTERNS = [
  /(?:me chamo|meu nome é|meu nome e|sou o|sou a|aqui é|pode me chamar de|sou)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]{1,48})/i,
];

/** Extrai nome de mensagens ricas («Sou Lucas, quero comprar…») ou texto curto puro. */
export function extrairNomeDaMensagemFluxo(mensagem: string): string | null {
  const trimmed = mensagem.trim();
  if (!trimmed) return null;

  for (const pattern of NOME_FLUXO_PATTERNS) {
    const match = trimmed.match(pattern);
    if (!match?.[1]) continue;
    const candidato = match[1]
      .trim()
      .split(/[,.\n!?]/)[0]!
      .trim()
      .split(/\s+/)
      .slice(0, 4)
      .join(" ");
    if (mensagemPareceNome(candidato)) return candidato;
  }

  if (mensagemPareceNome(trimmed)) return trimmed;
  return null;
}

function segmentosMensagemParaResolucao(mensagem: string): string[] {
  const trimmed = mensagem.trim();
  if (!trimmed) return [];
  const partes = trimmed
    .split(/[,;.\n!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([trimmed, ...partes])];
}

function askTextAceitaResposta(step: FlowAskTextStep, texto: string, tipoMidia: string): boolean {
  const minLength = Number.isFinite(step.min_length) ? Math.max(1, Number(step.min_length)) : 1;
  const mediaOk = step.allow_media === true && tipoMidia !== "texto";
  const textOk = texto.length >= minLength;
  const validEmail = step.validator === "email" ? mensagemPareceEmail(texto) : true;
  if (!((mediaOk || textOk) && validEmail)) return false;
  if (step.answer_key === "nome" && !mediaOk && !mensagemPareceNome(texto)) return false;
  return true;
}

function mensagemPareceEmail(mensagem: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mensagem.trim());
}

/** Normaliza texto de menu para comparação (rótulos, respostas livres, m²/m2). */
export function normMenuChoiceText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/m²/g, "m2")
    .replace(/[²º°]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function choiceIdFromCandidates(
  candidates: string[],
  choices: FlowMenuChoice[],
  globalResolve?: (mensagem: string, menuChoiceId?: string | null) => string | null
): string | null {
  const choiceIds = new Set(choices.map((c) => c.id));

  for (const raw of candidates) {
    const t = raw.trim();
    if (!t) continue;

    const globalId = globalResolve?.(t, null);
    if (globalId && choiceIds.has(globalId)) return globalId;

    if (choiceIds.has(t)) return t;
    const lower = t.toLowerCase();
    const byId = choices.find((c) => c.id === t || c.id.toLowerCase() === lower);
    if (byId) return byId.id;

    const pipeId = t.includes("|") ? t.split("|").pop()?.trim() : "";
    if (pipeId && choiceIds.has(pipeId)) return pipeId;

    if (/^\d+$/.test(t)) {
      const idx = Number.parseInt(t, 10);
      if (idx >= 1 && idx <= choices.length) return choices[idx - 1].id;
    }

    const normMsg = normMenuChoiceText(t);
    if (!normMsg) continue;

    const exactLabel = choices.find((c) => normMenuChoiceText(c.label) === normMsg);
    if (exactLabel) return exactLabel.id;

    const partialLabel = choices.find((c) => {
      const normLabel = normMenuChoiceText(c.label);
      if (!normLabel || normLabel.length < 4) return false;
      if (normMsg.includes(normLabel) || normLabel.includes(normMsg)) return true;
      const palavras = normLabel.split(" ").filter((w) => w.length >= 4);
      return palavras.some((w) => normMsg.includes(w));
    });
    if (partialLabel) return partialLabel.id;
  }

  return null;
}

/**
 * Resolve opção de menu: ID do WhatsApp, aliases globais, índice numérico (1..n) ou rótulo.
 */
export function resolveMenuChoiceId(
  mensagem: string,
  menuChoiceId: string | null | undefined,
  choices: FlowMenuChoice[],
  globalResolve?: (mensagem: string, menuChoiceId?: string | null) => string | null
): string | null {
  if (!choices.length) return null;

  const fromGlobal = globalResolve?.(mensagem, menuChoiceId);
  if (fromGlobal && choices.some((c) => c.id === fromGlobal)) return fromGlobal;

  const candidates = [
    ...(typeof menuChoiceId === "string" && menuChoiceId.trim() ? [menuChoiceId.trim()] : []),
    ...segmentosMensagemParaResolucao(mensagem),
  ];
  return choiceIdFromCandidates(candidates, choices, globalResolve);
}

const MAX_AUTO_TRANSITIONS = 12;

export async function executeFlowEngine(
  definition: FlowEngineDefinition,
  input: FlowEngineInput,
  adapter: FlowEngineAdapter
): Promise<FlowEngineResult> {
  let currentStepId = input.step || definition.start_step;
  if (!currentStepId) return { handled: false };

  const answers = { ...input.answers };
  const texto = input.mensagem.trim();

  for (let transitions = 0; transitions < MAX_AUTO_TRANSITIONS; transitions += 1) {
    const step = definition.steps[currentStepId];
    if (!step) return { handled: false };
    const waitingAtCurrentStep = input.step === currentStepId;
    const canResolveFromMessage = waitingAtCurrentStep || transitions > 0;
    const choiceId = (() => {
      if (!canResolveFromMessage) return null;
      if (step.type === "menu") {
        return resolveMenuChoiceId(
          input.mensagem,
          input.menuChoiceId,
          step.choices,
          adapter.resolveChoiceId
        );
      }
      if (step.type === "branch_imob_sub") {
        return adapter.resolveChoiceId(input.mensagem, input.menuChoiceId);
      }
      return null;
    })();

    switch (step.type) {
      case "send_text": {
        if (!adapter.stateOnly && step.text.trim()) {
          await adapter.sendText(step.text.trim());
        }
        if (!step.next_step) {
          await adapter.persistState({
            step: currentStepId,
            answers,
            active: true,
            complete: false,
          });
          return { handled: true, skipIa: skipIaForAdapter(adapter), step: currentStepId };
        }
        currentStepId = step.next_step;
        continue;
      }

      case "send_media": {
        if (!adapter.stateOnly && step.file.trim()) {
          if (adapter.sendMedia) {
            const sent = await adapter.sendMedia({
              mediaType: step.media_type,
              file: step.file.trim(),
              caption: step.caption?.trim() || undefined,
            });
            if (!sent.ok) {
              const fallback = step.caption?.trim() || step.file.trim();
              await adapter.sendText(
                `Não consegui enviar a mídia agora. Link: ${fallback}`
              );
            }
          } else {
            const label =
              step.media_type === "image"
                ? "Imagem"
                : step.media_type === "video"
                  ? "Vídeo"
                  : "Documento";
            await adapter.sendText(
              `${label}: ${step.file.trim()}${step.caption?.trim() ? `\n\n${step.caption.trim()}` : ""}`
            );
          }
        }
        if (!step.next_step) {
          await adapter.persistState({
            step: currentStepId,
            answers,
            active: true,
            complete: false,
          });
          return { handled: true, skipIa: skipIaForAdapter(adapter), step: currentStepId };
        }
        currentStepId = step.next_step;
        continue;
      }

      case "await_name": {
        const nomeCapturado =
          waitingAtCurrentStep && !choiceId ? extrairNomeDaMensagemFluxo(texto) : null;
        if (nomeCapturado) {
          const key = step.answer_key || "nome";
          answers[key] = nomeCapturado;
          if (adapter.onNameCaptured) {
            await adapter.onNameCaptured(nomeCapturado);
          }
          await adapter.persistState({
            step: step.next_step,
            answers,
            active: true,
            complete: false,
          });
          currentStepId = step.next_step;
          continue;
        }
        if (!adapter.stateOnly) {
          await adapter.sendText(step.invalid_prompt || step.prompt);
        }
        await adapter.persistState({
          step: currentStepId,
          answers,
          active: true,
          complete: false,
        });
        return { handled: true, skipIa: skipIaForAdapter(adapter), step: currentStepId };
      }

      case "menu": {
        const selectedFromText =
          canResolveFromMessage && !choiceId
            ? resolverEscolhaMenuPorTexto(texto, step.choices)
            : null;
        const selected =
          canResolveFromMessage && choiceId
            ? step.choices.find((c) => c.id === choiceId)
            : selectedFromText
              ? step.choices.find((c) => c.id === selectedFromText)
              : null;
        if (selected) {
          const key = step.answer_key;
          if (key) answers[key] = selected.id;
          const nextStep = selected.next_step || step.next_step;
          if (!nextStep) {
            await adapter.persistState({
              step: currentStepId,
              answers,
              active: true,
              complete: false,
            });
            return { handled: true, skipIa: skipIaForAdapter(adapter), step: currentStepId };
          }
          await adapter.persistState({
            step: nextStep,
            answers,
            active: true,
            complete: false,
          });
          currentStepId = nextStep;
          continue;
        }

        const menuChoices = step.choices.map((c) => `${c.label}|${c.id}`);
        const resolvedMenuType = menuTypeForStep(step);
        const pendingMenu: FlowPendingMenu = {
          text: step.text,
          menuType: resolvedMenuType,
          listButton: resolvedMenuType === "list" ? step.list_button || "Ver opções" : undefined,
          choices: menuChoices,
        };

        if (adapter.stateOnly) {
          await adapter.persistState({
            step: currentStepId,
            answers,
            active: true,
            complete: false,
          });
          return {
            handled: true,
            skipIa: false,
            step: currentStepId,
            pendingMenu,
          };
        }

        if (choiceId && step.invalid_prompt) {
          await adapter.sendText(step.invalid_prompt);
        }
        const menu = await adapter.sendMenu({
          text: step.text,
          menuType: resolvedMenuType,
          listButton: resolvedMenuType === "list" ? step.list_button || "Ver opções" : undefined,
          choices: menuChoices,
        });
        if (!menu.ok && menu.erro) {
          await adapter.sendText(step.invalid_prompt || "Não consegui abrir o menu agora. Tente novamente em instantes.");
        }
        await adapter.persistState({
          step: currentStepId,
          answers,
          active: true,
          complete: false,
        });
        return { handled: true, skipIa: skipIaForAdapter(adapter), step: currentStepId };
      }

      case "ask_text": {
        const mediaOk = step.allow_media === true && input.tipoMidia !== "texto";
        const nomeExtraido =
          waitingAtCurrentStep &&
          !choiceId &&
          !mediaOk &&
          step.answer_key === "nome"
            ? extrairNomeDaMensagemFluxo(texto)
            : null;
        const respostaTexto =
          nomeExtraido ??
          (askTextAceitaResposta(step, texto, input.tipoMidia) ? texto : null);
        if (waitingAtCurrentStep && respostaTexto && !choiceId) {
          answers[step.answer_key] = mediaOk ? input.tipoMidia : respostaTexto;
          if (step.answer_key === "nome" && adapter.onNameCaptured && !mediaOk) {
            await adapter.onNameCaptured(respostaTexto);
          }
          await adapter.persistState({
            step: step.next_step,
            answers,
            active: true,
            complete: false,
          });
          currentStepId = step.next_step;
          continue;
        }
        if (!adapter.stateOnly) {
          await adapter.sendText(step.invalid_prompt || step.prompt);
        }
        await adapter.persistState({
          step: currentStepId,
          answers,
          active: true,
          complete: false,
        });
        return { handled: true, skipIa: skipIaForAdapter(adapter), step: currentStepId };
      }

      case "branch_imob_sub": {
        const key = step.source_key || step.answer_key || "imob_sub";
        const incoming = choiceId || answers[key] || "";
        if (incoming) answers[key] = incoming;
        const nextStep = step.routes[incoming] || step.default_step;
        if (!nextStep) {
          if (!adapter.stateOnly) {
            await adapter.sendText(step.invalid_prompt || "Escolha uma opção do menu para continuarmos.");
          }
          await adapter.persistState({
            step: currentStepId,
            answers,
            active: true,
            complete: false,
          });
          return { handled: true, skipIa: skipIaForAdapter(adapter), step: currentStepId };
        }
        await adapter.persistState({
          step: nextStep,
          answers,
          active: true,
          complete: false,
        });
        currentStepId = nextStep;
        continue;
      }

      case "complete": {
        if (!adapter.stateOnly && step.text?.trim()) {
          await adapter.sendText(step.text.trim());
        }
        if (adapter.onStepComplete) {
          await adapter.onStepComplete(currentStepId, answers);
        }
        if (step.next_step?.trim()) {
          await adapter.persistState({
            step: step.next_step.trim(),
            answers,
            active: true,
            complete: false,
          });
          currentStepId = step.next_step.trim();
          continue;
        }
        await adapter.persistState({
          step: "concluido",
          answers,
          active: false,
          complete: true,
        });
        return { handled: true, skipIa: skipIaForAdapter(adapter), step: "concluido" };
      }
    }
  }

  await adapter.persistState({
    step: currentStepId,
    answers,
    active: true,
    complete: false,
  });
  return { handled: true, skipIa: skipIaForAdapter(adapter), step: currentStepId };
}
