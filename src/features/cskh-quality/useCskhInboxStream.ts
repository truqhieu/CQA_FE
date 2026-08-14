import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { markInboxAsRead, type CskhCustomerIntent } from './api'
import {
  appendInboxMessagesToCache,
  patchInboxConversationInCache,
  type InboxRealtimeConversationPatch,
  type InboxRealtimeMessagePayload,
} from './inboxRealtimeCache'

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

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    const base = (import.meta.env.VITE_API_URL || 'http://localhost:3003').replace(/\/$/, '')
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null
    const url = token
      ? `${base}/cskh/inbox/stream?token=${encodeURIComponent(token)}`
      : `${base}/cskh/inbox/stream`
    const es = new EventSource(url, { withCredentials: true })
    let disconnectTimer: ReturnType<typeof setTimeout> | null = null
    const typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

    es.onopen = () => {
      if (disconnectTimer) clearTimeout(disconnectTimer)
      setConnected(true)
      // Chỉ refresh số tab — KHÔNG refetch infinite list (đã load nhiều trang sẽ treo)
      void qc.invalidateQueries({ queryKey: ['cskh', 'inbox', 'conversation-stats'] })
    }
    es.onerror = () => {
      if (disconnectTimer) clearTimeout(disconnectTimer)
      disconnectTimer = setTimeout(() => setConnected(false), 4000)
    }
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string) as InboxRealtimeEvent
        if (!data || data.type === 'ping') return

        // 1. Handle typing indicator
        if (data.type === 'typing' && data.conversationId) {
          setTypingConversationIds((prev) => new Set([...prev, data.conversationId!]))

          // Clear previous timeout if exists
          if (typingTimeouts.has(data.conversationId)) {
            clearTimeout(typingTimeouts.get(data.conversationId)!)
          }

          // Hide typing indicator after 3 seconds
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

        // 2. Handle intent updates (from AI analysis completion)
        if (data.type === 'intent' && data.conversationId && data.intent) {
          qc.setQueryData(['cskh', 'inbox', 'intent', data.conversationId], data.intent)
          onIntent?.(data.conversationId, data.intent)
          return
        }

        // 3. Update conversation info in cache if present
        if (data.conversation) {
          patchInboxConversationInCache(qc, data.conversation)
        }

        if (data.type === 'message' && data.messages?.length && data.conversationId) {
          appendInboxMessagesToCache(
            qc,
            data.conversationId,
            activeAuditDate ?? undefined,
            data.messages,
            data.conversation,
          )
          if (!data.conversation) {
            const last = data.messages[data.messages.length - 1]
            patchInboxConversationInCache(qc, {
              id: data.conversationId,
              lastMessage: last.text || undefined,
              lastMessageAt: last.sentAt,
            })
          }
          void qc.invalidateQueries({ queryKey: ['cskh', 'inbox', 'conversation-stats'] })
          onNewMessage?.(data.conversationId)
          if (data.conversationId === activeConversationId) {
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

        // 5. Handle read-receipt event (local cache update for messages)
        if (data.type === 'read-receipt' && data.conversationId) {
          qc.setQueryData<{ conversation: any; messages: any[] }>(
            ['cskh', 'inbox', 'messages', data.conversationId],
            (prev) => {
              if (!prev) return prev
              return {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.status !== 'read' ? { ...m, status: 'read' } : m
                ),
              }
            }
          )
          return
        }

        // 6. If we have a conversation event, we already patched it above, so we can just return
        if (data.type === 'conversation') {
          return
        }

        // Fallback: Only invalidate specific queries if we receive an unhandled event type
        // DO NOT invalidate ['cskh', 'inbox'] globally as it causes huge API overhead (refetching intents, etc.)
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
      if (disconnectTimer) clearTimeout(disconnectTimer)
      es.close()
      setConnected(false)
      typingTimeouts.forEach((timeout) => clearTimeout(timeout))
      typingTimeouts.clear()
    }
  }, [enabled, qc, activeConversationId, activeAuditDate, onIntent, onNewMessage])

  return { connected, typingConversationIds }
}
