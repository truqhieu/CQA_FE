import { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ChartBar,
  CheckCircle,
  CaretRight,
  Diamond,
  Lightbulb,
  MagnifyingGlass,
  Warning,
  TrendUp,
  Sparkle,
  Star,
  Smiley,
  SmileyMeh,
  SmileySad,
  ArrowCounterClockwise,
  SealCheck,
  XCircle,
} from '@phosphor-icons/react';
import AnalyticsShell from '@/components/analytics/AnalyticsShell';
import KpiGrid from '@/components/analytics/KpiGrid';
import { fetchCskhInsights } from '@/features/cskh-quality/api';

const kpiIconMap = [Lightbulb, Warning, TrendUp, MagnifyingGlass];
const kpiColors = ['var(--primary-500)', '#ef4444', '#22c55e', '#f59e0b'];
/** Debounce đổi ngày để không spam /cskh/insights khi kéo date picker. */
const RANGE_DEBOUNCE_MS = 700;
/** Cache FE dài hơn — khớp cache BE ~180s, giảm gọi lại khi đổi kênh rồi quay lại. */
const INSIGHT_STALE_MS = 180_000;

const QUALITY_HINT = (
  <>
    Chưa có dữ liệu audit — vào mục{' '}
    <Link to="/quality" style={{ color: '#4f46e5', fontWeight: 700, textDecoration: 'underline' }}>
      Chất lượng CSKH
    </Link>{' '}
    để chạy audit AI cho kênh này.
  </>
);

const STATUS_STYLE = {
  good: { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d' },
  warning: { bg: '#fffbeb', border: '#fde68a', color: '#b45309' },
  critical: { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c' },
  pending: { bg: '#f8fafc', border: '#e2e8f0', color: '#64748b' },
};

function formatYmd(d) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d);
}

function defaultRange() {
  const to = new Date();
  const from = new Date();
  // 14 ngày mặc định — đủ insight, nhẹ hơn 30 ngày rõ rệt.
  from.setDate(from.getDate() - 13);
  return { from: formatYmd(from), to: formatYmd(to) };
}

