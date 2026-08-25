import { useState, useMemo, useEffect, useCallback, useTransition, useRef } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { ArrowLeft, RefreshCw, Search, MessageCircle, Wifi, WifiOff, Inbox, CalendarDays, LayoutGrid, Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/axios'
import {
  fetchCskhPages,
  CSKH_PAGES_LITE_QUERY_KEY,
  syncInboxFromGraph,
  isAsyncInboxSync,
  fetchCustomerIntent,
  fetchInboxMessagesProgressive,
  fetchConversationAdInsights,
  prefetchInboxMessages,
  fetchInboxConversationsPage,
  fetchInboxConversationStats,
  fetchInboxLabels,
  type CskhInboxConversation,
  type CskhInboxConversationPage,
  type CskhInboxConversationStats,
  type CskhInboxMessage,
  type CskhPage,
} from './api'
import { ChatListPanel } from './ChatListPanel'
import { ChatPanel } from './ChatPanel'
import { ChatRightSidebar } from './ChatRightSidebar'
import { InternalAssistantPanel, inboxMessagesForAssistant } from './InternalAssistantPanel'
import { prefetchInboxViewHistory } from './ConversationViewHistory'
import { InboxLabelFilterPopover, type InboxLabelFilterValue } from './InboxLabelFilterPopover'
import { useCskhInboxStream } from './useCskhInboxStream'
import { patchInboxConversationInCache, isInboxMessagePreview, mergeInboxConversationPages } from './inboxRealtimeCache'
import { inboxRtLog } from './inboxRealtimeDebug'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/custom-ui/select'
import {
  currentInboxMonthKey,
  formatInboxMonthLabel,
  inboxMonthOptions,
} from './inboxMonth'

type ChatMessengerPaneProps = {
  pageId?: string
}

type FilterTab = 'all' | 'unread' | 'ads' | 'normal'
type PlatformFilter = 'all' | 'facebook' | 'instagram' | 'threads' | 'youtube'

const PLATFORM_TABS: { key: PlatformFilter; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'threads', label: 'Threads' },
  { key: 'youtube', label: 'YouTube' },
]

const INBOX_MONTH_OPTIONS = inboxMonthOptions(18)

const EMPTY_CONV_PAGE: CskhInboxConversationPage = { items: [], nextCursor: null, hasMore: false }
const EMPTY_STATS: CskhInboxConversationStats = { total: 0, fromAd: 0, unread: 0, normal: 0 }

function pageBucket(platform?: string): Exclude<PlatformFilter, 'all'> {
  if (platform === 'instagram') return 'instagram'
  if (platform === 'threads') return 'threads'
  if (platform === 'youtube') return 'youtube'
  return 'facebook'
}

function graphPlatformParam(filter: PlatformFilter): 'messenger' | 'instagram' | undefined {
  if (filter === 'instagram') return 'instagram'
  if (filter === 'facebook') return 'messenger'
  return undefined
}

function hasConnectedInbox(filter: PlatformFilter): boolean {
  return filter === 'all' || filter === 'facebook' || filter === 'instagram'
}

function PlatformGlyph({ name }: { name: PlatformFilter }) {
  if (name === 'facebook') {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="currentColor" aria-hidden>
        <path d="M22 12a10 10 0 10-11.56 9.88v-6.99H8.08V12h2.36V9.8c0-2.33 1.39-3.62 3.52-3.62.99 0 2.03.18 2.03.18v2.23h-1.14c-1.13 0-1.48.7-1.48 1.42V12h2.52l-.4 2.89h-2.12v6.99A10 10 0 0022 12z" />
      </svg>
    )
  }
  if (name === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="currentColor" aria-hidden>
        <path d="M7.75 2h8.5A5.75 5.75 0 0122 7.75v8.5A5.75 5.75 0 0116.25 22h-8.5A5.75 5.75 0 012 16.25v-8.5A5.75 5.75 0 017.75 2zm0 1.8A3.95 3.95 0 003.8 7.75v8.5a3.95 3.95 0 003.95 3.95h8.5a3.95 3.95 0 003.95-3.95v-8.5A3.95 3.95 0 0016.25 3.8h-8.5zM12 7.2A4.8 4.8 0 1112 16.8 4.8 4.8 0 0112 7.2zm0 1.8a3 3 0 100 6 3 3 0 000-6zM17.5 6.1a1.15 1.15 0 110 2.3 1.15 1.15 0 010-2.3z" />
      </svg>
    )
  }
  if (name === 'youtube') {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="currentColor" aria-hidden>
        <path d="M23.5 6.2a3.05 3.05 0 00-2.15-2.16C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.35.44A3.05 3.05 0 00.5 6.2 31.9 31.9 0 000 12a31.9 31.9 0 00.5 5.8 3.05 3.05 0 002.15 2.16C4.5 20.4 12 20.4 12 20.4s7.5 0 9.35-.44a3.05 3.05 0 002.15-2.16A31.9 31.9 0 0024 12a31.9 31.9 0 00-.5-5.8zM9.6 15.6V8.4L15.8 12l-6.2 3.6z" />
      </svg>
    )
  }
  if (name === 'threads') {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="currentColor" aria-hidden>
        <path d="M16.3 11.2c-.1-2.4-1.5-4-4-4-2.9 0-4.8 2.2-4.8 5.6 0 3.2 1.7 5.4 4.8 5.4 2.2 0 3.8-1.1 4.5-3l-1.8-.6c-.4 1.2-1.4 1.8-2.7 1.8-1.8 0-2.9-1.4-2.9-3.6h7c0-.2.1-.4.1-.6zm-7-1.2c.3-1.5 1.3-2.5 2.8-2.5 1.4 0 2.3.9 2.5 2.5h-5.3zM12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z" />
      </svg>
    )
  }
  return <LayoutGrid className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
}

