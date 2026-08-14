import { apiClient } from '@/lib/axios'
import { backupAuthForOAuth } from '@/lib/authSession'

export interface CskhPage {
  pageId: string
  pageName: string | null
  pagePictureUrl?: string | null
  enabled: boolean
  updatedAt: string
  conversationCount?: number
  /** Tổng số tin nhắn (mọi chiều, mọi thời điểm) trong kênh. */
  messageCount?: number
  unreadConversationCount?: number
  /** Tin nhắn khách gửi đến trong tháng đã chọn (inbound). */
  inboundMessageCount?: number
  /** Chi tiêu QC trong ngày (cache cron Marketing API). */
  adSpend?: number | null
  adSpendCurrency?: string | null
  adMessagingConversations?: number | null
  adCostPerConversation?: number | null
  adAccountName?: string | null
  adSpendUnavailableReason?: string | null
  adSpendSyncedAt?: string | null
}

export interface CskhPagesInboundSummary {
  month: string
  totalInbound: number
}

export interface CskhPagesInboundDaySummary {
  date: string
  totalInbound: number
  totalAdSpend?: number | null
  adSpendCurrency?: string | null
  /** BE đang đồng bộ chi tiêu QC nền — FE có thể poll lại. */
  adSpendSyncPending?: boolean
}

export interface CskhPagesStatsMeta {
  inboundMonthStats?: true
  requestedMonth?: string
  inboundDayStats?: true
  requestedDate?: string
  buildTag: string
}

export interface CskhPagesResponse {
  pages: CskhPage[]
  inboundMonth?: CskhPagesInboundSummary
  inboundDay?: CskhPagesInboundDaySummary
  statsMeta?: CskhPagesStatsMeta
  oauthConnected: boolean
  oauthUser: string | null
  oauthUpdatedAt: string | null
  oauthExpiresAt: string | null
  oauthSyncStatus?: 'running' | 'done' | 'failed' | null
  oauthSyncError?: string | null
  adsReadConnected?: boolean
  adAccountCount?: number
}

export interface CskhMonitorItem {
  id: string
  pageId: string
  pageName: string | null
  conversationId: string
  customerName: string | null
  lastMessage: string | null
  needsReply: boolean
  updatedAt: string | null
}

export interface CskhJobRun {
  id: string
  type: string
  status: string
  summary?: {
    totalConversations?: number
    totalNoReply?: number
    pageCount?: number
    pageErrors?: number
    pagesTotal?: number
    pagesProcessed?: number
    currentPage?: string
    maxConversationsPerPage?: number
    total?: number
    processed?: number
    phase?: string
    fetched?: number
    currentCustomer?: string
    audited?: number
    errors?: number
    avgScore?: number
    auditCount?: number
    auditDate?: string
    auditDateFrom?: string
    auditDateTo?: string
    pageId?: string | null
    scanAllPages?: boolean
    scanned?: number
    maxConversations?: number | null
    paused?: boolean
    partial?: boolean
    pauseRequested?: boolean
    skippedAlready?: number
    remaining?: number
    allAlreadyAudited?: boolean
    tokenUsage?: {
      model?: string
      promptTokens?: number
      completionTokens?: number
      totalTokens?: number
      perAuditAvg?: number
    }
  } | null
  error?: string | null
  startedAt: string
  finishedAt?: string | null
  monitorItems?: CskhMonitorItem[]
}

