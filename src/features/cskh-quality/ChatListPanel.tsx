import { memo, useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Loader2, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type CskhInboxConversation } from './api'
import { CskhPageAvatar, inboxChannelLabel } from './cskhUi'
import { ConversationLabelBadges } from './ChatLabelBar'

type ChatListPanelProps = {
  selectedConversationId?: string
  onSelect: (conversation: CskhInboxConversation) => void
  onPrefetch?: (conversation: CskhInboxConversation) => void
  conversations?: CskhInboxConversation[]
  isLoading?: boolean
  isError?: boolean
  emptyHint?: string
  pageId?: string
  typingConversationIds?: Set<string>
  bumpedConversationIds?: Set<string>
  connected?: boolean
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onLoadMore?: () => void
  /** Bấm nút thay vì auto-load khi cuộn — tránh treo với DB lớn */
  manualLoadMore?: boolean
}

const ROW_HEIGHT = 124
const LOAD_MORE_ROW_HEIGHT = 52

function formatTime(isoString: string | null): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'Vừa xong'
  if (diffMins < 60) return `${diffMins}p trước`
  if (diffHours < 24) return `${diffHours}h trước`
  if (diffDays < 7) return `${diffDays}d trước`

  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  if (diffDays < 1) return `${hh}:${mm}`
  return date.toLocaleDateString('vi-VN')
}

/** Khách đang chờ (chưa đọc hoặc chưa trả lời / chưa gán nhãn). */
function isCustomerWaiting(conv: CskhInboxConversation): boolean {
  return conv.unreadCount > 0 || Boolean(conv.awaitingLabel)
}

