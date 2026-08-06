import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  ChartLineUp,
  ClipboardText,
  Truck,
  Percent,
  Warning,
  WarningCircle,
  TrendUp,
  TrendDown,
  FileArrowDown,
  ChartBar,
  ChartPieSlice,
  Package,
  Timer,
  ArrowsCounterClockwise,
  CaretLeft,
  CaretRight,
} from '@phosphor-icons/react';
import AnalyticsShell from '@/components/analytics/AnalyticsShell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/custom-ui/select';
import { fetchProductOperations, fetchOmsCategories, fetchOmsLocations } from '@/features/cskh-quality/api';

const ALL_VALUE = '__all__';
const selectTriggerClass =
  'h-8.5 w-full rounded-lg border-slate-200 bg-slate-50/60 px-2.5 py-0 text-[12.5px] font-normal text-slate-700 shadow-none hover:bg-white';

const EXTRA_ICONS = {
  revenue: { icon: ChartBar, bg: 'bg-emerald-50', fg: 'text-emerald-600' },
  categoryShare: { icon: ChartPieSlice, bg: 'bg-violet-50', fg: 'text-violet-600' },
  noOrders: { icon: Package, bg: 'bg-amber-50', fg: 'text-amber-600' },
  avgProcessTime: { icon: Timer, bg: 'bg-sky-50', fg: 'text-sky-600' },
  cancelReturnRate: { icon: ArrowsCounterClockwise, bg: 'bg-rose-50', fg: 'text-rose-600' },
};

const RANK_STYLES = [
  'bg-amber-100 text-amber-700',
  'bg-slate-200 text-slate-600',
  'bg-orange-100 text-orange-700',
];

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function KpiTrend({ pct }) {
  if (pct == null) return null;
  const up = pct >= 0;
  const Icon = up ? TrendUp : TrendDown;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
      <Icon size={12} weight="bold" />
      {up ? '+' : ''}
      {pct}%
    </span>
  );
}

