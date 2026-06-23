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
import type { PlatformBrandPublic } from "@/lib/platform-brands";

type PlatformBrandContextValue = {
  brand: PlatformBrandPublic | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const PlatformBrandContext = createContext<PlatformBrandContextValue>({
  brand: null,
  loading: true,
  refresh: async () => {},
});

export function usePlatformBrand(): PlatformBrandContextValue {
  return useContext(PlatformBrandContext);
}

function applyBrandToDocument(brand: PlatformBrandPublic | null) {
  if (typeof document === "undefined" || !brand) return;
  const root = document.documentElement;
  root.style.setProperty("--platform-brand-primary", brand.corPrimaria);
  root.style.setProperty("--platform-brand-accent", brand.corAccent);
  root.style.setProperty("--platform-brand-bg", brand.corFundo);
  if (brand.faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>('link[data-platform-brand-favicon="1"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.setAttribute("data-platform-brand-favicon", "1");
      document.head.appendChild(link);
    }
    link.href = brand.faviconUrl;
  }
}

export function PlatformBrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<PlatformBrandPublic | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/public/platform-brand", { credentials: "include" });
      const json = (await res.json()) as { data?: PlatformBrandPublic };
      if (res.ok && json.data) {
        setBrand(json.data);
        applyBrandToDocument(json.data);
      }
    } catch {
      /* mantém fallback estático */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ brand, loading, refresh }), [brand, loading, refresh]);

  return <PlatformBrandContext.Provider value={value}>{children}</PlatformBrandContext.Provider>;
}
