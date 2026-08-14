import { useState, useEffect, useMemo, useRef, useDeferredValue, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  MagnifyingGlass, 
  FacebookLogo, 
  InstagramLogo, 
  TiktokLogo, 
  ChatCircleText, 
  ShoppingCart, 
  Storefront, 
  Globe,
  Warning,
  TrendUp,
  Plus,
  CalendarBlank,
  DownloadSimple,
  Pause,
  X,
} from '@phosphor-icons/react';
import {
  fetchCskhPages,
  startCskhBackfill,
  pauseCskhBackfill,
  cancelCskhBackfill,
  fetchCskhBackfillStatus,
  CSKH_PAGES_LITE_QUERY_KEY,
} from '@/features/cskh-quality/api';
import { CskhPageAvatar } from '@/features/cskh-quality/cskhUi';

function buildPagesPlaceholderFromLite(lite, selectedDate) {
  if (!lite?.pages?.length) return undefined;
  return {
    ...lite,
    pages: lite.pages.map((p) => ({
      ...p,
      conversationCount: p.conversationCount ?? 0,
      messageCount: p.messageCount ?? 0,
      unreadConversationCount: p.unreadConversationCount ?? 0,
      inboundMessageCount: undefined,
      adSpend: null,
      adCostPerConversation: null,
    })),
    inboundDay: { date: selectedDate, totalInbound: null, totalAdSpend: null, adSpendSyncPending: false },
    statsMeta: { inboundDayStats: true, requestedDate: selectedDate, buildTag: 'inbound-day-v1' },
  };
}

function getVNDateValue(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(date);
}

function formatDateLabel(dateValue) {
  const [year, month, day] = dateValue.split('-');
  return `${day}/${month}/${year}`;
}