export interface CskhAuditRow {
  id: string
  agentName: string | null
  customerName: string | null
  customerPictureUrl?: string | null
  fromAd?: boolean
  adId?: string | null
  adTitle?: string | null
  referralSource?: string | null
  channel: string | null
  score: number
  feedback: string | null
  transcript?: Array<{ sender?: string; text?: string; timestamp?: string }> | null
  metadata?: {
    pageName?: string
    pageId?: string
    conversationId?: string
    participantPsid?: string
    customerPictureUrl?: string | null
    noReply?: boolean
    staffAbsent?: boolean
    needsFollowUp?: boolean
    auditDate?: string
    auditDateFrom?: string
    auditDateTo?: string
    jobRunId?: string
    fromAd?: boolean
    adId?: string | null
    adTitle?: string | null
    referralSource?: string | null
    suggestedReplies?: string | string[] | null
    actionItems?: Array<{ issue: string; suggestedReply: string }> | string | null
    violations?: string | null
    tokenUsage?: {
      prompt_tokens?: number
      completion_tokens?: number
      total_tokens?: number
      model?: string
    } | null
    criteriaScores?: {
      greeting?: number
      needs?: number
      consult?: number
      objection?: number
      closing?: number
    } | null
    strengths?: string[] | null
    weaknesses?: string[] | null
    keywords?: string[] | null
    sentiment?: {
      label?: string
      customer?: string
      staff?: string
      tone?: 'positive' | 'neutral' | 'negative'
    } | null
    tags?: string[] | null
    transcriptMetrics?: {
      firstResponseSec?: number | null
      staffReplies?: number
      customerMessages?: number
      proactivePct?: number
    } | null
  } | null
  createdAt: string
}

export interface AuditComparisonStats {
  auditDate: string
  auditId: string
  staff: number
  team: number
  overall: number
  staffSampleSize: number
  teamSampleSize: number
  daySampleSize: number
}

export interface AuditScoreHistoryPoint {
  auditId: string
  auditDate: string
  score: number
  label: string
}

export interface AuditScoreHistory {
  auditId: string
  points: AuditScoreHistoryPoint[]
}

export interface CskhCustomerInterestedProduct {
  productId: number
  variantId: number
  name: string
  variantTitle: string
  price: number
  priceLabel: string
  compareAtPrice: number | null
  sku: string | null
  imageUrl: string | null
  inStock: boolean
  matchReason: string
}

export interface CskhCustomerIntent {
  summary: string
  intentLabel: string
  topics: string[]
  productMentions?: string[]
  products?: CskhCustomerInterestedProduct[]
  sapoConfigured?: boolean
  urgency: 'low' | 'normal' | 'high'
  suggestedFocus: string
  suggestedReply?: string
  analyzedAt: string
  isStale?: boolean
}

export function getCskhOAuthStartUrl(returnUrl?: string): string {
  backupAuthForOAuth()
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:3003').replace(/\/$/, '')
  const ret =
    returnUrl ||
    (typeof window !== 'undefined' ? window.location.href.split('#')[0] : '')
  // Cookie httpOnly trên API domain — không gửi JWT trong URL (tránh lộ token / logout sau redirect)
  return `${base}/cskh/oauth/start?returnUrl=${encodeURIComponent(ret)}`
}

export async function fetchCskhPages(options?: {
  month?: string
  date?: string
  lite?: boolean
}): Promise<CskhPagesResponse> {
  const month = options?.month?.trim()
  const date = options?.date?.trim()
  const params: Record<string, string> = {}
  if (month) params.month = month
  if (date) params.date = date
  if (options?.lite) params.lite = '1'
  const { data } = await apiClient.get<CskhPagesResponse>('/cskh/pages', {
    params: Object.keys(params).length ? params : undefined,
  })
  return data
}

export const CSKH_PAGES_LITE_QUERY_KEY = ['cskh', 'pages', 'lite'] as const

export async function syncCskhPagesAdSpend(date?: string): Promise<{
  synced: number
  pages: number
  dates: string[]
}> {
  const { data } = await apiClient.post<{ synced: number; pages: number; dates: string[] }>(
    '/cskh/pages/sync-ad-spend',
    null,
    { params: date ? { date } : undefined },
  )
  return data
}

export async function refreshCskhOAuth(): Promise<{ pageCount: number; oauthUser: string }> {
  const { data } = await apiClient.post<{ pageCount: number; oauthUser: string }>(
    '/cskh/oauth/refresh'
  )
  return data
}

export async function setCskhPageEnabled(pageId: string, enabled: boolean) {
  const { data } = await apiClient.patch(`/cskh/pages/${pageId}/enabled`, { enabled })
  return data
}

