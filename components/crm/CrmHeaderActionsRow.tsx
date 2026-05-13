"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";

const GROUP_BORDER = "1px solid rgba(48, 54, 61, 0.85)";

function isNativeButton(node: ReactNode): node is ReactElement<{ style?: CSSProperties }> {
  return isValidElement(node) && node.type === "button";
}

function cloneButtonForGroup(
  btn: ReactElement<{ style?: CSSProperties }>,
  index: number,
  total: number,
  groupIndex: number,
) {
  const prev = (btn.props.style && typeof btn.props.style === "object" ? btn.props.style : {}) as CSSProperties;
  return cloneElement(btn, {
    key: `crm-hdr-g${groupIndex}-b${index}`,
    style: {
      ...prev,
      borderRadius: 0,
      border: "none",
      borderRight: index < total - 1 ? GROUP_BORDER : undefined,
    },
  });
}

/**
 * Área de ações do header CRM: filhos são dispostos com `gap-2`;
 * **duas ou mais tags `<button>` seguidas** viram um único button group (borda única, sem espaço entre elas).
 */
export function CrmHeaderActionsRow({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  if (items.length === 0) return null;

  const out: ReactNode[] = [];
  let i = 0;
  let groupId = 0;

  while (i < items.length) {
    if (!isNativeButton(items[i])) {
      out.push(items[i]);
      i += 1;
      continue;
    }

    const run: ReactElement[] = [];
    while (i < items.length && isNativeButton(items[i])) {
      run.push(items[i] as ReactElement);
      i += 1;
    }

    if (run.length === 1) {
      out.push(run[0]);
    } else {
      const gid = groupId++;
      out.push(
        <div
          key={`crm-header-btngroup-${gid}`}
          role="group"
          aria-label="Ações da página"
          className="inline-flex items-stretch overflow-hidden rounded-xl"
          style={{
            border: GROUP_BORDER,
            boxShadow: "0 6px 22px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {run.map((btn, j) => cloneButtonForGroup(btn, j, run.length, gid))}
        </div>,
      );
    }
  }

  return <div className="flex min-w-0 flex-shrink-0 flex-wrap items-center justify-end gap-2">{out}</div>;
}
