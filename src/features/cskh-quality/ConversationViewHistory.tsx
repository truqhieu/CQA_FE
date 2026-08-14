import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { History, Loader2, UserX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { fetchInboxViewHistory, type CskhInboxViewer } from './api'

const VIEW_HISTORY_STALE_MS = 60_000

function formatViewTime(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ViewerRow({ viewer }: { viewer: CskhInboxViewer }) {
  const chot = Boolean(viewer.hasChot)
  return (
    <li
      className={cn(
        'flex items-center gap-2.5 px-2.5 py-2 rounded-lg',
        chot ? 'bg-violet-50/80' : 'bg-amber-50/50 hover:bg-amber-50/80',
      )}
    >
      {viewer.avatarUrl ? (
        <img
          src={viewer.avatarUrl}
          alt=""
          className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
        />
      ) : (
        <span className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0">
          {viewer.fullName.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-slate-800 truncate">{viewer.fullName}</p>
        <p className="text-[10px] text-slate-400">Mở lúc {formatViewTime(viewer.viewedAt)}</p>
      </div>
      <span
        className={cn(
          'shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded',
          chot ? 'text-violet-700 bg-violet-100' : 'text-amber-700 bg-amber-100',
        )}
      >
        {chot ? 'Đã chốt' : 'Chưa chốt'}
      </span>
    </li>
  )
}

type ConversationViewHistoryProps = {
  conversationId: string
  /** Số NV mở nhưng chưa chốt — badge trên icon (từ cache, có thể thiếu). */
  pendingCount?: number
  className?: string
}

export function prefetchInboxViewHistory(
  qc: ReturnType<typeof useQueryClient>,
  conversationId: string,
) {
  void qc.prefetchQuery({
    queryKey: ['cskh', 'inbox', 'view-history', conversationId],
    queryFn: () => fetchInboxViewHistory(conversationId),
    staleTime: VIEW_HISTORY_STALE_MS,
  })
}

export function invalidateInboxViewHistory(
  qc: ReturnType<typeof useQueryClient>,
  conversationId: string,
) {
  void qc.invalidateQueries({
    queryKey: ['cskh', 'inbox', 'view-history', conversationId],
  })
}

export function ConversationViewHistory({
  conversationId,
  pendingCount = 0,
  className,
}: ConversationViewHistoryProps) {
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['cskh', 'inbox', 'view-history', conversationId],
    queryFn: () => fetchInboxViewHistory(conversationId),
    enabled: Boolean(conversationId),
    staleTime: VIEW_HISTORY_STALE_MS,
    placeholderData: (prev) => prev,
  })

  const viewers = data?.viewers ?? []
  const withoutChot = data?.withoutChot ?? viewers.filter((v) => !v.hasChot)
  const badge = withoutChot.length || pendingCount

  const warmCache = () => prefetchInboxViewHistory(qc, conversationId)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={warmCache}
          onFocus={warmCache}
          className={cn(
            'relative flex h-7 w-7 items-center justify-center rounded-lg text-slate-400',
            'hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200 cursor-pointer',
            open && 'text-indigo-600 bg-indigo-50',
            className,
          )}
          title="Lịch sử mở hội thoại"
        >
          <History className="w-4 h-4" strokeWidth={2} />
          {badge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-white ring-2 ring-white">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" className="w-80 p-0 overflow-hidden bg-white border-slate-200 z-[250]">
        <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-indigo-500" />
            <div>
              <p className="text-[12px] font-bold text-slate-800">Lịch sử mở hội thoại</p>
              <p className="text-[10px] text-slate-500">Ai đã mở và đã / chưa chốt đơn</p>
            </div>
          </div>
        </div>

        <div className="max-h-[320px] overflow-y-auto p-1.5">
          {isLoading && !data ? (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-[11px]">Đang tải...</span>
            </div>
          ) : viewers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
              <UserX className="w-8 h-8 text-slate-300" />
              <p className="text-[11px] font-medium text-slate-500">Chưa ai mở hội thoại này</p>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {viewers.map((viewer) => (
                <ViewerRow key={viewer.userId} viewer={viewer} />
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