export async function setCskhPagesEnabledBulk(enabled: boolean, pageIds?: string[]) {
  const { data } = await apiClient.patch<{ updated: number; enabled: boolean }>(
    '/cskh/pages/bulk-enabled',
    { enabled, pageIds }
  )
  return data
}

export async function deleteCskhPage(pageId: string) {
  const { data } = await apiClient.delete(`/cskh/pages/${pageId}`)
  return data
}

export async function fetchLatestMonitor(): Promise<CskhJobRun | null> {
  const { data } = await apiClient.get<CskhJobRun | null>('/cskh/monitor/latest')
  return data
}

export async function runMonitor(maxConversations?: number): Promise<{
  jobId: string
  status: string
  alreadyRunning?: boolean
}> {
  const { data } = await apiClient.post<{
    jobId: string
    status: string
    alreadyRunning?: boolean
  }>('/cskh/monitor/run', {
    maxConversations,
  })
  return data
}

export async function runAudit(params: {
  auditDateFrom: string
  auditDateTo: string
  force?: boolean
  /** Một kênh — bỏ qua nếu scanAllChannels. */
  pageId?: string
  /** Quét tất cả kênh, mỗi kênh tối đa maxConversations cuộc. */
  scanAllChannels?: boolean
  /** Số cuộc hội thoại muốn quét; để trống/undefined = quét toàn bộ. */
  maxConversations?: number
}): Promise<{
  jobId: string
  status: string
  alreadyRunning?: boolean
}> {
  const scanAllChannels = Boolean(params.scanAllChannels) || !params.pageId
  const { data } = await apiClient.post<{
    jobId: string
    status: string
    alreadyRunning?: boolean
  }>('/cskh/audit/run', {
    auditDateFrom: params.auditDateFrom,
    auditDateTo: params.auditDateTo,
    auditDate: params.auditDateFrom,
    force: params.force,
    pageId: scanAllChannels ? undefined : params.pageId,
    scanAllChannels,
    maxConversations: params.maxConversations,
  })
  return data
}

export async function pauseAuditJob(): Promise<{
  paused: boolean
  jobId?: string
  message?: string
}> {
  const { data } = await apiClient.post<{ paused: boolean; jobId?: string; message?: string }>(
    '/cskh/audit/pause'
  )
  return data
}

export async function cancelAuditJob(): Promise<{ cancelled: number }> {
  const { data } = await apiClient.post<{ cancelled: number }>('/cskh/audit/cancel')
  return data
}

export async function fetchRunningCskhJob(type: 'monitor' | 'audit'): Promise<CskhJobRun | null> {
  const { data } = await apiClient.get<CskhJobRun | null>(`/cskh/jobs/running/${type}`)
  return data
}

export async function fetchCskhJob(jobId: string): Promise<CskhJobRun> {
  const { data } = await apiClient.get<CskhJobRun>(`/cskh/jobs/${jobId}`)
  return data
}

export interface CskhAuditProgress {
  id: string
  status: string
  error?: string | null
  startedAt: string
  finishedAt?: string | null
  summary?: CskhJobRun['summary']
  audits: CskhAuditRow[]
}

export async function fetchAuditProgress(jobId: string): Promise<CskhAuditProgress> {
  const { data } = await apiClient.get<CskhAuditProgress>(`/cskh/audit/progress/${jobId}`)
  return data
}

export async function fetchCskhAudits(params?: {
  pageId?: string
  jobRunId?: string
  auditDate?: string
  auditDateFrom?: string
  auditDateTo?: string
  limit?: number
}): Promise<CskhAuditRow[]> {
  const { data } = await apiClient.get<CskhAuditRow[]>('/cskh/audits', { params })
  return data
}

export interface AuditDayStats {
  auditDate: string
  auditDateFrom?: string
  auditDateTo?: string
  pageId?: string | null
  total: number
  passed: number
  failed: number
  fromAd: number
}

