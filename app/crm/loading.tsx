import { CRM_LOADING_SHELL, CRM_SURFACE_CARD } from "@/lib/crm-shell-theme";

/** Skeleton leve no segmento CRM — tema claro TIVIA (sem fundo escuro legado). */
export default function CrmLoading() {
  const { background, skeleton, skeletonStrong, rowBorder } = CRM_LOADING_SHELL;

  return (
    <div
      className="flex flex-1 flex-col gap-4 p-4 sm:p-6"
      style={{ background, minHeight: 120 }}
      aria-busy="true"
      aria-label="A carregar"
    >
      <div className="flex gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-20 flex-1 max-w-[180px] animate-pulse rounded-xl"
            style={{ background: CRM_SURFACE_CARD, border: `1px solid ${rowBorder}` }}
          />
        ))}
      </div>

      <div
        className="h-10 w-full max-w-lg animate-pulse rounded-xl"
        style={{ background: skeleton, border: `1px solid ${rowBorder}` }}
      />

      <div className="flex flex-col gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-xl"
            style={{
              background: i % 2 === 0 ? skeleton : skeletonStrong,
              border: `1px solid ${rowBorder}`,
              opacity: 1 - i * 0.06,
            }}
          />
        ))}
      </div>
    </div>
  );
}
