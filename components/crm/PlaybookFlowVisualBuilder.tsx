"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Route,
  Trash2,
} from "lucide-react";
import type {
  PlaybookFlowDefinition,
  PlaybookFlowInputStep,
  PlaybookFlowMenuStep,
  PlaybookFlowMessageStep,
  PlaybookFlowStep,
} from "@/lib/playbook/flow-definition-types";
import { parsePlaybookFlowFromMarkdown } from "@/lib/playbook/flow-parse";
import { upsertPlaybookFlowBlockInMarkdown } from "@/lib/playbook/playbook-flow-markdown";
import { emitFlowVisualTelemetry } from "@/lib/playbook/flow-visual-telemetry";
import { validatePlaybookFlowDefinition } from "@/lib/playbook/flow-validate";
import { PLAYBOOK_FLOW_FENCE_TAG } from "@/lib/playbook/flow-schema";
import { buildStarterPlaybookFlowDefinition } from "@/lib/playbook/playbook-flow-starter";

type Props = {
  markdown: string;
  onMarkdownChange: (next: string) => void;
  agenteSlug: string;
  disabled?: boolean;
};

function nextTargets(step: PlaybookFlowStep): string[] {
  const targets: string[] = [];
  if ("next" in step && typeof step.next === "string" && step.next.trim()) {
    targets.push(step.next.trim());
  }
  if (step.kind === "menu") {
    for (const opt of step.options) {
      if (typeof opt.next === "string" && opt.next.trim()) targets.push(opt.next.trim());
    }
  }
  return targets;
}

function cloneDefinition(def: PlaybookFlowDefinition): PlaybookFlowDefinition {
  return JSON.parse(JSON.stringify(def)) as PlaybookFlowDefinition;
}