export async function fetchAuditDayStats(
  auditDateFrom: string,
  auditDateTo: string,
  pageId?: string
): Promise<AuditDayStats> {
  const { data } = await apiClient.get<AuditDayStats>('/cskh/audits/day-stats', {
    params: { auditDateFrom, auditDateTo, auditDate: auditDateFrom, pageId },
  })
  return data
}

export interface CskhInsightKpi {
  label: string
  value: string
  unit: string
  change: string
  changePositive: boolean
  sub: string
}

export interface CskhInsightPageRow {
  pageId: string
  pageName: string
  auditCount: number
  avgScore: number
  passRate: number
  riskRate: number
  positiveRate: number
  scoreChange: number | null
  status: 'good' | 'warning' | 'critical'
  statusLabel: string
  topIssue: string | null
  topKeyword: string | null
}

export interface CskhInsightDashboard {
  source: 'chat_audits'
  period: { from: string; to: string; label: string }
  selectedPageId?: string | null
  selectedPageName?: string | null
  totalAnalyzed: number
  avgScore: number
  intro: string
  kpis: CskhInsightKpi[]
  customerConcerns: {
    total: number
    items: { label: string; count: number; pct: number; color: string }[]
  }
  closeRateFactors: {
    highClose: { label: string; pct: number; count: number }[]
    lostOrders: { label: string; pct: number; count: number }[]
  }
  videoTopics: {
    question: string
    mentions: number
    audience: string
    angle: string
    hook: string
    script: string[]
    cta: string
  }[]
  products: { name: string; visits: number; closeRate: string; revenue: string }[]
  sentiment: { positive: number; neutral: number; negative: number; positiveChange: number }
  adEfficiency: {
    name: string
    quality: string
    stars: number
    closeRate: string
    roas: string
    conversationCount: number
  }[]
  byPage?: {
    all: CskhInsightPageRow[]
    needsAttention: CskhInsightPageRow[]
    topPerformers: CskhInsightPageRow[]
    summary: { good: number; warning: number; critical: number; total: number }
  } | null
  pageDirectory?: CskhInsightPageRow[]
  byCountry: { country: string; flag: string; insight: string; closeRate: string }[]
}

export async function fetchCskhInsights(params: {
  auditDateFrom: string
  auditDateTo: string
  pageId?: string
}): Promise<CskhInsightDashboard> {
  const { data } = await apiClient.get<CskhInsightDashboard>('/cskh/insights', { params })
  return data
}

export async function fetchAuditComparisonStats(
  auditDate: string,
  auditId: string
): Promise<AuditComparisonStats> {
  const { data } = await apiClient.get<AuditComparisonStats>('/cskh/audits/comparison', {
    params: { auditDate, auditId },
  })
  return data
}

export async function fetchAuditScoreHistory(auditId: string): Promise<AuditScoreHistory> {
  const { data } = await apiClient.get<AuditScoreHistory>('/cskh/audits/score-history', {
    params: { auditId },
  })
  return data
}

export async function fetchCustomerIntent(
  conversationId: string,
  auditId?: string,
  signal?: AbortSignal
): Promise<CskhCustomerIntent> {
  const { data } = await apiClient.get<CskhCustomerIntent>(
    `/cskh/inbox/conversations/${conversationId}/intent`,
    {
      params: auditId ? { auditId } : undefined,
      signal
    }
  )
  return {
    summary: data.summary,
    intentLabel: data.intentLabel ?? (data as { intent_label?: string }).intent_label ?? 'Chưa rõ',
    topics: data.topics ?? [],
    productMentions:
      data.productMentions ?? (data as { product_mentions?: string[] }).product_mentions ?? [],
    products: data.products ?? [],
    sapoConfigured: data.sapoConfigured ?? (data as { sapo_configured?: boolean }).sapo_configured,
    urgency: data.urgency ?? 'normal',
    suggestedFocus:
      data.suggestedFocus ?? (data as { suggested_focus?: string }).suggested_focus ?? '',
    suggestedReply: data.suggestedReply ?? (data as { suggested_reply?: string }).suggested_reply ?? '',
    analyzedAt: data.analyzedAt ?? (data as { analyzed_at?: string }).analyzed_at ?? '',
    isStale: data.isStale,
  }
}