function RankBadge({ rank }) {
  return (
    <span
      className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
        RANK_STYLES[rank - 1] ?? 'bg-slate-100 text-slate-500'
      }`}
    >
      {rank}
    </span>
  );
}

const REVENUE_BAR_COLORS = ['#6366f1', '#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#94a3b8', '#14b8a6'];

function formatVndShort(value) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}tỷ`;
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}tr`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return `${value}`;
}

function truncateName(name, max = 26) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function RevenueTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] shadow-lg">
      <div className="mb-1 max-w-55 font-semibold text-slate-800">{p.name}</div>
      <div className="text-slate-500">SL: {p.quantity.toLocaleString('vi-VN')}</div>
      <div className="font-semibold text-indigo-600">{Math.round(p.revenue).toLocaleString('vi-VN')}đ</div>
    </div>
  );
}

function Pagination({ page, totalPages, total, pageSize, onChange }) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-3.5 py-2.5">
      <span className="text-[11.5px] text-slate-500">
        {start}–{end} trên {total} sản phẩm
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Trang trước"
        >
          <CaretLeft size={12} weight="bold" />
        </button>
        <span className="min-w-16 text-center text-[11.5px] font-medium text-slate-600">
          Trang {page}/{totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Trang sau"
        >
          <CaretRight size={12} weight="bold" />
        </button>
      </div>
    </div>
  );
}

function FilterField({ label, width, children }) {
  return (
    <div className="flex flex-col gap-1.5" style={{ width }}>
      <label className="text-[11px] font-semibold text-slate-500">{label}</label>
      {children}
    </div>
  );
}

const fieldClass =
  'h-8.5 w-full truncate rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 text-[12.5px] text-slate-700 transition-colors focus:border-indigo-300 focus:bg-white focus:outline-none';

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryId = searchParams.get('category') ?? '';
  const [month, setMonth] = useState(currentMonthValue());
  const [locationId, setLocationId] = useState('');
  const [mobileTab, setMobileTab] = useState('top');
  const [stockPulse, setStockPulse] = useState(false);
  const [stockoutPage, setStockoutPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const stockPanelRef = useRef(null);

  useEffect(() => {
    setStockoutPage(1);
  }, [month, categoryId, locationId]);

  const goToStockList = () => {
    setMobileTab('stock');
    stockPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setStockPulse(true);
  };

  useEffect(() => {
    if (!stockPulse) return;
    const t = setTimeout(() => setStockPulse(false), 1400);
    return () => clearTimeout(t);
  }, [stockPulse]);

  const setCategoryId = (value) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set('category', value);
        else next.delete('category');
        return next;
      },
      { replace: true },
    );
  };

  const { data: categoryOptions = [] } = useQuery({
    queryKey: ['cskh', 'oms', 'categories'],
    queryFn: fetchOmsCategories,
    staleTime: 10 * 60_000,
  });

  const { data: locationOptions = [] } = useQuery({
    queryKey: ['cskh', 'oms', 'locations'],
    queryFn: fetchOmsLocations,
    staleTime: 10 * 60_000,
  });

  const { data, isFetching, isPlaceholderData } = useQuery({
    queryKey: ['cskh', 'products', 'operations', month, categoryId, locationId, stockoutPage],
    queryFn: () =>
      fetchProductOperations({
        month,
        categoryId: categoryId || undefined,
        locationId: locationId || undefined,
        stockoutPage,
        stockoutPageSize: 10,
      }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const kpis = data?.kpis;
  const topOrdered = data?.topOrdered ?? [];
  const stockouts = data?.stockouts ?? [];
  const extraMetrics = data?.extraMetrics ?? [];
  const topRevenueProducts = data?.topRevenueProducts ?? [];
  const stockoutsPagination = data?.stockoutsPagination;
  const shipRate = kpis?.shipToOrderRate != null ? Math.round(kpis.shipToOrderRate) : null;
  const stuckOrdersTotal = kpis?.stuckOrdersTotal ?? 0;

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const full = await fetchProductOperations({
        month,
        categoryId: categoryId || undefined,
        locationId: locationId || undefined,
        stockoutPage: 1,
        stockoutPageSize: stockoutsPagination?.total || 10_000,
      });
      const categoryLabel = categoryId ? categoryOptions.find((c) => c.id === categoryId)?.name : undefined;
      const locationLabel = locationId ? locationOptions.find((l) => l.id === locationId)?.name : undefined;
      const { exportProductOperationsExcel } = await import('./exportProductsExcel');
      await exportProductOperationsExcel(full, { categoryLabel, locationLabel });
      toast.success('Đã xuất file Excel thành công');
    } catch (err) {
      toast.error(`Xuất Excel thất bại: ${err?.message || 'Lỗi không xác định'}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AnalyticsShell demo={false}>
      <div
        className="page-scroll"
        style={{ opacity: isFetching && isPlaceholderData ? 0.72 : 1, transition: 'opacity .15s' }}
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2.5 text-[19px] font-bold text-slate-900">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <ChartLineUp size={18} weight="duotone" />
                </span>
                Sản phẩm — Vận hành theo tháng
              </h1>
              <p className="mt-1.5 text-[12.5px] text-slate-500">
                Tình trạng đơn hàng và tồn kho theo tháng, thay cho danh sách catalog trước đây.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="flex h-8.5 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileArrowDown size={14} className={isExporting ? 'animate-spin' : ''} />
              {isExporting ? 'Đang xuất...' : 'Xuất Excel'}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
            <FilterField label="Tháng" width={150}>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className={fieldClass}
              />
            </FilterField>
            <FilterField label="Danh mục" width={220}>
              <Select
                value={categoryId || ALL_VALUE}
                onValueChange={(v) => setCategoryId(v === ALL_VALUE ? '' : v)}
              >
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder="Tất cả danh mục" />
                </SelectTrigger>
                <SelectContent className="max-w-90">
                  <SelectItem value={ALL_VALUE}>Tất cả danh mục</SelectItem>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="whitespace-normal">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Kho" width={220}>
              <Select
                value={locationId || ALL_VALUE}
                onValueChange={(v) => setLocationId(v === ALL_VALUE ? '' : v)}
              >
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder="Tất cả kho" />
                </SelectTrigger>
                <SelectContent className="max-w-90">
                  <SelectItem value={ALL_VALUE}>Tất cả kho</SelectItem>
                  {locationOptions.map((l) => (
                    <SelectItem key={l.id} value={l.id} className="whitespace-normal">
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div
            className="animate-in fade-in slide-in-from-bottom-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            style={{ animationDelay: '0ms' }}
          >
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[12px] font-semibold text-slate-500">SP lên đơn trong tháng</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <ClipboardText size={16} weight="duotone" />
              </span>
            </div>
            <div className="text-[26px] font-bold leading-none text-slate-900">{kpis ? kpis.ordered : '…'}</div>
            <div className="mt-2.5 flex items-center gap-1.5">
              <KpiTrend pct={kpis?.orderedChangePct} />
              <span className="text-[11px] text-slate-400">so với tháng trước</span>
            </div>
          </div>

          <div
            className="animate-in fade-in slide-in-from-bottom-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            style={{ animationDelay: '50ms' }}
          >
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[12px] font-semibold text-slate-500">SP đã xuất hàng</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Truck size={16} weight="duotone" />
              </span>
            </div>
            <div className="text-[26px] font-bold leading-none text-slate-900">{kpis ? kpis.shipped : '…'}</div>
            <div className="mt-2.5 flex items-center gap-1.5">
              <KpiTrend pct={kpis?.shippedChangePct} />
              <span className="text-[11px] text-slate-400">so với tháng trước</span>
            </div>
          </div>

          <div
            className="animate-in fade-in slide-in-from-bottom-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            style={{ animationDelay: '100ms' }}
          >
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[12px] font-semibold text-slate-500">Tỉ lệ xuất / lên đơn</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <Percent size={16} weight="duotone" />
              </span>
            </div>
            <div className="text-[26px] font-bold leading-none text-slate-900">
              {shipRate != null ? `${shipRate}%` : '…'}
            </div>
            <div className="mt-2.5 h-1.25 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-600 transition-[width] duration-500"
                style={{ width: `${Math.min(100, Math.max(0, shipRate ?? 0))}%` }}
              />
            </div>
          </div>

          <div
            className="animate-in fade-in slide-in-from-bottom-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm transition-shadow hover:shadow-md"
            style={{ animationDelay: '150ms' }}
          >
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[12px] font-semibold text-rose-700">SP thiếu hàng khi lên đơn</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                <Warning size={16} weight="duotone" />
              </span>
            </div>
            <div className="text-[26px] font-bold leading-none text-rose-700">{kpis ? kpis.stockoutCount : '…'}</div>
            <button
              type="button"
              onClick={goToStockList}
              className="mt-2.5 text-[11.5px] font-semibold text-rose-700 hover:underline"
            >
              Xem danh sách →
            </button>
          </div>
        </div>

        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileTab('top')}
            className={`flex-1 rounded-md py-1.5 text-[13px] font-medium transition-colors ${
              mobileTab === 'top' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'
            }`}
          >
            Top order
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('stock')}
            className={`flex-1 rounded-md py-1.5 text-[13px] font-medium transition-colors ${
              mobileTab === 'stock' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'
            }`}
          >
            Thiếu hàng ({data?.stockoutListCount ?? 0})
          </button>
        </div>

        <div className="flex flex-col gap-3.5 lg:flex-row">
          <div
            className={`animate-in fade-in slide-in-from-bottom-4 w-full rounded-2xl border border-slate-200 bg-white shadow-sm lg:flex lg:flex-col ${
              mobileTab === 'top' ? 'flex flex-col' : 'hidden'
            }`}
            style={{ flex: '1.3 1 0%', minWidth: 0, animationDelay: '200ms' }}
          >
            <div className="card-title">
              <span className="inline-flex items-center gap-1.5">
                <TrendUp size={15} weight="bold" className="text-indigo-500" />
                Top sản phẩm được order nhiều nhất
              </span>
            </div>
            <div className="px-3.5 pb-2 text-[12px] text-slate-500">
              Xếp theo số lượt lên đơn trong tháng đang chọn.
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: 0 }}>
                <thead>
                  <tr>
                    <th></th>
                    <th>Sản phẩm</th>
                    <th>Lượt / SL</th>
                    <th>So T.trước</th>
                  </tr>
                </thead>
                <tbody>
                  {topOrdered.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>
                        Không có dữ liệu
                      </td>
                    </tr>
                  ) : (
                    topOrdered.map((p) => (
                      <tr key={p.rank}>
                        <td style={{ width: 32 }}>
                          <RankBadge rank={p.rank} />
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{p.name}</div>
                          <span className="tag tag-gray">{p.category}</span>
                        </td>
                        <td style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                          {p.count} lượt · {p.qty}sp
                        </td>
                        <td>
                          <KpiTrend pct={p.changePct} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div
            ref={stockPanelRef}
            className={`animate-in fade-in slide-in-from-bottom-4 w-full rounded-2xl border bg-white shadow-sm transition-all duration-300 lg:flex lg:flex-col ${
              mobileTab === 'stock' ? 'flex flex-col' : 'hidden'
            } ${stockPulse ? 'border-rose-400 ring-4 ring-rose-200' : 'border-rose-200'}`}
            style={{ flex: '1 1 0%', minWidth: 0, animationDelay: '250ms', scrollMarginTop: 14 }}
          >
            <div className="card-title" style={{ color: '#b91c1c' }}>
              <span className="inline-flex items-center gap-1.5">
                <WarningCircle size={16} weight="fill" />
                Sản phẩm thiếu hàng
              </span>
            </div>
            <div className="px-3.5 pb-2 text-[12px] text-rose-700">
              {kpis ? kpis.stockoutCount : 0} sản phẩm đang thiếu hàng · {stuckOrdersTotal} đơn đang bị kẹt vì thiếu tồn.
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: 0 }}>
                <thead>
                  <tr>
                    <th>SP / SKU</th>
                    <th>Thiếu</th>
                    <th>Khả dụng</th>
                    <th>Đơn kẹt</th>
                  </tr>
                </thead>
                <tbody>
                  {stockouts.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>
                        Không có sản phẩm thiếu hàng
                      </td>
                    </tr>
                  ) : (
                    stockouts.map((s) => (
                      <tr key={s.sku}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{s.name}</div>
                          <div style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace' }}>{s.sku}</div>
                        </td>
                        <td>
                          <span className="tag tag-red">-{s.shortage}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>{s.available}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{s.stuckOrders}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {stockoutsPagination ? (
              <Pagination
                page={stockoutsPagination.page}
                totalPages={stockoutsPagination.totalPages}
                total={stockoutsPagination.total}
                pageSize={stockoutsPagination.pageSize}
                onChange={setStockoutPage}
              />
            ) : null}
          </div>
        </div>

        <div>
          <h2 className="text-[15px] font-bold text-slate-900">Chỉ số bổ sung</h2>
          <p className="mb-3 mt-1 text-[12.5px] text-slate-500">Các chỉ số vận hành khác trong tháng đang chọn.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {extraMetrics.map((m, i) => {
              const meta = EXTRA_ICONS[m.key] ?? { icon: ChartBar, bg: 'bg-slate-50', fg: 'text-slate-500' };
              const Icon = meta.icon;
              return (
                <div
                  key={m.key}
                  className="animate-in fade-in slide-in-from-bottom-4 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md"
                  style={{ animationDelay: `${300 + i * 40}ms` }}
                >
                  <div className={`mb-2.5 flex h-7 w-7 items-center justify-center rounded-lg ${meta.bg} ${meta.fg}`}>
                    <Icon size={14} weight="duotone" />
                  </div>
                  <div className="mb-1 text-[12px] font-semibold text-slate-700">{m.label}</div>
                  <div className="text-[16px] font-bold text-slate-900">{m.value}</div>
                  <div className="mt-0.5 text-[11px] text-slate-400">{m.caption}</div>
                </div>
              );
            })}
          </div>
        </div>

        {topRevenueProducts.length > 0 ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-1 flex items-center gap-1.5 text-[13.5px] font-bold text-slate-900">
              <ChartBar size={16} weight="duotone" className="text-indigo-500" />
              Top 10 sản phẩm có doanh thu cao nhất
            </div>
            {categoryId ? (
              <p className="mb-2.5 text-[11px] text-amber-600">
                * Biểu đồ này chỉ áp dụng bộ lọc Tháng/Kho — OMS chưa hỗ trợ lọc theo Danh mục cho báo cáo doanh thu sản phẩm.
              </p>
            ) : (
              <div className="mb-3.5" />
            )}
            <div style={{ width: '100%', height: 340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topRevenueProducts} margin={{ top: 4, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    tickFormatter={(name) => truncateName(name, 9)}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                  />
                  <YAxis
                    tickFormatter={formatVndShort}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                  />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} content={<RevenueTooltip />} />
                  <Bar dataKey="revenue" radius={[4, 4, 0, 0]} barSize={28}>
                    {topRevenueProducts.map((p, i) => (
                      <Cell key={p.sku || i} fill={REVENUE_BAR_COLORS[i % REVENUE_BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}
      </div>
    </AnalyticsShell>
  );
}
