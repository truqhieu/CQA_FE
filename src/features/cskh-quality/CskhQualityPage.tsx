import { Link, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Loader2,
  RefreshCw,
  Link2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ShieldCheck,
  TrendingUp,
  Smile,
  Meh,
  Frown,
  Search,
  ChevronDown,
  Target,
  DollarSign,
  MessageCircle,
  Megaphone,
  Download,
  Award,
  TrendingDown,
  Package,
  MessageSquare,
  ShoppingBag,
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts'
import { cn } from '@/lib/utils'
import {
  fetchCskhPages,
  getCskhOAuthStartUrl,
  refreshCskhOAuth,
  setCskhPageEnabled,
  syncInboxFromGraph,
  isAsyncInboxSync,
  type CskhPage,
  type CskhPagesResponse,
} from '@/features/cskh-quality/api'
import { AuditMessengerView } from './AuditMessengerView'
import { ChatMessengerPane } from './ChatMessengerPane'
import { useOptionalAuditJob } from './AuditJobProvider'
import { loadAuditWorkspace, firstNonEmpty } from './auditWorkspaceState'
import { CskhGlassPanel, CskhPageShell, CskhPageAvatar } from './cskhUi'
import { toast } from 'sonner'

// Custom Facebook Icon because newer versions of lucide-react do not export brand icons.
function Facebook(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  )
}

function formatNumber(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toLocaleString('vi-VN')
}

// ==========================================
// MOCK DATA FOR CSKH QUALITY OVERVIEW
// ==========================================

const MOCK_KPI_CARDS = [
  {
    id: 'qa-score',
    label: 'QA Score (Chất lượng TB)',
    value: '85',
    max: '/100',
    trend: '↑ 6.2 điểm',
    comparison: 'so với 01/04 - 30/04',
    isPositive: true,
    strokeColor: '#10b981', // green
    data: [{ v: 75 }, { v: 78 }, { v: 76 }, { v: 81 }, { v: 80 }, { v: 83 }, { v: 85 }],
  },
  {
    id: 'csat',
    label: 'CSAT (Hài lòng)',
    value: '92%',
    max: '',
    trend: '↑ 5%',
    comparison: 'vs 87%',
    isPositive: true,
    strokeColor: '#10b981', // green
    data: [{ v: 87 }, { v: 88 }, { v: 89 }, { v: 91 }, { v: 90 }, { v: 92 }, { v: 92 }],
  },
  {
    id: 'conversion-rate',
    label: 'Tỷ lệ chốt đơn',
    value: '28.6%',
    max: '',
    trend: '↑ 4.1%',
    comparison: 'vs 24.5%',
    isPositive: true,
    strokeColor: '#8b5cf6', // purple
    data: [
      { v: 24.5 },
      { v: 25.1 },
      { v: 26.2 },
      { v: 25.8 },
      { v: 27.0 },
      { v: 28.1 },
      { v: 28.6 },
    ],
  },
  {
    id: 'revenue',
    label: 'Doanh thu ước tính',
    value: '1.286.450.000đ',
    max: '',
    trend: '↑ 23.4%',
    comparison: 'vs 1.042.350.000đ',
    isPositive: true,
    strokeColor: '#10b981', // green
    data: [
      { v: 1042 },
      { v: 1100 },
      { v: 1080 },
      { v: 1150 },
      { v: 1210 },
      { v: 1250 },
      { v: 1286 },
    ],
  },
  {
    id: 'organic-orders',
    label: 'Đơn từ tin nhắn tự nhiên',
    value: '972 đơn',
    max: ' (64.7%)',
    trend: '↑ 17.6%',
    comparison: 'vs 827 đơn',
    isPositive: true,
    strokeColor: '#3b82f6', // blue
    data: [{ v: 827 }, { v: 840 }, { v: 865 }, { v: 890 }, { v: 910 }, { v: 950 }, { v: 972 }],
  },
  {
    id: 'ad-orders',
    label: 'Đơn từ quảng cáo',
    value: '530 đơn',
    max: ' (35.3%)',
    trend: '↑ 16.2%',
    comparison: 'vs 456 đơn',
    isPositive: true,
    strokeColor: '#8b5cf6', // purple
    data: [{ v: 456 }, { v: 470 }, { v: 480 }, { v: 505 }, { v: 498 }, { v: 515 }, { v: 530 }],
  },
]

const MOCK_QUALITY_TREND = [
  { name: '01/05', qaScore: 40, csat: 62, conversion: 20 },
  { name: '06/05', qaScore: 50, csat: 70, conversion: 25 },
  { name: '11/05', qaScore: 60, csat: 80, conversion: 35 },
  { name: '16/05', qaScore: 55, csat: 75, conversion: 30 },
  { name: '21/05', qaScore: 48, csat: 78, conversion: 28 },
  { name: '26/05', qaScore: 55, csat: 80, conversion: 30 },
  { name: '31/05', qaScore: 65, csat: 85, conversion: 40 },
]

const MOCK_SOURCE_PIE = [
  { name: 'Tin nhắn tự nhiên', value: 3402, color: '#3b82f6', chotDon: 972, rate: '28.6%' },
  { name: 'Quảng cáo', value: 1851, color: '#10b981', chotDon: 530, rate: '28.6%' },
]

const MOCK_TOP_PRODUCTS = [
  { id: 1, name: 'Nhẫn bạc Kim Hoàn Trơn Classic', count: 1125, percent: 21.4, color: '#8b5cf6' },
  { id: 2, name: 'Dây chuyền bạc nữ', count: 856, percent: 16.3, color: '#f59e0b' },
  { id: 3, name: 'Lắc tay bạc', count: 741, percent: 14.1, color: '#3b82f6' },
  { id: 4, name: 'Bông tai bạc', count: 623, percent: 11.9, color: '#06b6d4' },
  { id: 5, name: 'Nhẫn bạc đính đá', count: 512, percent: 9.8, color: '#ec4899' },
]

const MOCK_PAGE_EFFECTIVENESS = [
  { name: 'Viễn Chí Bảo - Trang chính', conversations: 1825, qaScore: 87, conversionRate: '31.7%' },
  { name: 'Viễn Chí Bảo - HN', conversations: 1213, qaScore: 83, conversionRate: '27.8%' },
  { name: 'Viễn Chí Bảo - HCM', conversations: 898, qaScore: 81, conversionRate: '26.1%' },
  { name: 'Viễn Chí Bảo - Đà Nẵng', conversations: 567, qaScore: 78, conversionRate: '24.5%' },
  { name: 'Viễn Chí Bảo - Shop 2', conversations: 375, qaScore: 76, conversionRate: '22.9%' },
]

const MOCK_FUNNEL_STEPS = [
  { name: 'Tổng hội thoại', count: 5253, percent: '100%', bg: 'from-blue-700 to-blue-800' },
  { name: 'Đã tư vấn', count: 3982, percent: '75.8%', bg: 'from-blue-500 to-blue-600' },
  { name: 'Khách quan tâm', count: 2146, percent: '40.9%', bg: 'from-violet-500 to-violet-600' },
  { name: 'Báo giá', count: 1762, percent: '33.6%', bg: 'from-pink-500 to-pink-600' },
  { name: 'Chốt đơn', count: 1502, percent: '28.6%', bg: 'from-emerald-500 to-emerald-600' },
]

const MOCK_FUNNEL_CONVERSIONS = [
  { value: '75.8%' },
  { value: '53.9%' },
  { value: '82.1%' },
  { value: '85.2%' },
]

const MOCK_CUSTOMERS_TO_CARE = [
  {
    id: 're-care',
    label: 'Cần chăm sóc lại',
    count: 267,
    border: 'border-blue-100',
    bg: 'bg-blue-50/50',
    text: 'text-blue-700',
    type: 're-care',
  },
  {
    id: 'warranty',
    label: 'Cần bảo hành / đổi trả',
    count: 83,
    border: 'border-emerald-100',
    bg: 'bg-emerald-50/50',
    text: 'text-emerald-700',
    type: 'warranty',
  },
  {
    id: 'unclosed',
    label: 'Khách chưa chốt đơn (quá 24h)',
    count: 145,
    border: 'border-amber-100',
    bg: 'bg-amber-50/50',
    text: 'text-amber-700',
    type: 'unclosed',
  },
  {
    id: 'negative-sentiment',
    label: 'Khách có cảm xúc tiêu cực',
    count: 37,
    border: 'border-rose-100',
    bg: 'bg-rose-50/50',
    text: 'text-rose-700',
    type: 'negative',
  },
]

const MOCK_STAFF_RANKING = [
  {
    rank: 1,
    name: 'Trung Hiếu',
    hasTrophy: true,
    qaScore: 92,
    conversionRate: '34.6%',
    conversations: 632,
    avatar: 'TH',
  },
  {
    rank: 2,
    name: 'Hoangvan Hoangvan',
    hasTrophy: false,
    qaScore: 88,
    conversionRate: '29.7%',
    conversations: 598,
    avatar: 'HH',
  },
  {
    rank: 3,
    name: 'Oanh Lê',
    hasTrophy: false,
    qaScore: 86,
    conversionRate: '28.1%',
    conversations: 512,
    avatar: 'OL',
  },
  {
    rank: 4,
    name: 'Jarvis Nguyen',
    hasTrophy: false,
    qaScore: 84,
    conversionRate: '27.4%',
    conversations: 478,
    avatar: 'JN',
  },
  {
    rank: 5,
    name: 'Goc Pho Mua Thu',
    hasTrophy: false,
    qaScore: 82,
    conversionRate: '25.9%',
    conversations: 430,
    avatar: 'GP',
  },
]

const MOCK_KEYWORDS = [
  { text: 'nhẫn', count: 824 },
  { text: 'size', count: 689 },
  { text: 'dây chuyền', count: 589 },
  { text: 'giá', count: 521 },
  { text: 'bạc', count: 925 },
  { text: 'bảo hành', count: 398 },
  { text: 'bông tai', count: 321 },
  { text: 'đặt trả', count: 336 },
  { text: 'đổi trả', count: 301 },
  { text: 'khuyến mãi', count: 290 },
]

const MOCK_SENTIMENT_TRENDS = [
  { name: '01/05', positive: 75, neutral: 15, negative: 10 },
  { name: '06/05', positive: 78, neutral: 16, negative: 6 },
  { name: '11/05', positive: 76, neutral: 18, negative: 6 },
  { name: '16/05', positive: 74, neutral: 17, negative: 9 },
  { name: '21/05', positive: 78, neutral: 16, negative: 6 },
  { name: '26/05', positive: 80, neutral: 15, negative: 5 },
  { name: '31/05', positive: 82, neutral: 14, negative: 4 },
]

const MOCK_RECENT_ACTIVITIES = [
  { time: '10:29', label: 'Audit hoàn thành: Hội thoại #5204 - 85 điểm', type: 'audit' },
  { time: '10:15', label: 'Khách hàng cần chăm sóc lại (quá 24h): 5 khách', type: 'unclosed' },
  { time: '09:58', label: 'Đã chốt đơn mới: #DH73921 - 1.950.000đ', type: 'closed-order' },
  { time: '09:40', label: '3 hội thoại có cảm xúc tiêu cực', type: 'negative' },
  { time: '09:22', label: 'Khách yêu cầu bảo hành: #BH3201', type: 'warranty' },
]

// ==========================================
// MOCK DATA FOR FB PAGE TAB
// ==========================================

const MOCK_FB_KPI_CARDS = [
  {
    id: 'total-messages',
    label: 'Tổng tin nhắn',
    value: '8.625',
    trend: '↑ 18.6%',
    comparison: 'so với tháng trước',
  },
  {
    id: 'ad-messages',
    label: 'Tin nhắn từ quảng cáo',
    value: '5.248',
    trend: '↑ 24.3%',
    comparison: '60.8% tổng tin nhắn',
  },
  {
    id: 'response-rate',
    label: 'Tỷ lệ phản hồi',
    value: '85.3%',
    trend: '↑ 3.8%',
    comparison: 'so với tháng trước',
  },
  {
    id: 'closing-rate',
    label: 'Tỷ lệ chốt',
    value: '28.6%',
    trend: '↑ 4.2%',
    comparison: 'so với tháng trước',
  },
  {
    id: 'revenue-chat',
    label: 'Doanh thu từ chat',
    value: '1.248.500.000đ',
    trend: '↑ 22.5%',
    comparison: 'so với tháng trước',
  },
]

