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
  CheckCircle,
  CalendarBlank,
} from '@phosphor-icons/react';
import AnalyticsShell from '@/components/analytics/AnalyticsShell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/custom-ui/select';
import { fetchProductOperations, fetchOmsCategories, fetchOmsLocations } from '@/features/cskh-quality/api';

const ALL_VALUE = '__all__';
const selectTriggerClass =
  'h-8.5 w-full rounded-lg border-slate-200 bg-slate-50/60 px-2.5 py-0 text-[12.5px] font-normal text-slate-700 shadow-none hover:bg-white';

const EXTRA_ICONS = {
  revenue: { icon: ChartBar, bg: 'bg-emerald-50', fg: 'text-emerald-600', accent: 'bg-emerald-400' },
  categoryShare: { icon: ChartPieSlice, bg: 'bg-violet-50', fg: 'text-violet-600', accent: 'bg-violet-400' },
  noOrders: { icon: Package, bg: 'bg-amber-50', fg: 'text-amber-600', accent: 'bg-amber-400' },
  avgProcessTime: { icon: Timer, bg: 'bg-sky-50', fg: 'text-sky-600', accent: 'bg-sky-400' },
  cancelReturnRate: { icon: ArrowsCounterClockwise, bg: 'bg-rose-50', fg: 'text-rose-600', accent: 'bg-rose-400' },
};

const RANK_STYLES = [
  'bg-linear-to-br from-amber-300 to-amber-500 text-white shadow-sm',
  'bg-linear-to-br from-slate-300 to-slate-400 text-white shadow-sm',
  'bg-linear-to-br from-orange-300 to-orange-500 text-white shadow-sm',
];

const CATEGORY_TAG_CLASSES = ['tag-blue', 'tag-green', 'tag-gold', 'tag-gray'];

