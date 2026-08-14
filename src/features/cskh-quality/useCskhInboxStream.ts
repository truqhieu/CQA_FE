import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/axios'
import { markInboxAsRead, type CskhCustomerIntent } from './api'
import {
  appendInboxMessagesToCache,
  patchInboxConversationInCache,
  type InboxRealtimeConversationPatch,
  type InboxRealtimeMessagePayload,
} from './inboxRealtimeCache'
import { inboxRtLog, inboxRtWarn } from './inboxRealtimeDebug'

export type InboxRealtimeEvent = {
  type?: string
  conversationId?: string
  messages?: InboxRealtimeMessagePayload[]
  conversation?: InboxRealtimeConversationPatch
  intent?: CskhCustomerIntent
}

type UseCskhInboxStreamOptions = {
  enabled?: boolean
  activeConversationId?: string | null
  activeAuditDate?: string | null
  onIntent?: (conversationId: string, intent: CskhCustomerIntent) => void
  /** Gọi khi có tin mới qua SSE — dùng highlight hàng trong danh sách. */
  onNewMessage?: (conversationId: string) => void
}

/**
 * SSE từ BE — push tin + intent ngay khi webhook Facebook có sự kiện mới.
 * Giữ 1 kết nối EventSource ổn định — callback/context đọc qua ref, không remount SSE.
 */
