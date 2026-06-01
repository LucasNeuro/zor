"use client";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";

const MobileShell = dynamic(() => import("./MobileShell"), { ssr: false });

interface Props { children: React.ReactNode; }

function mobileFallback(children: React.ReactNode) {
  return (
    <div className="min-h-[100dvh]" style={{ background: "#0d1117" }}>
      {children}
    </div>
  );
}

export default function MobileDetector({ children }: Props) {
  const narrow = useNarrowViewport();

  if (narrow === null) {
    return mobileFallback(children);
  }

  if (narrow) {
    return (
      <Suspense fallback={mobileFallback(children)}>
        <MobileShell>{children}</MobileShell>
      </Suspense>
    );
  }

  return <>{children}</>;
}
