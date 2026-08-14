import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/axios'
import { Loader2, AlertCircle, X, Mail } from 'lucide-react'
import {
  fetchInboxMessages,
  fetchInboxMessagesProgressive,
  sendInboxMessage,
  detectInboxConversationLang,
  notifyInboxTyping,
  markInboxAsUnread,
  type CskhInboxConversation,
  type CskhInboxMessage,
} from './api'
import { ChatMessage } from './ChatMessage'
import { ChatMessageInput } from './ChatMessageInput'
import { ChatLabelBar, ConversationLabelBadges } from './ChatLabelBar'
import { ConversationViewHistory } from './ConversationViewHistory'
import { TypingIndicator } from './TypingIndicator'
import { cskhMediaProxySrc } from './messageMedia'
import { appendInboxMessagesToCache, patchInboxConversationInCache, isInboxMessagePreview, collapseInboxMessageList } from './inboxRealtimeCache'

type ChatPanelProps = {
  conversation: CskhInboxConversation
  isCustomerTyping?: boolean
  onClose?: () => void
  connected?: boolean
  draftText?: string
  onDraftApplied?: () => void
}

export function ChatPanel({
  conversation,
  isCustomerTyping,
  onClose,
  connected,
  draftText,
  onDraftApplied,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastMessageIdRef = useRef<string>('')
  const typingTimeoutRef = useRef<any>(null)
  const lastConversationIdRef = useRef<string>('')
  const hasScrolledForConvRef = useRef<boolean>(false)
  const loadingOlderRef = useRef(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMoreOlder, setHasMoreOlder] = useState(true)

  if (lastConversationIdRef.current !== conversation.id) {
    lastConversationIdRef.current = conversation.id
    hasScrolledForConvRef.current = false
    loadingOlderRef.current = false
  }

  useEffect(() => {
    setHasMoreOlder(true)
  }, [conversation.id])
  const qc = useQueryClient()

  const markUnreadMutation = useMutation({
    mutationFn: markInboxAsUnread,
    onSuccess: () => {
      patchInboxConversationInCache(qc, {
        id: conversation.id,
        unreadCount: 1,
      })
      toast.success('Đã đánh dấu cuộc trò chuyện là chưa đọc')
      if (onClose) onClose()
    },
    onError: (err) => {
      toast.error(`Lỗi: ${getApiErrorMessage(err)}`)
    },
  })

  const handleMarkAsUnread = () => {
    markUnreadMutation.mutate(conversation.id)
  }

  // Fetch messages — dùng chung cache với ChatMessengerPane (prefetch khi click)
  const { data: messagesData, isLoading, isFetching, isPending, isFetched } = useQuery({
    queryKey: ['cskh', 'inbox', 'messages', conversation.id],
    queryFn: ({ signal }) =>
      fetchInboxMessagesProgressive(conversation.id, signal, (partial) => {
        qc.setQueryData(['cskh', 'inbox', 'messages', conversation.id], partial)
      }),
    staleTime: 120_000,
    refetchInterval: connected ? 20_000 : 8_000,
  })

  const rawMessages = messagesData?.messages ?? []
  const hasRealMessages = rawMessages.some((m) => !isInboxMessagePreview(m.id))
  const messages = useMemo(() => {
    if (!hasRealMessages) return []
    return rawMessages.filter((m) => !isInboxMessagePreview(m.id))
  }, [rawMessages, hasRealMessages])

  const conversationWithLabels = messagesData?.conversation ?? conversation
  const showInitialLoader =
    !hasRealMessages && (!isFetched || isLoading || isPending || isFetching)
  const showHydratingHint = isFetching && hasRealMessages

  // Send message mutation
  const sendMut = useMutation({
    mutationFn: ({ text, autoTranslate }: { text: string; autoTranslate?: boolean }) =>
      sendInboxMessage(conversation.id, text, { autoTranslate }),
    onMutate: async ({ text, autoTranslate }) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await qc.cancelQueries({ queryKey: ['cskh', 'inbox', 'messages', conversation.id] })

      // Create a temporary optimistic message
      const tempId = `temp-${Date.now()}`
      const optimisticMessage: CskhInboxMessage = {
        id: tempId,
        conversationId: conversation.id,
        fbMessageId: null,
        direction: 'outbound',
        senderType: 'staff',
        text,
        originalText: autoTranslate ? text : null,
        translatedText: autoTranslate ? text : null,
        messageType: 'text',
        attachmentUrl: null,
        sentAt: new Date().toISOString(),
        status: 'pending', // Will show loader spinner
      }

      // Save previous messages in case of error rollback
      const previousMessages = qc.getQueryData<{
        conversation: CskhInboxConversation
        messages: CskhInboxMessage[]
      }>(['cskh', 'inbox', 'messages', conversation.id])

      // Instantly append to cache
      appendInboxMessagesToCache(qc, conversation.id, undefined, [optimisticMessage])

      // Instantly update conversation previews
      patchInboxConversationInCache(qc, {
        id: conversation.id,
        lastMessage: text,
        lastMessageAt: optimisticMessage.sentAt,
        ...(conversationWithLabels.labels?.length
          ? { unreadCount: 0, awaitingLabel: false }
          : {}),
      })

      return { tempId, previousMessages }
    },
    onSuccess: (newMessage, _vars, context) => {
      if (context?.tempId) {
        qc.setQueryData<{ conversation: CskhInboxConversation; messages: CskhInboxMessage[] }>(
          ['cskh', 'inbox', 'messages', conversation.id],
          (prev) => {
            if (!prev) return prev
            const withoutTemp = (prev.messages ?? []).filter((m) => m.id !== context.tempId)
            const next = newMessage ? [...withoutTemp, newMessage] : withoutTemp
            return { ...prev, messages: collapseInboxMessageList(next) }
          }
        )
      } else if (newMessage) {
        appendInboxMessagesToCache(qc, conversation.id, undefined, [newMessage])
      }
      if (newMessage) {
        patchInboxConversationInCache(qc, {
          id: conversation.id,
          lastMessage: newMessage.text,
          lastMessageAt: newMessage.sentAt,
          ...(conversationWithLabels.labels?.length
            ? { unreadCount: 0, awaitingLabel: false }
            : {}),
        })
      }
    },
    onError: (error, _vars, context) => {
      toast.error(getApiErrorMessage(error) || 'Gửi tin thất bại')
      // Rollback to previous state
      if (context?.previousMessages) {
        qc.setQueryData(['cskh', 'inbox', 'messages', conversation.id], context.previousMessages)
      } else if (context?.tempId) {
        qc.setQueryData<{ conversation: CskhInboxConversation; messages: CskhInboxMessage[] }>(
          ['cskh', 'inbox', 'messages', conversation.id],
          (prev) => {
            if (!prev) return prev
            return {
              ...prev,
              messages: (prev.messages ?? []).filter((m) => m.id !== context.tempId),
            }
          }
        )
      }
    },
  })

  // Typing notification
  const handleTyping = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)

    void notifyInboxTyping(conversation.id).catch(() => {
      // Ignore errors from typing endpoint
    })

    typingTimeoutRef.current = setTimeout(() => {
      // Clear typing after 3 seconds
    }, 3000)
  }

  // Phát hiện ngôn ngữ khách → lưu BE (một lần / hội thoại nếu chưa có)
  useEffect(() => {
    if (!hasRealMessages) return
    if (conversationWithLabels.customerLang) return
    let cancelled = false
    void detectInboxConversationLang(conversation.id)
      .then((res) => {
        if (cancelled) return
        qc.setQueryData<{ conversation: CskhInboxConversation; messages: CskhInboxMessage[] }>(
          ['cskh', 'inbox', 'messages', conversation.id],
          (prev) => {
            if (!prev) return prev
            return {
              ...prev,
              conversation: {
                ...prev.conversation,
                customerLang: res.customerLang,
                customerLangLabel: res.customerLangLabel,
              },
            }
          }
        )
        patchInboxConversationInCache(qc, {
          id: conversation.id,
          customerLang: res.customerLang,
          customerLangLabel: res.customerLangLabel,
        })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [
    hasRealMessages,
    conversation.id,
    conversationWithLabels.customerLang,
    qc,
  ])

  // Mark-as-read được xử lý khi chọn hội thoại (ChatMessengerPane)

  // Auto-scroll to bottom when new messages arrive or when typing starts
  useEffect(() => {
    if (messages.length === 0 && !isCustomerTyping) return

    const lastMsgId = messages[messages.length - 1]?.id ?? ''
    const isNewMessage = lastMsgId !== lastMessageIdRef.current
    const isInitialLoad = !hasScrolledForConvRef.current

    // Only scroll if:
    // 1. It is the first scroll for this conversation (instant scroll)
    // 2. A new message arrived (smooth scroll)
    // 3. Customer started typing (smooth scroll)
    const nearBottom =
      !scrollRef.current ||
      scrollRef.current.scrollHeight - scrollRef.current.scrollTop - scrollRef.current.clientHeight < 140
    const shouldScroll =
      !loadingOlder && (isInitialLoad || ((isNewMessage || isCustomerTyping) && nearBottom))

    if (shouldScroll && scrollRef.current) {
      const behavior = isInitialLoad ? 'auto' : 'smooth'
      setTimeout(() => {
        if (!scrollRef.current) return
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior,
        })
        hasScrolledForConvRef.current = true
      }, 0)
    }

    lastMessageIdRef.current = lastMsgId
  }, [messages, isCustomerTyping, conversation.id, loadingOlder])

  const displayMessages = useMemo(() => {
    return collapseInboxMessageList(messages)
      .filter((m) => m.text || m.attachmentUrl || m.messageType)
      .map((m) => ({
        ...m,
        isOwn: m.senderType === 'staff',
      }))
  }, [messages])

  const loadOlder = useCallback(async () => {
    const el = scrollRef.current
    const oldest = messages[0]
    if (!el || !oldest?.sentAt || loadingOlderRef.current || !hasMoreOlder) return
    loadingOlderRef.current = true
    setLoadingOlder(true)
    const prevHeight = el.scrollHeight
    try {
      const older = await fetchInboxMessages(conversation.id, {
        before: oldest.sentAt,
        limit: 80,
      })
      if (older.messages.length < 80) setHasMoreOlder(false)
      qc.setQueryData<{ conversation: CskhInboxConversation; messages: CskhInboxMessage[] }>(
        ['cskh', 'inbox', 'messages', conversation.id],
        (prev) => {
          if (!prev) return older
          return {
            ...prev,
            messages: collapseInboxMessageList([...(older.messages ?? []), ...(prev.messages ?? [])]),
          }
        },
      )
      requestAnimationFrame(() => {
        if (!scrollRef.current) return
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevHeight
      })
    } finally {
      loadingOlderRef.current = false
      setLoadingOlder(false)
    }
  }, [conversation.id, hasMoreOlder, messages, qc])

  const translatingPending = useMemo(() => {
    const noise = new Set(['[Ảnh]', '[Video]', '[Sticker]', '[attachment]'])
    return displayMessages.some((m) => {
      if (m.messageType && m.messageType !== 'text') return false
      if (!m.text?.trim() || noise.has(m.text)) return false
      const hasVi = Boolean((m.originalText || m.translatedText || '').trim())
      if (hasVi) return false
      return /[\u0E00-\u0E7F\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(m.text)
    })
  }, [displayMessages])

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200/60 bg-white shrink-0">
        <div className="flex items-center gap-3">
          {conversation.customerPictureUrl ? (
            <img
              src={cskhMediaProxySrc(conversation.customerPictureUrl)}
              alt={conversation.customerName || 'Customer'}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-100"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center text-white text-xs font-bold ring-2 ring-slate-100">
              {(conversation.customerName || 'K').charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h3 className="text-[13px] font-bold text-slate-800 leading-tight">
              {conversationWithLabels.customerName ||
                `Khách hàng ${(conversationWithLabels.participantPsid ?? conversation.participantPsid ?? '').slice(0, 8) || '?'}`}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-[10px] text-slate-400 font-medium">Cuộc trò chuyện Facebook</span>
              {translatingPending && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-50 text-indigo-600 leading-none">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  Đang dịch…
                </span>
              )}
              {conversationWithLabels.fromAd && (
                <span className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-white leading-none">
                  Ads
                </span>
              )}
              <ConversationLabelBadges labels={conversationWithLabels.labels} max={4} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <ConversationViewHistory
            conversationId={conversation.id}
            pendingCount={
              conversationWithLabels.viewers?.filter((v) => !v.hasChot).length ?? 0
            }
          />
          <button
            onClick={handleMarkAsUnread}
            disabled={markUnreadMutation.isPending}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-200 cursor-pointer disabled:opacity-50"
            title="Đánh dấu chưa đọc"
          >
            <Mail className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-200 cursor-pointer"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        onScroll={() => {
          if (scrollRef.current && scrollRef.current.scrollTop < 56) void loadOlder()
        }}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gradient-to-b from-slate-50/50 to-white"
      >
        {showInitialLoader ? (
          <div className="flex items-center justify-center h-full min-h-[200px]">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          </div>
        ) : displayMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <AlertCircle className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm font-medium">Không có tin nhắn nào</p>
          </div>
        ) : (
          <>
            {loadingOlder && (
              <div className="flex justify-center py-1">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-300" />
              </div>
            )}
            {showHydratingHint && (
              <div className="flex justify-center py-1">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-300" />
              </div>
            )}
            {displayMessages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} isOwn={msg.isOwn} />
            ))}
            {isCustomerTyping && <TypingIndicator />}
          </>
        )}
      </div>

      {/* Label bar + Input — chỉ hiện khi đã có tin thật */}
      {!showInitialLoader && (
        <>
          <ChatLabelBar conversation={conversationWithLabels} />
          <ChatMessageInput
            conversationId={conversation.id}
            customerLang={conversationWithLabels.customerLang}
            customerLangLabel={conversationWithLabels.customerLangLabel}
            onSend={async (text, options) => {
              await sendMut.mutateAsync({ text, autoTranslate: options?.autoTranslate })
            }}
            onTyping={handleTyping}
            disabled={sendMut.isPending}
            draftText={draftText}
            onDraftApplied={onDraftApplied}
          />
        </>
      )}
    </div>
  )
}
