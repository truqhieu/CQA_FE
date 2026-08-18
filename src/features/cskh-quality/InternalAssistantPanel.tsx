import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/axios'
import { cn } from '@/lib/utils'
import {
  chatInternalAssistant,
  type AssistantChatHistoryItem,
  type CskhInboxConversation,
  type CskhInboxMessage,
} from './api'
import { AiFaceIcon } from './AiFaceIcon'
import { parseAssistantReply } from './parseAssistantReply'

const SUGGESTED_PROMPTS = [
  'Món này còn hàng không?',
  'Nên báo giá thế nào?',
  'Mẫu upsell phù hợp?',
  'Chính sách bảo hành / đổi trả?',
]

type ChatTurn = { id: string; role: 'user' | 'assistant'; content: string; outOfScope?: boolean }

export function inboxMessagesForAssistant(messages: CskhInboxMessage[] | undefined) {
  return (messages ?? [])
    .map((m) => {
      const text =
        m.senderType === 'customer'
          ? (m.translatedText || m.text || '').trim()
          : (m.originalText || m.text || '').trim()
      return {
        sender: m.senderType === 'customer' ? 'customer' : 'staff',
        text,
      }
    })
    .filter((m) => m.text)
    .slice(-16)
}

type InternalAssistantPanelProps = {
  conversation: CskhInboxConversation
  recentMessages: { sender: string; text: string }[]
  onClose: () => void
  onApplyToChat: (text: string) => void
}

function ThinkingBubble() {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-indigo-100 bg-white px-3.5 py-2.5 shadow-sm">
      <AiFaceIcon className="h-5 w-5 shrink-0 text-indigo-500" blinking />
      <span className="text-[12px] text-slate-500">Đang suy nghĩ</span>
      <span className="flex gap-0.5 pt-1" aria-hidden>
        <span className="h-1 w-1 rounded-full bg-indigo-400 animate-bounce [animation-delay:0ms]" />
        <span className="h-1 w-1 rounded-full bg-indigo-400 animate-bounce [animation-delay:150ms]" />
        <span className="h-1 w-1 rounded-full bg-indigo-400 animate-bounce [animation-delay:300ms]" />
      </span>
    </div>
  )
}

function AssistantMessage({
  turnId,
  content,
  outOfScope,
  picked,
  onPick,
  onApplyToChat,
}: {
  turnId: string
  content: string
  outOfScope?: boolean
  picked?: number
  onPick: (index: number) => void
  onApplyToChat: (text: string) => void
}) {
  const parsed = parseAssistantReply(content)
  const hasOptions = !outOfScope && parsed.options.length >= 2
  const selected = picked != null ? parsed.options[picked] : undefined

  return (
    <div className="max-w-[92%] rounded-2xl border border-indigo-100 bg-white px-3 py-2 text-[12px] leading-relaxed text-slate-700 shadow-sm">
      {parsed.body ? <p className="whitespace-pre-wrap">{parsed.body}</p> : null}
      {hasOptions && (
        <div className="mt-2.5 space-y-1.5">
          <p className="text-[10.5px] font-medium text-slate-400">Chọn 1 tin nhắn để chèn</p>
          {parsed.options.map((opt, i) => {
            const on = picked === i
            return (
              <button
                key={`${turnId}-opt-${i}`}
                type="button"
                onClick={() => onPick(i)}
                className={cn(
                  'w-full rounded-xl border px-2.5 py-2 text-left text-[11.5px] leading-relaxed whitespace-pre-wrap transition-colors',
                  on
                    ? 'border-indigo-400 bg-indigo-50 text-slate-800'
                    : 'border-slate-200 bg-slate-50/80 text-slate-600 hover:border-indigo-200',
                )}
              >
                <span className="mb-1 block text-[10px] font-semibold text-indigo-500">
                  Gợi ý {i + 1}
                </span>
                {opt}
              </button>
            )
          })}
          <button
            type="button"
            disabled={selected == null}
            onClick={() => selected && onApplyToChat(selected)}
            className="mt-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            Chèn vào ô chat
          </button>
        </div>
      )}
    </div>
  )
}

