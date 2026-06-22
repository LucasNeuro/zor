"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CrmLogoutOverlay } from "@/components/crm/CrmLogoutOverlay";
import { registerLogoutOverlayHandlers } from "@/lib/crm/logout-overlay-bridge";

type CrmLogoutOverlayContextValue = {
  isLoggingOut: boolean;
  beginLogout: () => void;
  endLogout: () => void;
};

const CrmLogoutOverlayContext = createContext<CrmLogoutOverlayContextValue | null>(null);

export function CrmLogoutOverlayProvider({ children }: { children: ReactNode }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const beginLogout = useCallback(() => {
    setIsLoggingOut(true);
  }, []);

  const endLogout = useCallback(() => {
    setIsLoggingOut(false);
  }, []);

  useEffect(() => {
    registerLogoutOverlayHandlers({ beginLogout, endLogout });
    return () => registerLogoutOverlayHandlers(null);
  }, [beginLogout, endLogout]);

  const value = useMemo(
    () => ({ isLoggingOut, beginLogout, endLogout }),
    [isLoggingOut, beginLogout, endLogout],
  );

  return (
    <CrmLogoutOverlayContext.Provider value={value}>
      {children}
      <CrmLogoutOverlay visible={isLoggingOut} />
    </CrmLogoutOverlayContext.Provider>
  );
}

export function useCrmLogoutOverlay(): CrmLogoutOverlayContextValue {
  const ctx = useContext(CrmLogoutOverlayContext);
  if (!ctx) {
    throw new Error("useCrmLogoutOverlay must be used within CrmLogoutOverlayProvider");
  }
  return ctx;
}
