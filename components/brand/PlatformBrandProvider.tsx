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
  /** true enquanto a marca ainda não está disponível para render branded UI */
  loading: boolean;
  /** true quando marca + tema no documento estão prontos */
  ready: boolean;
  refresh: () => Promise<void>;
};

const PlatformBrandContext = createContext<PlatformBrandContextValue>({
  brand: null,
  loading: true,
  ready: false,
  refresh: async () => {},
});

export function usePlatformBrand(): PlatformBrandContextValue {
  return useContext(PlatformBrandContext);
}

export function useBrandNome(): string {
  const { brand } = usePlatformBrand();
  return brand?.nome?.trim() || "Waje";
}

export function useIsWhiteLabelBrand(): boolean {
  const { brand } = usePlatformBrand();
  return Boolean(brand && !brand.isPrincipal);
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

export function PlatformBrandProvider({
  children,
  initialBrand = null,
}: {
  children: ReactNode;
  initialBrand?: PlatformBrandPublic | null;
}) {
  const [brand, setBrand] = useState<PlatformBrandPublic | null>(initialBrand);
  const [loading, setLoading] = useState(!initialBrand);
  const [readyOnce, setReadyOnce] = useState(Boolean(initialBrand));

  const refresh = useCallback(async (options?: { background?: boolean }) => {
    const background = options?.background ?? Boolean(brand);
    if (!background) setLoading(true);
    try {
      const res = await fetch("/api/public/platform-brand", { credentials: "include" });
      const json = (await res.json()) as { data?: PlatformBrandPublic };
      if (res.ok && json.data) {
        setBrand((prev) => {
          if (prev?.slug === json.data!.slug) {
            return { ...prev, ...json.data! };
          }
          return json.data!;
        });
        applyBrandToDocument(json.data);
      }
    } catch {
      /* mantém fallback estático */
    } finally {
      if (!background) setLoading(false);
    }
  }, [brand]);

  useEffect(() => {
    if (initialBrand) {
      applyBrandToDocument(initialBrand);
      void refresh({ background: true });
      return;
    }
    void refresh();
  }, [initialBrand, refresh]);

  useEffect(() => {
    if (Boolean(brand) && !loading) setReadyOnce(true);
  }, [brand, loading]);

  const ready = readyOnce || (Boolean(brand) && !loading);
  const value = useMemo(
    () => ({ brand, loading, ready, refresh: () => refresh({ background: true }) }),
    [brand, loading, ready, refresh]
  );

  return <PlatformBrandContext.Provider value={value}>{children}</PlatformBrandContext.Provider>;
}