const KPI_THEME = {
  indigo: { chip: 'bg-indigo-100 text-indigo-600', bar: 'bg-indigo-500' },
  amber: { chip: 'bg-amber-100 text-amber-600', bar: 'bg-amber-500' },
  violet: { chip: 'bg-violet-100 text-violet-600', bar: 'bg-violet-500' },
  rose: { chip: 'bg-rose-100 text-rose-600', bar: 'bg-rose-500' },
};

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function currentDayValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** ISO week string "YYYY-Www" cho tuần hiện tại — trùng định dạng native <input type="week">. */
function currentWeekValue() {
  const now = new Date();
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

const PERIOD_TABS = [
  { value: 'day', label: 'Ngày', noun: 'ngày', inputType: 'date' },
  { value: 'week', label: 'Tuần', noun: 'tuần', inputType: 'week' },
  { value: 'month', label: 'Tháng', noun: 'tháng', inputType: 'month' },
];

function categoryTagClass(name) {
  const str = name || '';
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return CATEGORY_TAG_CLASSES[h % CATEGORY_TAG_CLASSES.length];
}

function KpiTrend({ pct }) {
  if (pct == null) return null;
  const up = pct >= 0;
  const Icon = up ? TrendUp : TrendDown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
        up ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
      }`}
    >
      <Icon size={11} weight="bold" />
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

function SectionEyebrow({ icon: Icon, children }) {
  return (
    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
      {Icon ? <Icon size={13} weight="bold" /> : null}
      {children}
    </div>
  );
}

function KpiCard({ theme = 'indigo', icon: Icon, label, value, delay = 0, danger = false, children }) {
  const t = KPI_THEME[theme];
  return (
    <div
      className={`animate-in fade-in slide-in-from-bottom-4 relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
        danger ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white'
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className={`absolute inset-x-0 top-0 h-1 ${t.bar}`} />
      <div className="relative mb-2.5 flex items-center justify-between">
        <span className={`text-[12px] font-semibold ${danger ? 'text-rose-700' : 'text-slate-500'}`}>{label}</span>
        {Icon ? (
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${danger ? 'bg-rose-100 text-rose-600' : t.chip}`}
          >
            <Icon size={16} weight="duotone" />
          </span>
        ) : null}
      </div>
      <div className={`relative text-[26px] font-bold leading-none tabular-nums ${danger ? 'text-rose-700' : 'text-slate-900'}`}>
        {value}
      </div>
      <div className="relative mt-2.5">{children}</div>
    </div>
  );
}

function revenueBarColor(index, total) {
  const t = total <= 1 ? 0 : index / (total - 1);
  const lightness = 45 + t * 32;
  return `hsl(243 68% ${lightness}%)`;
}

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

function FilterField({ label, width, className = '', children }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`} style={{ width }}>
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
  const [periodType, setPeriodType] = useState('month');
  const [month, setMonth] = useState(currentMonthValue());
  const [week, setWeek] = useState(currentWeekValue());
  const [day, setDay] = useState(currentDayValue());
  const [locationId, setLocationId] = useState('');
  const [mobileTab, setMobileTab] = useState('top');
  const [stockPulse, setStockPulse] = useState(false);
  const [stockoutPage, setStockoutPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const stockPanelRef = useRef(null);

  const activePeriodTab = PERIOD_TABS.find((t) => t.value === periodType) ?? PERIOD_TABS[2];
  const periodValue = periodType === 'day' ? day : periodType === 'week' ? week : month;
  const setPeriodValue = periodType === 'day' ? setDay : periodType === 'week' ? setWeek : setMonth;
  const periodParams =
    periodType === 'day' ? { day } : periodType === 'week' ? { week } : { month };

  useEffect(() => {
    setStockoutPage(1);
  }, [periodType, month, week, day, categoryId, locationId]);

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
    queryKey: ['cskh', 'products', 'operations', periodType, month, week, day, categoryId, locationId, stockoutPage],
    queryFn: () =>
      fetchProductOperations({
        ...periodParams,
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
  const revenueSummary = data?.revenueSummary;
  const stockoutsPagination = data?.stockoutsPagination;
  const shipRate = kpis?.shipToOrderRate != null ? Math.round(kpis.shipToOrderRate) : null;
  const stuckOrdersTotal = kpis?.stuckOrdersTotal ?? 0;
  const totalTopRevenue =
    revenueSummary?.totalRevenue ?? topRevenueProducts.reduce((sum, p) => sum + (p.revenue || 0), 0);

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const full = await fetchProductOperations({
        ...periodParams,
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
        <div className="sticky top-0 z-20 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-linear-to-br from-indigo-100/70 to-violet-100/40 blur-2xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="flex flex-wrap items-center gap-2.5 text-[19px] font-bold text-slate-900">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <ChartLineUp size={18} weight="duotone" />
                </span>
                Sản phẩm — Vận hành theo {activePeriodTab.noun}
                {isFetching ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2 py-0.5 text-[10.5px] font-semibold text-indigo-600">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
                    Đang cập nhật
                  </span>
                ) : null}
              </h1>
              <p className="mt-1.5 text-[12.5px] text-slate-500">
                Tình trạng đơn hàng và tồn kho theo {activePeriodTab.noun} đang chọn, thay cho danh sách catalog trước đây.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 text-[12.5px] font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileArrowDown size={14} className={isExporting ? 'animate-spin' : ''} />
              {isExporting ? 'Đang xuất...' : 'Xuất Excel'}
            </button>
          </div>

          <div className="relative mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
            <FilterField label="Kỳ báo cáo" className="w-full sm:w-auto">
              <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/60 p-1">
                <div className="flex items-center gap-1">
                  {PERIOD_TABS.map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setPeriodType(tab.value)}
                      className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                        periodType === tab.value
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="flex h-6.5 min-w-35 flex-1 items-center gap-1.5 rounded-md bg-white px-2 text-slate-400 sm:min-w-0 sm:bg-transparent">
                  <CalendarBlank size={14} className="shrink-0" />
                  <input
                    type={activePeriodTab.inputType}
                    value={periodValue}
                    onChange={(e) => setPeriodValue(e.target.value)}
                    className="h-full w-full min-w-0 border-0 bg-transparent text-[12.5px] text-slate-700 focus:outline-none"
                  />
                </div>
              </div>
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

        <div>
          <SectionEyebrow icon={ChartLineUp}>Tổng quan {activePeriodTab.noun}</SectionEyebrow>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              theme="indigo"
              icon={ClipboardText}
              label={`SP lên đơn trong ${activePeriodTab.noun}`}
              value={kpis ? kpis.ordered : '…'}
              delay={0}
            >
              <div className="flex items-center gap-1.5">
                <KpiTrend pct={kpis?.orderedChangePct} />
                <span className="text-[11px] text-slate-400">so với {activePeriodTab.noun} trước</span>
              </div>
            </KpiCard>

            <KpiCard theme="amber" icon={Truck} label="SP đã xuất hàng" value={kpis ? kpis.shipped : '…'} delay={50}>
              <div className="flex items-center gap-1.5">
                <KpiTrend pct={kpis?.shippedChangePct} />
                <span className="text-[11px] text-slate-400">so với {activePeriodTab.noun} trước</span>
              </div>
            </KpiCard>

            <KpiCard
              theme="violet"
              icon={Percent}
              label="Tỉ lệ xuất / lên đơn"
              value={shipRate != null ? `${shipRate}%` : '…'}
              delay={100}
            >
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-linear-to-r from-violet-400 to-indigo-500 transition-[width] duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, shipRate ?? 0))}%` }}
                />
              </div>
            </KpiCard>

            <KpiCard
              theme="rose"
              icon={Warning}
              label="SP thiếu hàng khi lên đơn"
              value={kpis ? kpis.stockoutCount : '…'}
              delay={150}
              danger
            >
              <button
                type="button"
                onClick={goToStockList}
                className="text-[11.5px] font-semibold text-rose-700 hover:underline"
              >
                Xem danh sách →
              </button>
            </KpiCard>
          </div>
        </div>

        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileTab('top')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[13px] font-medium transition-colors ${
              mobileTab === 'top' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'
            }`}
          >
            <TrendUp size={14} weight="bold" />
            Top order
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('stock')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[13px] font-medium transition-colors ${
              mobileTab === 'stock' ? 'bg-rose-50 text-rose-700' : 'text-slate-500'
            }`}
          >
            <WarningCircle size={14} weight="bold" />
            Thiếu hàng ({data?.stockoutListCount ?? 0})
          </button>
        </div>

        <div>
          <SectionEyebrow icon={ChartBar}>Chi tiết đơn hàng &amp; tồn kho</SectionEyebrow>
          <div className="flex flex-col gap-3.5 lg:flex-row">
            <div
              className={`animate-in fade-in slide-in-from-bottom-4 w-full rounded-2xl border border-slate-200 bg-white shadow-sm lg:flex lg:flex-col ${
                mobileTab === 'top' ? 'flex flex-col' : 'hidden'
              }`}
              style={{ flex: '1.3 1 0%', minWidth: 0, animationDelay: '200ms' }}
            >
              <div className="card-title">
                <span className="inline-flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <TrendUp size={14} weight="bold" />
                  </span>
                  Top sản phẩm được order nhiều nhất
                </span>
                <span className="tag tag-blue">{topOrdered.length} sản phẩm</span>
              </div>
              <div className="px-3.5 pb-2 text-[12px] text-slate-500">
                Xếp theo số lượt lên đơn trong {activePeriodTab.noun} đang chọn.
              </div>
              <div className="[&_td]:py-2.5 [&_th]:py-2.5 [&_tbody_tr:nth-child(even)]:bg-slate-50/60" style={{ overflowX: 'auto' }}>
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
                        <td colSpan={4} className="py-10 text-center">
                          <div className="flex flex-col items-center gap-1.5 text-slate-400">
                            <Package size={22} className="text-slate-300" />
                            <span className="text-[12.5px]">Không có dữ liệu</span>
                          </div>
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
                            <span className={`tag ${categoryTagClass(p.category)}`}>{p.category || 'Khác'}</span>
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
              <div className="card-title" style={{ color: '#be123c' }}>
                <span className="inline-flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                    <WarningCircle size={14} weight="fill" />
                  </span>
                  Sản phẩm thiếu hàng
                </span>
                <span className="tag tag-red">{kpis ? kpis.stockoutCount : 0} SP</span>
              </div>
              <div className="flex flex-wrap gap-2 px-3.5 pb-3">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1 text-[11.5px] font-medium text-rose-700">
                  <Package size={12} weight="bold" />
                  {kpis ? kpis.stockoutCount : 0} sản phẩm đang thiếu hàng
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-[11.5px] font-medium text-amber-700">
                  <Warning size={12} weight="bold" />
                  {stuckOrdersTotal} đơn đang bị kẹt
                </span>
              </div>
              <div className="[&_td]:py-2.5 [&_th]:py-2.5 [&_tbody_tr:nth-child(even)]:bg-slate-50/60" style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ minWidth: 0 }}>
                  <thead>
                    <tr>
                      <th>SP / SKU</th>
                      <th>Thiếu</th>
                      <th>Tồn kho</th>
                      <th>Đơn kẹt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockouts.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center">
                          <div className="flex flex-col items-center gap-1.5 text-emerald-500">
                            <CheckCircle size={22} weight="duotone" />
                            <span className="text-[12.5px] text-slate-400">Không có sản phẩm thiếu hàng</span>
                          </div>
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
        </div>

        <div>
          <SectionEyebrow icon={Timer}>Chỉ số bổ sung</SectionEyebrow>
          <p className="mb-3 -mt-1 text-[12.5px] text-slate-500">Các chỉ số vận hành khác trong {activePeriodTab.noun} đang chọn.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {extraMetrics.map((m, i) => {
              const meta = EXTRA_ICONS[m.key] ?? { icon: ChartBar, bg: 'bg-slate-50', fg: 'text-slate-500', accent: 'bg-slate-300' };
              const Icon = meta.icon;
              return (
                <div
                  key={m.key}
                  className="animate-in fade-in slide-in-from-bottom-4 relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-3.5 pl-4 shadow-sm transition-shadow hover:shadow-md"
                  style={{ animationDelay: `${300 + i * 40}ms` }}
                >
                  <span className={`absolute inset-y-0 left-0 w-1 ${meta.accent}`} />
                  <div className={`mb-2.5 flex h-7 w-7 items-center justify-center rounded-lg ${meta.bg} ${meta.fg}`}>
                    <Icon size={14} weight="duotone" />
                  </div>
                  <div className="mb-1 text-[12px] font-semibold text-slate-700">{m.label}</div>
                  <div className="text-[16px] font-bold tabular-nums text-slate-900">{m.value}</div>
                  <div className="mt-0.5 text-[11px] text-slate-400">{m.caption}</div>
                </div>
              );
            })}
          </div>
        </div>

        {topRevenueProducts.length > 0 ? (
          <div>
            <SectionEyebrow icon={ChartBar}>Thống kê doanh thu sản phẩm</SectionEyebrow>
            <p className="mb-3 -mt-1 text-[12.5px] text-slate-500">
              Sản phẩm mang lại doanh thu cao nhất trong {activePeriodTab.noun} đang chọn, theo cùng bộ lọc Kỳ/Kho ở trên.
            </p>
            <div className="animate-in fade-in slide-in-from-bottom-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="card-title">
                <span className="inline-flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <ChartBar size={15} weight="duotone" />
                  </span>
                  Top sản phẩm doanh thu cao nhất
                </span>
                <span className="tag tag-blue">Top {topRevenueProducts.length} SP</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 px-3.5 pb-3 pt-3">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-[11.5px] font-medium text-indigo-700">
                  <ChartBar size={12} weight="bold" />
                  Tổng doanh thu: {Math.round(totalTopRevenue).toLocaleString('vi-VN')}đ
                </span>
                {revenueSummary ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-[11.5px] font-medium text-slate-600">
                    <Package size={12} weight="bold" />
                    {revenueSummary.totalProducts.toLocaleString('vi-VN')} sản phẩm có doanh thu
                  </span>
                ) : null}
              </div>
              {categoryId ? (
                <p className="px-3.5 pb-2.5 text-[11px] text-amber-600">
                  * Chỉ áp dụng bộ lọc Kỳ/Kho — OMS chưa hỗ trợ lọc theo Danh mục cho báo cáo doanh thu sản phẩm.
                </p>
              ) : null}
              <div className="px-3.5 pb-3.5" style={{ width: '100%', height: 340 }}>
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
                        <Cell key={p.sku || i} fill={revenueBarColor(i, topRevenueProducts.length)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AnalyticsShell>
  );
}
