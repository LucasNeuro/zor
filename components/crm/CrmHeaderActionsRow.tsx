"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";

const GROUP_BORDER = "1px solid #d4ecd0";

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
export function CrmHeaderActionsRow({
  children,
  align = "end",
  overflowBehavior = "wrap",
}: {
  children: ReactNode;
  /** Alinhamento horizontal dos grupos na linha. */
  align?: "start" | "end" | "center";
  /** Comportamento quando os grupos excedem a largura disponível. */
  overflowBehavior?: "wrap" | "scroll";
}) {
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

    const run: ReactElement<{ style?: CSSProperties }>[] = [];
    while (i < items.length && isNativeButton(items[i])) {
      run.push(items[i] as ReactElement<{ style?: CSSProperties }>);
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
            boxShadow: "0 2px 8px rgba(11, 31, 16, 0.08)",
          }}
        >
          {run.map((btn, j) => cloneButtonForGroup(btn, j, run.length, gid))}
        </div>,
      );
    }
  }

  const justify =
    align === "start" ? "justify-start" : align === "center" ? "justify-center" : "justify-end";
  const allowHorizontalScroll = overflowBehavior === "scroll";
  const rowClass = allowHorizontalScroll
    ? `flex min-w-0 max-w-full w-full flex-nowrap items-center gap-2 ${justify}`
    : `flex min-w-0 flex-shrink-0 flex-wrap items-center gap-2 ${justify}`;
  const rowStyle = allowHorizontalScroll
    ? ({
        overflowX: "auto",
        overflowY: "hidden",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "thin",
      } as CSSProperties)
    : undefined;

  return <div className={rowClass} style={rowStyle}>{out}</div>;
}
