import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/axios'
import { cn } from '@/lib/utils'
import {
  fetchInboxLabels,
  toggleInboxConversationLabel,
  type CskhInboxConversation,
  type CskhInboxLabel,
  type CskhInboxMessage,
} from './api'
import { patchInboxConversationInCache } from './inboxRealtimeCache'
import { invalidateInboxViewHistory } from './ConversationViewHistory'

type ChatLabelBarProps = {
  conversation: CskhInboxConversation
}

function LabelChip({
  label,
  active,
  disabled,
  locked,
  onClick,
}: {
  label: CskhInboxLabel
  active: boolean
  disabled?: boolean
  locked?: boolean
  onClick: () => void
}) {
  const isDisabled = disabled || (active && locked)
  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      title={
        active && locked
          ? `Nhãn "${label.name}" đã khóa`
          : active
            ? `Nhãn "${label.name}"`
            : `Gắn nhãn "${label.name}"`
      }
      className={cn(
        'shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all cursor-pointer disabled:opacity-50',
        active ? 'text-white shadow-sm' : 'bg-white hover:brightness-95',
      )}
      style={
        active
          ? { backgroundColor: label.color, borderColor: label.color }
          : { color: label.color, borderColor: `${label.color}55` }
      }
    >
      {label.name}
    </button>
  )
}

export function ChatLabelBar({ conversation }: ChatLabelBarProps) {
  const qc = useQueryClient()

  const { data: allLabels, isLoading } = useQuery<CskhInboxLabel[]>({
    queryKey: ['cskh', 'inbox', 'labels'],
    queryFn: fetchInboxLabels,
    staleTime: 120_000,
  })

  const activeIds = useMemo(
    () => new Set((conversation.labels ?? []).map((l) => l.id)),
    [conversation.labels],
  )

  const statusLabels = useMemo(
    () => (allLabels ?? []).filter((l) => l.type === 'status'),
    [allLabels],
  )
  const staffLabels = useMemo(
    () => (allLabels ?? []).filter((l) => l.type === 'staff'),
    [allLabels],
  )
  const labelsLocked = conversation.labelsLocked ?? (conversation.labels?.length ?? 0) > 0
  const hasDaChot = useMemo(
    () => (conversation.labels ?? []).some((l) => l.type === 'status' && l.name === 'Đã chốt'),
    [conversation.labels],
  )
  const assignedStaffId = useMemo(
    () => conversation.labels?.find((l) => l.type === 'staff')?.id,
    [conversation.labels],
  )

  const toggleMut = useMutation({
    mutationFn: (labelId: string) => toggleInboxConversationLabel(conversation.id, labelId),
    onMutate: (labelId) => {
      const picked = (allLabels ?? []).find((l) => l.id === labelId)
      if (!picked) return
      const prevLabels = conversation.labels ?? []
      let nextLabels = [...prevLabels]
      if (picked.type === 'staff') {
        nextLabels = nextLabels.filter((l) => l.type !== 'staff')
      }
      if (!nextLabels.some((l) => l.id === labelId)) {
        nextLabels.push(picked)
      }
      patchInboxConversationInCache(qc, {
        id: conversation.id,
        labels: nextLabels,
        labelsLocked: true,
        awaitingLabel: false,
        unreadCount: 0,
      })
    },
    onSuccess: (labels) => {
      patchInboxConversationInCache(qc, {
        id: conversation.id,
        labels,
        labelsLocked: labels.length > 0,
        awaitingLabel: false,
        unreadCount: 0,
      })
      invalidateInboxViewHistory(qc, conversation.id)
      qc.setQueryData<{ conversation: CskhInboxConversation; messages: CskhInboxMessage[] }>(
        ['cskh', 'inbox', 'messages', conversation.id],
        (prev) =>
          prev
            ? {
                ...prev,
                conversation: {
                  ...prev.conversation,
                  labels,
                  labelsLocked: labels.length > 0,
                  awaitingLabel: false,
                  unreadCount: 0,
                },
              }
            : prev,
      )
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error) || 'Không thể gán nhãn')
    },
  })

  if (isLoading && (allLabels ?? []).length === 0) {
    return (
      <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/60 flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
        <span className="text-[10px] text-slate-400">Đang tải nhãn...</span>
      </div>
    )
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50/60 shrink-0">
      {!labelsLocked && conversation.awaitingLabel && (
        <div className="px-3 pt-2 pb-1">
          <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">
            Đã xem tin nhưng chưa gán nhãn — hội thoại vẫn hiện dấu <strong>!</strong> cho đến khi gán nhãn (shop đã trả lời thì không còn chấm cam chưa đọc).
          </p>
        </div>
      )}
      <div className="px-3 pt-2 pb-1 flex items-center gap-1.5">
        <Tag className="w-3 h-3 text-slate-400 shrink-0" />
        <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wide">
          Nhãn trạng thái
        </span>
      </div>
      <div className="px-3 pb-1.5 flex gap-1 overflow-x-auto scrollbar-thin">
        {statusLabels.map((label) => (
          <LabelChip
            key={label.id}
            label={label}
            active={activeIds.has(label.id)}
            locked={labelsLocked}
            disabled={toggleMut.isPending}
            onClick={() => toggleMut.mutate(label.id)}
          />
        ))}
      </div>

      {!hasDaChot && (
        <>
          <div className="px-3 pt-1 pb-2 flex items-center gap-1.5">
            <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wide pl-4">
              Nhân viên chốt
            </span>
          </div>
          <div className="px-3 pb-2.5 flex gap-1 overflow-x-auto scrollbar-thin max-h-[52px] flex-wrap content-start">
            {staffLabels.map((label) => (
              <LabelChip
                key={label.id}
                label={label}
                active={activeIds.has(label.id)}
                locked={labelsLocked}
                disabled={
                  toggleMut.isPending ||
                  (!!assignedStaffId && assignedStaffId !== label.id)
                }
                onClick={() => toggleMut.mutate(label.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** Ẩn nhãn NV chốt trên list/header khi hội thoại đã gán "Đã chốt". */
export function labelsForConversationDisplay(labels?: CskhInboxLabel[]): CskhInboxLabel[] {
  if (!labels?.length) return []
  const daChot = labels.some((l) => l.type === 'status' && l.name === 'Đã chốt')
  if (!daChot) return labels
  return labels.filter((l) => l.type !== 'staff')
}

export function ConversationLabelBadges({
  labels,
  max = 3,
  className,
}: {
  labels?: CskhInboxLabel[]
  max?: number
  className?: string
}) {
  const display = labelsForConversationDisplay(labels)
  if (!display.length) return null
  const shown = display.slice(0, max)
  const rest = display.length - shown.length

  return (
    <div className={cn('flex items-center gap-0.5 flex-wrap', className)}>
      {shown.map((label) => (
        <span
          key={label.id}
          className="inline-flex px-1 py-0.5 rounded text-[8px] font-bold text-white leading-none max-w-[72px] truncate"
          style={{ backgroundColor: label.color }}
          title={label.name}
        >
          {label.name}
        </span>
      ))}
      {rest > 0 && (
        <span className="text-[8px] text-slate-400 font-medium">+{rest}</span>
      )}
    </div>
  )
}