/** Thanh tiến trình indeterminate — API đếm DB, không có % từ server. */
function DayStatsProgress({ active, dateLabel }) {
  if (!active) return null;
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 shadow-sm animate-in fade-in duration-200">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-indigo-900">
          Đang thống kê tin nhắn mới đến — <span className="text-indigo-600">{dateLabel}</span>
        </p>
        <Globe size={15} className="animate-spin text-indigo-600 shrink-0" />
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-indigo-100">
        <div
          className="absolute top-0 bottom-0 w-2/5 rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600"
          style={{ animation: 'dayStatsBar 1.15s ease-in-out infinite' }}
        />
      </div>
      <p className="mt-2 text-[10px] font-medium text-indigo-700/70">
        Đọc từ inbox đã đồng bộ — thường hoàn tất trong vài giây, không cần quét Facebook.
      </p>
      <style>{`
        @keyframes dayStatsBar {
          0% { left: -40%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}

function formatAdMoney(amount, currency) {
  if (amount == null || !Number.isFinite(amount)) return '—';
  const cur = (currency || 'VND').toUpperCase();
  const rounded = cur === 'VND' ? Math.round(amount) : amount;
  try {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: cur === 'VND' ? 0 : 2,
    }).format(rounded);
  } catch {
    return `${rounded.toLocaleString('vi-VN')} ${cur}`;
  }
}

function pageMessageCount(p) {
  return p.messageCount ?? p.conversationCount ?? 0;
}

function DonutChart({ data, total, size = 150 }) {
  const r = (size / 2) - 14;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative flex items-center justify-center select-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f8fafc" strokeWidth="14" />
        {data.map((d, i) => {
          const dash = (d.pct / 100) * c;
          const o = offset; 
          offset += dash;
          return (
            <circle 
              key={i} 
              cx={size/2} 
              cy={size/2} 
              r={r} 
              fill="none" 
              stroke={d.color} 
              strokeWidth="14" 
              strokeDasharray={`${dash} ${c - dash}`} 
              strokeDashoffset={-o} 
              className="transition-all duration-500 ease-out hover:stroke-[16px] cursor-pointer"
            />
          );
        })}
      </svg>
      <div className="absolute text-center select-none pointer-events-none">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Tổng tin nhắn</div>
        <div className="text-3xl font-black text-slate-800 tracking-tight">{total.toLocaleString()}</div>
      </div>
    </div>
  );
}

const PAGE_TYPE_ICONS = {
  Instagram: (props) => <InstagramLogo {...props} weight="fill" className="text-pink-600" />,
  TikTok: (props) => <TiktokLogo {...props} weight="fill" className="text-slate-800" />,
  Zalo: (props) => <ChatCircleText {...props} weight="fill" className="text-blue-500" />,
  Shopee: (props) => <ShoppingCart {...props} weight="fill" className="text-orange-500" />,
  Lazada: (props) => <Storefront {...props} weight="fill" className="text-indigo-600" />,
  Website: (props) => <Globe {...props} weight="fill" className="text-emerald-500" />,
  'Facebook Page': (props) => <FacebookLogo {...props} weight="fill" className="text-blue-600" />,
};

function getPageType(name = '') {
  const n = name.toLowerCase();
  if (n.includes('instagram') || n.includes('ig ')) return 'Instagram';
  if (n.includes('tiktok')) return 'TikTok';
  if (n.includes('zalo')) return 'Zalo';
  if (n.includes('shopee')) return 'Shopee';
  if (n.includes('lazada')) return 'Lazada';
  if (n.includes('web') || n.includes('live chat') || n.includes('chat widget')) return 'Website';
  return 'Facebook Page';
}

function PageTypeIcon({ type, size = 18 }) {
  const Icon = PAGE_TYPE_ICONS[type] || PAGE_TYPE_ICONS['Facebook Page'];
  return <Icon size={size} />;
}

const ChannelRow = memo(function ChannelRow({ channel, isActive, onSelect }) {
  return (
    <div
      onClick={() => onSelect(channel.id)}
      className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-colors duration-150 ${
        isActive
          ? 'bg-indigo-50/50 border-indigo-200/70 shadow-sm shadow-indigo-50'
          : 'bg-transparent border-transparent hover:bg-slate-50'
      }`}
    >
      <div className="relative w-10 h-10 flex-shrink-0">
        <CskhPageAvatar
          name={channel.name}
          pictureUrl={channel.pictureUrl}
          pageId={channel.id}
          className="!h-10 !w-10 !rounded-full !ring-slate-200/60"
        />
        <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
          channel.enabled ? 'bg-emerald-500' : 'bg-slate-300'
        }`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-bold text-slate-700 truncate group-hover:text-indigo-700 transition-colors">
            {channel.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
          <span className="font-semibold text-slate-500">{channel.type}</span>
          <span>•</span>
          <span>Tin nhắn: <strong className="text-slate-600 font-bold">{channel.msgs}</strong></span>
        </div>
      </div>
    </div>
  );
});

export default function PagesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [tab, setTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [performanceFilter, setPerformanceFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(() => getVNDateValue());

  const { data: pagesData, isLoading: isLoadingPages, isFetching: isFetchingPages, refetch, isError } = useQuery({
    queryKey: ['cskh', 'pages', selectedDate],
    queryFn: () => fetchCskhPages({ date: selectedDate }),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    placeholderData: (prev) =>
      prev ?? buildPagesPlaceholderFromLite(queryClient.getQueryData(CSKH_PAGES_LITE_QUERY_KEY), selectedDate),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const adSpendSyncPending = pagesData?.inboundDay?.adSpendSyncPending === true;

  useEffect(() => {
    if (!adSpendSyncPending) return undefined;
    const timer = setInterval(() => {
      void refetch();
    }, 20_000);
    return () => clearInterval(timer);
  }, [adSpendSyncPending, refetch]);

  const [startingBackfill, setStartingBackfill] = useState(false);
  const [pausingBackfill, setPausingBackfill] = useState(false);
  const [cancellingBackfill, setCancellingBackfill] = useState(false);
  const { data: backfillStatus, refetch: refetchBackfill } = useQuery({
    queryKey: ['cskh', 'backfill'],
    queryFn: fetchCskhBackfillStatus,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.pauseRequested) return 1000;
      if (data?.running) return 2500;
      return false;
    },
    refetchOnWindowFocus: false,
  });
  const backfillRunning = Boolean(backfillStatus?.running);
  const backfillPaused = Boolean(backfillStatus?.paused && !backfillRunning);
  const backfillPausing = Boolean(backfillStatus?.pauseRequested) || pausingBackfill;
  const backfillCancelling = cancellingBackfill;
  const backfillStopping = backfillPausing;
  const backfillScanActive = backfillRunning && !backfillPausing && !backfillCancelling;
  const prevBackfillRunning = useRef(false);
  const prevBackfillDone = useRef(0);
  const prevCompletedCount = useRef(0);

  useEffect(() => {
    if (prevBackfillRunning.current && !backfillRunning) {
      refetch();
      setPausingBackfill(false);
    }
    if (!backfillRunning && !backfillStatus?.pauseRequested) {
      setPausingBackfill(false);
    }
    prevBackfillRunning.current = backfillRunning;
  }, [backfillRunning, backfillStatus?.pauseRequested, refetch]);

  /** Mỗi khi quét xong thêm 1 kênh → tải lại bảng (tin mới, chi phí QC, CP/HT). */
  useEffect(() => {
    if (!backfillScanActive && !backfillPaused) {
      prevBackfillDone.current = backfillStatus?.done ?? 0;
      return;
    }
    const done = backfillStatus?.done ?? 0;
    if (done > prevBackfillDone.current) {
      prevBackfillDone.current = done;
      void refetch();
    }
  }, [backfillScanActive, backfillPaused, backfillStatus?.done, refetch]);

  /** Refetch khi danh sách kênh đã quét tăng (đáng tin cậy hơn done). */
  useEffect(() => {
    const count = backfillStatus?.completedPageIds?.length ?? 0;
    if ((backfillScanActive || backfillPaused) && count > prevCompletedCount.current) {
      prevCompletedCount.current = count;
      void refetch();
    }
    if (!backfillScanActive && !backfillPaused) {
      prevCompletedCount.current = count;
    }
  }, [backfillScanActive, backfillPaused, backfillStatus?.completedPageIds, refetch]);

  const handleStartBackfill = async (force = false) => {
    if (backfillRunning || startingBackfill) return;
    setStartingBackfill(true);
    try {
      await startCskhBackfill('all', { force, date: selectedDate });
      await refetchBackfill();
    } catch {
      // lỗi hiện qua trạng thái poll
    } finally {
      setStartingBackfill(false);
    }
  };

  const handlePauseBackfill = async () => {
    if (!backfillScanActive || pausingBackfill) return;
    setPausingBackfill(true);
    try {
      await pauseCskhBackfill();
      await refetchBackfill();
    } catch {
      setPausingBackfill(false);
    }
  };

  const handleCancelBackfill = async () => {
    if ((!backfillRunning && !backfillPaused) || cancellingBackfill) return;
    setCancellingBackfill(true);
    try {
      await cancelCskhBackfill();
      await refetchBackfill();
      await refetch();
    } catch {
      // poll sẽ cập nhật trạng thái
    } finally {
      setCancellingBackfill(false);
      setPausingBackfill(false);
    }
  };

  const pages = pagesData?.pages || [];
  const inboundDaySummary = pagesData?.inboundDay;
  const selectedDateLabel = formatDateLabel(selectedDate);
  const apiBase = import.meta.env.VITE_API_URL || '(chưa cấu hình VITE_API_URL)';
  const isRailwayApi = /railway\.app/i.test(apiBase);
  const deployHint = isRailwayApi
    ? `1. Commit & push code BE (cskh.controller.ts, cskh.service.ts) lên branch Railway đang theo dõi
