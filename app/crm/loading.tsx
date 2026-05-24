/** Skeleton leve só no segmento CRM — não bloqueia o ecrã inteiro como `app/loading.tsx`. */
export default function CrmLoading() {
  return (
    <div
      className="flex flex-1 flex-col gap-3 p-4"
      style={{ background: "#0d1117", minHeight: 120 }}
      aria-busy="true"
      aria-label="A carregar"
    >
      <div
        className="h-10 w-full max-w-md animate-pulse rounded-lg"
        style={{ background: "#21262d" }}
      />
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-9 flex-1 max-w-[140px] animate-pulse rounded-lg"
            style={{ background: "#21262d" }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-col gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-xl"
            style={{ background: "#161b22", border: "1px solid #21262d" }}
          />
        ))}
      </div>
    </div>
  );
}
