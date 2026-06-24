"use client";

import { useEffect, useRef, useState } from "react";
import { PlatformBrandLoading } from "@/components/brand/PlatformBrandLoading";
import { usePlatformBrand } from "@/components/brand/PlatformBrandProvider";

type Props = {
  layoutReady: boolean;
  accessLoaded: boolean;
  children: React.ReactNode;
};

/** Só monta o shell CRM (sidebar + conteúdo) quando marca, viewport e acessos estão prontos. */
export function CrmShellBootstrap({ layoutReady, accessLoaded, children }: Props) {
  const { ready: brandReady } = usePlatformBrand();
  const shellReady = layoutReady && accessLoaded && brandReady;
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (shellReady && !bootstrappedRef.current) {
      bootstrappedRef.current = true;
      setHasBootstrapped(true);
    }
  }, [shellReady]);

  if (!hasBootstrapped && !shellReady) {
    return <PlatformBrandLoading label="A preparar o CRM…" />;
  }

  return <>{children}</>;
}