export interface DeepSeekBalanceResponse {
  isAvailable?: boolean
  currency?: string
  totalBalance?: number
  grantedBalance?: number
  toppedUpBalance?: number
  model?: string
  error?: boolean
  message?: string
}

export interface AuditTokenStatsResponse {
  source?: 'running' | 'lastJob' | 'none'
  jobId?: string | null
  finishedAt?: string | null
  tokenUsage?: {
    model?: string
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
    perAuditAvg?: number
  } | null
}

export async function fetchAuditTokenStats(): Promise<AuditTokenStatsResponse> {
  const { data } = await apiClient.get<AuditTokenStatsResponse>('/cskh/audit/token-stats')
  return data
}

export async function fetchDeepSeekBalance(): Promise<DeepSeekBalanceResponse> {
  const { data } = await apiClient.get<DeepSeekBalanceResponse>('/cskh/ai/balance')
  return data
}

export interface CskhAdInsights {
  adId: string
  adName: string | null
  adsetName: string | null
  campaignName: string | null
  currency: string | null
  spend: number | null
  impressions: number | null
  clicks: number | null
  messagingConversations: number | null
  costPerConversation: number | null
  dateStart: string | null
  dateStop: string | null
  estimatedForThisConversation: number | null
  localConversationCount: number
  unavailableReason: string | null
  isPageLevelEstimate?: boolean
  insightsScope?: 'ad' | 'campaign' | 'page' | null
  /** @deprecated */
  isAccountLevelEstimate?: boolean
  estimateNote?: string | null
  connectedAdAccountId?: string | null
  connectedAdAccountName?: string | null
  topCampaigns?: Array<{
    campaignName: string
    spend: number | null
    messagingConversations: number | null
  }>
}

export async function fetchConversationAdInsights(
  conversationId: string,
  signal?: AbortSignal,
  refresh = false
): Promise<CskhAdInsights> {
  const { data } = await apiClient.get<CskhAdInsights>(
    `/cskh/inbox/conversations/${conversationId}/ad-insights`,
    {
      signal,
      params: refresh ? { refresh: 'true' } : undefined,
    }
  )
  return data
}

export interface CskhInboxViewer {
  userId: number
  fullName: string
  avatarUrl: string | null
  viewedAt: string
  hasChot?: boolean
}

export interface CskhInboxLabel {
  id: string
  name: string
  color: string
  type: 'staff' | 'status'
  userId: number | null
  sortOrder: number
}

export interface CskhInboxConversation {
  id: string
  pageId: string
  pageName: string | null
  fbConversationId: string | null
  participantPsid: string
  customerName: string | null
  customerPictureUrl?: string | null
  fromAd?: boolean
  adId?: string | null
  adTitle?: string | null
  referralSource?: string | null
  lastMessage: string | null
  lastMessageAt: string | null
  unreadCount: number
  awaitingLabel?: boolean
  updatedAt: string
  labels?: CskhInboxLabel[]
  labelsLocked?: boolean
  viewers?: CskhInboxViewer[]
}

export interface CskhInboxMessage {
  id: string
  conversationId: string
  fbMessageId: string | null
  direction: 'inbound' | 'outbound'
  senderType: 'customer' | 'staff'
  text: string
  messageType?: 'text' | 'image' | 'sticker' | string
  attachmentUrl?: string | null
  sentAt: string
  status: 'sent' | 'pending' | 'failed' | 'read'
}

export interface CskhInboxConversationStats {
  total: number
  fromAd: number
  unread: number
  normal: number
}

export interface CskhInboxConversationPage {
  items: CskhInboxConversation[]
  nextCursor: string | null
  hasMore: boolean
}

