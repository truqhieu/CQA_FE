import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { CskhInboxConversation, CskhInboxConversationPage, CskhInboxMessage } from './api'
import { groupLiveMediaMessages } from './auditHelpers'
import { inboxRtLog, inboxRtWarn } from './inboxRealtimeDebug'

export type InboxRealtimeMessagePayload = CskhInboxMessage

export type InboxRealtimeConversationPatch = Partial<CskhInboxConversation> & {
  id: string
  labels?: CskhInboxConversation['labels']
}

function sortConversationsByRecent(
  a: Pick<CskhInboxConversation, 'id' | 'lastMessageAt' | 'updatedAt'>,
  b: Pick<CskhInboxConversation, 'id' | 'lastMessageAt' | 'updatedAt'>,
): number {
  const at = new Date(a.lastMessageAt ?? a.updatedAt ?? 0).getTime()
  const bt = new Date(b.lastMessageAt ?? b.updatedAt ?? 0).getTime()
  if (bt !== at) return bt - at
  return b.id.localeCompare(a.id)
}

function collapseInboxMessages(messages: CskhInboxMessage[]): CskhInboxMessage[] {
  const byId = new Map<string, CskhInboxMessage>()
  const byFb = new Map<string, string>()
  for (const msg of messages) {
    const prev = byId.get(msg.id)
    byId.set(msg.id, prev ? { ...prev, ...msg } : msg)
    if (msg.fbMessageId) {
      const existingId = byFb.get(msg.fbMessageId)
      if (existingId && existingId !== msg.id) {
        const keepId = msg.id.startsWith('temp-') ? existingId : msg.id
        const dropId = keepId === msg.id ? existingId : msg.id
        const keep = { ...byId.get(dropId), ...byId.get(keepId), fbMessageId: msg.fbMessageId } as CskhInboxMessage
        byId.delete(dropId)
        byId.set(keepId, keep)
        byFb.set(msg.fbMessageId, keepId)
      } else {
        byFb.set(msg.fbMessageId, msg.id)
      }
    }
  }
  const list = [...byId.values()]
  for (const temp of list.filter((m) => m.id.startsWith('temp-'))) {
    const match = list.find(
      (m) =>
        !m.id.startsWith('temp-') &&
        m.direction === 'outbound' &&
        (m.text || '').replace(/\s+/g, ' ').trim() === (temp.text || '').replace(/\s+/g, ' ').trim() &&
        Math.abs(new Date(m.sentAt).getTime() - new Date(temp.sentAt).getTime()) < 30_000,
    )
    if (match) byId.delete(temp.id)
  }
  const collapsed = [...byId.values()].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
  )
  const out: CskhInboxMessage[] = []
  const attKey = (url?: string | null) => (url || '').split('?')[0]
  for (const m of collapsed) {
    const last = out[out.length - 1]
    const lastText = (last?.text || '').replace(/\s+/g, ' ').trim()
    const nextText = (m.text || '').replace(/\s+/g, ' ').trim()
    const sameEcho =
      last &&
      last.direction === 'outbound' &&
      m.direction === 'outbound' &&
      lastText === nextText &&
      attKey(last.attachmentUrl) === attKey(m.attachmentUrl) &&
      Math.abs(new Date(last.sentAt).getTime() - new Date(m.sentAt).getTime()) < 12_000
    if (sameEcho) {
      if ((m.fbMessageId && !last.fbMessageId) || (m.status === 'sent' && last.status === 'pending')) {
        out[out.length - 1] = m
      }
      continue
    }
    out.push(m)
  }
  return out
}

/** Gộp các trang infinite query, khử trùng, sort theo tin mới nhất — tránh list nhảy loạn sau SSE. */
export function mergeInboxConversationPages(
  pages: CskhInboxConversationPage[] | undefined,
): CskhInboxConversation[] {
  if (!pages?.length) return []
  const byId = new Map<string, CskhInboxConversation>()
  for (const page of pages) {
    for (const conv of page.items) {
      const prev = byId.get(conv.id)
      if (!prev) {
        byId.set(conv.id, conv)
        continue
      }
      const prevAt = new Date(prev.lastMessageAt ?? 0).getTime()
      const nextAt = new Date(conv.lastMessageAt ?? 0).getTime()
      byId.set(conv.id, nextAt >= prevAt ? { ...prev, ...conv } : prev)
    }
  }
  return [...byId.values()].sort(sortConversationsByRecent)
}