const MOCK_FB_PAGES_LIST = [
  {
    name: 'Vienchibao Jewelry',
    handle: '@vienchibao.jewelry',
    status: 'active',
    totalMsg: 2352,
    totalTrend: '↑ 20.1%',
    adMsg: 1548,
    adTrend: '↑ 28.3%',
    adPercent: '65.8%',
    responseRate: '89.2%',
    responseTrend: '↑ 2.9%',
    closingRate: '32.1%',
    closingTrend: '↑ 3.5%',
    revenue: '420.500.000đ',
    revenueTrend: '↑ 18.4%',
    quality: 92,
    trendData: [110, 115, 112, 120, 125, 128, 132],
    isPositiveTrend: true,
  },
  {
    name: 'Vienchibao Official',
    handle: '@vienchibao.official',
    status: 'active',
    totalMsg: 1856,
    totalTrend: '↑ 15.7%',
    adMsg: 1120,
    adTrend: '↑ 21.6%',
    adPercent: '60.4%',
    responseRate: '86.7%',
    responseTrend: '↑ 2.1%',
    closingRate: '29.8%',
    closingTrend: '↑ 3.2%',
    revenue: '312.200.000đ',
    revenueTrend: '↑ 16.2%',
    quality: 88,
    trendData: [90, 95, 93, 100, 102, 106, 110],
    isPositiveTrend: true,
  },
  {
    name: 'Vienchibao Thailand',
    handle: '@vienchibao.th',
    status: 'active',
    totalMsg: 1248,
    totalTrend: '↑ 12.3%',
    adMsg: 892,
    adTrend: '↑ 18.9%',
    adPercent: '71.6%',
    responseRate: '84.1%',
    responseTrend: '↑ 1.8%',
    closingRate: '26.7%',
    closingTrend: '↑ 2.8%',
    revenue: '210.800.000đ',
    revenueTrend: '↑ 12.7%',
    quality: 85,
    trendData: [70, 75, 72, 78, 80, 84, 85],
    isPositiveTrend: true,
  },
  {
    name: 'VB Accessories',
    handle: '@vb.accessories',
    status: 'active',
    totalMsg: 964,
    totalTrend: '↑ 9.8%',
    adMsg: 564,
    adTrend: '↑ 16.4%',
    adPercent: '58.5%',
    responseRate: '82.3%',
    responseTrend: '↑ 1.6%',
    closingRate: '24.9%',
    closingTrend: '↑ 2.1%',
    revenue: '128.600.000đ',
    revenueTrend: '↑ 10.3%',
    quality: 82,
    trendData: [60, 63, 61, 66, 68, 72, 75],
    isPositiveTrend: true,
  },
  {
    name: 'Vienchibao Men',
    handle: '@vienchibao.men',
    status: 'active',
    totalMsg: 632,
    totalTrend: '↑ 14.1%',
    adMsg: 356,
    adTrend: '↑ 11.3%',
    adPercent: '56.3%',
    responseRate: '78.5%',
    responseTrend: '↑ 1.2%',
    closingRate: '22.3%',
    closingTrend: '↑ 1.9%',
    revenue: '86.300.000đ',
    revenueTrend: '↑ 8.7%',
    quality: 79,
    trendData: [45, 48, 46, 52, 55, 58, 62],
    isPositiveTrend: true,
  },
  {
    name: 'Vienchibao Customer Care',
    handle: '@vb.customer.care',
    status: 'active',
    totalMsg: 356,
    totalTrend: '↑ 8.7%',
    adMsg: 216,
    adTrend: '↑ 11.3%',
    adPercent: '60.7%',
    responseRate: '76.1%',
    responseTrend: '↑ 1.0%',
    closingRate: '19.8%',
    closingTrend: '↑ 1.5%',
    revenue: '54.700.000đ',
    revenueTrend: '↑ 7.8%',
    quality: 75,
    trendData: [30, 32, 31, 35, 38, 40, 42],
    isPositiveTrend: true,
  },
  {
    name: 'VB Diamond',
    handle: '@vb.diamond',
    status: 'inactive',
    totalMsg: 128,
    totalTrend: '↓ 5.2%',
    adMsg: 64,
    adTrend: '↓ 8.6%',
    adPercent: '50.0%',
    responseRate: '65.3%',
    responseTrend: '↓ 0.7%',
    closingRate: '14.2%',
    closingTrend: '↓ 1.1%',
    revenue: '22.100.000đ',
    revenueTrend: '↓ 4.3%',
    quality: 62,
    trendData: [25, 23, 20, 18, 15, 14, 12],
    isPositiveTrend: false,
  },
]

type FbPageTableRow = {
  pageId: string
  name: string
  pictureUrl?: string | null
  status: 'active' | 'inactive'
  totalMsg: number
  totalTrend: string
  adMsg: number
  adTrend: string
  adPercent: string
  responseRate: string
  responseTrend: string
  closingRate: string
  closingTrend: string
  revenue: string
  revenueTrend: string
  quality: number
  trendData: number[]
  isPositiveTrend: boolean
}

function mapConnectedPagesToTableRows(pages: CskhPage[]): FbPageTableRow[] {
  return pages.map((page, idx) => {
    const fallbackMock = {
      totalMsg: 0,
      totalTrend: '—',
      adMsg: 0,
      adTrend: '—',
      adPercent: '—',
      responseRate: '—',
      responseTrend: '—',
      closingRate: '—',
      closingTrend: '—',
      revenue: '—',
      revenueTrend: '—',
      quality: 0,
      trendData: [] as number[],
      isPositiveTrend: true,
    }

    const mock =
      MOCK_FB_PAGES_LIST.length > 0
        ? (MOCK_FB_PAGES_LIST[idx % MOCK_FB_PAGES_LIST.length] ?? fallbackMock)
        : fallbackMock
    // Mọi Page trong danh sách đã kết nối OAuth → coi là đang hoạt động (không dùng cờ enabled cũ).
    return {
      pageId: page.pageId,
      name: page.pageName || page.pageId,
      pictureUrl: page.pagePictureUrl ?? null,
      status: 'active' as const,
      totalMsg: mock.totalMsg,
      totalTrend: mock.totalTrend,
      adMsg: mock.adMsg,
      adTrend: mock.adTrend,
      adPercent: mock.adPercent,
      responseRate: mock.responseRate,
      responseTrend: mock.responseTrend,
      closingRate: mock.closingRate,
      closingTrend: mock.closingTrend,
      revenue: mock.revenue,
      revenueTrend: mock.revenueTrend,
      quality: mock.quality,
      trendData: mock.trendData,
      isPositiveTrend: mock.isPositiveTrend,
    }
  })
}

const MOCK_FB_MESSAGE_TREND = [
  { name: '01/05', total: 300, ad: 150 },
  { name: '06/05', total: 450, ad: 250 },
  { name: '11/05', total: 400, ad: 220 },
  { name: '16/05', total: 550, ad: 320 },
  { name: '21/05', total: 520, ad: 300 },
  { name: '26/05', total: 600, ad: 380 },
  { name: '31/05', total: 650, ad: 420 },
]

const MOCK_FB_SOURCE_PIE = [
  { name: 'Từ quảng cáo', value: 5248, color: '#10b981' },
  { name: 'Từ nguồn khác', value: 3377, color: '#94a3b8' },
]

const MOCK_FB_AD_METRICS = [
  {
    id: 'ad-total',
    label: 'Tổng tin nhắn từ quảng cáo',
    value: '5.248',
    trend: '↑ 24.3%',
    isPositive: true,
  },
  {
    id: 'ad-cost',
    label: 'Chi phí quảng cáo',
    value: '24.500.000đ',
    trend: '↑ 12.5%',
    isPositive: true,
  },
  {
    id: 'ad-cpm',
    label: 'Chi phí / tin nhắn',
    value: '4.671đ',
    trend: '↓ 9.3%',
    isPositive: false,
  },
  {
    id: 'ad-quality',
    label: 'Chất lượng tin nhắn (AI)',
    value: '86/100',
    trend: '↑ 5.2%',
    isPositive: true,
  },
]

const MOCK_FB_TOP_ADS = [
  {
    id: 1,
    name: 'Quảng cáo nhẫn bạc Classic',
    page: 'Vienchibao Jewelry',
    messages: 1245,
    cost: '3.980đ',
    image: '💍',
  },
  {
    id: 2,
    name: 'Dây chuyền bạc Minimal',
    page: 'Vienchibao Official',
    messages: 986,
    cost: '4.120đ',
    image: '📿',
  },
  {
    id: 3,
    name: 'Khuyến mãi 20% - Tháng 5',
    page: 'Vienchibao Thailand',
    messages: 754,
    cost: '4.530đ',
    image: '🏷️',
  },
  {
    id: 4,
    name: 'Bộ trang sức quà tặng',
    page: 'VB Accessories',
    messages: 564,
    cost: '4.890đ',
    image: '🎁',
  },
  {
    id: 5,
    name: 'Nhẫn bạc nam cá tính',
    page: 'Vienchibao Men',
    messages: 356,
    cost: '5.210đ',
    image: '💍',
  },
]

const MOCK_FB_AI_INSIGHTS = [
  {
    id: 1,
    type: 'success',
    text: 'Vienchibao Jewelry có chất lượng tin nhắn từ quảng cáo tốt nhất (92/100).',
  },
  {
    id: 2,
    type: 'info',
    text: 'Vienchibao Thailand có tỷ lệ tin nhắn từ quảng cáo cao nhất (71.6%).',
  },
  { id: 3, type: 'warning', text: 'VB Diamond đang có xu hướng giảm, cần tối ưu lại quảng cáo.' },
  {
    id: 4,
    type: 'tip',
    text: 'Nên tăng ngân sách cho quảng cáo "Nhẫn bạc Classic" để tăng tin nhắn.',
  },
]

// ==========================================
// MOCK DATA FOR PRODUCTS TAB
// ==========================================

const MOCK_PROD_KPI_CARDS = [
  {
    id: 'total-prod',
    label: 'Tổng sản phẩm',
    value: '286',
    trend: '↑ 12 sản phẩm',
    comparison: 'so với tháng trước',
    icon: 'package',
    colors: 'bg-blue-50 text-blue-600 border border-blue-100/50',
  },
  {
    id: 'prod-with-msg',
    label: 'Sản phẩm có tin nhắn',
    value: '184 (64.3%)',
    trend: '↑ 18.6%',
    comparison: 'so với tháng trước',
    icon: 'message-square',
    colors: 'bg-indigo-50 text-indigo-600 border border-indigo-100/50',
  },
  {
    id: 'total-msg',
    label: 'Tổng tin nhắn',
    value: '12.458',
    trend: '↑ 24.3%',
    comparison: 'so với tháng trước',
    icon: 'message-circle',
    colors: 'bg-purple-50 text-purple-600 border border-purple-100/50',
  },
  {
    id: 'sold-prod',
    label: 'Sản phẩm đã bán',
    value: '1.248',
    trend: '↑ 22.5%',
    comparison: 'so với tháng trước',
    icon: 'shopping-bag',
    colors: 'bg-amber-50 text-amber-500 border border-amber-100/50',
  },
  {
    id: 'revenue-prod',
    label: 'Doanh thu từ sản phẩm',
    value: '1.248.500.000đ',
    trend: '↑ 25.1%',
    comparison: 'so với tháng trước',
    icon: 'dollar-sign',
    colors: 'bg-emerald-50 text-emerald-600 border border-emerald-100/50',
  },
  {
    id: 'avg-closing',
    label: 'Tỷ lệ chốt trung bình',
    value: '10.02%',
    trend: '↑ 2.1%',
    comparison: 'so với tháng trước',
    icon: 'target',
    colors: 'bg-rose-50 text-rose-600 border border-rose-100/50',
  },
]

const MOCK_PROD_LIST = [
  {
    name: 'Nhẫn bạc Classic',
    code: 'SP001',
    category: 'Nhẫn',
    msg: 1245,
    msgTrend: '↑ 15.6%',
    responseRate: '86.7%',
    closingRate: '12.4%',
    closingTrend: '↑ 1.8%',
    sold: 156,
    soldTrend: '↑ 23.8%',
    revenue: '156.000.000đ',
    revenueTrend: '↑ 25.1%',
    revPerItem: '1.000.000đ',
    aiScore: 92,
    trendData: [80, 85, 83, 89, 92, 95, 98],
    isPositiveTrend: true,
    image: '💍',
  },
  {
    name: 'Dây chuyền bạc Minimal',
    code: 'SP002',
    category: 'Dây chuyền',
    msg: 1086,
    msgTrend: '↑ 15.3%',
    responseRate: '84.1%',
    closingRate: '9.8%',
    closingTrend: '↑ 1.2%',
    sold: 112,
    soldTrend: '↑ 18.9%',
    revenue: '112.000.000đ',
    revenueTrend: '↑ 20.6%',
    revPerItem: '1.000.000đ',
    aiScore: 88,
    trendData: [75, 78, 80, 83, 85, 87, 88],
    isPositiveTrend: true,
    image: '📿',
  },
  {
    name: 'Lắc tay bạc Basic',
    code: 'SP003',
    category: 'Lắc tay',
    msg: 943,
    msgTrend: '↑ 12.8%',
    responseRate: '82.3%',
    closingRate: '8.7%',
    closingTrend: '↑ 0.9%',
    sold: 82,
    soldTrend: '↑ 15.5%',
    revenue: '82.000.000đ',
    revenueTrend: '↑ 16.7%',
    revPerItem: '1.000.000đ',
    aiScore: 82,
    trendData: [70, 72, 75, 78, 80, 81, 82],
    isPositiveTrend: true,
    image: '✨',
  },
  {
    name: 'Bông tai bạc Tiny',
    code: 'SP004',
    category: 'Bông tai',
    msg: 765,
    msgTrend: '↑ 8.9%',
    responseRate: '78.6%',
    closingRate: '7.3%',
    closingTrend: '↓ 0.2%',
    sold: 56,
    soldTrend: '↑ 8.1%',
    revenue: '56.000.000đ',
    revenueTrend: '↑ 9.3%',
    revPerItem: '1.000.000đ',
    aiScore: 76,
    trendData: [78, 77, 75, 74, 75, 75, 76],
    isPositiveTrend: false,
    image: '💎',
  },
  {
    name: 'Nhẫn bạc đá CZ',
    code: 'SP005',
    category: 'Nhẫn',
    msg: 652,
    msgTrend: '↑ 6.7%',
    responseRate: '76.1%',
    closingRate: '6.1%',
    closingTrend: '↓ 0.6%',
    sold: 40,
    soldTrend: '↑ 5.2%',
    revenue: '40.000.000đ',
    revenueTrend: '↑ 4.8%',
    revPerItem: '1.000.000đ',
    aiScore: 68,
    trendData: [72, 70, 68, 66, 65, 66, 68],
    isPositiveTrend: false,
    image: '💍',
  },
  {
    name: 'Vòng tay bạc Charm',
    code: 'SP006',
    category: 'Vòng tay',
    msg: 512,
    msgTrend: '↑ 5.1%',
    responseRate: '74.8%',
    closingRate: '5.2%',
    closingTrend: '↓ 0.4%',
    sold: 26,
    soldTrend: '↑ 3.9%',
    revenue: '26.000.000đ',
    revenueTrend: '↑ 3.2%',
    revPerItem: '1.000.000đ',
    aiScore: 62,
    trendData: [68, 65, 62, 60, 58, 60, 62],
    isPositiveTrend: false,
    image: '📿',
  },
]

const MOCK_PROD_REVENUE_TOP = [
  { name: 'Nhẫn bạc Classic', value: '156.000.000đ', sold: 156, image: '💍' },
  { name: 'Dây chuyền bạc Minimal', value: '112.000.000đ', sold: 112, image: '📿' },
  { name: 'Lắc tay bạc Basic', value: '82.000.000đ', sold: 82, image: '✨' },
  { name: 'Bông tai bạc Tiny', value: '56.000.000đ', sold: 56, image: '💎' },
  { name: 'Nhẫn bạc đá CZ', value: '40.000.000đ', sold: 40, image: '💍' },
]

const MOCK_PROD_AI_INSIGHTS = [
  {
    id: 1,
    type: 'success',
    text: 'Nhẫn bạc Classic đang là sản phẩm thu hút nhiều tin nhắn nhất (1.245 tin nhắn) và có tỷ lệ chốt cao nhất (12.4%).',
  },
  {
    id: 2,
    type: 'success',
    text: 'Dây chuyền bạc Minimal có doanh thu cao thứ 2 và tăng trưởng tốt (20.6%) so với tháng trước.',
  },
  {
    id: 3,
    type: 'warning',
    text: 'Bông tai bạc Tiny có tỷ lệ phản hồi thấp hơn trung bình (78.6%). Nên tối ưu mô tả và hình ảnh sản phẩm.',
  },
  {
    id: 4,
    type: 'danger',
    text: 'Vòng tay bạc Charm có performance thấp, cần xem xét điều chỉnh giá hoặc chiến lược quảng bá.',
  },
]