export async function fetchInboxConversationStats(options?: {
  pageId?: string
}): Promise<CskhInboxConversationStats> {
  const params: Record<string, string> = {}
  if (options?.pageId) params.pageId = options.pageId
  const { data } = await apiClient.get<CskhInboxConversationStats>(
    '/cskh/inbox/conversation-stats',
    { params: Object.keys(params).length ? params : undefined },
  )
  return data
}

export async function fetchInboxConversationsPage(options?: {
  pageId?: string
  fromAdOnly?: boolean
  unreadOnly?: boolean
  organicOnly?: boolean
  limit?: number
  cursor?: string
  search?: string
  sinceDays?: number
  labelId?: string
  unlabeledOnly?: boolean
  includeLabels?: boolean
}): Promise<CskhInboxConversationPage> {
  const params: Record<string, string> = {}
  if (options?.pageId) params.pageId = options.pageId
  if (options?.fromAdOnly) params.fromAdOnly = '1'
  if (options?.unreadOnly) params.unreadOnly = '1'
  if (options?.organicOnly) params.organicOnly = '1'
  if (options?.limit != null && options.limit > 0) params.limit = String(options.limit)
  if (options?.cursor) params.cursor = options.cursor
  if (options?.search) params.search = options.search
  if (options?.sinceDays != null && options.sinceDays > 0) {
    params.sinceDays = String(options.sinceDays)
  }
  if (options?.labelId) params.labelId = options.labelId
  if (options?.unlabeledOnly) params.unlabeledOnly = '1'
  if (options?.includeLabels) params.includeLabels = '1'
  const { data } = await apiClient.get<CskhInboxConversationPage>('/cskh/inbox/conversations', {
    params: Object.keys(params).length ? params : undefined,
  })
  return data
}

/** Tải nhiều trang — dùng audit / màn hình cần list đầy đủ (giới hạn server). */
export async function fetchInboxConversations(options?: {
  pageId?: string
  fromAdOnly?: boolean
  unreadOnly?: boolean
  organicOnly?: boolean
  maxItems?: number
}): Promise<CskhInboxConversation[]> {
  const params: Record<string, string> = { legacy: '1' }
  if (options?.pageId) params.pageId = options.pageId
  if (options?.fromAdOnly) params.fromAdOnly = '1'
  if (options?.unreadOnly) params.unreadOnly = '1'
  if (options?.organicOnly) params.organicOnly = '1'
  if (options?.maxItems != null && options.maxItems > 0) {
    params.limit = String(Math.min(options.maxItems, 5000))
  }
  const { data } = await apiClient.get<CskhInboxConversation[]>('/cskh/inbox/conversations', {
    params,
  })
  return data
}

export async function backfillInboxAdReferrals(): Promise<{ updated: number }> {
  const { data } = await apiClient.post<{ updated: number }>('/cskh/inbox/backfill-ad-referrals')
  return data
}

export async function fetchInboxMessages(
  conversationId: string,
  opts?: { since?: string; before?: string; refresh?: boolean; limit?: number },
  signal?: AbortSignal
): Promise<{ conversation: CskhInboxConversation; messages: CskhInboxMessage[] }> {
  const params: Record<string, string> = {}
  if (opts?.since) params.since = opts.since
  if (opts?.before) params.before = opts.before
  if (opts?.refresh) params.refresh = '1'
  if (opts?.limit != null && opts.limit > 0) params.limit = String(opts.limit)
  const { data } = await apiClient.get<{
    conversation: CskhInboxConversation
    messages: CskhInboxMessage[]
  }>(`/cskh/inbox/conversations/${conversationId}/messages`, {
    params: Object.keys(params).length ? params : undefined,
    signal,
  })
  return {
    conversation: data.conversation,
    messages: Array.isArray(data.messages) ? data.messages : [],
  }
}

const INBOX_MESSAGES_OPEN_LIMIT = 400
const INBOX_BACKGROUND_REFRESH_MS = 45_000
const lastInboxBackgroundRefresh = new Map<string, number>()