2. Railway Dashboard → service cqa-be → Deployments → Redeploy
   (Build Docker Hub viejhaf/cqa-be KHÔNG ảnh hưởng Railway trừ khi Railway cấu hình pull image đó)
3. Sau deploy, mở ${apiBase.replace(/\/$/, '')}/docs — GET /cskh/pages phải có query ?date=`
    : `cd CQA_BE
docker build -t viejhaf/cqa-be:latest .
docker push viejhaf/cqa-be:latest
# Trên server:
docker pull viejhaf/cqa-be:latest && docker restart cqa-be`;
  const dayStatsReady =
    inboundDaySummary?.date === selectedDate ||
    pagesData?.statsMeta?.requestedDate === selectedDate ||
    pages.some((p) => typeof p.inboundMessageCount === 'number');
  const dayStatsUnavailable =
    !isLoadingPages && !isFetchingPages && !isError && pages.length > 0 && !dayStatsReady;

  useEffect(() => {
    if (!activeChannelId && pages.length > 0) {
      setActiveChannelId(pages[0].pageId);
    }
  }, [activeChannelId, pages]);

  const deferredSearchQuery = useDeferredValue(searchQuery);

  const channels = useMemo(() => pages.map((p) => ({
    id: p.pageId,
    name: p.pageName || `Trang #${p.pageId}`,
    type: getPageType(p.pageName),
    msgs: pageMessageCount(p),
    processing: p.unreadConversationCount || 0,
    enabled: p.enabled,
    pictureUrl: p.pagePictureUrl,
  })), [pages]);

  const filteredChannels = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    return channels.filter((ch) => {
      if (q && !ch.name.toLowerCase().includes(q)) return false;
      if (tab === 'all') return true;
      if (tab === 'facebook' && ch.type === 'Facebook Page') return true;
      if (tab === 'instagram' && ch.type === 'Instagram') return true;
      if (tab === 'zalo' && ch.type === 'Zalo') return true;
      if (tab === 'other' && !['Facebook Page', 'Instagram', 'Zalo'].includes(ch.type)) return true;
      return false;
    });
  }, [channels, tab, deferredSearchQuery]);

  const facebookCount = channels.filter(c => c.type === 'Facebook Page').length;
  const instagramCount = channels.filter(c => c.type === 'Instagram').length;
  const zaloCount = channels.filter(c => c.type === 'Zalo').length;
  const otherCount = channels.length - facebookCount - instagramCount - zaloCount;

  const tabs = [
    { key: 'all', label: `Tất cả ${channels.length}` },
    { key: 'facebook', label: `Facebook ${facebookCount}` },
    { key: 'instagram', label: `Instagram ${instagramCount}` },
    { key: 'zalo', label: `Zalo ${zaloCount}` },
    { key: 'other', label: `Khác ${otherCount}` },
  ];

  const performance = useMemo(() => pages.map((p) => ({
    pageId: p.pageId,
    name: p.pageName || `Trang #${p.pageId}`,
    type: getPageType(p.pageName),
    msgs: pageMessageCount(p),
    // Tin mới đến: ưu tiên inbound đã sync từ Meta Graph theo ngày; fallback hội thoại messaging từ Meta Ads
    newInbound:
      (p.inboundMessageCount ?? 0) > 0
        ? (p.inboundMessageCount ?? 0)
        : (p.adMessagingConversations ?? 0),
    adSpend: p.adSpend,
    adSpendCurrency: p.adSpendCurrency,
    adCostPerConversation: p.adCostPerConversation,
    adMessagingConversations: p.adMessagingConversations,
    adSpendUnavailableReason: p.adSpendUnavailableReason,
    pictureUrl: p.pagePictureUrl,
  })), [pages]);

  const scannedPageIds = useMemo(
    () => new Set(backfillStatus?.completedPageIds ?? []),
    [backfillStatus?.completedPageIds],
  );

  const sortedPerformance = useMemo(() => {
    const completed = backfillStatus?.completedPageIds ?? [];
    const completedRank = new Map(completed.map((id, i) => [id, i]));
    const currentName = backfillStatus?.currentPage;
    return [...performance].sort((a, b) => {
      const aDone = completedRank.has(a.pageId);
      const bDone = completedRank.has(b.pageId);
      if (aDone && !bDone) return -1;
      if (!aDone && bDone) return 1;
      if (aDone && bDone) {
        return (completedRank.get(a.pageId) ?? 0) - (completedRank.get(b.pageId) ?? 0);
      }
      const aScanning =
        backfillScanActive && currentName && (a.name === currentName || a.pageId === currentName);
      const bScanning =
        backfillScanActive && currentName && (b.name === currentName || b.pageId === currentName);
      if (aScanning && !bScanning) return -1;
      if (!aScanning && bScanning) return 1;
      return a.name.localeCompare(b.name, 'vi');
    });
  }, [performance, backfillStatus?.completedPageIds, backfillStatus?.currentPage, backfillScanActive]);

  const totalNewInbound = performance.reduce((sum, p) => sum + p.newInbound, 0);
  const totalAdSpend = inboundDaySummary?.totalAdSpend
    ?? performance.reduce((sum, p) => sum + (p.adSpend ?? 0), 0);
  const adSpendCurrency = inboundDaySummary?.adSpendCurrency
    ?? performance.find((p) => p.adSpendCurrency)?.adSpendCurrency
    ?? 'VND';
  const totalMsgs = performance.reduce((sum, p) => sum + p.msgs, 0);

  const dynamicKPIs = [
    { 
      label: 'Tổng tin nhắn', 
      value: totalMsgs.toLocaleString(), 
      sub: selectedDateLabel, 
      isReal: true,
    },
    { 
      label: 'Tin nhắn mới đến', 
      value: totalNewInbound.toLocaleString(), 
      sub: selectedDateLabel, 
      isReal: true,
    },
    { 
      label: 'Tổng chi tiêu QC', 
      value: totalAdSpend > 0 ? formatAdMoney(totalAdSpend, adSpendCurrency) : '—', 
      sub: selectedDateLabel, 
      isReal: true,
      adMetric: true,
    },
    { 
      label: 'Số kênh đang hoạt động', 
      value: pages.filter((p) => p.enabled).length.toLocaleString(), 
      sub: `Trên ${pages.length} kênh`, 
      isReal: true,
    },
  ];

  const typeMap = {};
  pages.forEach((p) => {
    const type = getPageType(p.pageName);
    const msgs = pageMessageCount(p);
    if (!typeMap[type]) typeMap[type] = 0;
    typeMap[type] += msgs;
  });

  const totalTypeMsgs = Object.values(typeMap).reduce((a, b) => a + b, 0);

  const channelColors = {
    'Facebook Page': '#3b82f6',
    'Instagram': '#ec4899',
    'TikTok': '#111827',
    'Zalo': '#0ea5e9',
    'Shopee': '#f97316',
    'Lazada': '#6366f1',
    'Website': '#10b981',
    'Khác': '#64748b',
  };

  const dynamicDistribution = Object.keys(typeMap).map(type => {
    const value = typeMap[type];
    const pct = totalTypeMsgs > 0 ? Math.round((value / totalTypeMsgs) * 100) : 0;
    return { label: type, pct, value, color: channelColors[type] || '#94a3b8' };
  }).sort((a, b) => b.value - a.value);

  const insights = useMemo(() => {
    const primaryPageName = pages[0]?.pageName || 'Facebook Page';
    const topInbound = [...performance].sort((a, b) => b.newInbound - a.newInbound)[0];
    const list = [
      `Kênh "${primaryPageName}" và ${pages.length - 1} kênh khác đang đồng bộ dữ liệu tin nhắn.`,
      `Trong ngày ${selectedDateLabel}, hệ thống ghi nhận ${totalNewInbound.toLocaleString()} tin khách gửi đến.`,
    ];
    if (totalAdSpend > 0) {
      list.push(`Tổng chi tiêu QC ${selectedDateLabel}: ${formatAdMoney(totalAdSpend, adSpendCurrency)}.`);
    }
    if (topInbound?.newInbound > 0) {
      list.push(`Kênh "${topInbound.name}" nhận nhiều tin mới nhất (${topInbound.newInbound.toLocaleString()} tin).`);
    }
    list.push('Liên kết Sapo OAuth tại Cài đặt kênh để đồng bộ doanh thu thực tế.');
    return list.slice(0, 4);
  }, [pages, performance, selectedDateLabel, totalNewInbound, totalAdSpend, adSpendCurrency]);

  const filteredPerformance = useMemo(() => sortedPerformance.filter(p => {
    if (performanceFilter === 'all') return true;
    if (performanceFilter === 'facebook' && p.type === 'Facebook Page') return true;
    if (performanceFilter === 'instagram' && p.type === 'Instagram') return true;
    if (performanceFilter === 'tiktok' && p.type === 'TikTok') return true;
    if (performanceFilter === 'zalo' && p.type === 'Zalo') return true;
    if (performanceFilter === 'shopee' && p.type === 'Shopee') return true;
    if (performanceFilter === 'lazada' && p.type === 'Lazada') return true;
    if (performanceFilter === 'website' && p.type === 'Website') return true;
    return false;
  }), [sortedPerformance, performanceFilter]);

  const platformTypes = useMemo(
    () => [...new Set(performance.map((p) => p.type))].sort(),
    [performance]
  );

  const isInitialPagesLoad = isLoadingPages && !pagesData?.pages?.length;

  if (isInitialPagesLoad) {
    return (
      <div className="flex flex-col justify-center items-center h-full text-slate-400 gap-4 py-20">
        <Globe size={44} className="animate-spin text-indigo-600" />
        <span className="text-base font-bold tracking-wide">Đang tải thông tin trang & kênh...</span>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-12 shadow-sm flex flex-col items-center justify-center gap-6 text-center h-full max-w-2xl mx-auto my-12 animate-in fade-in slide-in-from-bottom-4">
        <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
          <FacebookLogo size={36} weight="duotone" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-800">Chưa kết nối Page / Kênh</h3>
          <p className="text-sm text-slate-500 mt-2 max-w-md">
            Kết nối tài khoản Facebook Fanpage của bạn trong phần Cài đặt để đồng bộ hội thoại và theo dõi tin nhắn theo từng kênh.
          </p>
        </div>
        <button 
          onClick={() => navigate('/settings?tab=channel')}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all duration-200 cursor-pointer"
        >
          Đi tới Cài đặt kênh
        </button>
      </div>
    );
  }

  const keywordItems = [
    { type: 'Facebook Page', keywords: 'nhẫn bạc, size, giá, bảo hành, giao hàng' },
    { type: 'Instagram', keywords: 'dây chuyền, mẫu mới, giá, có sẵn không' },
    { type: 'TikTok', keywords: 'review, chất liệu, đeo có đen không, giá' },
  ];

  return (
    <div className="flex flex-col xl:flex-row gap-4 2xl:gap-5 w-full h-full overflow-y-auto xl:overflow-hidden text-slate-700">
      
      {/* Left Column - Channel List */}
      <div className="w-full xl:w-64 2xl:w-72 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col p-4 shrink-0 max-h-[700px] xl:max-h-none xl:h-full overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold text-slate-800 text-lg">Danh sách Page & Kênh</div>
          <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full font-bold">{filteredChannels.length} trang</span>
        </div>
        
        <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 mb-3 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-100 transition-all duration-200">
          <MagnifyingGlass size={18} className="text-slate-400" />
          <input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm page hoặc kênh..." 
            className="flex-1 bg-transparent text-sm text-slate-700 outline-none border-none placeholder-slate-400" 
          />
        </div>

        <div className="flex gap-1 overflow-x-auto pb-2 mb-3 no-scrollbar shrink-0">
          {tabs.map(t => (
            <button 
              key={t.key} 
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                tab === t.key 
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 no-scrollbar">
          {filteredChannels.map((ch) => (
            <ChannelRow
              key={ch.id}
              channel={ch}
              isActive={activeChannelId === ch.id}
              onSelect={setActiveChannelId}
            />
          ))}
          {filteredChannels.length === 0 && (
            <div className="text-center py-8 text-sm text-slate-400">Không tìm thấy trang hoặc kênh nào</div>
          )}
        </div>

        <button 
          onClick={() => navigate('/settings?tab=channel')}
          className="mt-3 w-full py-2.5 border border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 text-indigo-600 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus size={14} />
          Kết nối thêm page / kênh
        </button>
      </div>

      {/* Center Column */}
      <div className="flex-1 flex flex-col gap-4 2xl:gap-5 min-w-0 xl:h-full xl:min-h-0 xl:overflow-hidden">

        <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CalendarBlank size={20} className="text-indigo-600 shrink-0" weight="duotone" />
              <h3 className="font-bold text-slate-800">Thống kê tin nhắn theo ngày</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Chọn ngày rồi bấm <strong>Quét theo ngày</strong> — chỉ lấy tin nhắn Meta trong ngày đó (không quét cả lịch sử page).
              Tin mới đến / chi tiêu QC / CP hội thoại lấy từ Meta; QC cũng tự chạy lúc <strong>2:00 sáng</strong> (VN).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <label className="flex items-center gap-2 rounded-xl border-2 border-indigo-200 bg-indigo-50/40 px-3 py-2 cursor-pointer">
              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Ngày</span>
              <input
                type="date"
                value={selectedDate}
                max={getVNDateValue()}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="text-sm font-bold text-slate-800 bg-transparent border-none outline-none cursor-pointer"
              />
            </label>
            <button
              type="button"
              onClick={() => setSelectedDate(getVNDateValue())}
              className="rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 cursor-pointer"
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => handleStartBackfill(false)}
              disabled={backfillScanActive || startingBackfill || backfillCancelling}
              title={`Chỉ quét tin nhắn Meta trong ngày ${selectedDateLabel} — bỏ qua kênh đã quét nếu tạm dừng trước đó`}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50 cursor-pointer ${
                backfillPausing
                  ? 'border border-amber-300 bg-amber-50 text-amber-800'
                  : backfillCancelling
                    ? 'border border-rose-300 bg-rose-50 text-rose-800'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              <DownloadSimple size={14} className={backfillScanActive ? 'animate-bounce' : ''} />
              {backfillCancelling
                ? 'Đang hủy...'
                : backfillPausing
                ? 'Đang dừng...'
                : backfillScanActive
                  ? 'Đang quét...'
                  : backfillPaused
                    ? 'Tiếp tục quét'
                    : startingBackfill
                      ? 'Đang khởi động...'
                      : 'Quét theo ngày'}
            </button>
            {(backfillScanActive || backfillPaused || backfillPausing || backfillCancelling) && (
              <button
                type="button"
                onClick={handleCancelBackfill}
                disabled={cancellingBackfill}
                title="Hủy ngay — dừng toàn bộ quét, xóa hàng đợi"
                className="flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100 cursor-pointer disabled:opacity-60"
              >
                <X size={14} weight="bold" />
                {cancellingBackfill ? 'Đang hủy...' : 'Hủy quét'}
              </button>
            )}
            {backfillScanActive && !backfillCancelling && (
              <button
                type="button"
                onClick={handlePauseBackfill}
                title="Tạm dừng sau khi xong kênh hiện tại — tiến độ được lưu vào DB"
                className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 cursor-pointer"
              >
                <Pause size={14} weight="fill" />
                Tạm dừng
              </button>
            )}
            <div className="text-right px-3 py-1 min-w-[72px]">
              <div className="text-2xl font-black text-indigo-600 leading-none">
                {isFetchingPages && !isLoadingPages ? '…' : totalNewInbound.toLocaleString()}
              </div>
              <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">{selectedDateLabel}</div>
            </div>
          </div>
        </div>

        {(backfillRunning || backfillPaused || backfillCancelling || (backfillStatus && backfillStatus.finishedAt && backfillStatus.done > 0)) && (
          <div className={`rounded-xl border px-4 py-3 shadow-sm ${
            backfillCancelling
              ? 'border-rose-200 bg-rose-50/80'
              : backfillPausing
              ? 'border-amber-200 bg-amber-50/80'
              : backfillScanActive
              ? 'border-indigo-200 bg-indigo-50/80'
              : backfillPaused
                ? 'border-amber-200 bg-amber-50/80'
                : 'border-emerald-200 bg-emerald-50/80'
          }`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className={`text-xs font-bold ${
                backfillCancelling ? 'text-rose-900' : backfillPausing ? 'text-amber-900' : backfillScanActive ? 'text-indigo-900' : backfillPaused ? 'text-amber-900' : 'text-emerald-900'
              }`}>
                {backfillCancelling
                  ? 'Đang hủy quét — dừng ngay'
                  : backfillPausing
                  ? 'Đang dừng — chờ xong kênh hiện tại'
                  : backfillScanActive
                  ? `Đang quét tin nhắn Meta${backfillStatus?.scanDate ? ` ngày ${formatDateLabel(backfillStatus.scanDate)}` : selectedDateLabel ? ` ngày ${selectedDateLabel}` : ''}`
                  : backfillPaused
                    ? 'Đã tạm dừng — tiến độ đã lưu'
                    : 'Đã quét xong'}
                {' '}
                <span className={
                  backfillCancelling ? 'text-rose-700' : backfillPausing ? 'text-amber-700' : backfillScanActive ? 'text-indigo-600' : backfillPaused ? 'text-amber-700' : 'text-emerald-700'
                }>
                  {backfillStatus.done}/{backfillStatus.total} kênh
                </span>
              </p>
              <span className={`text-xs font-bold ${backfillScanActive ? 'text-indigo-700' : 'text-emerald-700'}`}>
                +{(backfillStatus.addedMessages || 0).toLocaleString()} tin
              </span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-white/70">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  backfillCancelling
                    ? 'bg-gradient-to-r from-rose-300 to-rose-500'
                    : backfillPausing
                    ? 'bg-gradient-to-r from-amber-300 to-amber-500'
                    : backfillScanActive ? 'bg-gradient-to-r from-indigo-400 to-indigo-600' : 'bg-emerald-500'
                }`}
                style={{ width: `${backfillStatus.total > 0 ? Math.round((backfillStatus.done / backfillStatus.total) * 100) : 0}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className={`text-[10px] font-medium truncate ${
                backfillCancelling ? 'text-rose-700/80' : backfillPausing ? 'text-amber-700/80' : backfillScanActive ? 'text-indigo-700/80' : 'text-emerald-700/80'
              }`}>
                {backfillCancelling
                  ? 'Đang ngắt tiến trình quét...'
                  : backfillPausing && backfillStatus.currentPage
                  ? `Đang kết thúc kênh: ${backfillStatus.currentPage}`
                  : backfillScanActive && backfillStatus.currentPage
                  ? `Đang xử lý: ${backfillStatus.currentPage}${
                      (backfillStatus.pageConvsDone ?? 0) > 0
                        ? ` (${backfillStatus.pageConvsDone} hội thoại)`
                        : ''
                    }`
                  : `Hoàn tất ${backfillStatus.okPages} kênh`}
                {backfillStatus.errorPages?.length > 0 && (
                  <span className="text-amber-600"> · {backfillStatus.errorPages.length} kênh Facebook báo lỗi (sẽ thử lại sau)</span>
                )}
              </p>
              {!backfillRunning && (
                <div className="flex items-center gap-3 shrink-0">
                  {backfillPaused && (
                    <button
                      type="button"
                      onClick={() => handleStartBackfill(false)}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      Tiếp tục quét
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleStartBackfill(true)}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    Quét lại từ đầu
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {dayStatsUnavailable && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl text-xs font-medium flex items-start gap-2">
            <Warning size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p>
                API backend đang chạy <strong>bản cũ</strong> — không trả <code className="text-[11px] bg-amber-100 px-1 rounded">inboundDay</code> cho{' '}
                <strong>{selectedDateLabel}</strong>.
              </p>
              <p className="text-amber-800/90">
                {isRailwayApi ? (
                  <>
                    FE đang gọi <strong>Railway</strong> — build Docker Hub <strong>không cập nhật</strong> server này.
                    Cần push code BE lên Git và redeploy trên Railway:
                  </>
                ) : (
                  <>
                    Push Git <strong>không đủ</strong> — cần <strong>build lại Docker image</strong> và restart container:
                  </>
                )}
              </p>
              <pre className="text-[10px] bg-amber-100/80 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap">{deployHint}</pre>
              <p className="text-amber-800/90">
                Kiểm tra: DevTools → Network → <code className="text-[11px] bg-amber-100 px-1 rounded">pages?date={selectedDate}</code> → response phải có{' '}
                <code className="text-[11px] bg-amber-100 px-1 rounded">inboundDay</code>.
                Hiện tại Railway chưa có endpoint <code className="text-[11px] bg-amber-100 px-1 rounded">/cskh/features</code> — dấu hiệu bản cũ.
                API: <code className="text-[11px] bg-amber-100 px-1 rounded break-all">{apiBase}</code>
              </p>
            </div>
          </div>
        )}

        {isError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-xs font-medium">
            Không tải được dữ liệu. Kiểm tra kết nối API và thử «Tải lại».
          </div>
        )}

        <DayStatsProgress active={isFetchingPages && !isInitialPagesLoad} dateLabel={selectedDateLabel} />
        {adSpendSyncPending && (
          <div className="rounded-xl border border-violet-200 bg-violet-50/80 px-4 py-2.5 text-xs font-medium text-violet-800">
            Đang đồng bộ chi tiêu QC từ Meta cho ngày {selectedDateLabel} — cột Chi tiêu QC sẽ cập nhật trong vài phút.
          </div>
        )}

        <div className={`grid grid-cols-2 2xl:grid-cols-4 gap-3 2xl:gap-4 transition-opacity duration-200 ${isFetchingPages && !isLoadingPages ? 'opacity-60' : ''}`}>
          {dynamicKPIs.map((kpi, i) => (
            <div 
              key={i} 
              className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex flex-col transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="flex justify-between items-start gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{kpi.label}</span>
                {kpi.isReal ? (
                  <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 select-none">Thực</span>
                ) : (
                  <span className="text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 select-none">Giả lập</span>
                )}
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-800 tracking-tighter mt-2.5 mb-2 truncate" title={kpi.value}>
                {kpi.value}
              </div>
              <div className="flex items-center gap-1.5 mt-auto">
                {kpi.isReal ? (
                  <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5 shrink-0">
                    <TrendUp size={12} weight="bold" />
                    <span>Tin cậy</span>
                  </div>
                ) : (
                  <div className="text-[10px] text-amber-600 font-bold flex items-center gap-0.5 shrink-0">
                    <Warning size={12} weight="fill" />
                    <span>Cần Sapo</span>
                  </div>
                )}
                <span className="text-[10px] text-slate-400 truncate">— {kpi.sub}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Performance Table */}
        <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden flex-1 min-h-0 transition-opacity duration-200 ${isFetchingPages && !isLoadingPages ? 'opacity-60' : ''}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 border-b border-slate-100 gap-3">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Hiệu suất từng Page & Kênh</h3>
              <p className="text-xs text-slate-400 mt-1">
                {isFetchingPages
                  ? `Đang cập nhật số liệu ${selectedDateLabel}...`
                  : `Theo dõi tổng tin nhắn và tin mới đến trong ngày ${selectedDateLabel}.`}
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg self-start sm:self-center select-none">
              {filteredPerformance.length}/{performance.length} trang
              {isFetchingPages && !isLoadingPages ? (
                <span className="text-indigo-500 font-semibold ml-2">Đang tải...</span>
              ) : null}
            </span>
          </div>

          <div className="flex gap-1.5 overflow-x-auto px-5 py-3 border-b border-slate-100 no-scrollbar shrink-0">
            <button
              onClick={() => setPerformanceFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                performanceFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Tất cả {performance.length}
            </button>
            {platformTypes.map(type => {
              const count = performance.filter(p => p.type === type).length;
              const filterKey = type === 'Facebook Page' ? 'facebook' : type.toLowerCase();
              return (
                <button
                  key={type}
                  onClick={() => setPerformanceFilter(filterKey)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                    performanceFilter === filterKey
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  <PageTypeIcon type={type} size={14} />
                  <span>{type === 'Facebook Page' ? 'Facebook' : type} {count}</span>
                </button>
              );
            })}
          </div>
          
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full text-left border-collapse min-w-[680px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">
                  <th className="px-5 py-3.5">Page / Kênh</th>
                  <th className="px-4 py-3.5 text-center">
                    <div>Tin nhắn</div>
                    <div className="text-[9px] font-semibold normal-case text-slate-300 mt-0.5">{selectedDateLabel}</div>
                  </th>
                  <th className="px-4 py-3.5 text-center">
                    <div>Tin mới đến</div>
                    <div className="text-[9px] font-semibold normal-case text-slate-300 mt-0.5">{selectedDateLabel}</div>
                  </th>
                  <th className="px-4 py-3.5 text-center">
                    <div>Chi tiêu QC</div>
                    <div className="text-[9px] font-semibold normal-case text-slate-300 mt-0.5">{selectedDateLabel}</div>
                  </th>
                  <th className="px-4 py-3.5 text-center">
                    <div>CP / hội thoại</div>
                    <div className="text-[9px] font-semibold normal-case text-slate-300 mt-0.5">{selectedDateLabel}</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                {filteredPerformance.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-400 font-medium">
                      Không có trang nào thuộc nền tảng này.
                    </td>
                  </tr>
                )}
                {filteredPerformance.map((p) => {
                  const isScanned = scannedPageIds.has(p.pageId);
                  const isScanningNow =
                    backfillScanActive &&
                    backfillStatus?.currentPage &&
                    (p.name === backfillStatus.currentPage || p.pageId === backfillStatus.currentPage);
                  return (
                  <tr
                    key={p.pageId}
                    className={`transition-colors ${
                      isScanningNow
                        ? 'bg-indigo-50/50'
                        : isScanned && (backfillScanActive || backfillPaused)
                          ? 'bg-emerald-50/35'
                          : 'hover:bg-slate-50/30'
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative w-8 h-8 flex-shrink-0">
                          <CskhPageAvatar
                            name={p.name}
                            pictureUrl={p.pictureUrl}
                            pageId={p.pageId}
                            className="!h-8 !w-8 !rounded-full !ring-slate-200/50"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">{p.name}</span>
                            {isScanningNow && (
                              <span className="text-[9px] font-bold uppercase tracking-wide text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">
                                Đang quét
                              </span>
                            )}
                            {isScanned && !isScanningNow && (backfillScanActive || backfillPaused) && (
                              <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                Đã quét
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-semibold">{p.type}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center font-bold text-slate-700">
                      {p.msgs > 0 ? p.msgs.toLocaleString() : (
                        <span className="text-slate-300 font-normal text-xs">Chưa có</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center font-bold text-slate-700">
                      {p.newInbound > 0 ? p.newInbound.toLocaleString() : (
                        <span className="text-slate-300 font-normal text-xs">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center font-bold text-emerald-700">
                      {p.adSpend != null && p.adSpend > 0
                        ? formatAdMoney(p.adSpend, p.adSpendCurrency)
                        : p.adSpendUnavailableReason
                          ? <span className="text-slate-300 font-normal text-[10px]" title={p.adSpendUnavailableReason}>—</span>
                          : <span className="text-slate-300 font-normal text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-center font-bold text-slate-700">
                      {p.adCostPerConversation != null && p.adCostPerConversation > 0
                        ? formatAdMoney(p.adCostPerConversation, p.adSpendCurrency)
                        : <span className="text-slate-300 font-normal text-xs">—</span>}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Column */}
      <div className="w-full xl:w-64 2xl:w-72 flex flex-col gap-4 2xl:gap-5 shrink-0 pb-6 xl:pb-0 pr-0.5 xl:h-full xl:overflow-y-auto">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <h3 className="font-bold text-slate-800 text-sm mb-4">Phân bổ tin nhắn theo kênh</h3>
          <div className="flex flex-col items-center gap-5">
            <DonutChart 
              data={dynamicDistribution.length > 0 ? dynamicDistribution : [{ label: 'Không có dữ liệu', pct: 100, value: 0, color: '#e2e8f0' }]} 
              total={totalMsgs} 
            />
            <div className="w-full space-y-2.5 pt-3 border-t border-slate-100">
              {dynamicDistribution.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-slate-600 font-semibold truncate">{d.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 pl-2 shrink-0">
                    <span className="font-bold text-slate-800">{d.pct}%</span>
                    <span className="text-slate-400 text-xs">({d.value.toLocaleString()})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <h3 className="font-bold text-slate-800 text-sm">Insight về page & kênh</h3>
          </div>
          <div className="space-y-3">
            {insights.map((text, i) => (
              <div 
                key={i} 
                className="flex gap-2.5 items-start bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-xl p-2.5 transition-all duration-200"
              >
                <span className="text-indigo-500 font-bold text-base leading-none mt-0.5">•</span>
                <span className="text-xs text-slate-600 leading-relaxed font-semibold">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <h3 className="font-bold text-slate-800 text-sm mb-3">Top từ khóa khách hàng theo kênh</h3>
          <div className="space-y-3.5">
            {keywordItems.map((item, i) => (
              <div key={i} className="bg-slate-50/40 border border-slate-100 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2.5">
                  <PageTypeIcon type={item.type} size={14} />
                  <span className="text-xs font-bold text-slate-700">{item.type}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {item.keywords.split(', ').map((kw, idx) => (
                    <span 
                      key={idx} 
                      className="text-xs font-bold text-indigo-700 bg-indigo-50/70 border border-indigo-100/50 px-2.5 py-0.5 rounded-md hover:bg-indigo-100/80 transition-colors cursor-default"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