const MOCK_PROD_STATUS_PIE = [
  { name: 'Sản phẩm bán chạy', value: 48, percent: '16.8%', color: '#10b981' },
  { name: 'Sản phẩm tiềm năng', value: 72, percent: '25.2%', color: '#3b82f6' },
  { name: 'Sản phẩm trung bình', value: 106, percent: '37.1%', color: '#f59e0b' },
  { name: 'Sản phẩm kém hiệu quả', value: 60, percent: '21.0%', color: '#ef4444' },
]

const MOCK_PROD_MSG_CHART = [
  { name: 'Nhẫn Classic', value: 1245 },
  { name: 'Dây chuyền Min', value: 1086 },
  { name: 'Lắc tay Basic', value: 943 },
  { name: 'Bông tai Tiny', value: 765 },
  { name: 'Nhẫn đá CZ', value: 652 },
  { name: 'Vòng tay Charm', value: 512 },
  { name: 'Dây chuyền đá', value: 432 },
  { name: 'Nhẫn nam bạc', value: 378 },
  { name: 'Khuyên tai bạc', value: 301 },
  { name: 'Nhẫn đôi bạc', value: 256 },
]

const MOCK_PROD_CLOSING_CHART = [
  { name: 'Nhẫn Classic', rate: 12.4 },
  { name: 'Dây chuyền Min', rate: 9.8 },
  { name: 'Lắc tay Basic', rate: 8.7 },
  { name: 'Bông tai Tiny', rate: 7.3 },
  { name: 'Nhẫn đá CZ', rate: 6.1 },
  { name: 'Vòng tay Charm', rate: 5.2 },
  { name: 'Dây chuyền đá', rate: 4.8 },
  { name: 'Nhẫn nam bạc', rate: 4.3 },
  { name: 'Khuyên tai bạc', rate: 3.9 },
  { name: 'Nhẫn đôi bạc', rate: 3.2 },
]

function Sparkline({ data, strokeColor }: { data: { v: number }[]; strokeColor: string }) {
  return <SparklinePath data={data.map((d) => d.v)} stroke={strokeColor} />
}

function getCardIconAndColors(id: string) {
  switch (id) {
    case 'qa-score':
      return {
        icon: <ShieldCheck className="h-4.5 w-4.5" />,
        iconBg: 'bg-blue-50/10 text-blue-600 dark:text-blue-400 border border-blue-200/20',
      }
    case 'csat':
      return {
        icon: <Smile className="h-4.5 w-4.5" />,
        iconBg: 'bg-amber-50/10 text-amber-500 dark:text-amber-400 border border-amber-200/20',
      }
    case 'conversion-rate':
      return {
        icon: <Target className="h-4.5 w-4.5" />,
        iconBg: 'bg-purple-50/10 text-purple-600 dark:text-purple-400 border border-purple-200/20',
      }
    case 'revenue':
      return {
        icon: <DollarSign className="h-4.5 w-4.5" />,
        iconBg: 'bg-emerald-50/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/20',
      }
    case 'organic-orders':
      return {
        icon: <MessageCircle className="h-4.5 w-4.5" />,
        iconBg: 'bg-sky-50/10 text-sky-500 dark:text-sky-400 border border-sky-200/20',
      }
    case 'ad-orders':
      return {
        icon: <Megaphone className="h-4.5 w-4.5" />,
        iconBg: 'bg-violet-50/10 text-violet-500 dark:text-violet-400 border border-violet-200/20',
      }
    default:
      return {
        icon: <TrendingUp className="h-4.5 w-4.5" />,
        iconBg: 'bg-n-50 dark:bg-n-900 text-n-500 dark:text-n-400 border border-border',
      }
  }
}

