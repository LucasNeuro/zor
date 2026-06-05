"use client";

export type FunilChartItem = {
  label: string;
  count: number;
  color: string;
};

type Props = {
  items: FunilChartItem[];
};

export function FunilOperacionalChart({ items }: Props) {
  const maxCount = Math.max(...items.map((i) => i.count), 0);
  const topo = maxCount > 0 ? maxCount : 1;

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const pct = maxCount > 0 ? Math.round((item.count / topo) * 100) : 0;
        return (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className="min-w-[7rem] shrink-0 truncate text-right text-[10px] font-bold text-[#5d7a67] sm:max-w-[9rem]"
              title={item.label}
            >
              {item.label}
            </span>
            <div className="relative h-6 min-w-0 flex-1 overflow-hidden rounded-md bg-[#eef7eb]">
              {item.count > 0 && (
                <div
                  className="h-full rounded-md transition-all duration-700"
                  style={{
                    width: `${Math.max(4, pct)}%`,
                    background: item.color,
                  }}
                />
              )}
            </div>
            <span className="w-8 shrink-0 text-right text-[10px] font-bold tabular-nums text-[#0b2210]">
              {item.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