function isInfiniteConversationData(
  data: unknown,
): data is InfiniteData<CskhInboxConversationPage> {
  return !!data && typeof data === 'object' && 'pages' in data && Array.isArray((data as InfiniteData<CskhInboxConversationPage>).pages)
}

function matchesConversationFilter(
  conv: CskhInboxConversation,
  pageIdFilter: string | undefined,
  activeFilter: string | undefined,
  search: string | undefined,
  labelFilter: string | undefined,
  platformFilter?: string,
  platformScopeKey?: string,
): boolean {
  if (pageIdFilter && conv.pageId !== pageIdFilter) return false
  if (platformScopeKey) {
    const allowed = platformScopeKey.split(',').filter(Boolean)
    if (allowed.length > 0 && !allowed.includes(conv.pageId)) return false
  }
  if (platformFilter === 'instagram' && conv.platform && conv.platform !== 'instagram') return false
  if (platformFilter === 'facebook' && conv.platform === 'instagram') return false
  if (platformFilter === 'threads' || platformFilter === 'youtube') return false
  if (activeFilter === 'ads' && !conv.fromAd) return false
  if (activeFilter === 'unread' && !(conv.unreadCount > 0 || conv.awaitingLabel)) return false
  if (activeFilter === 'normal' && conv.fromAd) return false
  const q = search?.trim().toLowerCase()
  if (q) {
    const hay = `${conv.customerName ?? ''} ${conv.lastMessage ?? ''} ${conv.pageName ?? ''}`.toLowerCase()
    if (!hay.includes(q)) return false
  }
  if (labelFilter === 'unlabeled') {
    if ((conv.labels?.length ?? 0) > 0) return false
  } else if (labelFilter && labelFilter !== 'all') {
    if (!conv.labels?.some((l) => l.id === labelFilter)) return false
  }
  return true
}

function mergeConversationPatch(
  prev: CskhInboxConversation,
  patch: InboxRealtimeConversationPatch,
): CskhInboxConversation {
  const next = { ...prev, ...patch } as CskhInboxConversation
  const prevAt = new Date(prev.lastMessageAt ?? 0).getTime()
  const patchAt = patch.lastMessageAt ? new Date(patch.lastMessageAt).getTime() : 0
  if (prevAt > 0 && patchAt > 0 && patchAt < prevAt) {
    next.lastMessageAt = prev.lastMessageAt
    if (patch.lastMessage == null) next.lastMessage = prev.lastMessage
  }
  return next
}

function patchFlatConversationList(
  prev: CskhInboxConversation[],
  patch: InboxRealtimeConversationPatch,
  key: readonly unknown[],
): CskhInboxConversation[] {
  if (!prev?.length) return prev
  const idx = prev.findIndex((c) => c.id === patch.id)
  if (idx < 0) {
    const pageIdFilter = key[3] as string | undefined
    if (pageIdFilter && pageIdFilter !== 'all' && patch.pageId && patch.pageId !== pageIdFilter) {
      return prev
    }
    const row = patch as CskhInboxConversation
    return [row, ...prev].sort(sortConversationsByRecent)
  }
  const next = [...prev]
  next[idx] = mergeConversationPatch(next[idx], patch)
  next.sort(sortConversationsByRecent)
  return next
}