function OverviewTab() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto lg:overflow-hidden bg-n-100 dark:bg-n-950 p-2 pb-2 sm:gap-2.5 sm:p-3 font-sans">
      {/* Upper Title and Operational Overview Banner */}
      <div className="shrink-0 rounded-xl border border-border bg-card text-card-foreground px-3 py-2.5 shadow-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
              CSKH Quality
            </p>
            <h2 className="mt-0.5 text-lg font-black tracking-tight text-foreground sm:text-xl">
              Tổng quan vận hành CSKH
            </h2>
            <p className="mt-0.5 hidden max-w-3xl text-xs text-n-600 dark:text-n-450 lg:block">
              Theo dõi kết nối Facebook, inbox real-time và chất lượng audit AI trên cùng một màn.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            <Link
              to="/quality?tab=audit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition opacity-90 hover:opacity-100"
            >
              Mở Audit <ChevronRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/quality?tab=config"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
            >
              Cấu hình Page
            </Link>
          </div>
        </div>
      </div>

      {/* Reihe 1: 6 KPI-Karten mit Sparklines */}
      <div className="grid shrink-0 grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
        {MOCK_KPI_CARDS.map((card) => {
          const details = getCardIconAndColors(card.id)
          const isCompactValue =
            card.id === 'revenue' || card.id === 'organic-orders' || card.id === 'ad-orders'
          return (
            <div
              key={card.id}
              className="flex min-w-0 flex-col justify-between rounded-xl border border-border bg-card text-card-foreground p-0.5 sm:p-1 shadow-sm transition duration-200 hover:shadow-md"
            >
              {/* Row 1: Icon and Title */}
              <div className="flex min-w-0 items-center gap-1.5">
                <div
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                    details.iconBg
                  )}
                >
                  {details.icon}
                </div>
                <span className="min-w-0 text-[10px] font-bold uppercase tracking-wide text-n-500 dark:text-n-400 line-clamp-2 leading-snug">
                  {card.label}
                </span>
              </div>

              {/* Row 2: Main Big Value */}
              <div className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-1">
                <span
                  className={cn(
                    'min-w-0 font-black tracking-tight text-foreground break-words',
                    isCompactValue
                      ? 'text-base sm:text-lg lg:text-sm 2xl:text-lg'
                      : 'text-lg sm:text-xl lg:text-lg 2xl:text-xl'
                  )}
                >
                  {card.value}
                </span>
                {card.max && (
                  <span className="shrink-0 text-xs sm:text-sm font-bold text-n-400 dark:text-n-500">
                    {card.max}
                  </span>
                )}
                {(card.id === 'csat' || card.id === 'conversion-rate') && (
                  <span className="ml-0.5 inline-flex shrink-0 items-center gap-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                    {card.trend}
                  </span>
                )}
              </div>

              {/* Row 3: Bottom info + Sparkline separated */}
              <div className="mt-0.5 flex items-end justify-between gap-1.5">
                {/* Left Column: Trend and comparison details */}
                <div className="flex flex-col min-w-0 pr-1 select-none">
                  {card.id !== 'csat' && card.id !== 'conversion-rate' ? (
                    <>
                      <div className="mb-0.5">
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.2 text-[9px] sm:text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                          {card.trend}
                        </span>
                      </div>
                      <span className="text-[9px] sm:text-[10px] text-n-400 dark:text-n-500 font-bold truncate">
                        {card.comparison}
                      </span>
                    </>
                  ) : (
                    <span className="text-[9px] sm:text-[10px] text-n-400 dark:text-n-500 font-bold truncate">
                      {card.comparison}
                    </span>
                  )}
                </div>

                {/* Right Column: Clean Sparkline with Dots */}
                <div className="shrink-0 h-[24px]">
                  <Sparkline data={card.data} strokeColor={card.strokeColor} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Main Grid for 4 Columns */}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-1 sm:gap-1.5">
        {/* ================= COLUMN 1 ================= */}
        <div className="flex min-h-0 flex-col gap-2 sm:gap-2.5 lg:h-full">
          {/* Xu hướng chất lượng theo ngày */}
          <div className="flex min-h-0 min-w-0 flex-col rounded-xl border border-border bg-card text-card-foreground p-3 shadow-sm lg:flex-1 lg:min-h-0">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-extrabold text-foreground sm:text-sm">
                Xu hướng chất lượng theo ngày
              </h3>
              <div className="flex items-center gap-1 border border-border rounded-lg px-2 py-1 bg-n-50 dark:bg-n-900 text-[11px] font-bold text-n-500 dark:text-n-400 cursor-pointer hover:bg-n-100 dark:hover:bg-n-800 transition">
                <span>Theo ngày</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </div>
            </div>

            {/* Legend Custom */}
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-n-500 dark:text-n-400">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <span>QA Score (TB)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>CSAT</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-purple-500" />
                <span>Tỷ lệ chốt đơn</span>
              </div>
            </div>

            {/* Recharts Area/Line Chart */}
            <div className="w-full flex-1 min-h-[90px] h-[120px] sm:h-[130px] lg:h-auto">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={MOCK_QUALITY_TREND}
                  margin={{ top: 10, right: 5, left: -25, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 9, fontWeight: 500, fill: 'var(--n-400)' }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 9, fontWeight: 500, fill: 'var(--n-400)' }}
                  />
                  <Tooltip cursor={{ stroke: 'var(--n-300)', strokeWidth: 1 }} />
                  <Line
                    type="monotone"
                    dataKey="qaScore"
                    name="QA Score (TB)"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="csat"
                    name="CSAT"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="conversion"
                    name="Tỷ lệ chốt đơn"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2. Hiệu quả theo Page */}
          <div className="flex min-h-0 min-w-0 flex-col rounded-xl border border-border bg-card text-card-foreground p-3 shadow-sm lg:flex-1 lg:min-h-0">
            <div className="mb-1.5 flex shrink-0 items-center justify-between gap-2">
              <h3 className="text-xs font-extrabold text-foreground sm:text-sm">
                Hiệu quả theo Page
              </h3>
              <span className="text-[10px] font-bold text-primary cursor-pointer hover:underline">
                Xem tất cả
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto [scrollbar-width:thin]">
              <table className="w-full min-w-[240px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border text-[9px] font-bold text-n-400 dark:text-n-500 uppercase tracking-wider sticky top-0 bg-card z-10">
                    <th className="pb-1 font-black">Page</th>
                    <th className="pb-1 text-right font-black">Hội thoại</th>
                    <th className="pb-1 text-center font-black">QA Score</th>
                    <th className="pb-1 text-right font-black">Tỷ lệ chốt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {MOCK_PAGE_EFFECTIVENESS.map((page, idx) => (
                    <tr key={idx} className="text-[11px]">
                      <td className="py-1 font-bold text-n-700 dark:text-n-300 flex items-center gap-1 min-w-0 max-w-[100px]">
                        <div className="h-4.5 w-4.5 rounded bg-gradient-to-br from-indigo-500 to-indigo-700 text-[8px] font-black text-white flex items-center justify-center shrink-0 uppercase">
                          {page.name.charAt(12)}
                        </div>
                        <span className="truncate">{page.name}</span>
                      </td>
                      <td className="py-1 text-right font-semibold text-n-800 dark:text-n-200 tabular-nums">
                        {formatNumber(page.conversations)}
                      </td>
                      <td className="py-1 text-center">
                        <span
                          className={cn(
                            'inline-flex min-w-[24px] items-center justify-center rounded px-1 py-0.5 text-[9px] font-black',
                            page.qaScore >= 80
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          )}
                        >
                          {page.qaScore}
                        </span>
                      </td>
                      <td className="py-1 text-right font-semibold text-n-800 dark:text-n-200 tabular-nums">
                        {page.conversionRate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Cảm xúc khách hàng */}
          <div className="flex min-h-0 min-w-0 flex-col rounded-xl border border-border bg-card text-card-foreground p-3 shadow-sm lg:flex-1 lg:min-h-0">
            <h3 className="mb-1.5 shrink-0 text-xs font-extrabold text-foreground sm:text-sm">
              Cảm xúc khách hàng
            </h3>

            <div className="flex flex-1 min-h-0 flex-col justify-between">
              {/* The Gauge Container */}
              <div className="relative flex h-[64px] w-full shrink-0 items-center justify-center overflow-hidden">
                <div className="absolute -bottom-[54px] h-[110px] w-[110px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Tích cực', value: 78, color: '#10b981' },
                          { name: 'Trung tính', value: 16, color: '#f59e0b' },
                          { name: 'Tiêu cực', value: 6, color: '#ef4444' },
                        ]}
                        innerRadius={42}
                        outerRadius={54}
                        startAngle={180}
                        endAngle={0}
                        paddingAngle={1.5}
                        dataKey="value"
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#f59e0b" />
                        <Cell fill="#ef4444" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="absolute bottom-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-lg font-black text-foreground leading-none">78%</span>
                  <span className="mt-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Tích cực
                  </span>
                </div>
              </div>

              {/* Smiley rows at bottom */}
              <div className="mt-1.5 grid shrink-0 grid-cols-3 gap-1 border-t border-border pt-1.5">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm">
                    <Smile className="h-3 w-3" />
                  </div>
                  <span className="text-[9px] font-black text-foreground">78%</span>
                  <span className="text-[8px] font-bold text-n-400 dark:text-n-500 uppercase tracking-wider mt-0.5 leading-none">
                    Tích cực
                  </span>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="mb-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-sm">
                    <Meh className="h-3 w-3" />
                  </div>
                  <span className="text-[9px] font-black text-foreground">16%</span>
                  <span className="text-[8px] font-bold text-n-400 dark:text-n-500 uppercase tracking-wider mt-0.5 leading-none">
                    Trung tính
                  </span>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="mb-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-danger-100 dark:border-danger-500/20 bg-danger-50 dark:bg-danger-500/10 text-danger-600 dark:text-danger-400 shadow-sm">
                    <Frown className="h-3 w-3" />
                  </div>
                  <span className="text-[9px] font-black text-foreground">6%</span>
                  <span className="text-[8px] font-bold text-n-400 dark:text-n-500 uppercase tracking-wider mt-0.5 leading-none">
                    Tiêu cực
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================= COLUMN 2 ================= */}
        <div className="flex min-h-0 flex-col gap-2 sm:gap-2.5 lg:h-full">
          {/* 4. Nguồn hội thoại & tỷ lệ chốt */}
          <div className="flex min-h-0 min-w-0 flex-col rounded-xl border border-border bg-card text-card-foreground p-3 shadow-sm lg:flex-1 lg:min-h-0">
            <h3 className="mb-1.5 shrink-0 text-xs font-extrabold text-foreground sm:text-sm">
              Nguồn hội thoại & tỷ lệ chốt
            </h3>

            <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-2 sm:flex-row lg:flex-col 2xl:flex-row overflow-y-auto [scrollbar-width:thin]">
              {/* Donut PieChart */}
              <div className="relative flex h-[90px] w-[90px] shrink-0 items-center justify-center sm:h-[100px] sm:w-[100px] lg:h-[85px] lg:w-[85px] 2xl:h-[100px] 2xl:w-[100px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={MOCK_SOURCE_PIE}
                      innerRadius={36}
                      outerRadius={48}
                      paddingAngle={2.5}
                      dataKey="value"
                      isAnimationActive={false}
                    >
                      {MOCK_SOURCE_PIE.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-[8px] font-bold text-n-400 dark:text-n-500 uppercase tracking-wider leading-none">
                    Tổng
                  </span>
                  <span className="text-base font-black text-foreground leading-none mt-0.5">
                    5.253
                  </span>
                </div>
              </div>

              {/* Source detailed specs */}
              <div className="flex-1 space-y-2 w-full min-w-0 py-0.5 text-[11px] lg:space-y-1">
                {MOCK_SOURCE_PIE.map((src, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex items-center gap-1 font-bold text-n-700 dark:text-n-300">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: src.color }}
                      />
                      <span className="truncate">{src.name}</span>
                    </div>
                    <div className="pl-3 space-y-0.5">
                      <p className="font-black text-n-800 dark:text-n-200">
                        {formatNumber(src.value)}{' '}
                        <span className="font-medium text-n-400 dark:text-n-500">
                          ({src.name === 'Quảng cáo' ? '35.3%' : '64.7%'})
                        </span>
                      </p>
                      <p className="text-[9px] font-semibold text-n-500 dark:text-n-400">
                        Chốt:{' '}
                        <span className="font-bold text-primary">
                          {formatNumber(src.chotDon)}
                        </span>{' '}
                        ({src.rate})
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 5. Phễu chăm sóc & chốt đơn */}
          <div className="flex min-h-0 min-w-0 flex-col rounded-xl border border-border bg-card text-card-foreground p-3 shadow-sm lg:flex-1 lg:min-h-0">
            <h3 className="mb-1.5 shrink-0 text-xs font-extrabold text-foreground sm:text-sm">
              Phễu chăm sóc & chốt đơn
            </h3>

            <div className="grid flex-1 min-h-0 grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_auto] overflow-y-auto [scrollbar-width:thin] pr-0.5">
              {/* Left Column: Funnel blocks */}
              <div className="min-w-0 flex flex-col justify-between py-0.5 gap-1 flex-1">
                {MOCK_FUNNEL_STEPS.map((step, idx) => {
                  const widths = ['w-full', 'w-[88%]', 'w-[76%]', 'w-[64%]', 'w-[52%]']
                  return (
                    <div key={idx} className="flex justify-center flex-1 min-h-[22px] max-h-[32px]">
                      <div
                        className={cn(
                          'flex flex-col items-center justify-center h-full text-white rounded bg-gradient-to-r text-center px-1.5 shadow-sm',
                          widths[idx],
                          step.bg
                        )}
                      >
                        <span className="text-[7.5px] sm:text-[8px] font-bold opacity-90 uppercase tracking-wide leading-none">
                          {step.name}
                        </span>
                        <span className="text-[9px] sm:text-[10px] font-black tabular-nums mt-0.5 leading-none">
                          {formatNumber(step.count)}{' '}
                          <span className="text-[8px] font-normal opacity-80">
                            ({step.percent})
                          </span>
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Right Column: Connection arrows */}
              <div className="relative flex shrink-0 flex-row flex-wrap items-center justify-center gap-1.5 border-t border-border pt-1.5 lg:flex-col lg:justify-around lg:border-l lg:border-t-0 lg:py-1.5 lg:pl-1.5 lg:pt-0">
                <div className="absolute left-0 top-0 hidden h-full w-px bg-gradient-to-b from-blue-200 via-purple-200 to-emerald-200 lg:block" />
                {MOCK_FUNNEL_CONVERSIONS.map((conv, idx) => (
                  <div
                    key={idx}
                    className="relative z-10 flex items-center gap-1 rounded bg-card text-card-foreground py-0.5 lg:-ml-[10px]"
                  >
                    <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-sm">
                      <ChevronRight className="h-2 w-2 rotate-90" />
                    </div>
                    <div className="flex flex-col text-[10px]">
                      <span className="text-[7px] font-bold text-n-400 dark:text-n-500 uppercase tracking-wider leading-none">
                        Chuyển
                      </span>
                      <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 leading-none mt-0.5">
                        {conv.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 6. Từ khóa nổi bật */}
          <div className="flex min-h-0 min-w-0 flex-col rounded-xl border border-border bg-card text-card-foreground p-3 shadow-sm lg:flex-1 lg:min-h-0">
            <h3 className="mb-1.5 shrink-0 text-xs font-extrabold text-foreground sm:text-sm">
              Từ khóa nổi bật
            </h3>

            <div className="grid flex-1 min-h-0 grid-cols-2 gap-1.5 overflow-y-auto [scrollbar-width:thin] align-content-start py-0.5">
              {MOCK_KEYWORDS.map((kw, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded border border-border bg-n-50 dark:bg-n-900 px-1.5 h-6.5 text-[10px] font-bold text-n-600 dark:text-n-300 shadow-sm"
                >
                  <span className="text-n-400 dark:text-n-500 font-bold shrink-0 mr-1 flex items-center text-ellipsis overflow-hidden">
                    #{' '}
                    <span className="text-n-600 dark:text-n-300 font-bold ml-0.5 truncate max-w-[50px]">
                      {kw.text}
                    </span>
                  </span>
                  <span className="text-foreground font-black tabular-nums shrink-0">
                    {kw.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ================= COLUMN 3 ================= */}
        <div className="flex min-h-0 flex-col gap-2 sm:gap-2.5 lg:h-full">
          {/* 7. Top sản phẩm */}
          <div className="flex min-h-0 min-w-0 flex-col rounded-xl border border-border bg-card text-card-foreground p-3 shadow-sm lg:flex-1 lg:min-h-0">
            <div className="mb-1.5 flex shrink-0 flex-wrap items-center justify-between gap-2">
              <h3 className="min-w-0 text-xs font-extrabold text-foreground sm:text-sm">
                Top sản phẩm
              </h3>
              <span className="text-[10px] font-bold text-primary cursor-pointer hover:underline">
                Tất cả
              </span>
            </div>

            <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin] pr-0.5 py-0.5">
              {MOCK_TOP_PRODUCTS.map((p, index) => {
                const bgColors = [
                  'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
                  'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
                  'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
                  'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20',
                  'bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20',
                ]
                const progressColors = [
                  'bg-purple-500',
                  'bg-amber-500',
                  'bg-blue-500',
                  'bg-cyan-500',
                  'bg-pink-500',
                ]
                const percentageFill = Math.round((p.count / 1125) * 100)

                return (
                  <div key={p.id} className="space-y-0.5 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 min-w-0">
                        <span
                          className={cn(
                            'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded text-[9px] font-black',
                            bgColors[index]
                          )}
                        >
                          {p.id}
                        </span>
                        <span className="truncate font-semibold text-n-700 dark:text-n-300">{p.name}</span>
                      </div>
                      <span className="shrink-0 font-bold text-foreground">
                        {formatNumber(p.count)}{' '}
                        <span className="text-n-400 dark:text-n-500 font-medium text-[9px]">
                          ({p.percent}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-n-100 dark:bg-n-900">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          progressColors[index]
                        )}
                        style={{ width: `${percentageFill}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 8. Khách hàng cần chăm sóc */}
          <div className="flex min-h-0 min-w-0 flex-col rounded-xl border border-border bg-card text-card-foreground p-3 shadow-sm lg:flex-1 lg:min-h-0">
            <h3 className="mb-1.5 shrink-0 text-xs font-extrabold text-foreground sm:text-sm">
              Khách hàng cần chăm sóc
            </h3>

            <div className="grid flex-1 min-h-0 grid-cols-1 gap-1.5 overflow-y-auto [scrollbar-width:thin] pr-0.5 py-0.5">
              {MOCK_CUSTOMERS_TO_CARE.map((item) => {
                let IconComponent = Search
                let cardClasses = ''
                let iconClasses = ''
                let countClasses = ''
                if (item.type === 'warranty') {
                  IconComponent = ShieldCheck
                  cardClasses = 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20 text-foreground'
                  iconClasses = 'bg-card border-emerald-500/30 text-emerald-600 dark:text-emerald-450'
                  countClasses = 'text-emerald-600 dark:text-emerald-450'
                } else if (item.type === 'unclosed') {
                  IconComponent = Clock3
                  cardClasses = 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/20 text-foreground'
                  iconClasses = 'bg-card border-amber-500/30 text-amber-600 dark:text-amber-450'
                  countClasses = 'text-amber-600 dark:text-amber-450'
                } else if (item.type === 'negative') {
                  IconComponent = Frown
                  cardClasses = 'bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/20 text-foreground'
                  iconClasses = 'bg-card border-rose-500/30 text-rose-600 dark:text-rose-450'
                  countClasses = 'text-rose-600 dark:text-rose-450'
                } else {
                  IconComponent = Search
                  cardClasses = 'bg-blue-500/5 dark:bg-blue-500/10 border-blue-500/20 text-foreground'
                  iconClasses = 'bg-card border-blue-500/30 text-blue-600 dark:text-blue-450'
                  countClasses = 'text-blue-600 dark:text-blue-450'
                }

                return (
                  <div
                    key={item.id}
                    className={cn(
                      'flex items-center justify-between rounded-lg border p-1.5 shadow-sm transition duration-200 h-[34px] shrink-0',
                      cardClasses
                    )}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div
                        className={cn(
                          'flex h-5.5 w-5.5 items-center justify-center rounded shadow-sm border shrink-0',
                          iconClasses
                        )}
                      >
                        <IconComponent className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-[10px] font-bold text-n-700 dark:text-n-300 truncate">
                        {item.label}
                      </span>
                    </div>
                    <span className={cn('text-sm font-black tabular-nums shrink-0', countClasses)}>
                      {item.count}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 9. Xu hướng cảm xúc (CSAT) */}
          <div className="flex min-h-0 min-w-0 flex-col rounded-xl border border-border bg-card text-card-foreground p-3 shadow-sm lg:flex-1 lg:min-h-0">
            <div className="mb-1 flex shrink-0 items-center justify-between gap-2">
              <h3 className="text-xs font-extrabold text-foreground sm:text-sm">Xu hướng cảm xúc</h3>
            </div>

            {/* Custom CSAT Legend */}
            <div className="mb-1 flex shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[8px] font-bold text-n-500 dark:text-n-400">
              <div className="flex items-center gap-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>Tích cực</span>
              </div>
              <div className="flex items-center gap-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span>Trung tính</span>
              </div>
              <div className="flex items-center gap-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                <span>Tiêu cực</span>
              </div>
            </div>

            {/* CSAT Stacked Bar Chart */}
            <div className="w-full flex-1 min-h-[75px] h-[90px] sm:h-[100px] lg:h-auto">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={MOCK_SENTIMENT_TRENDS}
                  margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 8, fontWeight: 500, fill: 'var(--n-400)' }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 8, fontWeight: 500, fill: 'var(--n-400)' }}
                    unit="%"
                  />
                  <Tooltip cursor={{ fill: 'var(--n-50)' }} />
                  <Bar
                    dataKey="positive"
                    name="Tích cực"
                    stackId="a"
                    fill="#10b981"
                    barSize={10}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="neutral"
                    name="Trung tính"
                    stackId="a"
                    fill="#f59e0b"
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="negative"
                    name="Tiêu cực"
                    stackId="a"
                    fill="#ef4444"
                    radius={[2, 2, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ================= COLUMN 4 ================= */}
        <div className="flex min-h-0 flex-col gap-2 sm:gap-2.5 lg:h-full">
          {/* 10. Xếp hạng nhân viên */}
          <div className="flex min-h-0 min-w-0 flex-col rounded-xl border border-border bg-card text-card-foreground p-3 shadow-sm lg:flex-1 lg:min-h-0">
            <div className="mb-1.5 flex shrink-0 items-center justify-between gap-2">
              <h3 className="text-xs font-extrabold text-foreground sm:text-sm">
                Xếp hạng nhân viên
              </h3>
              <span className="text-[10px] font-bold text-primary cursor-pointer hover:underline">
                Tất cả
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto [scrollbar-width:thin]">
              <table className="w-full min-w-[240px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border text-[9px] font-bold text-n-400 dark:text-n-500 uppercase tracking-wider sticky top-0 bg-card z-10">
                    <th className="pb-1 text-center font-black w-5">#</th>
                    <th className="pb-1 font-black">Nhân viên</th>
                    <th className="pb-1 text-center font-black">QA</th>
                    <th className="pb-1 text-right font-black">Chốt</th>
                    <th className="pb-1 text-right font-black">Hội thoại</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {MOCK_STAFF_RANKING.map((staff, idx) => (
                    <tr key={idx} className="text-[11px]">
                      <td className="py-1 text-center font-black text-n-400 dark:text-n-500">{staff.rank}</td>
                      <td className="py-1 font-bold text-n-700 dark:text-n-300 flex items-center gap-1 min-w-0">
                        <div className="h-5 w-5 rounded-full bg-gradient-to-br from-indigo-50 to-purple-500 text-[9px] font-black text-white flex items-center justify-center shrink-0">
                          {staff.avatar}
                        </div>
                        <span className="truncate flex items-center gap-0.5 min-w-0">
                          <span className="truncate">{staff.name}</span>
                          {staff.hasTrophy && <span className="shrink-0 text-[10px]">🏆</span>}
                        </span>
                      </td>
                      <td className="py-1 text-center">
                        <span className="inline-flex min-w-[22px] items-center justify-center rounded bg-emerald-500/10 px-1 py-0.5 text-[9px] font-black text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {staff.qaScore}
                        </span>
                      </td>
                      <td className="py-1 text-right font-semibold text-n-800 dark:text-n-200 tabular-nums">
                        {staff.conversionRate}
                      </td>
                      <td className="py-1 text-right font-semibold text-n-800 dark:text-n-200 tabular-nums">
                        {formatNumber(staff.conversations)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 11. Hoạt động gần đây */}
          <div className="flex min-h-0 min-w-0 flex-col rounded-xl border border-border bg-card text-card-foreground p-3 shadow-sm lg:flex-1 lg:min-h-0">
            <div className="mb-1.5 flex shrink-0 items-center justify-between gap-2">
              <h3 className="text-xs font-extrabold text-foreground sm:text-sm">
                Hoạt động gần đây
              </h3>
              <span className="text-[10px] font-bold text-primary cursor-pointer hover:underline">
                Tất cả
              </span>
            </div>

            {/* Timeline Feed Container */}
            <div className="space-y-2 flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin] pr-0.5 py-0.5">
              {MOCK_RECENT_ACTIVITIES.slice(0, 4).map((act, index, arr) => {
                let dotColor = 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400'
                if (act.type === 'unclosed')
                  dotColor = 'border-amber-450 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                else if (act.type === 'closed-order' || act.type === 'warranty')
                  dotColor = 'border-emerald-450 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                else if (act.type === 'negative')
                  dotColor = 'border-rose-450 bg-rose-500/10 text-rose-600 dark:text-rose-400'

                return (
                  <div
                    key={index}
                    className="relative flex min-h-0 items-start gap-1.5 pl-3 text-[10.5px]"
                  >
                    {/* Vertical line connecting timeline nodes */}
                    {index < arr.length - 1 && (
                      <div className="absolute bottom-[-6px] left-[3.5px] top-[10px] w-px bg-border" />
                    )}
                    {/* Circle dot node */}
                    <div
                      className={cn(
                        'absolute left-0 top-[2px] flex h-2 w-2 shrink-0 items-center justify-center rounded-full border bg-card',
                        dotColor
                      )}
                    />

                    {/* Right hand description layout */}
                    <div className="min-w-0 flex-1">
                      <span className="text-[8px] font-bold tabular-nums text-n-400 dark:text-n-500">
                        {act.time}
                      </span>
                      <p className="mt-0.5 line-clamp-1 font-semibold leading-snug tracking-tight text-n-600 dark:text-n-400">
                        {/* Highlight specific sections in bold */}
                        {act.label.includes('#') ? (
                          <>
                            {act.label
                              .split(/(#\w+|\d+\s*điểm|\d+(?:\.\d+)*đ)/g)
                              .map((part, pidx) => {
                                if (
                                  part.startsWith('#') ||
                                  part.includes('điểm') ||
                                  part.includes('đ')
                                ) {
                                  return (
                                    <span
                                      key={pidx}
                                      className="font-extrabold text-foreground bg-n-100 dark:bg-n-900 px-0.5 py-0.2 rounded text-[10px]"
                                    >
                                      {part}
                                    </span>
                                  )
                                }
                                return part
                              })}
                          </>
                        ) : act.label.includes('khách') ? (
                          <>
                            {act.label.split(/(\d+\s*khách)/g).map((part, pidx) => {
                              if (part.includes('khách')) {
                                  return (
                                    <span
                                      key={pidx}
                                      className="font-extrabold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-0.5 py-0.2 rounded text-[10px]"
                                    >
                                      {part}
                                    </span>
                                  )
                              }
                              return part
                            })}
                          </>
                        ) : act.label.includes('tiêu cực') ? (
                          <>
                            {act.label.split(/(3\s*hội thoại)/g).map((part, pidx) => {
                              if (part.includes('hội thoại')) {
                                  return (
                                    <span
                                      key={pidx}
                                      className="font-extrabold text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-500/10 px-0.5 py-0.2 rounded text-[10px]"
                                    >
                                      {part}
                                    </span>
                                  )
                              }
                              return part
                            })}
                          </>
                        ) : (
                          act.label
                        )}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ConfigTab() {
  const qc = useQueryClient()
  const { data, isLoading, refetch } = useQuery<CskhPagesResponse>({
    queryKey: ['cskh', 'pages'],
    queryFn: () => fetchCskhPages(),
  })

  const refreshMut = useMutation({
    mutationFn: refreshCskhOAuth,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cskh'] }),
  })

  const syncMut = useMutation({
    mutationFn: syncInboxFromGraph,
    onSuccess: (res) => {
      if (isAsyncInboxSync(res)) {
        toast.info(res.message || 'Đang đồng bộ nền — làm mới danh sách sau vài phút')
      } else {
        toast.success(`Đã đồng bộ thành công ${res.synced} tin nhắn từ ${res.pageCount} kênh!`)
      }
      qc.invalidateQueries({ queryKey: ['cskh'] })
    },
    onError: () => {
      toast.error('Đồng bộ tin nhắn thất bại. Vui lòng thử lại!')
    },
  })

  const togglePageMut = useMutation({
    mutationFn: (variables: { pageId: string; enabled: boolean }) =>
      setCskhPageEnabled(variables.pageId, variables.enabled),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cskh'] })
    },
  })

  const handleTogglePage = (pageId: string, enabled: boolean) => {
    togglePageMut.mutate({ pageId, enabled })
  }

  const pages = data?.pages ?? []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-n-500">
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Đang tải cấu hình…
      </div>
    )
  }

  return (
    <div className="space-y-5 p-5 sm:p-6 bg-background text-foreground">
      <div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 p-6 text-white shadow-lg">
          <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                <Link2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Kết nối Facebook</h3>
                <p className="text-sm text-blue-100">OAuth Meta — token Page bạn quản trị</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={getCskhOAuthStartUrl()}
                className="inline-flex items-center gap-2 rounded-xl bg-card px-4 py-2.5 text-sm font-semibold text-blue-650 dark:text-blue-400 shadow-md transition hover:bg-muted"
              >
                <Link2 className="h-4 w-4" /> Kết nối Facebook
              </a>
              <button
                type="button"
                disabled={!data?.oauthConnected || refreshMut.isPending}
                onClick={() => refreshMut.mutate()}
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-medium backdrop-blur transition hover:bg-white/20 disabled:opacity-50"
              >
                {refreshMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Cập nhật kết nối Facebook
              </button>
              <button
                type="button"
                disabled={!data?.oauthConnected || syncMut.isPending}
                onClick={() => syncMut.mutate(undefined)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-medium backdrop-blur transition hover:bg-white/20 disabled:opacity-50"
              >
                {syncMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Đồng bộ tin nhắn
              </button>
            </div>
            {data?.oauthConnected ? (
              <div className="flex items-start gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm backdrop-blur">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <div>
                  <p>
                    Đã kết nối: <strong>{data.oauthUser}</strong>
                  </p>
                  {data.oauthUpdatedAt && (
                    <p className="mt-0.5 text-xs text-blue-100">
                      Cập nhật {new Date(data.oauthUpdatedAt).toLocaleString('vi-VN')}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-blue-100">Chưa kết nối — bấm nút trên để bắt đầu.</p>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
        <div className="border-b border-border bg-n-50 dark:bg-n-900 px-5 py-4">
          <h3 className="font-semibold text-foreground">Facebook Pages</h3>
          {pages.length ? (
            <p className="mt-0.5 text-xs text-n-500 dark:text-n-400">
              {pages.length.toLocaleString('vi-VN')} Page đã kết nối — chọn kênh khi chấm điểm ở tab
              Chấm điểm. Bật kênh để tải và hiển thị cuộc hội thoại.
            </p>
          ) : null}
        </div>

        {!pages.length ? (
          <p className="p-8 text-center text-sm text-n-500 dark:text-n-400">
            Chưa có Page — kết nối Facebook ở trên.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {pages.map((p) => (
              <li
                key={p.pageId}
                className="flex items-center justify-between px-5 py-4 hover:bg-n-50/30 dark:hover:bg-n-900/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CskhPageAvatar
                    name={p.pageName || p.pageId}
                    pictureUrl={p.pagePictureUrl}
                    pageId={p.pageId}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">
                      {p.pageName || p.pageId}
                    </p>
                    <p className="truncate text-xs text-n-400 dark:text-n-500">ID: {p.pageId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-xs font-semibold ${p.enabled ? 'text-primary' : 'text-n-400 dark:text-n-500'}`}
                  >
                    {p.enabled ? 'Đang hoạt động' : 'Ngưng hoạt động'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={p.enabled}
                      onChange={(e) => handleTogglePage(p.pageId, e.target.checked)}
                      className="sr-only peer"
                      disabled={togglePageMut.isPending}
                    />
                    <div className="w-9 h-5 bg-n-200 dark:bg-n-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => void refetch()}
        className="text-sm font-medium text-primary hover:opacity-80"
      >
        Tải lại danh sách
      </button>
    </div>
  )
}

function SparklinePath({ data, stroke }: { data: number[]; stroke: string }) {
  const width = 60
  const height = 14
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width
      const y = height - ((val - min) / range) * height
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg className="w-16 h-4" width={width} height={height}>
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

function CircularProgress({
  score,
  label,
  color = '#10b981',
}: {
  score: number
  label: string
  color?: string
}) {
  const radius = 24
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (score / 100) * circumference
  return (
    <div className="relative flex items-center justify-center h-16 w-16">
      <svg className="transform -rotate-90 w-16 h-16">
        <circle
          cx="32"
          cy="32"
          r={radius}
          className="stroke-n-100 dark:stroke-n-800"
          strokeWidth="3.5"
          fill="transparent"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          stroke={color}
          strokeWidth="3.5"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
        <span className="text-[10px] font-black text-foreground leading-none">
          {score}
          <span className="text-[7px] font-bold text-n-400 dark:text-n-500">/100</span>
        </span>
        <span className="text-[7px] font-black text-emerald-600 dark:text-emerald-450 mt-0.5 uppercase tracking-wider scale-90 leading-none">
          {label}
        </span>
      </div>
    </div>
  )
}

const FB_PAGE_LIST_PAGE_SIZE = 5

function FbPageTab() {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTimeframe, setActiveTimeframe] = useState<'day' | 'week' | 'month'>('day')
  const [visiblePageCount, setVisiblePageCount] = useState(FB_PAGE_LIST_PAGE_SIZE)

  const { data, isLoading, isError, refetch } = useQuery<CskhPagesResponse>({
    queryKey: ['cskh', 'pages'],
    queryFn: () => fetchCskhPages(),
  })

  const connectedPages = data?.pages ?? []

  const pageRows = useMemo(() => mapConnectedPagesToTableRows(connectedPages), [connectedPages])

  const filteredPages = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return pageRows
    return pageRows.filter(
      (page) => page.name.toLowerCase().includes(q) || page.pageId.toLowerCase().includes(q)
    )
  }, [pageRows, searchTerm])

  useEffect(() => {
    setVisiblePageCount(FB_PAGE_LIST_PAGE_SIZE)
  }, [searchTerm, filteredPages.length])

  const visiblePages = useMemo(
    () => filteredPages.slice(0, visiblePageCount),
    [filteredPages, visiblePageCount]
  )

  const remainingPageCount = Math.max(0, filteredPages.length - visiblePageCount)
  const canLoadMorePages = remainingPageCount > 0

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center bg-n-100 dark:bg-n-950 p-6 font-sans text-n-500">
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
        Đang tải danh sách Page…
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-col gap-2 overflow-x-hidden bg-n-100 dark:bg-n-950 p-2 pb-4 font-sans sm:gap-2.5 sm:p-3 sm:pb-5">
      {/* Header and Filter Row */}
      <div className="shrink-0 border-b border-border pb-2.5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md">
                <Facebook className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-black tracking-tight text-foreground sm:text-xl">
                  Page (Facebook)
                </h2>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-n-500 dark:text-n-400">
                  Quản lý và đánh giá hiệu suất tất cả page Facebook
                  {connectedPages.length > 0 ? (
                    <span className="ml-1.5 normal-case text-primary">
                      · {connectedPages.length} kênh đã kết nối
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <div className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 font-bold text-foreground shadow-sm transition hover:bg-muted">
              <span>01/05/2026 - 31/05/2026</span>
              <span className="text-n-400 dark:text-n-500">📅</span>
            </div>
            <div className="flex cursor-pointer items-center gap-1 border border-border bg-card px-2.5 py-1.5 font-bold text-foreground shadow-sm transition hover:bg-muted">
              <span>Tất cả team</span>
              <ChevronDown className="h-3 w-3 text-n-400 dark:text-n-500" />
            </div>
            <div className="flex cursor-pointer items-center gap-1 border border-border bg-card px-2.5 py-1.5 font-bold text-foreground shadow-sm transition hover:bg-muted">
              <span>Bộ lọc</span>
              <ChevronDown className="h-3 w-3 text-n-400 dark:text-n-500" />
            </div>
            <div className="flex items-center gap-1 px-1.5 py-1 font-bold text-n-400 dark:text-n-500">
              <span className="mr-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              <span>
                Cập nhật lúc{' '}
                {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {isError ? (
        <div className="rounded-xl border border-danger-100 bg-danger-50 dark:bg-danger-500/10 px-4 py-3 text-sm text-danger-600 dark:text-danger-400">
          Không tải được danh sách Page.{' '}
          <button type="button" onClick={() => refetch()} className="font-semibold underline">
            Thử lại
          </button>
        </div>
      ) : null}

      {!data?.oauthConnected ? (
        <div className="rounded-xl border border-warning-100 bg-warning-50 dark:bg-warning-500/10 px-4 py-3 text-sm text-warning-600 dark:text-warning-400">
          Chưa kết nối Facebook.{' '}
          <Link
            to="/quality?tab=config"
            className="font-semibold text-primary underline"
          >
            Vào Cài đặt Kênh
          </Link>{' '}
          để kết nối Page.
        </div>
      ) : null}

      {/* Row 1: KPI-Karten (5 cards + 1 gauge) */}
      <div className="shrink-0 space-y-2">
        <h3 className="text-xs font-extrabold tracking-tight text-foreground sm:text-sm">
          Tổng quan hiệu suất toàn bộ Page
        </h3>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 2xl:grid-cols-6">
          {MOCK_FB_KPI_CARDS.map((card) => (
            <div
              key={card.id}
              className="flex min-w-0 flex-col justify-between rounded-xl border border-border bg-card text-card-foreground p-2.5 shadow-sm transition duration-200 hover:shadow-md"
            >
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-n-400 dark:text-n-500">
                  {card.label}
                </span>
                <h3 className="mt-1 text-lg font-black leading-none tracking-tight text-foreground sm:text-xl">
                  {card.value}
                </h3>
              </div>
              <div className="mt-1 space-y-0.5">
                <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-black leading-none text-emerald-600 dark:text-emerald-450">
                  {card.trend}
                </span>
                <p className="truncate text-[9px] font-bold text-n-400 dark:text-n-500">{card.comparison}</p>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between rounded-xl border border-border bg-card text-card-foreground p-2.5 shadow-sm transition duration-200 hover:shadow-md">
            <div className="min-w-0">
              <span className="block truncate text-[9px] font-bold uppercase tracking-wider text-n-400 dark:text-n-500">
                Chất lượng (AI)
              </span>
              <span className="mt-1 inline-block rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-600 dark:text-emerald-450">
                Đạt 92/100
              </span>
            </div>
            <div className="shrink-0 scale-90">
              <CircularProgress score={92} label="Rất tốt" color="#10b981" />
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Bottom layout (Left: 70% | Right: 30%) */}
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-12">
        {/* Left Side */}
        <div className="space-y-2 xl:col-span-8">
          {/* Table Card (Danh sách Page Facebook) */}
          <div className="flex flex-col rounded-xl border border-border bg-card text-card-foreground p-3.5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-extrabold text-foreground sm:text-sm">
                  Danh sách Page Facebook
                </h3>
                <p className="text-[10px] font-medium text-n-500 dark:text-n-400">
                  Lấy từ kênh đã kết nối ở Cài đặt Kênh
                  {filteredPages.length > 0 ? (
                    <span className="ml-1 text-n-400 dark:text-n-500">
                      · Hiển thị {visiblePages.length}/{filteredPages.length}
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-n-400 dark:text-n-500" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm kiếm page..."
                    className="w-[130px] rounded-lg border border-border bg-card py-1.5 pl-7 pr-2 text-[11px] font-bold shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring sm:w-[160px]"
                  />
                </div>
                <div className="flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-n-50 dark:bg-n-900 px-2 py-1.5 text-[10px] font-bold text-n-500 dark:text-n-400 transition hover:bg-n-100 dark:hover:bg-n-800">
                  <span>Tháng này</span>
                  <ChevronDown className="h-3 w-3" />
                </div>
                <button
                  type="button"
                  title="Tải báo cáo"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card transition hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5 text-n-500 dark:text-n-400" />
                </button>
              </div>
            </div>

            {!connectedPages.length ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-n-500 dark:text-n-400">
                <p>Chưa có Page nào được kết nối.</p>
                <Link
                  to="/quality?tab=config"
                  className="font-semibold text-primary underline"
                >
                  Thêm kênh tại Cài đặt Kênh
                </Link>
              </div>
            ) : (
              <>
                <div className="min-h-0 overflow-x-auto [scrollbar-width:thin]">
                  <table className="w-full min-w-[740px] border-separate border-spacing-y-2.5 text-left">
                    <thead>
                      <tr className="text-[10px] font-bold uppercase tracking-wider text-n-450 dark:text-n-500">
                        <th className="px-2 pb-3 font-black">Page</th>
                        <th className="px-2 pb-3 text-center font-black">Trạng thái</th>
                        <th className="px-2 pb-3 text-right font-black">Tổng tin nhắn</th>
                        <th className="px-2 pb-3 text-right font-black">Tin nhắn từ QC</th>
                        <th className="px-2 pb-3 text-center font-black">% từ QC</th>
                        <th className="px-2 pb-3 text-right font-black">Tỷ lệ phản hồi</th>
                        <th className="px-2 pb-3 text-right font-black">Tỷ lệ chốt</th>
                        <th className="px-2 pb-3 text-right font-black">Doanh thu</th>
                        <th className="px-2 pb-3 text-center font-black">Chất lượng (AI)</th>
                        <th className="px-2 pb-3 text-center font-black">Xu hướng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePages.map((page) => {
                        const isInactive = page.status === 'inactive'
                        return (
                          <tr
                            key={page.pageId}
                            className="text-xs transition hover:bg-n-50/60 dark:hover:bg-n-900/60 [&>td]:border-y [&>td]:border-border [&>td:first-child]:rounded-l-xl [&>td:first-child]:border-l [&>td:first-child]:border-border [&>td:last-child]:rounded-r-xl [&>td:last-child]:border-r [&>td:last-child]:border-border"
                          >
                            <td className="flex max-w-[210px] min-w-0 items-center gap-3 bg-card px-3 py-4 font-bold text-n-700 dark:text-n-300">
                              <CskhPageAvatar
                                name={page.name}
                                pictureUrl={page.pictureUrl}
                                pageId={page.pageId}
                                className="h-9 w-9 shrink-0 rounded-full text-[11px]"
                              />
                              <div className="min-w-0 leading-snug">
                                <span className="block truncate text-[13px] font-black text-foreground">
                                  {page.name}
                                </span>
                                <span className="mt-1 block truncate text-[10px] font-bold text-n-400 dark:text-n-500">
                                  ID: {page.pageId}
                                </span>
                              </div>
                            </td>

                            {/* Status Badge */}
                            <td className="bg-card px-2 py-4 text-center">
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold',
                                  isInactive
                                    ? 'bg-n-50 text-n-400 border-border dark:bg-n-900'
                                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                )}
                              >
                                {isInactive ? 'Ngừng hoạt động' : 'Đang hoạt động'}
                              </span>
                            </td>

                            {/* Metrics with mini-trends below */}
                            <td className="bg-card px-2 py-4 text-right">
                              <span className="block text-[13px] font-black leading-snug text-foreground">
                                {formatNumber(page.totalMsg)}
                              </span>
                              <span
                                className={cn(
                                  'mt-1.5 block text-[10px] font-bold leading-snug',
                                  page.totalTrend.includes('↓')
                                    ? 'text-danger-600 dark:text-danger-400'
                                    : 'text-emerald-650 dark:text-emerald-400'
                                )}
                              >
                                {page.totalTrend}
                              </span>
                            </td>

                            <td className="bg-card px-2 py-4 text-right">
                              <span className="block text-[13px] font-black leading-snug text-foreground">
                                {formatNumber(page.adMsg)}
                              </span>
                              <span
                                className={cn(
                                  'mt-1.5 block text-[10px] font-bold leading-snug',
                                  page.adTrend.includes('↓') ? 'text-danger-600 dark:text-danger-400' : 'text-emerald-650 dark:text-emerald-400'
                                )}
                              >
                                {page.adTrend}
                              </span>
                            </td>

                            {/* % from ads */}
                            <td className="bg-card px-2 py-4 text-center text-[13px] font-extrabold tabular-nums text-foreground">
                              {page.adPercent}
                            </td>

                            {/* Response Rate */}
                            <td className="bg-card px-2 py-4 text-right">
                              <span className="block text-[13px] font-black leading-snug text-foreground">
                                {page.responseRate}
                              </span>
                              <span
                                className={cn(
                                  'mt-1.5 block text-[10px] font-bold leading-snug',
                                  page.responseTrend.includes('↓')
                                    ? 'text-danger-600 dark:text-danger-400'
                                    : 'text-emerald-655 dark:text-emerald-400'
                                )}
                              >
                                {page.responseTrend}
                              </span>
                            </td>

                            {/* Closing Rate */}
                            <td className="bg-card px-2 py-4 text-right">
                              <span className="block text-[13px] font-black leading-snug text-foreground">
                                {page.closingRate}
                              </span>
                              <span
                                className={cn(
                                  'mt-1.5 block text-[10px] font-bold leading-snug',
                                  page.closingTrend.includes('↓')
                                    ? 'text-danger-600 dark:text-danger-400'
                                    : 'text-emerald-655 dark:text-emerald-400'
                                )}
                              >
                                {page.closingTrend}
                              </span>
                            </td>

                            {/* Revenue */}
                            <td className="bg-card px-2 py-4 text-right">
                              <span className="block text-[13px] font-black leading-snug text-foreground">
                                {page.revenue}
                              </span>
                              <span
                                className={cn(
                                  'mt-1.5 block text-[10px] font-bold leading-snug',
                                  page.revenueTrend.includes('↓')
                                    ? 'text-danger-600 dark:text-danger-400'
                                    : 'text-emerald-655 dark:text-emerald-400'
                                )}
                              >
                                {page.revenueTrend}
                              </span>
                            </td>

                            {/* AI Quality badge */}
                            <td className="bg-card px-2 py-4 text-center">
                              <span
                                className={cn(
                                  'inline-flex min-w-[32px] items-center justify-center rounded-full border px-2.5 py-1 text-[11px] font-black',
                                  page.quality >= 85
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                    : page.quality >= 75
                                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                      : 'bg-danger-50 dark:bg-danger-500/10 text-danger-600 dark:text-danger-400 border-danger-100 dark:border-danger-500/20'
                                )}
                              >
                                {page.quality}
                              </span>
                            </td>

                            {/* Xu hướng Sparkline */}
                            <td className="bg-card px-2 py-4 text-center">
                              <div className="flex justify-center py-0.5">
                                <SparklinePath
                                  data={page.trendData}
                                  stroke={page.isPositiveTrend ? '#10b981' : '#ef4444'}
                                />
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {canLoadMorePages ? (
                  <div className="mt-2 flex justify-center border-t border-border pt-2.5">
                    <button
                      type="button"
                      onClick={() => setVisiblePageCount((count) => count + FB_PAGE_LIST_PAGE_SIZE)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-n-100 dark:bg-n-900 px-4 py-2 text-xs font-bold text-foreground transition hover:bg-muted"
                    >
                      Xem thêm
                      <span className="font-black">
                        {Math.min(remainingPageCount, FB_PAGE_LIST_PAGE_SIZE)} kênh
                      </span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : filteredPages.length > FB_PAGE_LIST_PAGE_SIZE ? (
                  <p className="mt-2 border-t border-border pt-2 text-center text-[10px] font-medium text-n-400 dark:text-n-500">
                    Đã hiển thị tất cả {filteredPages.length} kênh
                  </p>
                ) : null}
              </>
            )}
          </div>

          {/* Grid for Message LineChart & Donut Chart */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {/* Biểu đồ tin nhắn */}
            <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-3 shadow-sm text-card-foreground">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-extrabold text-foreground sm:text-sm">
                  Biểu đồ tin nhắn
                </h3>
                {/* Timeframe tab selector */}
                <div className="flex bg-n-100 dark:bg-n-900 p-0.5 rounded-lg text-[10px] font-black text-n-500 dark:text-n-400">
                  <span
                    onClick={() => setActiveTimeframe('day')}
                    className={cn(
                      'px-2 py-1 rounded-md cursor-pointer transition',
                      activeTimeframe === 'day'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'hover:text-foreground'
                    )}
                  >
                    Ngày
                  </span>
                  <span
                    onClick={() => setActiveTimeframe('week')}
                    className={cn(
                      'px-2 py-1 rounded-md cursor-pointer transition',
                      activeTimeframe === 'week'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'hover:text-foreground'
                    )}
                  >
                    Tuần
                  </span>
                  <span
                    onClick={() => setActiveTimeframe('month')}
                    className={cn(
                      'px-2 py-1 rounded-md cursor-pointer transition',
                      activeTimeframe === 'month'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'hover:text-foreground'
                    )}
                  >
                    Tháng
                  </span>
                </div>
              </div>

              {/* Legend matching screenshot */}
              <div className="flex items-center gap-4 text-[10px] font-bold text-n-400 dark:text-n-500 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  <span>Tổng tin nhắn</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Tin nhắn từ quảng cáo</span>
                </div>
              </div>

              {/* Message Chart */}
              <div className="h-[130px] w-full sm:h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={MOCK_FB_MESSAGE_TREND}
                    margin={{ top: 10, right: 5, left: -25, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 9, fontWeight: 500, fill: 'var(--n-400)' }}
                    />
                    <YAxis
                      domain={[0, 'auto']}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 9, fontWeight: 500, fill: 'var(--n-400)' }}
                    />
                    <Tooltip cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="Tổng tin nhắn"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: 2.5 }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="ad"
                      name="Tin nhắn từ quảng cáo"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ r: 2.5 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tỷ lệ tin nhắn từ quảng cáo Donut */}
            <div className="flex flex-col rounded-xl border border-border bg-card p-3 shadow-sm text-card-foreground">
              <h3 className="mb-2 text-xs font-extrabold text-foreground sm:text-sm">
                Tỷ lệ tin nhắn từ quảng cáo
              </h3>

              <div className="flex flex-col items-center justify-around gap-3 min-[420px]:flex-row">
                {/* Donut chart */}
                <div className="relative flex h-[120px] w-[120px] shrink-0 items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={MOCK_FB_SOURCE_PIE}
                        innerRadius={42}
                        outerRadius={58}
                        paddingAngle={3}
                        dataKey="value"
                        isAnimationActive={false}
                      >
                        {MOCK_FB_SOURCE_PIE.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-2xl font-black text-foreground leading-none">60.8%</span>
                    <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 mt-1 uppercase tracking-wider text-center max-w-[80px] leading-tight">
                      Tin nhắn từ quảng cáo
                    </span>
                  </div>
                </div>

                {/* Legend specs */}
                <div className="space-y-4 min-w-0">
                  {MOCK_FB_SOURCE_PIE.map((src, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-n-600 dark:text-n-400">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: src.color }}
                        />
                        <span className="truncate">{src.name}</span>
                      </div>
                      <p className="pl-4 font-black text-foreground text-xs">
                        {formatNumber(src.value)}
                        <span className="font-medium text-n-400 dark:text-n-500 ml-1.5">
                          ({idx === 0 ? '60.8%' : '39.2%'})
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side */}
        <div className="space-y-2 xl:col-span-4">
          {/* Hiệu suất tin nhắn từ quảng cáo */}
          <div className="flex flex-col rounded-xl border border-border bg-card p-2.5 shadow-sm text-card-foreground">
            <div className="mb-1.5 flex shrink-0 items-center justify-between gap-2">
              <h3 className="text-[11px] font-extrabold text-foreground">
                Hiệu suất tin nhắn từ quảng cáo
              </h3>
              <span className="cursor-pointer text-[10px] font-bold text-primary hover:underline">
                Chi tiết
              </span>
            </div>

            {/* Vertically stacked items */}
            <div className="space-y-1.5">
              {MOCK_FB_AD_METRICS.map((item) => {
                let iconComponent = <MessageCircle className="h-3.5 w-3.5" />
                let bgBox = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'

                if (item.id === 'ad-cost') {
                  iconComponent = <DollarSign className="h-3.5 w-3.5" />
                  bgBox = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                } else if (item.id === 'ad-cpm') {
                  iconComponent = <TrendingDown className="h-3.5 w-3.5" />
                  bgBox = 'bg-danger-100 dark:bg-danger-500/10 text-danger-600 dark:text-danger-400 border border-danger-500/20'
                } else if (item.id === 'ad-quality') {
                  iconComponent = <Award className="h-3.5 w-3.5" />
                  bgBox = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                }

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-border p-2 transition duration-150 hover:bg-muted"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                          bgBox
                        )}
                      >
                        {iconComponent}
                      </div>
                      <div className="min-w-0 leading-snug">
                        <span className="block truncate text-[9px] font-bold text-n-400 dark:text-n-500">
                          {item.label}
                        </span>
                        <span className="mt-0.5 block text-xs font-black leading-snug text-foreground">
                          {item.value}
                        </span>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[8px] font-black leading-none',
                        item.isPositive
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-danger-100 dark:bg-danger-500/10 text-danger-600 dark:text-danger-400 border-danger-100/20'
                      )}
                    >
                      {item.trend}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Blue Info Alerts Box */}
            <div className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-primary-200/20 bg-primary-100/10 p-2 text-[9px] font-bold text-n-600 dark:text-n-400 shadow-inner">
              <span className="scale-100 font-bold text-primary">💡</span>
              <p className="leading-relaxed">
                Tin nhắn từ quảng cáo chiếm <span className="font-black text-primary">60.8%</span>{' '}
                tổng tin nhắn và mang lại <span className="font-black text-primary">62.3%</span>{' '}
                doanh thu toàn bộ hệ thống.
              </p>
            </div>
          </div>

          {/* Top quảng cáo mang lại nhiều tin nhắn */}
          <div className="flex flex-col rounded-xl border border-border bg-card p-2.5 shadow-sm text-card-foreground">
            <div className="mb-1.5 flex shrink-0 items-center justify-between gap-2">
              <h3 className="text-[11px] font-extrabold text-foreground">
                Top quảng cáo mang lại nhiều tin nhắn
              </h3>
              <span className="cursor-pointer text-[10px] font-bold text-primary hover:underline">
                Xem tất cả
              </span>
            </div>

            {/* Item Rows with Thumbnails */}
            <div className="space-y-1.5">
              {MOCK_FB_TOP_ADS.map((ad, idx) => {
                const colors = [
                  'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400',
                  'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
                  'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
                  'bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400',
                  'bg-pink-500/10 border-pink-500/20 text-pink-600 dark:text-pink-400',
                ]
                return (
                  <div
                    key={ad.id}
                    className="flex items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-[11px]"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-sm shadow-inner',
                          colors[idx % colors.length]
                        )}
                      >
                        {ad.image}
                      </div>
                      <div className="min-w-0 leading-snug">
                        <span className="block truncate text-[10px] font-black text-foreground">
                          {ad.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[9px] font-bold text-n-400 dark:text-n-500">
                          {ad.page}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right leading-snug">
                      <span className="block text-[10px] font-black tabular-nums text-foreground">
                        {formatNumber(ad.messages)}
                      </span>
                      <span className="mt-0.5 block text-[9px] font-bold text-n-400 dark:text-n-500">
                        {ad.cost} <span className="text-[8px] font-medium">/tin</span>
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* AI Insight về Page */}
          <div className="flex flex-col rounded-xl border border-border bg-card p-2.5 shadow-sm text-card-foreground">
            <h3 className="mb-1.5 text-[11px] font-extrabold text-foreground">AI Insight về Page</h3>

            <div className="space-y-1.5">
              {MOCK_FB_AI_INSIGHTS.map((ins) => {
                let statusDotColor = 'bg-emerald-500'
                let bulletBg = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                let bulletIcon = '🌿'

                if (ins.type === 'info') {
                  statusDotColor = 'bg-blue-500'
                  bulletBg = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                  bulletIcon = '⭐'
                } else if (ins.type === 'warning') {
                  statusDotColor = 'bg-amber-500'
                  bulletBg = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  bulletIcon = '⚠️'
                } else if (ins.type === 'tip') {
                  statusDotColor = 'bg-purple-500'
                  bulletBg = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                  bulletIcon = '💡'
                }

                return (
                  <div
                    key={ins.id}
                    className="flex items-start gap-2 rounded-lg border border-border bg-n-50 dark:bg-n-900 p-1.5 text-[10px] transition hover:bg-muted"
                  >
                    <div
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold shadow-sm',
                        bulletBg
                      )}
                    >
                      {bulletIcon}
                    </div>

                    <p className="font-semibold leading-relaxed tracking-tight text-n-600 dark:text-n-400">
                      {ins.text
                        .split(
                          /(Vienchibao\s+\w+|VB\s+\w+|Nhẫn bạc Classic|\d+(?:\.\d+)?%|\d+\/\d+)/g
                        )
                        .map((part, pidx) => {
                          if (
                              part.startsWith('Vienchibao') ||
                              part.startsWith('VB') ||
                              part === 'Nhẫn bạc Classic' ||
                              part.includes('%') ||
                              part.includes('/')
                          ) {
                            return (
                              <span key={pidx} className="font-extrabold text-foreground">
                                {part}
                              </span>
                            )
                          }
                          return part
                        })}
                    </p>
                  </div>
                )
              })}
            </div>

            <div className="border-t border-border mt-4 pt-3 text-center shrink-0">
              <span className="text-xs font-black text-primary cursor-pointer hover:underline flex items-center justify-center gap-1">
                Xem tất cả insight <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductsTab() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')

  const filteredProducts = MOCK_PROD_LIST.filter((prod) => {
    const matchesSearch =
      prod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prod.code.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || prod.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto lg:overflow-hidden bg-n-100 dark:bg-n-950 p-2 pb-2 sm:gap-2.5 sm:p-3 font-sans">
      {/* Upper Title and Operational Overview Banner */}
      <div className="shrink-0 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm text-card-foreground">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
              Product Performance
            </p>
            <h2 className="mt-0.5 text-lg font-black tracking-tight text-foreground sm:text-xl">
              Hiệu suất sản phẩm
            </h2>
            <p className="mt-0.5 hidden max-w-3xl text-xs text-n-600 dark:text-n-400 lg:block">
              Quản lý, phân tích và đánh giá hiệu suất bán hàng của từng sản phẩm trên hệ thống.
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <div className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 font-bold text-foreground shadow-sm transition hover:bg-muted">
              <span>01/05/2026 - 31/05/2026</span>
              <span className="text-n-400 dark:text-n-500">📅</span>
            </div>
            <div className="flex cursor-pointer items-center gap-1 border border-border rounded-lg bg-card px-2.5 py-1.5 font-bold text-foreground shadow-sm transition hover:bg-muted">
              <span>Tất cả team</span>
              <ChevronDown className="h-3 w-3 text-n-400 dark:text-n-500" />
            </div>
            <div className="flex cursor-pointer items-center gap-1 border border-border rounded-lg bg-card px-2.5 py-1.5 font-bold text-foreground shadow-sm transition hover:bg-muted">
              <span>Bộ lọc</span>
              <ChevronDown className="h-3 w-3 text-n-400 dark:text-n-500" />
            </div>
            <div className="flex items-center gap-1 px-1.5 py-1 font-bold text-n-400 dark:text-n-500">
              <span className="mr-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              <span>Cập nhật lúc 10:30</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 1: KPI-Karten (6 cards) */}
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {MOCK_PROD_KPI_CARDS.map((card) => {
          let iconComponent = <Package className="h-4 w-4" />
          if (card.icon === 'message-square') iconComponent = <MessageSquare className="h-4 w-4" />
          if (card.icon === 'message-circle') iconComponent = <MessageCircle className="h-4 w-4" />
          if (card.icon === 'shopping-bag') iconComponent = <ShoppingBag className="h-4 w-4" />
          if (card.icon === 'dollar-sign') iconComponent = <DollarSign className="h-4 w-4" />
          if (card.icon === 'target') iconComponent = <Target className="h-4 w-4" />

          return (
            <div
              key={card.id}
              className="flex min-w-0 flex-col justify-between rounded-xl border border-border bg-card p-2 sm:p-2.5 shadow-sm transition duration-200 hover:shadow-md text-card-foreground"
            >
              {/* Top Title & Icon */}
              <div className="flex min-w-0 items-center gap-1.5">
                <div
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                    card.colors
                  )}
                >
                  {iconComponent}
                </div>
                <span className="min-w-0 text-[10px] font-bold uppercase tracking-wide text-n-500 dark:text-n-400 truncate block">
                  {card.label}
                </span>
              </div>

              {/* Value & Trend */}
              <div className="mt-1">
                <h3 className="text-base sm:text-lg lg:text-sm 2xl:text-lg font-black text-foreground tracking-tight leading-none mb-1">
                  {card.value}
                </h3>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.2 text-[9px] font-black text-emerald-600 dark:text-emerald-450 leading-none">
                    {card.trend}
                  </span>
                  <p className="text-[9px] text-n-400 dark:text-n-500 font-bold truncate">{card.comparison}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Row 2: Bottom layout (Left: 70% | Right: 30%) */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-10 gap-2 sm:gap-2.5">
        {/* Left Side (col-span-7) */}
        <div className="lg:col-span-7 flex min-h-0 flex-col gap-2 sm:gap-2.5 lg:h-full">
          {/* Table Card (Danh sách sản phẩm) */}
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm flex min-h-0 flex-1 flex-col text-card-foreground">
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap shrink-0">
              <div>
                <h3 className="font-extrabold text-foreground text-xs sm:text-sm">
                  Danh sách sản phẩm
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {/* Search box */}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-n-400 dark:text-n-500" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm kiếm..."
                    className="rounded-lg border border-border bg-card py-1 pl-6 pr-2.5 text-[10px] font-bold shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40 w-[120px] sm:w-[150px] text-foreground"
                  />
                </div>

                {/* Category selector */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="rounded-lg border border-border bg-n-100 dark:bg-n-900 py-1 px-2 text-[10px] font-bold text-n-500 dark:text-n-400 cursor-pointer focus:outline-none hover:bg-muted transition"
                >
                  <option value="all">Danh mục</option>
                  <option value="Nhẫn">Nhẫn</option>
                  <option value="Dây chuyền">Dây chuyền</option>
                  <option value="Lắc tay">Lắc tay</option>
                  <option value="Bông tai">Bông tai</option>
                  <option value="Vòng tay">Vòng tay</option>
                </select>

                {/* Status Selector */}
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="rounded-lg border border-border bg-n-100 dark:bg-n-900 py-1 px-2 text-[10px] font-bold text-n-500 dark:text-n-400 cursor-pointer focus:outline-none hover:bg-muted transition"
                >
                  <option value="all">Trạng thái</option>
                  <option value="hot">Bán chạy</option>
                  <option value="potential">Tiềm năng</option>
                </select>

                {/* Export Button */}
                <button
                  type="button"
                  className="flex items-center gap-1 border border-border bg-card px-2 py-1 rounded-lg text-[10px] font-bold text-n-600 dark:text-n-400 hover:bg-muted transition"
                >
                  <Download className="h-3 w-3 text-n-500" />
                  <span>Xuất</span>
                </button>
              </div>
            </div>

            {/* List Table */}
            <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 [scrollbar-width:thin] border-t border-border pt-1.5">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-border text-[9px] font-bold text-n-450 dark:text-n-500 uppercase tracking-wider sticky top-0 bg-card z-10">
                    <th className="pb-1 font-black">Sản phẩm</th>
                    <th className="pb-1 text-left font-black">Danh mục</th>
                    <th className="pb-1 text-right font-black">Tin nhắn</th>
                    <th className="pb-1 text-right font-black">Tỷ lệ phản hồi</th>
                    <th className="pb-1 text-right font-black">Tỷ lệ chốt</th>
                    <th className="pb-1 text-right font-black">Đã bán</th>
                    <th className="pb-1 text-right font-black">Doanh thu</th>
                    <th className="pb-1 text-right font-black">Doanh thu / SP</th>
                    <th className="pb-1 text-center font-black">AI Score</th>
                    <th className="pb-1 text-center font-black">Xu hướng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProducts.map((prod, idx) => (
                    <tr key={idx} className="text-[11px] hover:bg-muted/50 transition">
                      {/* Product details */}
                      <td className="py-1.5 font-bold text-foreground flex items-center gap-1.5 min-w-0 max-w-[150px]">
                        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-n-100 to-n-200 dark:from-n-900 dark:to-n-800 text-sm flex items-center justify-center shrink-0 border border-border">
                          {prod.image}
                        </div>
                        <div className="min-w-0 leading-none">
                          <span className="truncate block font-black text-foreground text-[10.5px]">
                            {prod.name}
                          </span>
                          <span className="text-[8.5px] text-n-400 dark:text-n-500 font-bold block mt-0.5">
                            {prod.code}
                          </span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-1.5 text-left font-bold text-n-500 dark:text-n-400">{prod.category}</td>

                      {/* Messages */}
                      <td className="py-1.5 text-right">
                        <span className="font-black text-foreground block leading-none">
                          {formatNumber(prod.msg)}
                        </span>
                        <span className="text-[8.5px] font-bold block mt-0.5 leading-none text-emerald-500">
                          {prod.msgTrend}
                        </span>
                      </td>

                      {/* Response rate */}
                      <td className="py-1.5 text-right font-extrabold text-foreground tabular-nums">
                        {prod.responseRate}
                      </td>

                      {/* Closing rate */}
                      <td className="py-1.5 text-right">
                        <span className="font-black text-foreground block leading-none">
                          {prod.closingRate}
                        </span>
                        <span
                          className={cn(
                            'text-[8.5px] font-bold block mt-0.5 leading-none',
                            prod.closingTrend.includes('↓') ? 'text-danger-600 dark:text-danger-400' : 'text-emerald-500'
                          )}
                        >
                          {prod.closingTrend}
                        </span>
                      </td>

                      {/* Sold quantity */}
                      <td className="py-1.5 text-right">
                        <span className="font-black text-foreground block leading-none">
                          {prod.sold}
                        </span>
                        <span className="text-[8.5px] font-bold block mt-0.5 leading-none text-emerald-500">
                          {prod.soldTrend}
                        </span>
                      </td>

                      {/* Revenue */}
                      <td className="py-1.5 text-right">
                        <span className="font-black text-foreground block leading-none">
                          {prod.revenue}
                        </span>
                        <span className="text-[8.5px] font-bold block mt-0.5 leading-none text-emerald-500">
                          {prod.revenueTrend}
                        </span>
                      </td>

                      {/* Rev per product */}
                      <td className="py-1.5 text-right font-bold text-n-600 dark:text-n-400 tabular-nums">
                        {prod.revPerItem}
                      </td>

                      {/* AI Quality badge */}
                      <td className="py-1.5 text-center">
                        <span
                          className={cn(
                            'inline-flex min-w-[24px] items-center justify-center rounded px-1 py-0.5 text-[9px] font-black',
                            prod.aiScore >= 85
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : prod.aiScore >= 75
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                : 'bg-danger-100 dark:bg-danger-500/10 text-danger-600 dark:text-danger-400 border border-danger-100/20'
                          )}
                        >
                          {prod.aiScore}
                        </span>
                      </td>

                      {/* Xu hướng Sparkline */}
                      <td className="py-1.5 text-center">
                        <div className="flex justify-center">
                          <SparklinePath
                            data={prod.trendData}
                            stroke={prod.isPositiveTrend ? '#10b981' : '#ef4444'}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex shrink-0 items-center justify-between border-t border-border mt-2 pt-2 text-[10px] font-bold text-n-400 dark:text-n-500">
              <span>Hiển thị 1 - 6 trong 286 sản phẩm</span>
              <div className="flex items-center gap-1 select-none">
                <span className="h-5 w-5 rounded flex items-center justify-center cursor-pointer hover:bg-muted">
                  &lt;
                </span>
                <span className="h-5 w-5 rounded bg-primary text-primary-foreground flex items-center justify-center cursor-pointer">
                  1
                </span>
                <span className="h-5 w-5 rounded flex items-center justify-center cursor-pointer hover:bg-muted">
                  2
                </span>
                <span className="h-5 w-5 rounded flex items-center justify-center cursor-pointer hover:bg-muted">
                  3
                </span>
                <span className="h-5 w-5 rounded flex items-center justify-center cursor-pointer hover:bg-muted">
                  4
                </span>
                <span className="h-5 w-5 rounded flex items-center justify-center cursor-pointer hover:bg-muted">
                  5
                </span>
                <span>...</span>
                <span className="h-5 w-5 rounded flex items-center justify-center cursor-pointer hover:bg-muted">
                  48
                </span>
                <span className="h-5 w-5 rounded flex items-center justify-center cursor-pointer hover:bg-muted">
                  &gt;
                </span>
              </div>
            </div>
          </div>

          {/* Grid for two bottom charts */}
          <div className="grid gap-2 sm:gap-2.5 grid-cols-1 md:grid-cols-2 lg:h-[185px] shrink-0">
            {/* Chart 1: Số tin nhắn theo sản phẩm */}
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm flex flex-col justify-between min-h-0 h-full text-card-foreground">
              <div className="flex shrink-0 items-center justify-between gap-2 mb-1">
                <h3 className="font-extrabold text-foreground text-[11px] sm:text-xs">
                  Số tin nhắn theo sản phẩm{' '}
                  <span className="text-n-400 dark:text-n-500 font-bold text-[10px]">(Top 10)</span>
                </h3>
                <select className="rounded-lg border border-border bg-n-100 dark:bg-n-900 py-0.5 px-1 text-[9px] font-bold text-n-500 dark:text-n-400 cursor-pointer focus:outline-none hover:bg-muted">
                  <option>Tin nhắn</option>
                </select>
              </div>

              {/* Bar Chart */}
              <div className="flex-1 min-h-0 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={MOCK_PROD_MSG_CHART}
                    margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 7, fontWeight: 700, fill: 'var(--n-400)' }}
                    />
                    <YAxis
                      domain={[0, 'auto']}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v)}
                      tick={{ fontSize: 7, fontWeight: 700, fill: 'var(--n-400)' }}
                    />
                    <Tooltip cursor={{ fill: 'var(--border)' }} />
                    <Bar dataKey="value" fill="var(--primary)" radius={[3, 3, 0, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Tỷ lệ chốt theo sản phẩm */}
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm flex flex-col justify-between min-h-0 h-full text-card-foreground">
              <div className="flex shrink-0 items-center justify-between gap-2 mb-1">
                <h3 className="font-extrabold text-foreground text-[11px] sm:text-xs">
                  Tỷ lệ chốt theo sản phẩm{' '}
                  <span className="text-n-400 dark:text-n-500 font-bold text-[10px]">(Top 10)</span>
                </h3>
                <select className="rounded-lg border border-border bg-n-100 dark:bg-n-900 py-0.5 px-1 text-[9px] font-bold text-n-500 dark:text-n-400 cursor-pointer focus:outline-none hover:bg-muted">
                  <option>Tỷ lệ chốt</option>
                </select>
              </div>

              {/* Line Chart */}
              <div className="flex-1 min-h-0 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={MOCK_PROD_CLOSING_CHART}
                    margin={{ top: 5, right: 10, left: -25, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 7, fontWeight: 700, fill: 'var(--n-400)' }}
                    />
                    <YAxis
                      domain={[0, 20]}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 7, fontWeight: 700, fill: 'var(--n-400)' }}
                    />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      stroke="#10b981"
                      strokeWidth={1.5}
                      dot={{ r: 2, fill: '#10b981', strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side (col-span-3) */}
        <div className="lg:col-span-3 flex min-h-0 flex-col gap-2 sm:gap-2.5 lg:h-full">
          {/* Top sản phẩm doanh thu cao nhất */}
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm flex flex-col min-h-0 lg:flex-1 text-card-foreground">
            <div className="flex shrink-0 items-center justify-between gap-2 mb-2">
              <h3 className="font-extrabold text-foreground text-xs sm:text-sm">
                Top sản phẩm cao nhất
              </h3>
              <span className="text-[10px] font-bold text-primary cursor-pointer hover:underline">
                Xem tất cả
              </span>
            </div>

            {/* Vertically stacked items with Rank labels */}
            <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin] pr-0.5 py-0.5">
              {MOCK_PROD_REVENUE_TOP.map((item, idx) => {
                const rankColors = [
                  'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                  'bg-primary/10 text-primary',
                  'bg-purple-500/10 text-purple-600 dark:text-purple-400',
                  'bg-n-100 text-n-800 dark:bg-n-800 dark:text-n-200',
                  'bg-n-50 text-n-500 dark:bg-n-900 dark:text-n-400',
                ]
                return (
                  <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {/* Circle Rank ID */}
                      <span
                        className={cn(
                          'h-4.5 w-4.5 shrink-0 rounded-full flex items-center justify-center text-[9px] font-black',
                          rankColors[idx % rankColors.length]
                        )}
                      >
                        {idx + 1}
                      </span>

                      {/* Product avatar image */}
                      <div className="h-7 w-7 rounded-lg bg-n-50 dark:bg-n-900 flex items-center justify-center text-sm border border-border">
                        {item.image}
                      </div>

                      <div className="min-w-0 leading-none">
                        <span className="font-black text-foreground truncate block text-[10.5px]">
                          {item.name}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 leading-none">
                      <span className="font-black text-foreground tabular-nums block text-[10.5px]">
                        {item.value}
                      </span>
                      <span className="text-[8.5px] text-n-400 dark:text-n-500 font-bold block mt-0.5">
                        {item.sold} đã bán
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* AI Insight về sản phẩm */}
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm flex flex-col min-h-0 lg:flex-1 text-card-foreground">
            <h3 className="font-extrabold text-foreground text-xs sm:text-sm mb-2 shrink-0">
              AI Insight về sản phẩm
            </h3>

            <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin] pr-0.5 py-0.5">
              {MOCK_PROD_AI_INSIGHTS.map((ins) => {
                let bulletBg = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                let bulletIcon = '🌿'

                if (ins.type === 'warning') {
                  bulletBg = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  bulletIcon = '⚠️'
                } else if (ins.type === 'danger') {
                  bulletBg = 'bg-danger-100 dark:bg-danger-500/10 text-danger-600 dark:text-danger-400 border border-danger-100/20'
                  bulletIcon = '🚨'
                }

                return (
                  <div
                    key={ins.id}
                    className="flex gap-2 items-start text-[10.5px] p-1.5 rounded-lg bg-n-50 dark:bg-n-900 hover:bg-muted transition border border-border"
                  >
                    {/* Circle Bullet Badge */}
                    <div
                      className={cn(
                        'flex h-5.5 w-5.5 items-center justify-center rounded bg-card text-xs font-bold shrink-0 shadow-sm border border-border',
                        bulletBg
                      )}
                    >
                      {bulletIcon}
                    </div>

                    <p className="text-n-600 dark:text-n-400 font-bold leading-normal tracking-tight">
                      {ins.text
                        .split(
                          /(Nhẫn\s+\w+|Dây\s+\w+|Bông\s+\w+|Vòng\s+\w+|Classic|Minimal|Tiny|Charm|\d+(?:\.\d+)?%|\d+\.\d+)/g
                        )
                        .map((part, pidx) => {
                          if (
                            part.startsWith('Nhẫn') ||
                            part.startsWith('Dây') ||
                            part.startsWith('Bông') ||
                            part.startsWith('Vòng') ||
                            part === 'Classic' ||
                            part === 'Minimal' ||
                            part === 'Tiny' ||
                            part === 'Charm' ||
                            part.includes('%') ||
                            part.includes('.')
                          ) {
                            return (
                              <span key={pidx} className="font-extrabold text-foreground">
                                {part}
                              </span>
                            )
                          }
                          return part
                        })}
                    </p>
                  </div>
                )
              })}
            </div>

            <div className="border-t border-border mt-2 pt-2 text-center shrink-0">
              <span className="text-[10px] font-black text-primary cursor-pointer hover:underline flex items-center justify-center gap-1">
                Xem tất cả insight <ChevronRight className="h-3 w-3" />
              </span>
            </div>
          </div>

          {/* Tình trạng sản phẩm */}
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm flex flex-col min-h-0 lg:flex-1 text-card-foreground">
            <h3 className="font-extrabold text-foreground text-xs sm:text-sm shrink-0 mb-1.5">
              Tình trạng sản phẩm
            </h3>

            <div className="flex flex-1 min-h-0 items-center justify-around gap-2 overflow-y-auto [scrollbar-width:thin] py-0.5">
              {/* Donut chart */}
              <div className="relative h-[85px] w-[85px] flex items-center justify-center shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={MOCK_PROD_STATUS_PIE}
                      innerRadius={28}
                      outerRadius={40}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {MOCK_PROD_STATUS_PIE.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-sm font-black text-foreground leading-none">286</span>
                  <span className="text-[6.5px] font-bold text-n-400 dark:text-n-500 mt-0.5 uppercase tracking-wider text-center max-w-[50px] leading-tight">
                    Sản phẩm
                  </span>
                </div>
              </div>

              {/* Legend specs */}
              <div className="space-y-1 min-w-0 flex-1 text-[10px]">
                {MOCK_PROD_STATUS_PIE.map((status, idx) => (
                  <div key={idx} className="leading-none flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: status.color }}
                      />
                      <span className="font-bold text-n-550 dark:text-n-400 truncate">{status.name}</span>
                    </div>
                    <p className="font-black text-foreground text-right shrink-0">
                      {status.value}{' '}
                      <span className="font-bold text-n-400 dark:text-n-500">({status.percent})</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-2 text-center shrink-0 mt-1.5">
              <span className="text-[10px] font-black text-primary cursor-pointer hover:underline flex items-center justify-center gap-1">
                Xem danh sách chi tiết <ChevronRight className="h-3 w-3" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
export function CskhQualityPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab =
    tabParam === 'config'
      ? 'config'
      : tabParam === 'overview'
        ? 'overview'
        : tabParam === 'fb-page'
          ? 'fb-page'
          : tabParam === 'products'
            ? 'products'
            : tabParam === 'chat'
              ? 'chat'
              : 'audit'
  const auditJob = useOptionalAuditJob()
  const auditJobBusy = auditJob?.isRunning ?? false

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('tab') === 'monitor') {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', 'audit')
      window.history.replaceState({}, '', url.pathname + url.search)
    }
  }, [])

  useEffect(() => {
    if (tab !== 'audit') return
    const saved = loadAuditWorkspace()
    const next = new URLSearchParams(searchParams)
    let changed = false
    const page = firstNonEmpty(next.get('auditPage'), saved.selectedPageId)
    const from = firstNonEmpty(next.get('auditFrom'), saved.auditDateFrom)
    const to = firstNonEmpty(next.get('auditTo'), saved.auditDateTo)
    if (page && next.get('auditPage') !== page) {
      next.set('auditPage', page)
      changed = true
    }
    if (from && next.get('auditFrom') !== from) {
      next.set('auditFrom', from)
      changed = true
    }
    if (to && next.get('auditTo') !== to) {
      next.set('auditTo', to)
      changed = true
    }
    if (changed) setSearchParams(next, { replace: true })
  }, [tab, searchParams, setSearchParams])

  return (
    <CskhPageShell
      className={
        tab === 'audit' || tab === 'chat'
          ? 'h-full min-h-0 flex-1'
          : tab === 'overview' || tab === 'fb-page' || tab === 'products'
            ? 'h-full min-h-0 flex-1'
            : '!h-auto min-h-0 flex-none overflow-visible'
      }
    >

      {auditJobBusy && tab === 'audit' ? (
        <p className="mb-2 text-xs font-medium text-indigo-600">Đang quét và chấm điểm…</p>
      ) : null}

      <CskhGlassPanel
        className={
          tab === 'audit' || tab === 'chat'
            ? 'flex h-full min-h-0 flex-1 flex-col overflow-hidden'
            : tab === 'overview' || tab === 'products'
              ? 'flex h-full min-h-0 flex-1 flex-col overflow-x-hidden lg:overflow-hidden overflow-y-auto pb-1 [scrollbar-width:thin]'
              : tab === 'fb-page'
                ? 'flex h-full min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto pb-1 [scrollbar-width:thin]'
                : 'min-h-0 overflow-x-hidden overflow-y-auto'
        }
      >
        <div className={tab === 'overview' ? 'h-full min-h-0 flex flex-col' : 'hidden'}>
          <OverviewTab />
        </div>
        <div className={tab === 'fb-page' ? '' : 'hidden'}>
          <FbPageTab />
        </div>
        <div className={tab === 'products' ? 'h-full min-h-0 flex flex-col' : 'hidden'}>
          <ProductsTab />
        </div>
        <div className={tab === 'config' ? 'min-h-0' : 'hidden'}>
          <ConfigTab />
        </div>
        <div
          className={
            tab === 'audit'
              ? 'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
              : 'hidden'
          }
        >
          <AuditMessengerView />
        </div>
        <div
          className={
            tab === 'chat'
              ? 'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
              : 'hidden'
          }
        >
          <ChatMessengerPane />
        </div>
      </CskhGlassPanel>
    </CskhPageShell>
  )
}