function shouldBackgroundRefreshMessages(
  conversationId: string,
  quick: { messages: CskhInboxMessage[] },
): boolean {
  if (quick.messages.length === 0) return true
  const last = lastInboxBackgroundRefresh.get(conversationId) ?? 0
  return Date.now() - last >= INBOX_BACKGROUND_REFRESH_MS
}

/** Mở hội thoại — trả DB ngay, đồng bộ Graph nền (không chặn UI). */
export async function fetchInboxMessagesProgressive(
  conversationId: string,
  signal?: AbortSignal,
  onPartial?: (data: { conversation: CskhInboxConversation; messages: CskhInboxMessage[] }) => void,
): Promise<{ conversation: CskhInboxConversation; messages: CskhInboxMessage[] }> {
  const quick = await fetchInboxMessages(
    conversationId,
    { limit: INBOX_MESSAGES_OPEN_LIMIT },
    signal,
  )
  onPartial?.(quick)

  const needsBlockingRefresh = quick.messages.length === 0

  if (needsBlockingRefresh) {
    const fresh = await fetchInboxMessages(
      conversationId,
      { refresh: true, limit: INBOX_MESSAGES_OPEN_LIMIT },
      signal,
    )
    lastInboxBackgroundRefresh.set(conversationId, Date.now())
    onPartial?.(fresh)
    return fresh
  }

  if (shouldBackgroundRefreshMessages(conversationId, quick)) {
    lastInboxBackgroundRefresh.set(conversationId, Date.now())
    void fetchInboxMessages(
      conversationId,
      { refresh: true, limit: INBOX_MESSAGES_OPEN_LIMIT },
      signal,
    )
      .then((fresh) => {
        if (signal?.aborted) return
        onPartial?.(fresh)
      })
      .catch(() => {
        /* giữ tin DB nếu sync nền lỗi */
      })
  }

  return quick
}

/** Prefetch tin nhắn khi hover — chỉ DB, không sync Graph. */
export function prefetchInboxMessages(
  qc: import('@tanstack/react-query').QueryClient,
  conversation: CskhInboxConversation,
) {
  const key = ['cskh', 'inbox', 'messages', conversation.id] as const
  const existing = qc.getQueryData<{ messages?: CskhInboxMessage[] }>(key)
  if (existing?.messages?.some((m) => m.id && !m.id.startsWith('preview-'))) return

  void qc.prefetchQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      fetchInboxMessages(conversation.id, { limit: INBOX_MESSAGES_OPEN_LIMIT }, signal),
    staleTime: 120_000,
  })
}

/** Tải thêm lịch sử cũ khi user cuộn lên. */
export async function fetchInboxMessagesOlder(
  conversationId: string,
  beforeSentAt: string,
  signal?: AbortSignal,
): Promise<CskhInboxMessage[]> {
  const { messages } = await fetchInboxMessages(
    conversationId,
    { before: beforeSentAt, limit: INBOX_MESSAGES_OPEN_LIMIT },
    signal,
  )
  return messages
}

export async function fetchInboxLabels(): Promise<CskhInboxLabel[]> {
  const { data } = await apiClient.get<CskhInboxLabel[]>('/cskh/inbox/labels')
  return data
}

export async function fetchInboxViewHistory(conversationId: string): Promise<{
  viewers: CskhInboxViewer[]
  withoutChot: CskhInboxViewer[]
}> {
  const { data } = await apiClient.get<{
    viewers: CskhInboxViewer[]
    withoutChot: CskhInboxViewer[]
  }>(`/cskh/inbox/conversations/${conversationId}/view-history`)
  return data
}

export async function toggleInboxConversationLabel(
  conversationId: string,
  labelId: string,
): Promise<CskhInboxLabel[]> {
  const { data } = await apiClient.post<CskhInboxLabel[]>(
    `/cskh/inbox/conversations/${conversationId}/labels/${labelId}/toggle`,
  )
  return data
}