function buildStepId(kind: PlaybookFlowStep["kind"], existing: Set<string>): string {
  const base = `${kind}_step`;
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

function makeDefaultStep(kind: PlaybookFlowStep["kind"], id: string): PlaybookFlowStep {
  if (kind === "message") return { id, kind, title: "Mensagem", message: "Mensagem inicial", next: "" };
  if (kind === "menu") {
    return {
      id,
      kind,
      title: "Menu",
      prompt: "Escolha uma opção:",
      field: id,
      options: [{ id: "opcao_1", label: "Opção 1", next: "" }],
    };
  }
  if (kind === "input") {
    return {
      id,
      kind,
      title: "Coleta de dado",
      prompt: "Qual a sua resposta?",
      field: "campo",
      input_type: "text",
      next: "",
    };
  }
  return {
    id,
    kind,
    title: "Conclusão",
    complete: { type: "complete", summary: "Encaminhar para atendimento." },
  };
}

function buildStarterDefinition(agenteSlug?: string) {
  return buildStarterPlaybookFlowDefinition(agenteSlug);
}

export function PlaybookFlowVisualBuilder({
  markdown,
  onMarkdownChange,
  agenteSlug,
  disabled = false,
}: Props) {
  const [draft, setDraft] = useState<PlaybookFlowDefinition | null>(null);
  const [selectedStepId, setSelectedStepId] = useState("");

  const parsed = useMemo(() => parsePlaybookFlowFromMarkdown(markdown), [markdown]);
  const parsedValidation = useMemo(() => {
    if (!parsed.ok) return null;
    return validatePlaybookFlowDefinition(parsed.definition);
  }, [parsed]);

  useEffect(() => {
    if (!parsed.ok) {
      setDraft(null);
      setSelectedStepId("");
      return;
    }
    const next = cloneDefinition(parsed.definition);
    setDraft(next);
    const firstId = next.steps[0]?.id ?? "";
    setSelectedStepId((prev) => {
      if (prev && next.steps.some((s) => s.id === prev)) return prev;
      return next.entry_step_id || firstId;
    });
  }, [parsed]);

  const draftValidation = useMemo(() => (draft ? validatePlaybookFlowDefinition(draft) : null), [draft]);
  const selectedIndex = useMemo(
    () => (draft ? draft.steps.findIndex((s) => s.id === selectedStepId) : -1),
    [draft, selectedStepId]
  );
  const selectedStep = selectedIndex >= 0 && draft ? draft.steps[selectedIndex] : null;

  function persistDefinition(next: PlaybookFlowDefinition) {
    const nextMarkdown = upsertPlaybookFlowBlockInMarkdown(markdown, next);
    onMarkdownChange(nextMarkdown);
    void emitFlowVisualTelemetry({
      event: "playbook.flow_visual.markdown_applied",
      agente_slug: agenteSlug,
      metadata: {
        source: "visual_builder",
        steps_count: next.steps.length,
        entry_step_id: next.entry_step_id,
      },
    });
  }

  function updateDraft(mutator: (current: PlaybookFlowDefinition) => PlaybookFlowDefinition) {
    let nextDraft: PlaybookFlowDefinition | null = null;
    setDraft((current) => {
      if (!current) return current;
      nextDraft = mutator(cloneDefinition(current));
      return nextDraft;
    });
    if (nextDraft) {
      persistDefinition(nextDraft);
    }
  }

  if (!markdown.trim()) {
    return (
      <div style={panelStyle}>
        <p style={hintStyle}>Carregue um playbook para habilitar a edição visual do fluxo.</p>
      </div>
    );
  }

  if (!parsed.ok) {
    const starter = buildStarterDefinition(agenteSlug);
    return (
      <div style={panelStyle}>
        <p style={{ ...hintStyle, color: "#d29922", fontWeight: 700, marginBottom: 8 }}>
          Fluxo visual indisponível para este markdown
        </p>
        <p style={hintStyle}>
          O bloco `{PLAYBOOK_FLOW_FENCE_TAG}` não foi carregado com JSON válido. Use “Gerar fluxo da empresa” ou ajuste o bloco no
          modo textual.
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            const nextMarkdown = upsertPlaybookFlowBlockInMarkdown(markdown, starter);
            onMarkdownChange(nextMarkdown);
            void emitFlowVisualTelemetry({
              event: "playbook.flow_visual.builder_fallback",
              agente_slug: agenteSlug,
              metadata: {
                reason: "invalid_or_missing_flow_block",
                parse_errors_count: parsed.errors.length,
              },
            });
          }}
          style={{ ...smallBtnStyle, width: "fit-content", marginTop: 2 }}
        >
          <Plus size={12} /> Criar fluxo inicial visual
        </button>
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#5d7a67", fontSize: 11 }}>
          {parsed.errors.slice(0, 4).map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (!draft) {
    return (
      <div style={panelStyle}>
        <p style={hintStyle}>A carregar fluxo...</p>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Route size={14} color="#79c0ff" />
          <p style={{ margin: 0, fontSize: 12, color: "#c9d1d9", fontWeight: 700 }}>Construtor visual de fluxo</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={smallLabelStyle}>
            Entrada
            <select
              value={draft.entry_step_id}
              disabled={disabled}
              onChange={(e) => {
                const nextEntry = e.target.value;
                updateDraft((current) => ({ ...current, entry_step_id: nextEntry }));
              }}
              style={smallSelectStyle}
            >
              {draft.steps.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id}
                </option>
              ))}
            </select>
          </label>
          {(["message", "menu", "input", "complete"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              disabled={disabled}
              style={smallBtnStyle}
              onClick={() => {
                const ids = new Set(draft.steps.map((s) => s.id));
                const id = buildStepId(kind, ids);
                const step = makeDefaultStep(kind, id);
                updateDraft((current) => {
                  const next = { ...current, steps: [...current.steps, step] };
                  if (!next.entry_step_id) next.entry_step_id = id;
                  return next;
                });
                setSelectedStepId(id);
              }}
              title={`Adicionar step ${kind}`}
            >
              <Plus size={12} /> {kind}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
        {draft.steps.map((step) => {
          const isActive = step.id === selectedStepId;
          return (
            <button
              key={step.id}
              type="button"
              disabled={disabled}
              onClick={() => setSelectedStepId(step.id)}
              style={{
                border: `1px solid ${isActive ? "#388bfd66" : "#dcebd8"}`,
                background: isActive ? "#1f6feb22" : "#ffffff",
                color: isActive ? "#9ecbff" : "#c9d1d9",
                borderRadius: 10,
                minWidth: 170,
                textAlign: "left",
                padding: "8px 10px",
                cursor: "pointer",
              }}
            >
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700 }}>
                {step.id} · {step.kind}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 10, color: "#5d7a67" }}>
                {nextTargets(step).length ? `Saídas: ${nextTargets(step).join(", ")}` : "Sem saída definida"}
              </p>
            </button>
          );
        })}
      </div>

      {selectedStep ? (
        <div style={{ border: "1px solid #dcebd8", borderRadius: 10, padding: 12, display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr auto" }}>
            <label style={smallLabelStyle}>
              ID
              <input
                value={selectedStep.id}
                disabled={disabled}
                onChange={(e) => {
                  const nextId = e.target.value.trim();
                  if (!nextId) return;
                  updateDraft((current) => {
                    const existing = new Set(current.steps.map((s) => s.id));
                    if (nextId !== selectedStep.id && existing.has(nextId)) return current;
                    const nextSteps = [...current.steps];
                    const step = { ...nextSteps[selectedIndex], id: nextId };
                    nextSteps[selectedIndex] = step;
                    const nextEntry = current.entry_step_id === selectedStep.id ? nextId : current.entry_step_id;
                    return { ...current, entry_step_id: nextEntry, steps: nextSteps };
                  });
                  setSelectedStepId(nextId);
                }}
                style={inputStyle}
              />
            </label>
            <label style={smallLabelStyle}>
              Título
              <input
                value={selectedStep.title ?? ""}
                disabled={disabled}
                onChange={(e) =>
                  updateDraft((current) => {
                    const next = [...current.steps];
                    next[selectedIndex] = { ...next[selectedIndex], title: e.target.value };
                    return { ...current, steps: next };
                  })
                }
                style={inputStyle}
              />
            </label>
            <button
              type="button"
              disabled={disabled || draft.steps.length <= 1}
              onClick={() => {
                const removingId = selectedStep.id;
                updateDraft((current) => {
                  const nextSteps = current.steps.filter((s) => s.id !== removingId);
                  const nextEntry =
                    current.entry_step_id === removingId ? (nextSteps[0]?.id ?? "") : current.entry_step_id;
                  return { ...current, entry_step_id: nextEntry, steps: nextSteps };
                });
                setSelectedStepId(draft.steps.find((s) => s.id !== removingId)?.id ?? "");
              }}
              style={{ ...smallBtnStyle, alignSelf: "end", color: "#ffaba8", borderColor: "#f8514955" }}
            >
              <Trash2 size={12} /> Remover
            </button>
          </div>

          {selectedStep.kind === "message" ? (
            <MessageStepEditor step={selectedStep} disabled={disabled} onChange={(nextStep) => {
              updateDraft((current) => {
                const next = [...current.steps];
                next[selectedIndex] = nextStep;
                return { ...current, steps: next };
              });
            }} />
          ) : null}

          {selectedStep.kind === "menu" ? (
            <MenuStepEditor
              step={selectedStep}
              disabled={disabled}
              onChange={(nextStep) => {
                updateDraft((current) => {
                  const next = [...current.steps];
                  next[selectedIndex] = nextStep;
                  return { ...current, steps: next };
                });
              }}
            />
          ) : null}

          {selectedStep.kind === "input" ? (
            <InputStepEditor step={selectedStep} disabled={disabled} onChange={(nextStep) => {
              updateDraft((current) => {
                const next = [...current.steps];
                next[selectedIndex] = nextStep;
                return { ...current, steps: next };
              });
            }} />
          ) : null}

          {selectedStep.kind === "complete" ? (
            <label style={smallLabelStyle}>
              Resumo final
              <textarea
                value={selectedStep.complete?.summary ?? ""}
                disabled={disabled}
                onChange={(e) => {
                  const summary = e.target.value;
                  updateDraft((current) => {
                    const next = [...current.steps];
                    const existing = next[selectedIndex];
                    if (existing.kind !== "complete") return current;
                    next[selectedIndex] = {
                      ...existing,
                      complete: {
                        ...(existing.complete ?? { type: "complete" as const }),
                        type: "complete",
                        summary,
                      },
                    };
                    return { ...current, steps: next };
                  });
                }}
                rows={3}
                style={textareaStyle}
              />
            </label>
          ) : null}
        </div>
      ) : null}

      <div
        style={{
          border: `1px solid ${draftValidation?.ok ? "#23863666" : "#d2992255"}`,
          background: draftValidation?.ok ? "#23863612" : "#d2992212",
          borderRadius: 10,
          padding: "8px 10px",
          fontSize: 11,
          color: draftValidation?.ok ? "#7ee787" : "#d6b976",
        }}
      >
        {draftValidation?.ok
          ? `Fluxo visual válido (${draft.steps.length} passos). Pronto para publicação.`
          : `Fluxo visual com pendências. ${
              draftValidation?.errors.slice(0, 2).join(" | ") || "Revise campos obrigatórios."
            }`}
      </div>

      {parsedValidation && !parsedValidation.ok ? (
        <p style={{ margin: 0, color: "#5d7a67", fontSize: 10 }}>
          Observação: o bloco carregado estava inválido; use esta área para corrigir e publicar uma versão consistente.
        </p>
      ) : null}
    </div>
  );
}

function MessageStepEditor({
  step,
  disabled,
  onChange,
}: {
  step: PlaybookFlowMessageStep;
  disabled: boolean;
  onChange: (step: PlaybookFlowMessageStep) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label style={smallLabelStyle}>
        Mensagem
        <textarea
          value={step.message}
          disabled={disabled}
          onChange={(e) => onChange({ ...step, message: e.target.value })}
          rows={4}
          style={textareaStyle}
        />
      </label>
      <label style={smallLabelStyle}>
        Próximo step (next)
        <input
          value={step.next ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ ...step, next: e.target.value })}
          style={inputStyle}
        />
      </label>
    </div>
  );
}