export function useCskhInboxStream({
  enabled = true,
  activeConversationId,
  activeAuditDate,
  onIntent,
  onNewMessage,
}: UseCskhInboxStreamOptions = {}) {
  const qc = useQueryClient()
  const [connected, setConnected] = useState(false)
  const [typingConversationIds, setTypingConversationIds] = useState<Set<string>>(new Set())

  const onIntentRef = useRef(onIntent)
  const onNewMessageRef = useRef(onNewMessage)
  const activeConversationIdRef = useRef(activeConversationId)
  const activeAuditDateRef = useRef(activeAuditDate)

  useEffect(() => {
    onIntentRef.current = onIntent
  }, [onIntent])
  useEffect(() => {
    onNewMessageRef.current = onNewMessage
  }, [onNewMessage])
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId
  }, [activeConversationId])
  useEffect(() => {
    activeAuditDateRef.current = activeAuditDate
  }, [activeAuditDate])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    inboxRtLog('Debug ON — lọc Console: CSKH Inbox RT', {
      disable: "localStorage.setItem('cskh_inbox_debug', '0')",
    })

    const base = (apiClient.defaults.baseURL || 'http://localhost:3000/api/v1').replace(/\/$/, '')
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null
    const streamUrl = token
      ? `${base}/cskh/inbox/stream?token=${encodeURIComponent(token)}`
      : `${base}/cskh/inbox/stream`
    inboxRtLog('SSE connecting', {
      base,
      hasToken: Boolean(token),
      streamPath: '/cskh/inbox/stream',
    })
    const es = new EventSource(streamUrl, { withCredentials: true })
    let disconnectTimer: ReturnType<typeof setTimeout> | null = null
    const typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

    es.onopen = () => {
      if (disconnectTimer) clearTimeout(disconnectTimer)
      setConnected(true)
      inboxRtLog('SSE connected (Live)', { readyState: es.readyState })
      void qc.invalidateQueries({ queryKey: ['cskh', 'inbox', 'conversation-stats'] })
    }
    es.onerror = () => {
      inboxRtWarn('SSE error — sẽ hiện Offline sau 4s nếu không reconnect', {
        readyState: es.readyState,
        hint: 'readyState 0=CLOSED 1=OPEN 2=CONNECTING',
      })
      if (disconnectTimer) clearTimeout(disconnectTimer)
      disconnectTimer = setTimeout(() => setConnected(false), 4000)
    }
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string) as InboxRealtimeEvent
        if (!data || data.type === 'ping') return

        const lastMsg = data.messages?.[data.messages.length - 1]
        inboxRtLog('SSE event received', {
          type: data.type,
          conversationId: data.conversationId,
          messageCount: data.messages?.length ?? 0,
          messagePreview: lastMsg?.text?.slice(0, 80),
          messageSentAt: lastMsg?.sentAt,
          lastMessageAt: data.conversation?.lastMessageAt,
          lastMessage: data.conversation?.lastMessage?.slice(0, 80),
          customerName: data.conversation?.customerName,
        })

        if (data.type === 'typing' && data.conversationId) {
          setTypingConversationIds((prev) => new Set([...prev, data.conversationId!]))

          if (typingTimeouts.has(data.conversationId)) {
            clearTimeout(typingTimeouts.get(data.conversationId)!)
          }

          const timeout = setTimeout(() => {
            setTypingConversationIds((prev) => {
              const next = new Set(prev)
              next.delete(data.conversationId!)
              return next
            })
            typingTimeouts.delete(data.conversationId!)
          }, 3000)

          typingTimeouts.set(data.conversationId, timeout)
          return
        }

        if (data.type === 'intent' && data.conversationId && data.intent) {
          qc.setQueryData(['cskh', 'inbox', 'intent', data.conversationId], data.intent)
          onIntentRef.current?.(data.conversationId, data.intent)
          return
        }

        if (data.conversation) {
          patchInboxConversationInCache(qc, data.conversation, 'sse-conversation-patch')
        }

        if (data.type === 'message' && data.messages?.length && data.conversationId) {
          appendInboxMessagesToCache(
            qc,
            data.conversationId,
            activeAuditDateRef.current ?? undefined,
            data.messages,
            data.conversation,
          )
          if (!data.conversation) {
            const last = data.messages[data.messages.length - 1]
            patchInboxConversationInCache(
              qc,
              {
                id: data.conversationId,
                lastMessage: last.text || undefined,
                lastMessageAt: last.sentAt,
              },
              'sse-message-fallback-patch',
            )
          }
          void qc.invalidateQueries({ queryKey: ['cskh', 'inbox', 'conversation-stats'] })
          inboxRtLog('SSE message applied → bump list', {
            conversationId: data.conversationId,
            lastMessageAt: data.conversation?.lastMessageAt ?? lastMsg?.sentAt,
          })
          onNewMessageRef.current?.(data.conversationId)
          const activeId = activeConversationIdRef.current
          if (data.conversationId === activeId) {
            const cached = qc.getQueryData<{ conversation: { labels?: { id: string }[] } }>([
              'cskh',
              'inbox',
              'messages',
              data.conversationId,
            ])
            const hasLabels =
              (data.conversation?.labels?.length ?? cached?.conversation?.labels?.length ?? 0) > 0
            if (hasLabels) {
              markInboxAsRead(data.conversationId).catch((err: unknown) => {
                console.error('Failed to auto mark active conversation as read:', err)
              })
            }
          }
          return
        }

        if (data.type === 'read-receipt' && data.conversationId) {
          qc.setQueryData<{ conversation: any; messages: any[] }>(
            ['cskh', 'inbox', 'messages', data.conversationId],
            (prev) => {
              if (!prev) return prev
              return {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.status !== 'read' ? { ...m, status: 'read' } : m,
                ),
              }
            },
          )
          return
        }

        if (data.type === 'conversation') {
          if (data.conversationId && data.conversation?.lastMessageAt) {
            void qc.invalidateQueries({ queryKey: ['cskh', 'inbox', 'conversation-stats'] })
            inboxRtLog('SSE conversation bump', {
              conversationId: data.conversationId,
              lastMessageAt: data.conversation.lastMessageAt,
            })
            onNewMessageRef.current?.(data.conversationId)
          } else {
            inboxRtLog('SSE conversation (labels only, no reorder)', {
              conversationId: data.conversationId,
              labelCount: data.conversation?.labels?.length ?? 0,
            })
          }
          return
        }

        inboxRtWarn('SSE unhandled event type', {
          type: data.type,
          conversationId: data.conversationId,
        })
        if (data.conversationId) {
          void qc.invalidateQueries({
            queryKey: ['cskh', 'inbox', 'messages', data.conversationId],
            exact: true,
          })
        }
      } catch (err) {
        console.error('Failed to parse SSE event:', err)
      }
    }

    return () => {
      inboxRtLog('SSE disconnect (unmount)')
      if (disconnectTimer) clearTimeout(disconnectTimer)
      es.close()
      setConnected(false)
      typingTimeouts.forEach((timeout) => clearTimeout(timeout))
      typingTimeouts.clear()
    }
  }, [enabled, qc])

  return { connected, typingConversationIds }
}
