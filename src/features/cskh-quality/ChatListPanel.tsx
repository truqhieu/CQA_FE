import { memo, useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Loader2, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type CskhInboxConversation } from './api'
import { cskhMediaProxySrc } from './messageMedia'
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

const ROW_HEIGHT = 108
const LOAD_MORE_ROW_HEIGHT = 52

const avatarColors = [
  'from-blue-400 to-blue-600',
  'from-purple-400 to-purple-600',
  'from-emerald-400 to-emerald-600',
  'from-amber-400 to-amber-600',
  'from-rose-400 to-rose-600',
  'from-cyan-400 to-cyan-600',
  'from-indigo-400 to-indigo-600',
  'from-orange-400 to-orange-600',
  'from-teal-400 to-teal-600',
  'from-pink-400 to-pink-600',
]

function getColorIndex(name: string | null): number {
  if (!name) return 0
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % avatarColors.length
}

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

type ConversationRowProps = {
  conv: CskhInboxConversation
  isSelected: boolean
  isTyping: boolean
  isRecentlyBumped?: boolean
  onSelect: (conversation: CskhInboxConversation) => void
  onPrefetch?: (conversation: CskhInboxConversation) => void
}

const ConversationRow = memo(function ConversationRow({
  conv,
  isSelected,
  isTyping,
  isRecentlyBumped,
  onSelect,
  onPrefetch,
}: ConversationRowProps) {
  const colorIdx = getColorIndex(conv.customerName)
  const hasUnread = !isSelected && conv.unreadCount > 0
  const needsLabel = !isSelected && !!conv.awaitingLabel && conv.unreadCount <= 0
  const unreadBadge = Math.min(conv.unreadCount, 99)

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
          : hasUnread || needsLabel
            ? 'bg-slate-50/40 hover:bg-slate-50 border-slate-200/20'
            : 'bg-white hover:bg-slate-50 border-transparent',
      )}
    >
      {isSelected && (
        <div className="absolute left-0 top-3.5 bottom-3.5 w-[3.5px] bg-indigo-500 rounded-r-full" />
      )}
      <div className="flex gap-2.5">
        <div className="relative shrink-0">
          {conv.customerPictureUrl ? (
            <img
              src={cskhMediaProxySrc(conv.customerPictureUrl)}
              alt={conv.customerName || 'Customer'}
              className="w-10 h-10 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <div
              className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColors[colorIdx]} flex items-center justify-center text-white text-xs font-bold shadow-sm`}
            >
              {(conv.customerName || 'K').charAt(0).toUpperCase()}
            </div>
          )}
          {hasUnread && (
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-orange-500 rounded-full border-2 border-white" />
          )}
          {needsLabel && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-amber-400 rounded-full border-2 border-white" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3
                className={cn(
                  'text-[12.5px] truncate leading-tight',
                  hasUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700',
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
            <span className="text-[10px] text-slate-400 shrink-0 font-medium tabular-nums">
              {formatTime(conv.lastMessageAt)}
            </span>
          </div>

          <div className="flex items-center gap-1 mt-0.5">
            <span className="inline-flex items-center gap-0.5 text-[9.5px] text-blue-500 font-medium">
              <span className="w-1 h-1 rounded-full bg-blue-500 inline-block" />
              Messenger
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
                  : hasUnread
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
                conv.lastMessage || '[Không có tin nhắn]'
              )}
            </div>
            {hasUnread && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[9px] font-bold text-white bg-orange-500 rounded-full shrink-0 shadow-sm">
                {unreadBadge}
              </span>
            )}
            {needsLabel && (
              <span
                className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[9px] font-bold text-white bg-amber-500 rounded-full shrink-0 shadow-sm"
                title="Chờ gán nhãn"
              >
                !
              </span>
            )}
          </div>

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
  // Cập nhật "Vừa xong" / "5p trước" mà không cần reload list
  const [, timeTick] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => timeTick((n: number) => n + 1), 30_000)
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
