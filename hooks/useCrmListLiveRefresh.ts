"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

const NAV_PREV_KEY = "crm:nav-prev-path";

/**
 * Revalida listas CRM ao voltar de rota filha ou do bfcache do browser.
 * Não invalida em todo render — só quando o pathname muda para `listPath` vindo de `listPath/*`.
 */
export function useCrmListLiveRefresh(queryKey: QueryKey, listPath: string) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const queryKeyRef = useRef(queryKey);
  queryKeyRef.current = queryKey;

  useEffect(() => {
    let prev: string | null = null;
    try {
      prev = sessionStorage.getItem(NAV_PREV_KEY);
      sessionStorage.setItem(NAV_PREV_KEY, pathname);
    } catch {
      /* modo privado / storage indisponível */
    }

    if (pathname !== listPath) return;

    const fromChild =
      prev != null && prev !== listPath && prev.startsWith(`${listPath}/`);

    if (fromChild) {
      void queryClient.invalidateQueries({ queryKey: queryKeyRef.current });
    }
  }, [pathname, listPath, queryClient]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted || pathname !== listPath) return;
      void queryClient.invalidateQueries({ queryKey: queryKeyRef.current });
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [pathname, listPath, queryClient]);
}