function InputStepEditor({
  step,
  disabled,
  onChange,
}: {
  step: PlaybookFlowInputStep;
  disabled: boolean;
  onChange: (step: PlaybookFlowInputStep) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label style={smallLabelStyle}>
        Prompt
        <textarea
          value={step.prompt}
          disabled={disabled}
          onChange={(e) => onChange({ ...step, prompt: e.target.value })}
          rows={3}
          style={textareaStyle}
        />
      </label>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 1fr" }}>
        <label style={smallLabelStyle}>
          Field
          <input
            value={step.field}
            disabled={disabled}
            onChange={(e) => onChange({ ...step, field: e.target.value })}
            style={inputStyle}
          />
        </label>
        <label style={smallLabelStyle}>
          Tipo
          <select
            value={step.input_type ?? "text"}
            disabled={disabled}
            onChange={(e) => onChange({ ...step, input_type: e.target.value as PlaybookFlowInputStep["input_type"] })}
            style={smallSelectStyle}
          >
            <option value="text">text</option>
            <option value="email">email</option>
            <option value="phone">phone</option>
            <option value="number">number</option>
          </select>
        </label>
        <label style={smallLabelStyle}>
          Next
          <input
            value={step.next ?? ""}
            disabled={disabled}
            onChange={(e) => onChange({ ...step, next: e.target.value })}
            style={inputStyle}
          />
        </label>
      </div>
    </div>
  );
}