function InboxPlatformSelect({
  value,
  onChange,
}: {
  value: PlatformFilter
  onChange: (next: PlatformFilter) => void
}) {
  return (
    <Select value={value} onValueChange={(next: string) => onChange(next as PlatformFilter)}>
      <SelectTrigger className="h-8 w-[138px] text-[11px] font-semibold rounded-lg border-slate-200 bg-white px-2.5 shadow-none">
        <span className="flex items-center gap-1.5 min-w-0">
          <PlatformGlyph name={value} />
          <SelectValue placeholder="Tất cả" />
        </span>
      </SelectTrigger>
      <SelectContent className="bg-white rounded-xl min-w-[160px]">
        {PLATFORM_TABS.map((tab) => (
          <SelectItem key={tab.key} value={tab.key}>
            {tab.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function InboxMonthSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[148px] text-[11px] font-semibold rounded-lg border-slate-200 bg-white px-2.5 shadow-none">
        <span className="flex items-center gap-1.5 min-w-0">
          <CalendarDays className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          <SelectValue placeholder="Tháng" />
        </span>
      </SelectTrigger>
      <SelectContent className="max-h-72 bg-white rounded-xl min-w-[180px]">
        {INBOX_MONTH_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function channelAllLabel(platformFilter: PlatformFilter, count: string | number): string {
  if (platformFilter === 'facebook') return `Tất cả FB (${count})`
  if (platformFilter === 'instagram') return `Tất cả IG (${count})`
  if (platformFilter === 'threads') return `Tất cả Threads (${count})`
  if (platformFilter === 'youtube') return `Tất cả YT (${count})`
  return `Tất cả kênh (${count})`
}

function InboxPageSelectItems({
  pages,
  platformFilter,
  pagesLoading,
}: {
  pages: CskhPage[]
  platformFilter: PlatformFilter
  pagesLoading: boolean
}) {
  const count = pagesLoading ? '…' : pages.length

  return (
    <>
      <SelectItem value="all">{channelAllLabel(platformFilter, count)}</SelectItem>
      {platformFilter !== 'all' &&
        pages.map((page) => (
          <SelectItem key={page.pageId} value={page.pageId}>
            {page.pageName || page.pageId}
          </SelectItem>
        ))}
    </>
  )
}

export function ChatMessengerPane({ pageId }: ChatMessengerPaneProps) {
  const [selectedConversation, setSelectedConversation] = useState<CskhInboxConversation | null>(null)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [adInsightsSelectGen, setAdInsightsSelectGen] = useState<{ id: string; gen: number } | null>(
    null,
  )
  const qc = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [labelFilter, setLabelFilter] = useState<InboxLabelFilterValue>('all')
  const [selectedPageId, setSelectedPageId] = useState<string | undefined>(pageId)
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all')
  const [selectedMonth, setSelectedMonth] = useState(currentInboxMonthKey)
  const [, startFilterTransition] = useTransition()

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 450)
    return () => window.clearTimeout(t)
  }, [searchQuery])

  useEffect(() => {
    setSelectedPageId(pageId)
  }, [pageId])

  useEffect(() => {
    if (selectedPageId && selectedConversation && selectedConversation.pageId !== selectedPageId) {
      setSelectedConversation(null)
    }
  }, [selectedPageId, selectedConversation])

  const bumpTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const listHeadRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onNewMessageRef = useRef<(conversationId: string) => void>(() => {})
  const [bumpedConversationIds, setBumpedConversationIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    const timeouts = bumpTimeoutsRef.current
    return () => {
      timeouts.forEach((t) => clearTimeout(t))
      timeouts.clear()
      if (listHeadRefreshTimerRef.current) clearTimeout(listHeadRefreshTimerRef.current)
    }
  }, [])

  const { connected, typingConversationIds } = useCskhInboxStream({
    enabled: true,
    activeConversationId: selectedConversation?.id ?? null,
    onNewMessage: (conversationId) => onNewMessageRef.current(conversationId),
  })

  const { data: pagesData, isLoading: isLoadingPages } = useQuery({
    queryKey: CSKH_PAGES_LITE_QUERY_KEY,
    queryFn: () => fetchCskhPages({ lite: true }),
    staleTime: 300_000,
  })

  const pagesLoading = isLoadingPages && !pagesData

  const allPages = useMemo(() => pagesData?.pages ?? [], [pagesData])
  const filteredPages = useMemo(() => {
    if (platformFilter === 'all') return allPages
    return allPages.filter((p) => pageBucket(p.platform) === platformFilter)
  }, [allPages, platformFilter])

  const inboxPlatformReady = hasConnectedInbox(platformFilter)

  useEffect(() => {
    if (platformFilter === 'all') {
      if (selectedPageId) setSelectedPageId(undefined)
      return
    }
    if (!selectedPageId) return
    const stillVisible = filteredPages.some((p) => p.pageId === selectedPageId)
    if (!stillVisible) setSelectedPageId(undefined)
  }, [selectedPageId, platformFilter, filteredPages])

  const pageKey = selectedPageId ?? 'all'
  const graphPlatform = graphPlatformParam(platformFilter)

  const statsQueryKey = useMemo(
    () =>
      ['cskh', 'inbox', 'conversation-stats', pageKey, platformFilter, selectedMonth] as const,
    [pageKey, platformFilter, selectedMonth],
  )

  useEffect(() => {
    void qc.cancelQueries({
      queryKey: ['cskh', 'inbox', 'conversation-stats'],
      predicate: (query) => query.queryKey.join('|') !== statsQueryKey.join('|'),
    })
  }, [qc, statsQueryKey])

  const { data: convStats, isError: statsError, error: statsErr, isPending: statsPending } = useQuery({
    queryKey: statsQueryKey,
    queryFn: ({ signal }) =>
      inboxPlatformReady
        ? fetchInboxConversationStats({
            pageId: selectedPageId,
            platform: graphPlatform,
            month: selectedMonth,
            signal,
          })
        : Promise.resolve(EMPTY_STATS),
    staleTime: 90_000,
    retry: 0,
  })

  const { data: inboxLabels } = useQuery({
    queryKey: ['cskh', 'inbox', 'labels'],
    queryFn: fetchInboxLabels,
    staleTime: 120_000,
  })

  const statusLabels = useMemo(
    () => (inboxLabels ?? []).filter((l) => l.type === 'status'),
    [inboxLabels],
  )
  const staffLabels = useMemo(
    () => (inboxLabels ?? []).filter((l) => l.type === 'staff'),
    [inboxLabels],
  )

  const conversationFetchOpts = useMemo(() => {
    const base: {
      pageId?: string
      fromAdOnly?: boolean
      unreadOnly?: boolean
      organicOnly?: boolean
      labelId?: string
      unlabeledOnly?: boolean
      includeLabels?: boolean
      platform?: 'messenger' | 'instagram'
      month?: string
    } = { pageId: selectedPageId, platform: graphPlatform, month: selectedMonth }
    switch (activeFilter) {
      case 'ads':
        base.fromAdOnly = true
        break
      case 'unread':
        base.unreadOnly = true
        break
      case 'normal':
        base.organicOnly = true
        break
    }
    if (labelFilter === 'unlabeled') {
      base.unlabeledOnly = true
    } else if (labelFilter !== 'all') {
      base.labelId = labelFilter
    }
    base.includeLabels = labelFilter !== 'all'
    return base
  }, [selectedPageId, activeFilter, labelFilter, graphPlatform, selectedMonth])

  const listQueryKey = useMemo(
    () =>
      [
        'cskh',
        'inbox',
        'conversations',
        pageKey,
        activeFilter,
        debouncedSearch,
        labelFilter,
        platformFilter,
        platformFilter === 'all' || selectedPageId
          ? ''
          : filteredPages.map((p) => p.pageId).sort().join(','),
        selectedMonth,
      ] as const,
    [pageKey, activeFilter, debouncedSearch, labelFilter, platformFilter, selectedPageId, filteredPages, selectedMonth],
  )

  const {
    data: conversationPages,
    isLoading: isLoadingConversations,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError: listError,
    error: listErr,
  } = useInfiniteQuery({
    queryKey: listQueryKey,
    queryFn: ({ pageParam }) =>
      inboxPlatformReady
        ? fetchInboxConversationsPage({
            ...conversationFetchOpts,
            cursor: pageParam as string | undefined,
            search: debouncedSearch || undefined,
            limit: 50,
          })
        : Promise.resolve(EMPTY_CONV_PAGE),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    refetchInterval: false,
    retry: (failureCount, err) => {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 503) return failureCount < 2
      return failureCount < 1
    },
    retryDelay: (n) => Math.min(1500 * (n + 1), 4000),
  })

  const isRefreshingList = isFetching && !isFetchingNextPage && !isLoadingConversations

  const allConversations = useMemo(
    () => mergeInboxConversationPages(conversationPages?.pages),
    [conversationPages],
  )

  const scheduleListHeadRefresh = useCallback(() => {
    if (!inboxPlatformReady) return
    if (listHeadRefreshTimerRef.current) clearTimeout(listHeadRefreshTimerRef.current)
    listHeadRefreshTimerRef.current = setTimeout(() => {
      inboxRtLog('Safety refresh — fetch lại trang đầu list sau SSE')
      void fetchInboxConversationsPage({
        ...conversationFetchOpts,
        search: debouncedSearch || undefined,
        limit: 50,
      })
        .then((firstPage) => {
          qc.setQueryData<InfiniteData<CskhInboxConversationPage>>(listQueryKey, (prev) => {
            if (!prev?.pages?.length) {
              return { pages: [firstPage], pageParams: [undefined] }
            }
            const byId = new Map<string, CskhInboxConversation>()
            for (const c of firstPage.items) byId.set(c.id, c)
            for (const c of prev.pages[0].items) {
              const fromApi = byId.get(c.id)
              if (!fromApi) {
                byId.set(c.id, c)
                continue
              }
              const localAt = new Date(c.lastMessageAt ?? 0).getTime()
              const apiAt = new Date(fromApi.lastMessageAt ?? 0).getTime()
              byId.set(c.id, localAt >= apiAt ? { ...fromApi, ...c } : fromApi)
            }
            const merged = [...byId.values()].sort(
              (a, b) =>
                new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime(),
            )
            const pages = [...prev.pages]
            pages[0] = { ...firstPage, items: merged }
            return { ...prev, pages }
          })
        })
        .catch((err: unknown) => {
          inboxRtLog('Safety refresh failed', { error: String(err) })
        })
    }, 1200)
  }, [qc, listQueryKey, conversationFetchOpts, debouncedSearch, inboxPlatformReady])

  useEffect(() => {
    if (connected) return
    const id = window.setInterval(() => {
      scheduleListHeadRefresh()
    }, 15_000)
    return () => window.clearInterval(id)
  }, [scheduleListHeadRefresh, connected])

  const handleRealtimeMessage = useCallback(
    (conversationId: string) => {
      inboxRtLog('UI bump highlight', { conversationId })
      setBumpedConversationIds((prev) => new Set([...prev, conversationId]))
      const existing = bumpTimeoutsRef.current.get(conversationId)
      if (existing) clearTimeout(existing)
      bumpTimeoutsRef.current.set(
        conversationId,
        setTimeout(() => {
          setBumpedConversationIds((prev) => {
            const next = new Set(prev)
            next.delete(conversationId)
            return next
          })
          bumpTimeoutsRef.current.delete(conversationId)
        }, 2500),
      )
      scheduleListHeadRefresh()
    },
    [scheduleListHeadRefresh],
  )

  useEffect(() => {
    onNewMessageRef.current = handleRealtimeMessage
  }, [handleRealtimeMessage])

  const wasStreamConnectedRef = useRef(false)
  useEffect(() => {
    if (connected && !wasStreamConnectedRef.current) {
      inboxRtLog('SSE reconnected — refresh đầu list')
      scheduleListHeadRefresh()
    }
    wasStreamConnectedRef.current = connected
  }, [connected, scheduleListHeadRefresh])

  useEffect(() => {
    inboxRtLog(connected ? 'UI status: Live (SSE)' : 'UI status: Offline (SSE)', {
      filter: `${pageKey}|${activeFilter}|${labelFilter}`,
      search: debouncedSearch || '(none)',
      listCount: allConversations.length,
    })
  }, [connected, pageKey, activeFilter, labelFilter, debouncedSearch, allConversations.length])

  const listEmptyHint = useMemo(() => {
    if (listError) return getApiErrorMessage(listErr) || 'Không tải được danh sách hội thoại'
    if (platformFilter === 'threads') {
      return 'Chưa kết nối Threads. Hội thoại sẽ xuất hiện ở đây khi OAuth được bật.'
    }
    if (platformFilter === 'youtube') {
      return 'Chưa kết nối YouTube. Hội thoại sẽ xuất hiện ở đây khi OAuth được bật.'
    }
    if (platformFilter === 'instagram' && filteredPages.length === 0 && !pagesLoading) {
      return 'Chưa có kênh Instagram. Gắn Instagram Professional vào Fanpage rồi Cập nhật kết nối Facebook.'
    }
    if (platformFilter === 'facebook' && filteredPages.length === 0 && !pagesLoading) {
      return 'Chưa có Fanpage. Kết nối Facebook ở Cài đặt kênh.'
    }
    if (labelFilter === 'unlabeled' && (convStats?.total ?? 0) > 0) {
      return 'Không có hội thoại nào chưa gán nhãn với bộ lọc hiện tại'
    }
    if (labelFilter !== 'all' && (convStats?.total ?? 0) > 0) {
      return 'Không có hội thoại khớp nhãn đã chọn'
    }
    if (activeFilter === 'unread' && (convStats?.total ?? 0) > 0 && (convStats?.unread ?? 0) === 0) {
      return `Không còn hội thoại chưa đọc trong ${formatInboxMonthLabel(selectedMonth)}`
    }
    if (
      !listError &&
      !statsPending &&
      !statsError &&
      activeFilter === 'all' &&
      labelFilter === 'all' &&
      (convStats?.total ?? 0) === 0
    ) {
      return `Không có hội thoại trong ${formatInboxMonthLabel(selectedMonth)}`
    }
    return undefined
  }, [listError, listErr, labelFilter, convStats, activeFilter, platformFilter, filteredPages.length, pagesLoading, selectedMonth, statsPending, statsError])

  const showMigrationHint =
    labelFilter !== 'all' &&
    (convStats?.total ?? 0) === 0 &&
    allConversations.length === 0 &&
    !listError

  useEffect(() => {
    if (!listError) return
    const status = (listErr as { response?: { status?: number } })?.response?.status
    if (status === 503) return
    toast.error(getApiErrorMessage(listErr) || 'Lỗi tải hội thoại')
  }, [listError, listErr])

  // BE tự chạy ad-backfill khi tải danh sách — không gọi thêm từ FE (tránh tranh pool DB).

  const applyActiveFilter = useCallback((tab: FilterTab) => {
    startFilterTransition(() => {
      setActiveFilter(tab)
    })
  }, [])

  const applyLabelFilter = useCallback((value: InboxLabelFilterValue) => {
    startFilterTransition(() => {
      setLabelFilter(value)
    })
  }, [])

  const filterCounts = useMemo(() => {
    return {
      all: convStats?.total ?? 0,
      unread: convStats?.unread ?? 0,
      ads: convStats?.fromAd ?? 0,
      normal: convStats?.normal ?? 0,
    }
  }, [convStats])

  const syncMut = useMutation({
    mutationFn: () => syncInboxFromGraph(selectedPageId),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['cskh', 'inbox', 'conversations'] })
      if (isAsyncInboxSync(result)) {
        toast.info(result.message || 'Đang đồng bộ nền — làm mới danh sách sau vài phút')
        return
      }
      toast.success(`Đã đồng bộ ${result.synced} tin nhắn từ ${result.pageCount} kênh`)
    },
    onError: () => {
      toast.error('Đồng bộ thất bại, vui lòng thử lại')
    },
  })

  const [inputDraft, setInputDraft] = useState<string>('')

  const selectedId = selectedConversation?.id

  useEffect(() => {
    if (!selectedId) return
    prefetchInboxViewHistory(qc, selectedId)
  }, [selectedId, qc])

  const { data: messagesCache, isFetched: messagesFetched } = useQuery({
    queryKey: ['cskh', 'inbox', 'messages', selectedId ?? ''],
    queryFn: ({ signal }) =>
      fetchInboxMessagesProgressive(selectedId!, signal, (partial) => {
        qc.setQueryData(['cskh', 'inbox', 'messages', selectedId!], partial)
      }),
    enabled: !!selectedId,
    staleTime: 120_000,
    refetchOnMount: 'always',
    refetchInterval: connected ? false : 20_000,
  })

  const sidebarConversation: CskhInboxConversation | null = selectedConversation
    ? { ...selectedConversation, ...(messagesCache?.conversation ?? {}) }
    : null

  const shouldLoadAdInsights =
    !!sidebarConversation &&
    (sidebarConversation.fromAd || sidebarConversation.referralSource === 'HEURISTIC')

  const messagesReady =
    messagesFetched ||
    (messagesCache?.messages?.some((m) => !isInboxMessagePreview(m.id)) ?? false)

  const { data: intent, isLoading: isLoadingIntent } = useQuery({
    queryKey: ['cskh', 'inbox', 'intent', selectedId],
    queryFn: ({ signal }) => (selectedId ? fetchCustomerIntent(selectedId, undefined, signal) : null),
    enabled: !!selectedId && messagesReady,
    staleTime: 180_000,
  })

  const adInsightsVisitGen =
    selectedId && adInsightsSelectGen?.id === selectedId ? adInsightsSelectGen.gen : 0

  const {
    data: adInsights,
    isLoading: isLoadingAdInsights,
    isFetching: isFetchingAdInsights,
    isPlaceholderData: isAdInsightsPlaceholder,
  } = useQuery({
    queryKey: ['cskh', 'inbox', 'ad-insights', selectedId, adInsightsVisitGen],
    queryFn: ({ signal, queryKey }) => {
      const convId = queryKey[3] as string
      const visitGen = Number(queryKey[4] ?? 1)
      if (!convId) return null
      return fetchConversationAdInsights(convId, signal, visitGen >= 2)
    },
    enabled: shouldLoadAdInsights && !!selectedId && messagesReady && adInsightsVisitGen > 0,
    staleTime: 0,
    gcTime: 0,
  })

  const adInsightsPending =
    shouldLoadAdInsights &&
    !!selectedId &&
    (!messagesReady ||
      isLoadingAdInsights ||
      isFetchingAdInsights ||
      isAdInsightsPlaceholder)

  const [isRefreshingAdInsights, setIsRefreshingAdInsights] = useState(false)
  const handleRefreshAdInsights = useCallback(async () => {
    if (!selectedId || isRefreshingAdInsights) return
    setIsRefreshingAdInsights(true)
    try {
      const freshData = await fetchConversationAdInsights(selectedId, undefined, true)
      qc.setQueryData(
        ['cskh', 'inbox', 'ad-insights', selectedId, adInsightsVisitGen],
        freshData,
      )
      toast.success('Đã làm mới dữ liệu quảng cáo từ Meta')
    } catch (e) {
      toast.error(`Lỗi: ${getApiErrorMessage(e)}`)
    } finally {
      setIsRefreshingAdInsights(false)
    }
  }, [selectedId, isRefreshingAdInsights, qc, adInsightsVisitGen])

  const adInsightsVisitCountsRef = useRef(new Map<string, number>())

  const handlePrefetchConversation = useCallback(
    (conv: CskhInboxConversation) => {
      prefetchInboxMessages(qc, conv)
    },
    [qc],
  )

  const handleSelectConversation = useCallback((conv: CskhInboxConversation) => {
    const hasLabels = (conv.labels?.length ?? 0) > 0
    const opened: CskhInboxConversation = {
      ...conv,
      unreadCount: 0,
    }

    const visitGen = (adInsightsVisitCountsRef.current.get(conv.id) ?? 0) + 1
    adInsightsVisitCountsRef.current.set(conv.id, visitGen)

    setSelectedConversation(opened)
    setInputDraft('')
    setAdInsightsSelectGen({ id: conv.id, gen: visitGen })

    patchInboxConversationInCache(qc, {
      id: conv.id,
      unreadCount: 0,
    })

    qc.setQueryData<InfiniteData<CskhInboxConversationPage>>(
      listQueryKey,
      (prev) => {
        if (!prev) return prev
        if (hasLabels && activeFilter === 'unread') {
          return {
            ...prev,
            pages: prev.pages.map((p) => ({
              ...p,
              items: p.items.filter((c) => c.id !== conv.id),
            })),
          }
        }
        return {
          ...prev,
          pages: prev.pages.map((p) => ({
            ...p,
            items: p.items.map((c) =>
              c.id === conv.id ? { ...c, unreadCount: 0 } : c,
            ),
          })),
        }
      },
    )
  }, [qc, listQueryKey, activeFilter])

  const filterTabs: { key: FilterTab; label: string; color: string; activeColor: string }[] = [
    { key: 'all', label: 'Tất cả', color: 'text-slate-500', activeColor: 'text-blue-600 border-blue-600' },
    { key: 'unread', label: 'Chưa đọc', color: 'text-slate-500', activeColor: 'text-orange-600 border-orange-500' },
    { key: 'ads', label: 'Quảng cáo', color: 'text-slate-500', activeColor: 'text-purple-600 border-purple-500' },
    { key: 'normal', label: 'Tin thường', color: 'text-slate-500', activeColor: 'text-emerald-600 border-emerald-500' },
  ]

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2 border-b border-slate-100 bg-white shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shrink-0">
            <Inbox className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <h2 className="text-[13px] font-bold text-slate-800 leading-none truncate">Hộp thư đa kênh thông minh</h2>
          <span
            className={`flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
              connected
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-red-50 text-red-500 animate-pulse'
            }`}
          >
            {connected ? <><Wifi className="w-2.5 h-2.5" /> Live</> : <><WifiOff className="w-2.5 h-2.5" /> Offline</>}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <InboxMonthSelect
            value={selectedMonth}
            onChange={(next) => startFilterTransition(() => setSelectedMonth(next))}
          />
          <InboxPlatformSelect
            value={platformFilter}
            onChange={(next) =>
              startFilterTransition(() => {
                setPlatformFilter(next)
                setSelectedPageId(undefined)
              })
            }
          />
          <Select
            value={selectedPageId ?? 'all'}
            onValueChange={(val: string) => setSelectedPageId(val === 'all' ? undefined : val)}
            disabled={pagesLoading}
          >
            <SelectTrigger className="h-8 w-[168px] overflow-hidden whitespace-nowrap text-[11px] font-semibold rounded-lg border-slate-200 bg-white px-2.5 shadow-none">
              <span className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                <Radio className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="min-w-0 flex-1 truncate leading-none">
                  <SelectValue placeholder={pagesLoading ? 'Đang tải...' : 'Tất cả kênh'} />
                </span>
              </span>
            </SelectTrigger>
            <SelectContent className="max-h-72 bg-white rounded-xl min-w-[240px]">
              <InboxPageSelectItems
                pages={filteredPages}
                platformFilter={platformFilter}
                pagesLoading={pagesLoading}
              />
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => syncMut.mutate()}
            disabled={syncMut.isPending}
            title="Đồng bộ hội thoại"
            className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-lg shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncMut.isPending ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar - Conversation List */}
        <div
          className={`${
            selectedConversation && window.innerWidth < 768 ? 'hidden' : 'flex'
          } w-full md:w-[300px] lg:w-[320px] flex-col bg-white border-r border-slate-100 shrink-0`}
        >
          {/* Stats Filter Tabs */}
          <div className="relative flex gap-1 p-1.5 bg-slate-50/40 border-b border-slate-100 shrink-0">
            {isRefreshingList && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-100 overflow-hidden z-10">
                <div className="h-full w-1/3 bg-indigo-500 animate-pulse" />
              </div>
            )}
            {filterTabs.map((tab) => {
              const isActive = activeFilter === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => applyActiveFilter(tab.key)}
                  className={`flex-1 flex flex-col items-center py-1.5 px-0.5 rounded-xl transition-all duration-200 cursor-pointer border ${
                    isActive
                      ? 'bg-white text-slate-800 shadow-sm border-slate-200/40'
                      : 'border-transparent text-slate-500 hover:bg-slate-100/50 hover:text-slate-700'
                  }`}
                >
                  <span className={`text-[13px] font-extrabold leading-none ${
                    isActive ? tab.activeColor.split(' ')[0] : 'text-slate-600'
                  }`}>
                    {statsPending && convStats == null
                      ? '…'
                      : statsError && convStats == null
                        ? '—'
                        : filterCounts[tab.key].toLocaleString()}
                  </span>
                  <span className="text-[9.5px] font-semibold mt-1 tracking-tight text-slate-400">
                    {tab.label}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Search + label funnel */}
          <div className="px-3 py-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm hội thoại..."
                  className="w-full h-8 pl-8 pr-3 text-[11px] text-slate-700 bg-slate-50/80 border border-slate-200/60 rounded-lg outline-none transition-all duration-200 placeholder:text-slate-400 focus:bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100"
                />
              </div>
              <InboxLabelFilterPopover
                value={labelFilter}
                onChange={applyLabelFilter}
                statusLabels={statusLabels}
                staffLabels={staffLabels}
              />
            </div>

            <p className="text-[9.5px] text-slate-400 mt-1.5">
              {debouncedSearch
                ? `Tìm trong ${formatInboxMonthLabel(selectedMonth, true)} · ${filterCounts.all.toLocaleString()} hội thoại`
                : activeFilter === 'all'
                  ? (convStats?.total ?? 0) > 0
                    ? `${formatInboxMonthLabel(selectedMonth, true)} · Đã tải ${allConversations.length.toLocaleString()} / ${filterCounts.all.toLocaleString()} · Cuộn để xem thêm`
                    : `${formatInboxMonthLabel(selectedMonth, true)} · Đã tải ${allConversations.length.toLocaleString()} · Cuộn để xem thêm`
                  : activeFilter === 'unread'
                    ? `${formatInboxMonthLabel(selectedMonth, true)} · ${filterCounts.unread.toLocaleString()} chưa đọc · ${allConversations.length.toLocaleString()} đang hiển thị`
                    : `${formatInboxMonthLabel(selectedMonth, true)} · ${allConversations.length.toLocaleString()} hội thoại`}
            </p>

            {showMigrationHint && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] text-amber-800 leading-snug">
                Bộ lọc nhãn cần migration DB mới. Bấm{' '}
                <button
                  type="button"
                  className="font-bold underline cursor-pointer"
                  onClick={() => applyLabelFilter('all')}
                >
                  Mọi nhãn
                </button>{' '}
                để xem hội thoại, hoặc chạy file{' '}
                <code className="text-[9px] bg-white/80 px-1 rounded">manual-inbox-labels.sql</code>{' '}
                trên Supabase.
              </div>
            )}

            {statsError && (
              <p className="text-[10px] text-red-500 mt-1.5">
                Không tải được thống kê: {getApiErrorMessage(statsErr) || 'lỗi API'}
              </p>
            )}

            {activeFilter === 'ads' && filterCounts.ads > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-50 border border-purple-100 text-[10px] font-semibold text-purple-700">
                  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 2A2.5 2.5 0 002 4.5v7A2.5 2.5 0 004.5 14h7a2.5 2.5 0 002.5-2.5v-7A2.5 2.5 0 0011.5 2h-7zM5 5.5a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5a.5.5 0 01-.5-.5zm0 2.5a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5A.5.5 0 015 8zm0 2.5a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3a.5.5 0 01-.5-.5z"/></svg>
                  Ads
                </span>
                <span className="text-[10px] text-slate-400">
                  {filterCounts.ads}/{filterCounts.all} hội thoại
                </span>
              </div>
            )}
          </div>

          {/* Conversations List */}
          <ChatListPanel
            selectedConversationId={selectedConversation?.id}
            onSelect={handleSelectConversation}
            onPrefetch={handlePrefetchConversation}
            conversations={allConversations}
            isLoading={isLoadingConversations && allConversations.length === 0 && !listError}
            isError={listError}
            emptyHint={listEmptyHint}
            pageId={selectedPageId}
            typingConversationIds={typingConversationIds}
            bumpedConversationIds={bumpedConversationIds}
            connected={connected}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            manualLoadMore={filterCounts.all > 200}
            onLoadMore={() => {
              if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
            }}
          />
        </div>

        {/* Chat Area */}
        {selectedConversation ? (
          <div className="flex-1 flex min-w-0 bg-white relative">
            <div className="flex-1 flex flex-col min-w-0">
              {/* Mobile back button */}
              <div className="md:hidden p-2.5 border-b border-slate-100 flex items-center gap-2 bg-white">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedConversation(null)}
                  className="gap-2 text-slate-600 hover:text-slate-800 h-8"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Quay lại
                </Button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatPanel
                  conversation={sidebarConversation ?? selectedConversation}
                  isCustomerTyping={typingConversationIds.has(selectedConversation.id)}
                  onClose={() => setSelectedConversation(null)}
                  connected={connected}
                  draftText={inputDraft}
                  onDraftApplied={() => setInputDraft('')}
                  assistantOpen={assistantOpen}
                  onToggleAssistant={() => setAssistantOpen((open) => !open)}
                />
              </div>
            </div>

            {assistantOpen && (
              <div className="absolute inset-y-0 right-0 z-20 flex h-full w-[min(100%,340px)] shadow-xl md:static md:z-auto md:w-auto md:shadow-none">
                <InternalAssistantPanel
                  conversation={sidebarConversation ?? selectedConversation}
                  recentMessages={inboxMessagesForAssistant(messagesCache?.messages)}
                  onClose={() => setAssistantOpen(false)}
                  onApplyToChat={(text) => {
                    setInputDraft(text)
                    toast.success('Đã chèn gợi ý vào ô chat')
                  }}
                />
              </div>
            )}

            {/* Right Sidebar */}
            <div className="hidden lg:flex shrink-0 h-full min-h-0">
              <ChatRightSidebar
                conversation={sidebarConversation ?? selectedConversation}
                intent={intent}
                isLoadingIntent={isLoadingIntent}
                adInsights={adInsightsPending ? undefined : adInsights}
                isLoadingAdInsights={adInsightsPending}
                onApplySuggestedReply={(text) => setInputDraft(text)}
                onRefreshAdInsights={handleRefreshAdInsights}
                isRefreshingAdInsights={isRefreshingAdInsights}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 hidden md:flex items-center justify-center bg-gradient-to-br from-slate-50/80 to-indigo-50/20">
            <div className="text-center max-w-xs">
              <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-50 to-violet-100 mb-5">
                <MessageCircle className="w-9 h-9 text-indigo-400" strokeWidth={1.5} />
              </div>
              <p className="text-base font-bold text-slate-600 tracking-tight">
                Chọn một hội thoại để bắt đầu
              </p>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Nhấp vào một cuộc trò chuyện từ danh sách bên trái để xem và trả lời tin nhắn
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