function StatusTag({ status, label }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.warning;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 99,
        padding: '2px 8px',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function ScoreBar({ score, audited = true }) {
  if (!audited || score == null) {
    return (
      <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', fontStyle: 'italic' }}>
        Chưa audit
      </span>
    );
  }
  const color = score >= 70 ? '#22c55e' : score >= 55 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
      <div style={{ flex: 1, height: 6, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, score)}%`, height: '100%', background: color, borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 800, color, minWidth: 28 }}>{score}</span>
    </div>
  );
}

function ConcernDonut({ data, total }) {
  const r = 55;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const pctSum = data.reduce((s, d) => s + d.pct, 0) || 1;

  return (
    <div className="concern-donut">
      <div className="concern-chart" style={{ width: 140, height: 140 }}>
        <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="70" cy="70" r={r} fill="none" stroke="#f3f4f6" strokeWidth="18" />
          {data.map((d, i) => {
            const dash = (d.pct / pctSum) * c;
            const o = offset;
            offset += dash;
            return (
              <circle
                key={i}
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth="18"
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-o}
              />
            );
          })}
        </svg>
        <div className="concern-center">
          <div className="num">{total.toLocaleString('vi-VN')}</div>
          <div className="lbl">Tổng đề cập</div>
        </div>
      </div>
      <div className="concern-legend">
        {data.map((d, i) => (
          <div key={i} className="concern-legend-item">
            <div className="concern-legend-dot" style={{ background: d.color }} />
            <span style={{ flex: 1, fontSize: '12px', color: '#374151' }}>{d.label}</span>
            <span className="concern-legend-pct">{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChannelCard({ page, onSelect }) {
  const s = STATUS_STYLE[page.status] || STATUS_STYLE.warning;
  return (
    <button
      type="button"
      onClick={() => onSelect(page.pageId)}
      style={{
        width: '100%',
        textAlign: 'left',
        border: `1px solid ${s.border}`,
        background: s.bg,
        borderRadius: 10,
        padding: '10px 12px',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', lineHeight: 1.3 }}>{page.pageName}</div>
        <StatusTag status={page.status} label={page.statusLabel} />
      </div>
      <ScoreBar score={page.avgScore} audited={page.audited !== false} />
      <div style={{ marginTop: 6, fontSize: 11, color: '#6b7280' }}>
        {page.auditCount.toLocaleString('vi-VN')} HT
        {page.audited !== false ? (
          <> · Rủi ro {page.riskRate}% · QA {page.passRate}%</>
        ) : (
          <> · Chưa có điểm QA</>
        )}
      </div>
      {page.topIssue && (
        <div style={{ marginTop: 6, fontSize: 11, color: s.color, fontWeight: 600 }}>{page.topIssue}</div>
      )}
    </button>
  );
}

const inputStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '6px 10px',
  fontSize: 12,
  background: '#fff',
  minWidth: 0,
};

const btnOutline = {
  border: '1px solid #c7d2fe',
  background: '#eef2ff',
  color: '#4338ca',
  borderRadius: 8,
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const btnPrimary = {
  border: 'none',
  background: '#4f46e5',
  color: '#fff',
  borderRadius: 8,
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

function ContentLoading({ label }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm" style={{ padding: '32px 16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <ArrowCounterClockwise size={28} weight="bold" className="animate-spin" style={{ color: '#4f46e5' }} />
        <p style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{label}</p>
        <p style={{ fontSize: 11, color: '#9ca3af' }}>Có thể mất vài giây tùy khoảng ngày</p>
      </div>
    </div>
  );
}

function dataMatchesSelection(data, selectedPageId, range) {
  if (!data) return false;
  const sid = selectedPageId || '';
  const dataSid = data.selectedPageId || '';
  if (sid !== dataSid) return false;
  // placeholderData giữ data kỳ cũ — phải khớp khoảng ngày đang applied.
  if (range?.from && data.period?.from && data.period.from !== range.from) return false;
  if (range?.to && data.period?.to && data.period.to !== range.to) return false;
  return true;
}

export default function AIInsightPage() {
  const initialRange = useMemo(() => defaultRange(), []);
  const [draftRange, setDraftRange] = useState(initialRange);
  const [appliedRange, setAppliedRange] = useState(initialRange);
  const [selectedPageId, setSelectedPageId] = useState('');
  const [pageDirectory, setPageDirectory] = useState([]);
  const rangeDebounceRef = useRef(null);

  // Chỉ commit khoảng ngày sau khi user dừng chỉnh — tránh nhiều request chồng nhau.
  useEffect(() => {
    if (draftRange.from === appliedRange.from && draftRange.to === appliedRange.to) return;
    if (rangeDebounceRef.current) clearTimeout(rangeDebounceRef.current);
    rangeDebounceRef.current = setTimeout(() => {
      if (draftRange.from && draftRange.to && draftRange.from <= draftRange.to) {
        setAppliedRange(draftRange);
      }
    }, RANGE_DEBOUNCE_MS);
    return () => {
      if (rangeDebounceRef.current) clearTimeout(rangeDebounceRef.current);
    };
  }, [draftRange, appliedRange.from, appliedRange.to]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['cskh', 'insights', appliedRange.from, appliedRange.to, selectedPageId || 'all'],
    queryFn: () =>
      fetchCskhInsights({
        auditDateFrom: appliedRange.from,
        auditDateTo: appliedRange.to,
        pageId: selectedPageId || undefined,
      }),
    staleTime: INSIGHT_STALE_MS,
    gcTime: INSIGHT_STALE_MS * 2,
    placeholderData: (previousData) => previousData,
    retry: (failureCount, err) => {
      const status = err?.response?.status;
      // Ít retry hơn khi 503 — tránh đua connection pool với inbox sync.
      if (status === 503 && failureCount < 2) return true;
      return failureCount < 1;
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
  });

  useEffect(() => {
    const list = data?.pageDirectory ?? data?.byPage?.all;
    if (list?.length) setPageDirectory(list);
  }, [data?.pageDirectory, data?.byPage?.all]);

  const dataReady = dataMatchesSelection(data, selectedPageId, appliedRange);
  const isChannelDetail = Boolean(selectedPageId);
  const pageOptions = pageDirectory.length > 0 ? pageDirectory : (data?.pageDirectory ?? data?.byPage?.all ?? []);
  // Đổi ngày / đang fetch → loading full UI bên dưới (không giữ list cũ).
  const showContentLoading = !dataReady && (isLoading || isFetching) && !isError;
  const isRefreshing = isFetching && !isLoading;
  const rangePending =
    draftRange.from !== appliedRange.from || draftRange.to !== appliedRange.to;

  const applyRangeNow = () => {
    if (rangeDebounceRef.current) clearTimeout(rangeDebounceRef.current);
    if (!draftRange.from || !draftRange.to || draftRange.from > draftRange.to) return;
    if (draftRange.from === appliedRange.from && draftRange.to === appliedRange.to) {
      void refetch();
      return;
    }
    setAppliedRange(draftRange);
  };

  const byPage = dataReady && !isChannelDetail ? data?.byPage : null;

  const selectedPageName = useMemo(() => {
    if (!selectedPageId) return null;
    if (dataReady && data?.selectedPageName) return data.selectedPageName;
    return pageOptions.find((p) => p.pageId === selectedPageId)?.pageName ?? null;
  }, [selectedPageId, dataReady, data?.selectedPageName, pageOptions]);

  const kpiItems = useMemo(() => {
    if (!dataReady || !data?.kpis) return [];
    return data.kpis.map((kpi, i) => ({
      ...kpi,
      icon: kpiIconMap[i],
      color: kpiColors[i],
      change: `${kpi.change} ${kpi.sub}`,
      changePositive: kpi.changePositive,
    }));
  }, [data, dataReady]);

  const highCloseFactors = useMemo(
    () => (dataReady ? (data?.closeRateFactors?.highClose ?? []) : []),
    [data, dataReady],
  );

  const lostOrderFactors = useMemo(
    () => (dataReady ? (data?.closeRateFactors?.lostOrders ?? []) : []),
    [data, dataReady],
  );

  const topProducts = useMemo(
    () => (dataReady ? (data?.products ?? []).slice(0, 3) : []),
    [data, dataReady],
  );

  const loadingLabel = isChannelDetail && selectedPageName
    ? `Đang tải insight kênh «${selectedPageName}»...`
    : 'Đang tải danh sách kênh...';

  const clearChannel = () => setSelectedPageId('');

  return (
    <AnalyticsShell demo={false}>
      <div className="page-scroll">
        {/* Toolbar */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm" style={{ padding: '12px 16px' }}>
          {isChannelDetail && (
            <div style={{ marginBottom: 10 }}>
              <button type="button" onClick={clearChannel} style={btnOutline}>
                <ArrowLeft size={14} weight="bold" />
                Chọn kênh khác
              </button>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12, justifyContent: 'space-between' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Sparkle size={14} weight="duotone" style={{ color: '#4f46e5' }} />
                <span style={{ fontSize: 12, color: '#6b7280' }}>
                  {showContentLoading
                    ? loadingLabel
                    : isChannelDetail
                      ? (data?.intro ?? '')
                      : 'Chọn một kênh bên dưới để xem insight chi tiết (KPI, chủ đề quan tâm, yếu tố chốt...)'}
                </span>
              </div>
              {dataReady && data && isChannelDetail && (
                <div style={{ fontSize: 11, color: '#9ca3af' }}>
                  {data.audited && data.avgScore != null
                    ? `Điểm TB ${data.avgScore}/100 · ${data.auditCount ?? 0} audit · ${data.totalAnalyzed.toLocaleString('vi-VN')} hội thoại inbox`
                    : `Chưa audit · ${data.totalAnalyzed.toLocaleString('vi-VN')} hội thoại inbox`}
                </div>
              )}
              {dataReady && !isChannelDetail && byPage?.summary && (
                <div style={{ fontSize: 11, color: '#9ca3af' }}>
                  {byPage.summary.total} kênh · {byPage.summary.good} ổn · {byPage.summary.warning} cần cải thiện ·{' '}
                  {byPage.summary.critical} cần xử lý
                </div>
              )}
              {showContentLoading && !isChannelDetail && (
                <div style={{ fontSize: 11, color: '#6366f1' }}>Đang tải dữ liệu theo khoảng ngày…</div>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 8, fontSize: 12 }}>
              <label>
                Kênh{' '}
                <select
                  value={selectedPageId}
                  onChange={(e) => setSelectedPageId(e.target.value)}
                  disabled={showContentLoading && pageOptions.length === 0}
                  style={{ ...inputStyle, maxWidth: 220, marginLeft: 4, opacity: showContentLoading && pageOptions.length === 0 ? 0.7 : 1 }}
                >
                  <option value="">— Chọn kênh —</option>
                  {pageOptions.map((p) => (
                    <option key={p.pageId} value={p.pageId}>
                      {p.pageName}
                      {p.audited === false ? ' (Chưa audit)' : ` (${p.avgScore}đ)`}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Từ{' '}
                <input
                  type="date"
                  value={draftRange.from}
                  onChange={(e) => setDraftRange((r) => ({ ...r, from: e.target.value }))}
                  style={inputStyle}
                />
              </label>
              <label>
                Đến{' '}
                <input
                  type="date"
                  value={draftRange.to}
                  onChange={(e) => setDraftRange((r) => ({ ...r, to: e.target.value }))}
                  style={inputStyle}
                />
              </label>
              <button type="button" onClick={applyRangeNow} disabled={isFetching} style={btnOutline}>
                <ArrowCounterClockwise size={14} className={isFetching ? 'animate-spin' : ''} />
                {isRefreshing ? 'Đang tải...' : rangePending ? 'Áp dụng' : 'Làm mới'}
              </button>
            </div>
          </div>
        </div>

        {/* Banner chi tiết kênh */}
        {isChannelDetail && selectedPageName && (
          <div
            style={{
              borderRadius: 12,
              border: '1px solid #c7d2fe',
              background: 'linear-gradient(90deg,#eef2ff,#f5f3ff)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 12, color: '#4338ca' }}>
              Đang xem: <strong>{selectedPageName}</strong>
              {showContentLoading && (
                <span style={{ marginLeft: 8, color: '#6366f1', fontWeight: 600 }}>· Đang tải...</span>
              )}
            </span>
            <button type="button" onClick={clearChannel} style={btnPrimary} disabled={showContentLoading}>
              <ArrowLeft size={14} weight="bold" />
              Quay lại danh sách kênh
            </button>
          </div>
        )}

        {showContentLoading && !isError && <ContentLoading label={loadingLabel} />}

        {isError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 space-y-2">
            <p>
              Không tải được insight:{' '}
              {error?.response?.data?.message ||
                error?.message ||
                'Lỗi không xác định'}
            </p>
            {error?.response?.status === 503 && (
              <p className="text-xs text-red-600/90">
                Hệ thống đang đồng bộ inbox — trang sẽ tự thử lại, hoặc bấm «Tải lại» sau vài giây.
              </p>
            )}
            <button type="button" onClick={() => refetch()} style={btnOutline}>
              Tải lại
            </button>
          </div>
        )}

        {dataReady && data && (
          <>
            {!isChannelDetail && byPage && (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col">
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ChartBar size={16} weight="duotone" style={{ color: '#4f46e5' }} />
                  <span>Sức khỏe từng kênh — bấm để xem chi tiết</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, padding: '0 14px 14px' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#b91c1c', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <XCircle size={14} weight="fill" />
                      Cần cải thiện ({byPage.needsAttention.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {byPage.needsAttention.map((p) => (
                        <ChannelCard key={p.pageId} page={p} onSelect={setSelectedPageId} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#15803d', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <SealCheck size={14} weight="fill" />
                      Kênh đang ổn ({byPage.topPerformers.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {byPage.topPerformers.map((p) => (
                        <ChannelCard key={p.pageId} page={p} onSelect={setSelectedPageId} />
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ padding: '0 14px 14px' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#374151', marginBottom: 8 }}>Bảng tất cả kênh</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Kênh</th>
                          <th>Trạng thái</th>
                          <th>Điểm</th>
                          <th>QA đạt</th>
                          <th>Rủi ro</th>
                          <th>HT</th>
                          <th>Vấn đề chính</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {byPage.all.map((p) => (
                          <tr key={p.pageId} style={{ cursor: 'pointer' }} onClick={() => setSelectedPageId(p.pageId)}>
                            <td style={{ fontWeight: 600, maxWidth: 180 }}>{p.pageName}</td>
                            <td><StatusTag status={p.status} label={p.statusLabel} /></td>
                            <td><ScoreBar score={p.avgScore} audited={p.audited !== false} /></td>
                            <td>{p.audited === false ? '—' : `${p.passRate}%`}</td>
                            <td style={{ color: p.riskRate >= 75 ? '#dc2626' : undefined, fontWeight: p.riskRate >= 75 ? 700 : 400 }}>
                              {p.audited === false ? '—' : `${p.riskRate}%`}
                            </td>
                            <td>{p.auditCount.toLocaleString('vi-VN')}</td>
                            <td style={{ fontSize: 11, color: '#6b7280', maxWidth: 220 }}>{p.topIssue || '—'}</td>
                            <td><CaretRight size={14} style={{ color: '#9ca3af' }} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {dataReady && data && isChannelDetail && (
              <>
            <KpiGrid items={kpiItems} columns={4} />

            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col" style={{ flex: 1, minWidth: 280 }}>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>Khách quan tâm gì ở kênh này?</span>
                  <MagnifyingGlass size={13} weight="bold" style={{ color: '#4f46e5' }} />
                </div>
                {(data.customerConcerns?.items?.length ?? 0) > 0 ? (
                  <div style={{ padding: '0 14px 14px' }}>
                    <ConcernDonut data={data.customerConcerns.items} total={data.customerConcerns.total} />
                  </div>
                ) : (
                  <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Chưa có từ khóa</div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col" style={{ flex: 1.2, minWidth: 320 }}>
                <div className="card-title">Yếu tố chốt & mất đơn</div>
                <div className="factors-grid" style={{ padding: '0 14px 14px' }}>
                  {!data.audited ? (
                    <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#9ca3af', padding: '10px 0', lineHeight: 1.5 }}>
                      {QUALITY_HINT}
                    </div>
                  ) : (
                    <>
                  <div className="factor-col">
                    <h4 style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle size={14} weight="fill" />
                      Giúp chốt cao
                    </h4>
                    {highCloseFactors.length > 0 ? (
                      highCloseFactors.map((f, i) => (
                        <div key={i} className="factor-item">
                          <span className="name">{f.label}</span>
                          <span className="pct" style={{ color: '#16a34a' }}>{f.pct}%</span>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: 12, color: '#9ca3af', padding: '10px 0', lineHeight: 1.5 }}>
                        Audit chưa ghi nhận ưu điểm nổi bật
                      </div>
                    )}
                  </div>
                  <div className="factor-col">
                    <h4 style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Warning size={14} weight="fill" />
                      Lý do mất đơn
                    </h4>
                    {lostOrderFactors.length > 0 ? (
                      lostOrderFactors.map((f, i) => (
                        <div key={i} className="factor-item">
                          <span className="name">{f.label}</span>
                          <span className="pct" style={{ color: '#dc2626' }}>{f.pct}%</span>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: 12, color: '#9ca3af', padding: '10px 0', lineHeight: 1.5 }}>
                        Audit chưa ghi nhận điểm yếu nổi bật
                      </div>
                    )}
                  </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col">
              <div className="card-title">
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Diamond size={14} weight="duotone" style={{ color: '#f59e0b' }} />
                  Top 3 sản phẩm khách hàng quan tâm nhiều nhất
                </span>
              </div>
              {topProducts.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10, padding: '0 14px 14px' }}>
                  {topProducts.map((item, i) => (
                    <div
                      key={`${item.name}-${i}`}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        padding: 12,
                        background: i === 0 ? '#fffbeb' : '#fff',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: '#b45309', marginBottom: 4 }}>
                            #{i + 1}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', lineHeight: 1.35 }}>
                            {item.name}
                          </div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#4f46e5', whiteSpace: 'nowrap' }}>
                          {(item.visits ?? 0).toLocaleString('vi-VN')} lần
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>
                        Từ hội thoại inbox trong khoảng ngày đã chọn
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13, lineHeight: 1.5 }}>
                  Chưa nhận diện được sản phẩm trong hội thoại inbox kỳ này.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col" style={{ flex: 1, minWidth: 280 }}>
                <div className="card-title">Chủ đề được quan tâm</div>
                <table className="data-table">
                  <thead>
                    <tr><th>Chủ đề</th><th>Lượt nhắc</th></tr>
                  </thead>
                  <tbody>
                    {(data.products ?? []).length > 0 ? (
                    (data.products ?? []).map((p, i) => (
                      <tr key={i}>
                        <td>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Diamond size={13} weight="duotone" style={{ color: '#f59e0b' }} />
                            <span>{p.name}</span>
                          </div>
                        </td>
                        <td>{p.visits.toLocaleString('vi-VN')}</td>
                      </tr>
                    ))
                    ) : (
                      <tr>
                        <td colSpan={2} style={{ fontSize: 12, color: '#9ca3af', padding: 16, textAlign: 'center' }}>
                          Chưa nhận diện được sản phẩm trong hội thoại — cần import catalog SP hoặc khách chưa nhắc tên SP cụ thể.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col" style={{ flex: 1, minWidth: 280 }}>
                <div className="card-title">Cảm xúc khách hàng (AI)</div>
                {data.audited ? (
                <div className="sentiment-row" style={{ gap: 20, padding: '8px 16px 16px' }}>
                  <div className="sentiment-item">
                    <Smiley size={24} weight="duotone" style={{ color: '#22c55e' }} />
                    <div className="sentiment-pct">{data.sentiment?.positive ?? 0}%</div>
                    <div className="sentiment-label">Tích cực</div>
                  </div>
                  <div className="sentiment-item">
                    <SmileyMeh size={24} weight="duotone" style={{ color: '#f59e0b' }} />
                    <div className="sentiment-pct">{data.sentiment?.neutral ?? 0}%</div>
                    <div className="sentiment-label">Trung tính</div>
                  </div>
                  <div className="sentiment-item">
                    <SmileySad size={24} weight="duotone" style={{ color: '#ef4444' }} />
                    <div className="sentiment-pct">{data.sentiment?.negative ?? 0}%</div>
                    <div className="sentiment-label">Tiêu cực</div>
                  </div>
                </div>
                ) : (
                  <div style={{ padding: '16px 16px 20px', fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>
                    {QUALITY_HINT}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col">
              <div className="card-title">Hiệu quả theo nguồn hội thoại</div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nguồn</th>
                    <th>Chất lượng</th>
                    <th>QA đạt</th>
                    <th>Số hội thoại</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.adEfficiency ?? []).map((a, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{a.name}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {Array.from({ length: 5 }).map((_, j) => (
                            <Star key={j} size={10} weight={j < a.stars ? 'fill' : 'regular'} style={{ color: j < a.stars ? '#fbbf24' : '#e5e7eb' }} />
                          ))}
                          <span style={{ fontSize: 11 }}>{a.quality}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{a.closeRate}</td>
                      <td>{a.conversationCount.toLocaleString('vi-VN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              </>
            )}
          </>
        )}
      </div>
    </AnalyticsShell>
  );
}
