/** Lưới KPI responsive — dùng chung cho trang mock analytics. */
export default function KpiGrid({ items, columns = 4 }) {
  const colClass =
    columns === 7
      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7'
      : columns === 6
        ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
        : columns === 5
          ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
          : 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={`grid gap-3 ${colClass}`}>
      {items.map((kpi, i) => {
        const Icon = kpi.icon;
        return (
          <div
            key={kpi.key ?? `${kpi.label}-${i}`}
            className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition hover:shadow-md"
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: kpi.bg || 'rgba(99, 102, 241, 0.08)', color: kpi.color || '#6366f1' }}
            >
              {Icon ? <Icon size={18} weight="duotone" /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-[10.5px] font-medium leading-snug text-slate-500">
                {kpi.label}
              </div>
              <div className="text-base font-extrabold leading-tight text-slate-900">{kpi.value}</div>
              {kpi.change ? (
                <div
                  className={`text-[10px] font-semibold ${
                    kpi.changePositive === false ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {kpi.change}
                </div>
              ) : kpi.sub ? (
                <div className="text-[10px] text-slate-400">{kpi.sub}</div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
