"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** `path` deve ser o `usePathname()` atual — o header só aplica o slot quando bate com a rota (evita flash da tela anterior). */
export type CrmHeaderSlot = {
  path: string;
  title?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
} | null;

type Ctx = {
  slot: CrmHeaderSlot;
  setSlot: (next: CrmHeaderSlot) => void;
};

const CrmHeaderContext = createContext<Ctx | null>(null);

export function CrmHeaderProvider({ children }: { children: ReactNode }) {
  const [slot, setSlotState] = useState<CrmHeaderSlot>(null);
  const setSlot = useCallback((next: CrmHeaderSlot) => {
    setSlotState(next);
  }, []);

  const value = useMemo(() => ({ slot, setSlot }), [slot, setSlot]);

  return <CrmHeaderContext.Provider value={value}>{children}</CrmHeaderContext.Provider>;
}

export function useCrmHeaderSlot() {
  const c = useContext(CrmHeaderContext);
  if (!c) {
    throw new Error("useCrmHeaderSlot must be used within CrmHeaderProvider");
  }
  return c;
}