function MenuStepEditor({
  step,
  disabled,
  onChange,
}: {
  step: PlaybookFlowMenuStep;
  disabled: boolean;
  onChange: (step: PlaybookFlowMenuStep) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label style={smallLabelStyle}>
        Prompt do menu
        <textarea
          value={step.prompt}
          disabled={disabled}
          onChange={(e) => onChange({ ...step, prompt: e.target.value })}
          rows={3}
          style={textareaStyle}
        />
      </label>
      <label style={smallLabelStyle}>
        Field
        <input
          value={step.field ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ ...step, field: e.target.value })}
          style={inputStyle}
        />
      </label>

      <div style={{ display: "grid", gap: 8 }}>
        {step.options.map((opt, idx) => (
          <div
            key={`${opt.id}-${idx}`}
            style={{ border: "1px solid #dcebd8", borderRadius: 8, padding: 8, display: "grid", gap: 6 }}
          >
            <div style={{ display: "grid", gap: 6, gridTemplateColumns: "1fr 1fr 1fr auto" }}>
              <input
                value={opt.id}
                disabled={disabled}
                onChange={(e) => {
                  const options = [...step.options];
                  options[idx] = { ...options[idx], id: e.target.value };
                  onChange({ ...step, options });
                }}
                placeholder="id"
                style={inputStyle}
              />
              <input
                value={opt.label}
                disabled={disabled}
                onChange={(e) => {
                  const options = [...step.options];
                  options[idx] = { ...options[idx], label: e.target.value };
                  onChange({ ...step, options });
                }}
                placeholder="label"
                style={inputStyle}
              />
              <input
                value={opt.next ?? ""}
                disabled={disabled}
                onChange={(e) => {
                  const options = [...step.options];
                  options[idx] = { ...options[idx], next: e.target.value };
                  onChange({ ...step, options });
                }}
                placeholder="next"
                style={inputStyle}
              />
              <button
                type="button"
                disabled={disabled || step.options.length <= 1}
                onClick={() => {
                  const options = step.options.filter((_, i) => i !== idx);
                  onChange({ ...step, options });
                }}
                style={{ ...smallBtnStyle, color: "#ffaba8", borderColor: "#f8514955" }}
                title="Remover opção"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          const optionIndex = step.options.length + 1;
          onChange({
            ...step,
            options: [...step.options, { id: `opcao_${optionIndex}`, label: `Opção ${optionIndex}`, next: "" }],
          });
        }}
        style={smallBtnStyle}
      >
        <Plus size={12} /> Adicionar opção
      </button>
    </div>
  );
}

const panelStyle: CSSProperties = {
  border: "1px solid #dcebd8",
  borderRadius: 10,
  background: "#f8fcf6",
  padding: 12,
  display: "grid",
  gap: 10,
};

const hintStyle: CSSProperties = {
  margin: 0,
  color: "#5d7a67",
  fontSize: 11,
  lineHeight: 1.5,
};

const smallLabelStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  color: "#5d7a67",
  fontSize: 10,
  fontWeight: 700,
};

const inputStyle: CSSProperties = {
  border: "1px solid #dcebd8",
  borderRadius: 8,
  background: "#ffffff",
  color: "#0b2210",
  fontSize: 11,
  padding: "7px 9px",
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  resize: "vertical",
  minHeight: 72,
};

const smallSelectStyle: CSSProperties = {
  ...inputStyle,
  paddingTop: 6,
  paddingBottom: 6,
};

const smallBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  border: "1px solid #dcebd8",
  borderRadius: 8,
  background: "#eef7eb",
  color: "#c9d1d9",
  padding: "6px 8px",
  fontSize: 10,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