function patchInfiniteConversationList(
  prev: InfiniteData<CskhInboxConversationPage>,
  patch: InboxRealtimeConversationPatch,
  key: readonly unknown[],
): { next: InfiniteData<CskhInboxConversationPage>; action: string } {
  if (!prev?.pages?.length) return { next: prev, action: 'no-pages' }

  const pageIdFilter = key[3] === 'all' ? undefined : (key[3] as string | undefined)
  const activeFilter = key[4] as string | undefined
  const search = (key[5] as string | undefined) || undefined
  const labelFilter = (key[6] as string | undefined) ?? 'all'
  const platformFilter = (key[7] as string | undefined) ?? 'all'
  const platformScopeKey = (key[8] as string | undefined) ?? ''

  const pages = prev.pages.map((p) => ({ ...p, items: [...p.items] }))
  let foundPage = -1
  let foundIdx = -1
  let action = 'noop'

  for (let pi = 0; pi < pages.length; pi++) {
    const idx = pages[pi].items.findIndex((c) => c.id === patch.id)
    if (idx >= 0) {
      foundPage = pi
      foundIdx = idx
      break
    }
  }

  if (foundPage >= 0) {
    const prevRow = pages[foundPage].items[foundIdx]
    const merged = mergeConversationPatch(prevRow, patch)
    const stillMatches = matchesConversationFilter(
      merged as CskhInboxConversation,
      pageIdFilter,
      activeFilter,
      search,
      labelFilter,
      platformFilter,
      platformScopeKey,
    )
    if (!stillMatches) {
      pages[foundPage].items.splice(foundIdx, 1)
      action = 'removed-filter-mismatch'
    } else if (patch.lastMessageAt) {
      const prevAt = new Date(prevRow.lastMessageAt ?? 0).getTime()
      const nextAt = new Date(merged.lastMessageAt ?? 0).getTime()
      if (nextAt < prevAt) {
        pages[foundPage].items[foundIdx] = merged
        action = 'ignored-stale-lastMessageAt'
      } else {
      pages[foundPage].items.splice(foundIdx, 1)
      pages[0].items = [merged, ...pages[0].items.filter((c) => c.id !== patch.id)]
      pages[0].items.sort(sortConversationsByRecent)
      const seen = new Set<string>()
      for (const page of pages) {
        page.items = page.items.filter((c) => {
          if (seen.has(c.id)) return false
          seen.add(c.id)
          return true
        })
      }
      action = foundPage === 0 && foundIdx === 0 ? 'updated-top-in-place' : 'moved-to-top'
      }
    } else {
      pages[foundPage].items[foundIdx] = merged
      action = 'updated-in-place'
    }
  } else {
    const row = patch as CskhInboxConversation
    if (matchesConversationFilter(row, pageIdFilter, activeFilter, search, labelFilter, platformFilter, platformScopeKey)) {
      pages[0].items = [row, ...pages[0].items.filter((c) => c.id !== row.id)]
      pages[0].items.sort(sortConversationsByRecent)
      action = 'inserted-top'
    } else {
      action = 'skipped-filter-mismatch'
    }
  }

  return { next: { ...prev, pages }, action }
}

export function appendInboxMessagesToCache(
  qc: QueryClient,
  conversationId: string,
  auditDateKey: string | undefined,
  incoming: InboxRealtimeMessagePayload[],
  conversationPatch?: InboxRealtimeConversationPatch,
) {
  if (!incoming.length) return
  const queries = qc.getQueryCache().findAll({
    queryKey: ['cskh', 'inbox', 'messages', conversationId],
  })
  const apply = (
    prev: { conversation: CskhInboxConversation; messages: CskhInboxMessage[] } | undefined,
  ) => {
    if (!prev) {
      // SSE chỉ vài tin mới — không seed cache thiếu lịch sử (mở chat sẽ trống).
      return prev
    }
    const byId = new Map((prev.messages ?? []).map((m) => [m.id, m]))
    for (const msg of incoming) {
      byId.set(msg.id, { ...byId.get(msg.id), ...msg })
    }
    const merged = collapseInboxMessageList([...byId.values()])
    return {
      ...prev,
      conversation: conversationPatch
        ? ({ ...prev.conversation, ...conversationPatch } as CskhInboxConversation)
        : prev.conversation,
      messages: merged,
    }
  }

  if (!queries.length) {
    const next = apply(undefined)
    if (next) {
      qc.setQueryData(['cskh', 'inbox', 'messages', conversationId], next)
    }
    return
  }

  for (const q of queries) {
    qc.setQueryData<{ conversation: CskhInboxConversation; messages: CskhInboxMessage[] }>(
      q.queryKey,
      (prev) => apply(prev) ?? prev,
    )
  }
}