export async function resolveInboxMessageMedia(messageId: string): Promise<{
  id: string
  attachmentUrl: string | null
  attachmentUrls?: string[]
  messageType: string
  text: string
}> {
  const { data } = await apiClient.post<{
    id: string
    attachmentUrl: string | null
    attachmentUrls?: string[]
    messageType: string
    text: string
  }>(`/cskh/inbox/messages/${messageId}/resolve-media`)
  return data
}

export async function sendInboxMessage(
  conversationId: string,
  text: string
): Promise<CskhInboxMessage> {
  const { data } = await apiClient.post<CskhInboxMessage>(
    `/cskh/inbox/conversations/${conversationId}/send`,
    { text }
  )
  return data
}

export async function notifyInboxTyping(conversationId: string): Promise<void> {
  await apiClient.post(`/cskh/inbox/conversations/${conversationId}/typing`)
}

export async function markInboxAsRead(conversationId: string): Promise<{ markedAsRead: number }> {
  const { data } = await apiClient.post<{ markedAsRead: number }>(
    `/cskh/inbox/conversations/${conversationId}/mark-as-read`
  )
  return data
}

export async function markInboxAsUnread(conversationId: string): Promise<{ markedAsUnread: number }> {
  const { data } = await apiClient.post<{ markedAsUnread: number }>(
    `/cskh/inbox/conversations/${conversationId}/mark-as-unread`
  )
  return data
}

export async function syncInboxFromGraph(
  pageId?: string
): Promise<{ synced: number; pageCount: number }> {
  const { data } = await apiClient.post<{ synced: number; pageCount: number }>('/cskh/inbox/sync', {
    pageId,
  })
  return data
}

export interface CskhBackfillStatus {
  running: boolean
  paused?: boolean
  pauseRequested?: boolean
  scope: 'empty' | 'all' | ''
  total: number
  done: number
  currentPage: string | null
  pageConvsDone?: number
  addedMessages: number
  okPages: number
  errorPages: Array<{ page: string; error: string; pageId?: string }>
  completedPageIds?: string[]
  startedAt: string | null
  finishedAt: string | null
  jobId?: string | null
}

/** Bắt đầu / tiếp tục quét đầy đủ. force=true bỏ qua tiến độ cũ, quét lại từ đầu. */
export async function startCskhBackfill(
  scope: 'empty' | 'all' = 'all',
  options?: { force?: boolean }
): Promise<CskhBackfillStatus> {
  const { data } = await apiClient.post<CskhBackfillStatus>('/cskh/inbox/backfill', {
    scope,
    force: options?.force === true,
  })
  return data
}

/** Tạm dừng quét — lưu tiến độ kênh đã quét vào DB. */
export async function pauseCskhBackfill(): Promise<{ paused: boolean; message?: string }> {
  const { data } = await apiClient.post<{ paused: boolean; message?: string }>(
    '/cskh/inbox/backfill/pause'
  )
  return data
}

/** Hủy toàn bộ quét — dừng ngay, xóa hàng đợi Redis. */
export async function cancelCskhBackfill(): Promise<{
  cancelled: number
  queueCleared: number
  message: string
}> {
  const { data } = await apiClient.post<{
    cancelled: number
    queueCleared: number
    message: string
  }>('/cskh/inbox/backfill/cancel')
  return data
}

/** Lấy tiến độ quét đầy đủ để hiển thị thanh tiến trình. */
export async function fetchCskhBackfillStatus(): Promise<CskhBackfillStatus> {
  const { data } = await apiClient.get<CskhBackfillStatus>('/cskh/inbox/backfill')
  return data
}

export async function linkAuditInbox(auditId: string): Promise<CskhInboxConversation> {
  const { data } = await apiClient.post<CskhInboxConversation>('/cskh/inbox/link-audit', {
    auditId,
  })
  return data
}

export async function fetchInboxAuditHint(conversationId: string): Promise<CskhAuditRow | null> {
  const { data } = await apiClient.get<CskhAuditRow | null>(
    `/cskh/inbox/conversations/${conversationId}/audit-hint`
  )
  return data
}