export function InternalAssistantPanel({
  conversation,
  recentMessages,
  onClose,
  onApplyToChat,
}: InternalAssistantPanelProps) {
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [pickedByTurn, setPickedByTurn] = useState<Record<string, number>>({})
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const convIdRef = useRef(conversation.id)
  const turnsRef = useRef<ChatTurn[]>([])

  if (convIdRef.current !== conversation.id) {
    convIdRef.current = conversation.id
    setTurns([])
    setDraft('')
    setPickedByTurn({})
    turnsRef.current = []
  }

  turnsRef.current = turns

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [turns, sending, pickedByTurn])

  const send = useCallback(
    async (raw: string) => {
      const message = raw.trim()
      if (!message || sending) return
      const userTurn: ChatTurn = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: message,
      }
      setTurns((prev) => {
        const next = [...prev, userTurn]
        turnsRef.current = next
        return next
      })
      setDraft('')
      setSending(true)
      try {
        const history: AssistantChatHistoryItem[] = turnsRef.current
          .slice(-12)
          .map((t) => ({ role: t.role, content: t.content }))
        const res = await chatInternalAssistant({
          message,
          history: history.slice(0, -1),
          conversationContext: {
            conversationId: conversation.id,
            customerName: conversation.customerName,
            platform: conversation.platform || 'messenger',
            pageName: conversation.pageName,
            fromAd: Boolean(conversation.fromAd),
            labels: (conversation.labels ?? []).map((l) => l.name).filter(Boolean),
            recentMessages,
          },
        })
        const reply = (res.reply || '').trim() || 'Trợ lý chưa trả lời được. Thử lại giúp em.'
        const outOfScope =
          res.scope === 'off_topic' || /chưa có kỹ năng|ngoài chuyên môn/i.test(reply)
        setTurns((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', content: reply, outOfScope },
        ])
      } catch (err) {
        toast.error(getApiErrorMessage(err))
        setTurns((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: 'Trợ lý tạm thời không phản hồi được. Thử lại sau giúp em.',
          },
        ])
      } finally {
        setSending(false)
        requestAnimationFrame(() => inputRef.current?.focus())
      }
    },
    [conversation, recentMessages, sending],
  )

  const customerName = conversation.customerName?.trim() || 'khách này'

  return (
    <div
      className="flex h-full w-full md:w-[340px] shrink-0 flex-col border-l border-indigo-100 bg-[#f4f6fb]"
      style={{ fontFamily: '"Roboto", sans-serif' }}
    >
      <div className="flex items-start justify-between gap-2 border-b border-indigo-100/80 bg-white/70 px-3.5 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <AiFaceIcon className="h-6 w-6 shrink-0 text-indigo-600" blinking />
            <div className="min-w-0">
              <h3 className="text-[13px] font-bold tracking-tight text-slate-800">
                AI Assistant nội bộ
              </h3>
              <p className="mt-0.5 text-[10.5px] leading-snug text-slate-500">
                Tra giá, tồn kho, mẫu mã, chính sách
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Online
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Thu gọn"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={sending}
            onClick={() => void send(prompt)}
            className="rounded-full border border-indigo-100 bg-white px-2.5 py-1 text-[10.5px] font-medium text-slate-600 shadow-sm hover:border-indigo-200 hover:text-indigo-700 disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 pb-2">
        <div className="rounded-2xl border border-indigo-100 bg-white px-3.5 py-2.5 text-[12px] leading-relaxed text-slate-700 shadow-sm">
          <p className="font-medium text-slate-800">Xin chào, mình là AI Assistant nội bộ ạ.</p>
          <p className="mt-1.5 text-slate-600">Mình hỗ trợ nhân viên trong hội thoại đang mở.</p>
          <p className="mt-1.5 text-[11px] text-slate-400">
            Đang xem ngữ cảnh khách <span className="font-medium text-slate-700">{customerName}</span>.
          </p>
        </div>

        {turns.map((turn) => (
          <div
            key={turn.id}
            className={cn('flex', turn.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            {turn.role === 'user' ? (
              <div className="max-w-[92%] rounded-2xl bg-indigo-500 px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap text-white">
                {turn.content}
              </div>
            ) : (
              <AssistantMessage
                turnId={turn.id}
                content={turn.content}
                outOfScope={turn.outOfScope}
                picked={pickedByTurn[turn.id]}
                onPick={(index) => setPickedByTurn((prev) => ({ ...prev, [turn.id]: index }))}
                onApplyToChat={onApplyToChat}
              />
            )}
          </div>
        ))}

        {sending && <ThinkingBubble />}
      </div>

      <div className="border-t border-indigo-100 bg-white/80 p-2.5">
        <div className="flex items-end gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5">
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            disabled={sending}
            placeholder="Hỏi AI nội bộ…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send(draft)
              }
            }}
            className="max-h-24 min-h-[32px] flex-1 resize-none bg-transparent py-1.5 text-[12px] text-slate-700 outline-none placeholder:text-slate-400"
          />
          <button
            type="button"
            disabled={sending || !draft.trim()}
            onClick={() => void send(draft)}
            className="mb-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  )
}
