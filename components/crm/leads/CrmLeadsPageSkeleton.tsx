"use client";

/** Skeleton leve para primeira carga do funil de leads (evita spinner full-screen). */
export function CrmLeadsPageSkeleton() {
  return (
    <div className="flex h-full min-h-[50vh] flex-col bg-[#f8fcf6]" aria-busy aria-label="A carregar leads">
      <div className="border-b border-[#dcebd8] px-4 py-3">
        <div className="mx-auto flex max-w-6xl gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-16 flex-1 animate-pulse rounded-xl bg-[#e8f0e6]"
              aria-hidden
            />
          ))}
        </div>
      </div>
      <div className="flex flex-1 gap-3 overflow-hidden p-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex min-w-[240px] flex-1 flex-col gap-2 rounded-xl border border-[#dcebd8] bg-white/60 p-3"
            aria-hidden
          >
            <div className="h-5 w-24 animate-pulse rounded bg-[#e8f0e6]" />
            <div className="h-20 animate-pulse rounded-lg bg-[#f0f7ee]" />
            <div className="h-20 animate-pulse rounded-lg bg-[#f0f7ee]" />
          </div>
        ))}
      </div>
    </div>
  );
}