export function patchInboxConversationInCache(
  qc: QueryClient,
  patch: InboxRealtimeConversationPatch,
  source = 'unknown',
) {
  const queries = qc.getQueryCache().findAll({
    queryKey: ['cskh', 'inbox', 'conversations'],
  })
  if (!queries.length) {
    inboxRtWarn('cache patch — no conversation queries in cache', {
      source,
      conversationId: patch.id,
      hint: 'List chưa load — SSE tới trước khi API list trả về',
    })
    return
  }
  for (const q of queries) {
    const key = q.queryKey
    const prev = q.state.data
    if (isInfiniteConversationData(prev)) {
      const { next, action } = patchInfiniteConversationList(prev, patch, key)
      qc.setQueryData(key, next)
      const mergedTop = mergeInboxConversationPages(next.pages).slice(0, 3).map((c) => ({
        id: c.id.slice(0, 8),
        name: c.customerName,
        lastMessage: c.lastMessage?.slice(0, 40),
        lastMessageAt: c.lastMessageAt,
      }))
      inboxRtLog('cache patch list', {
        source,
        action,
        conversationId: patch.id,
        queryKey: key.slice(3).join('|'),
        lastMessageAt: patch.lastMessageAt,
        lastMessage: patch.lastMessage?.slice(0, 60),
        top3After: mergedTop,
      })
    } else if (Array.isArray(prev)) {
      qc.setQueryData<CskhInboxConversation[]>(key, patchFlatConversationList(prev, patch, key))
      inboxRtLog('cache patch flat list', {
        source,
        conversationId: patch.id,
        queryKey: key.slice(3).join('|'),
      })
    }
  }
}

export function collapseInboxMessageList(messages: CskhInboxMessage[]) {
  return groupLiveMediaMessages(collapseInboxMessages(messages))
}

export const INBOX_MESSAGE_PREVIEW_PREFIX = 'preview-'

export function isInboxMessagePreview(id: string): boolean {
  return id.startsWith(INBOX_MESSAGE_PREVIEW_PREFIX)
}

/** Hiển thị ngay tin cuối từ danh sách trong khi API messages đang tải. */
export function buildInboxMessagesPreview(
  conversation: CskhInboxConversation,
): { conversation: CskhInboxConversation; messages: CskhInboxMessage[] } {
  const messages: CskhInboxMessage[] = []
  if (conversation.lastMessage && conversation.lastMessageAt) {
    messages.push({
      id: `${INBOX_MESSAGE_PREVIEW_PREFIX}${conversation.id}`,
      conversationId: conversation.id,
      fbMessageId: null,
      direction: 'inbound',
      senderType: 'customer',
      text: conversation.lastMessage,
      messageType: 'text',
      attachmentUrl: null,
      sentAt: conversation.lastMessageAt,
      status: 'sent',
    })
  }
  return { conversation, messages }
}

export function bumpAuditSidebarPreview(
  qc: QueryClient,
  auditId: string,
  preview: string,
  score?: number,
) {
  qc.setQueryData(['cskh', 'audits'], (prev: unknown) => {
    if (!Array.isArray(prev)) return prev
    return prev.map((row) => {
      if (!row || typeof row !== 'object' || (row as { id?: string }).id !== auditId) return row
      const r = row as { transcript?: unknown[]; score?: number }
      const transcript = Array.isArray(r.transcript) ? [...r.transcript] : []
      if (preview.trim()) {
        transcript.push({
          sender: 'Customer',
          text: preview,
          timestamp: new Date().toISOString(),
        })
      }
      return {
        ...row,
        score: score ?? r.score,
        transcript,
      }
    })
  })
}