/** Khách đã nhắn, sale chưa trả — thời gian chờ nhìn thấy ngay trên list. */
function customerWaitInfo(conv: CskhInboxConversation): {
  label: string
  tone: 'amber' | 'orange' | 'red'
} | null {
  if (!(conv.unreadCount > 0) || !conv.lastMessageAt) return null
  const diffMs = Date.now() - new Date(conv.lastMessageAt).getTime()
  if (diffMs < 0) return null
  const mins = Math.floor(diffMs / 60_000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  let label = 'Chưa TL · <1p'
  if (mins < 1) label = 'Chưa TL · <1p'
  else if (mins < 60) label = `Chưa TL · ${mins}p`
  else if (hours < 24) label = `Chưa TL · ${hours}h${mins % 60 ? ` ${mins % 60}p` : ''}`
  else label = `Chưa TL · ${days}n`
  const tone = mins >= 30 ? 'red' : mins >= 5 ? 'orange' : 'amber'
  return { label, tone }
}

function pendingViewerLine(conv: CskhInboxConversation): string | null {
  if (!conv.awaitingLabel || conv.unreadCount > 0) return null
  const n =
    conv.pendingViewerCount ??
    conv.viewers?.filter((v) => !v.hasChot).length ??
    0
  if (n <= 0) return 'Đã xem · chưa chốt'
  if (n === 1) return '1 người đã xem · chưa chốt'
  return `${n} người đã xem · chưa chốt`
}

type ConversationRowProps = {
  conv: CskhInboxConversation
  isSelected: boolean
  isTyping: boolean
  isRecentlyBumped?: boolean
  nowTick?: number
  onSelect: (conversation: CskhInboxConversation) => void
  onPrefetch?: (conversation: CskhInboxConversation) => void
}

const ConversationRow = memo(function ConversationRow({
  conv,
  isSelected,
  isTyping,
  isRecentlyBumped,
  nowTick: _nowTick,
  onSelect,
  onPrefetch,
}: ConversationRowProps) {
  const hasUnread = !isSelected && conv.unreadCount > 0
  const waiting = !isSelected && isCustomerWaiting(conv)
  const unreadBadge = Math.min(conv.unreadCount, 99)
  const wait = !isSelected ? customerWaitInfo(conv) : null
  const viewerLine = pendingViewerLine(conv)

  return (
    <button
      onClick={() => onSelect(conv)}
      onMouseEnter={() => onPrefetch?.(conv)}
      className={cn(
        'w-[calc(100%-16px)] mx-2 my-1 text-left px-3 py-3 transition-all duration-300 rounded-xl relative group border',
        isRecentlyBumped && !isSelected
          ? 'bg-emerald-50/90 border-emerald-300/80 shadow-md shadow-emerald-100/50 scale-[1.01]'
          : isSelected
          ? 'bg-gradient-to-r from-indigo-50/70 to-indigo-50/30 border-indigo-100/70 shadow-sm shadow-indigo-100/20'
          : waiting
            ? 'bg-slate-50/40 hover:bg-slate-50 border-slate-200/20'
            : 'bg-white hover:bg-slate-50 border-transparent',
      )}
    >
      {isSelected && (
        <div className="absolute left-0 top-3.5 bottom-3.5 w-[3.5px] bg-indigo-500 rounded-r-full" />
      )}
      <div className="flex gap-2.5">
        <div className="relative shrink-0">
          <CskhPageAvatar
            name={conv.customerName || 'K'}
            pictureUrl={conv.customerPictureUrl}
            pageId={conv.pageId}
            psid={conv.participantPsid}
            className="h-10 w-10 rounded-full border border-slate-200 text-xs shadow-sm"
          />
          {waiting && (
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-orange-500 rounded-full border-2 border-white" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3
                className={cn(
                  'text-[12.5px] truncate leading-tight',
                  hasUnread || waiting ? 'font-bold text-slate-900' : 'font-semibold text-slate-700',
                )}
              >
                {conv.customerName || `Khách ${(conv.participantPsid ?? '').slice(0, 8) || '?'}`}
              </h3>
              {conv.fromAd && (
                <span className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm leading-none shrink-0">
                  Ads
                </span>
              )}
            </div>
            {wait ? (
              <span
                className={cn(
                  'shrink-0 text-[9.5px] font-bold tabular-nums px-1.5 py-0.5 rounded-md leading-none',
                  wait.tone === 'red'
                    ? 'bg-red-50 text-red-600 border border-red-200'
                    : wait.tone === 'orange'
                      ? 'bg-orange-50 text-orange-600 border border-orange-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200',
                )}
                title="Thời gian khách chờ phản hồi"
              >
                {wait.label}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 shrink-0 font-medium tabular-nums">
                {formatTime(conv.lastMessageAt)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 mt-0.5">
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-[9.5px] font-medium',
                conv.platform === 'instagram' ? 'text-pink-500' : 'text-blue-500',
              )}
            >
              <span
                className={cn(
                  'w-1 h-1 rounded-full inline-block',
                  conv.platform === 'instagram' ? 'bg-pink-500' : 'bg-blue-500',
                )}
              />
              {inboxChannelLabel(conv.platform)}
            </span>
            {conv.pageName && (
              <>
                <span className="text-[9px] text-slate-300">·</span>
                <span className="text-[9.5px] text-slate-400 font-medium truncate max-w-[120px]">
                  {conv.pageName}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center justify-between mt-1 gap-1.5">
            <div
              className={cn(
                'text-[11px] truncate flex-1 min-h-[14px] leading-snug',
                isTyping
                  ? 'text-blue-600 font-medium italic'
                  : waiting
                    ? 'text-slate-700 font-medium'
                    : 'text-slate-500',
              )}
            >
              {isTyping ? (
                <span className="inline-flex items-center gap-1 text-blue-600 font-semibold">
                  đang nhập
                  <span className="inline-flex gap-0.5 ml-0.5 items-end h-2 pb-0.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </span>
                </span>
              ) : (
                conv.lastMessage?.trim() || '[Không có tin nhắn]'
              )}
            </div>
            {hasUnread && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[9px] font-bold text-white bg-orange-500 rounded-full shrink-0 shadow-sm">
                {unreadBadge}
              </span>
            )}
          </div>

          {viewerLine && (
            <p
              className="mt-1 text-[10px] font-semibold text-amber-700 truncate"
              title="Mở hội thoại để xem những ai đã xem nhưng chưa chốt"
            >
              {viewerLine}
            </p>
          )}

                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {(conv.labels?.length ?? 0) > 0 && (
                    <ConversationLabelBadges labels={conv.labels} max={1} />
                  )}
                  {conv.fromAd && conv.adTitle && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60 max-w-[130px] truncate">
                {conv.adTitle}
              </span>
            )}
            {conv.pageName && !conv.fromAd && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-50/70 text-blue-600 border border-blue-100/50 max-w-[130px] truncate">
                {conv.pageName}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
})

export function ChatListPanel({
  selectedConversationId,
  onSelect,
  onPrefetch,
  conversations = [],
  isLoading = false,
  isError = false,
  emptyHint,
  typingConversationIds = new Set(),
  bumpedConversationIds = new Set(),
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  manualLoadMore = false,
}: ChatListPanelProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const prevTopIdRef = useRef<string | null>(null)
  const [nowTick, setNowTick] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setNowTick((n) => n + 1), 15_000)
    return () => window.clearInterval(t)
  }, [])

  // Tin mới đẩy lên đầu — cuộn lên nếu user đang xem gần đầu list.
  useEffect(() => {
    const topId = conversations[0]?.id ?? null
    const scrollEl = parentRef.current
    if (!topId || !scrollEl || topId === prevTopIdRef.current) {
      prevTopIdRef.current = topId
      return
    }
    const bumpedToTop = bumpedConversationIds.has(topId)
    prevTopIdRef.current = topId
    if (!bumpedToTop) return
    if (scrollEl.scrollTop <= ROW_HEIGHT * 4) {
      scrollEl.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [conversations, bumpedConversationIds])

  const rowCount = conversations.length + (hasNextPage ? 1 : 0)

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) =>
      hasNextPage && index === conversations.length ? LOAD_MORE_ROW_HEIGHT : ROW_HEIGHT,
    overscan: 3,
  })

  useEffect(() => {
    if (manualLoadMore) return
    const scrollEl = parentRef.current
    if (!scrollEl || !hasNextPage || isFetchingNextPage) return

    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollEl
      if (scrollHeight - scrollTop - clientHeight < ROW_HEIGHT * 10) {
        onLoadMore?.()
      }
    }

    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    return () => scrollEl.removeEventListener('scroll', onScroll)
  }, [manualLoadMore, hasNextPage, isFetchingNextPage, onLoadMore, conversations.length])

  if (isLoading && conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          <span className="text-[11px] text-slate-400">Đang tải hội thoại...</span>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-red-600 p-6 text-center">
        <MessageCircle className="w-10 h-10 mb-3 opacity-50" />
        <p className="text-sm font-semibold">Lỗi tải hội thoại</p>
        <p className="text-[11px] text-red-500/80 mt-2 leading-relaxed max-w-[240px]">
          {emptyHint || 'API inbox không phản hồi. Kiểm tra BE đã deploy và chạy migration DB.'}
        </p>
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 mb-3">
          <MessageCircle className="w-7 h-7 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-600">
          {emptyHint ? 'Không có kết quả' : 'Không có hội thoại nào'}
        </p>
        <p className="text-[11px] text-slate-400 mt-1 text-center max-w-[240px] leading-relaxed">
          {emptyHint ||
            'Hội thoại từ Facebook sẽ xuất hiện ở đây. Thử tab Tất cả hoặc bấm Mọi nhãn.'}
        </p>
      </div>
    )
  }

  return (
    <div ref={parentRef} className="overflow-y-auto h-full py-1.5 bg-slate-50/20">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const isLoaderRow = virtualRow.index >= conversations.length
          if (isLoaderRow) {
            return (
              <div
                key="loader-row"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="flex items-center justify-center px-3 py-2"
              >
                {manualLoadMore ? (
                  <button
                    type="button"
                    onClick={() => onLoadMore?.()}
                    disabled={isFetchingNextPage}
                    className="w-full py-2 rounded-lg text-[11px] font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 disabled:opacity-60 disabled:cursor-wait transition-colors cursor-pointer"
                  >
                    {isFetchingNextPage ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Đang tải...
                      </span>
                    ) : (
                      'Tải thêm hội thoại'
                    )}
                  </button>
                ) : isFetchingNextPage ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                ) : null}
              </div>
            )
          }

          const conv = conversations[virtualRow.index]
          return (
            <div
              key={conv.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <ConversationRow
                conv={conv}
                isSelected={selectedConversationId === conv.id}
                isTyping={typingConversationIds.has(conv.id)}
                isRecentlyBumped={bumpedConversationIds.has(conv.id)}
                nowTick={nowTick}
                onSelect={onSelect}
                onPrefetch={onPrefetch}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
