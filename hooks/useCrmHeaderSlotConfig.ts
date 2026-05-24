"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";

/**
 * Regista título/acções do header com dependências estáveis.
 * `subtitle` em string evita re-render do layout a cada mudança de JSX.
 */
export function useCrmHeaderSlotConfig(config: {
  path: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const { setSlot } = useCrmHeaderSlot();

  const actions = useMemo(() => config.actions, [config.actions]);

  useEffect(() => {
    setSlot({
      path: config.path,
      title: config.title,
      subtitle: config.subtitle,
      actions,
    });
    return () => setSlot(null);
  }, [config.path, config.title, config.subtitle, actions, setSlot]);
}
