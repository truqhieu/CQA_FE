import { apiClient } from '@/lib/axios'

export type PancakeStatus = {
  connected: boolean
  userName: string | null
  activatedPageCount: number
  tokenMasked: string | null
  tokenExpiresAt: string | null
  updatedAt: string | null
  fromEnv?: boolean
}

export type PancakePage = {
  id: string
  name: string | null
  platform: string | null
  roleInPage: string | null
  username: string | null
  isActivated?: boolean
  category?: string | null
}

export type PancakeConversation = {
  id: string
  customerName: string | null
  customerId: string | null
  lastMessage: string | null
  updatedAt: string | null
  tags: string[]
}

export type PancakeMessage = {
  id: string
  message: string | null
  fromId: string | null
  fromName: string | null
  createdAt: string | null
  isFromPage: boolean
  attachments?: Array<{ url: string; type: string | null; name: string | null }>
}

export type PancakeLeadPreview = {
  fullName: string | null
  phones: string[]
  address?: string | null
  sourcePageId: string
  sourcePageName: string | null
  platform: string | null
  conversationId: string
  customerId: string | null
  dataAt: string | null
  lastMessage: string | null
  tags: string[]
  chatHint: string
}

export type PancakeLeadStage = 'conversation' | 'customer'

export type PancakeLead = {
  id: string
  pancakeCustomerId?: string
  fullName: string | null
  phones: string[]
  emails?: string[]
  address?: string | null
  notes?: string | null
  gender: string | null
  conversationId: string | null
  lastMessage: string | null
  dataAt: string | null
  sourcePageId: string
  sourcePageName: string | null
  platform: string | null
  hasPhone?: boolean
  type?: string | null
  stage?: PancakeLeadStage | string
  labels?: string[]
  followAt?: string | null
  orderedAt?: string | null
  orderRef?: string | null
  leadSource?: string
  customerId?: string | null
  psid?: string | null
}

export const LEAD_LABEL_OPTIONS = ['follow', 'Hẹn gọi', 'Quan tâm', 'Không mua', 'Đã chốt'] as const

export async function fetchPancakeStatus() {
  const { data } = await apiClient.get<PancakeStatus>('/pancake/status')
  return data
}

export async function connectPancake(accessToken: string) {
  const { data } = await apiClient.post<PancakeStatus>('/pancake/connect', { accessToken })
  return data
}

export async function disconnectPancake() {
  const { data } = await apiClient.delete<{ disconnected: boolean }>('/pancake/disconnect')
  return data
}

export async function fetchPancakePages() {
  const { data } = await apiClient.get<{ pages: PancakePage[]; count: number }>('/pancake/pages')
  return data
}

export async function fetchPancakeLeads(
  pageId: string,
  opts?: { cursor?: string; limit?: number; from?: 'db' | 'live' },
) {
  const { data } = await apiClient.get<{
    pageId: string
    pageName: string | null
    platform: string | null
    source: string
    leads: PancakeLead[]
    count: number
    withPhoneCount?: number
    stageCounts?: { conversation: number; customer: number; follow: number }
    total?: number | null
    nextCursor: string | null
    pageTokenRegenerated: boolean
    warning: string | null
    note: string
  }>(`/pancake/pages/${encodeURIComponent(pageId)}/leads`, {
    params: {
      cursor: opts?.cursor,
      limit: opts?.limit ?? 200,
      from: opts?.from ?? 'db',
    },
  })
  return data
}

export async function syncPancakePageCustomers(pageId: string) {
  const { data } = await apiClient.post<{
    pageId: string
    pageName: string | null
    fetched: number
    upserted: number
    totalFromPancake: number | null
    storedInDb: number
    withPhoneCount: number
    withAddressCount?: number
    closedCount?: number
    autoLabel?: { scanned: number; closed: number; follow: number; candidates: number }
    pageTokenRegenerated: boolean
    warning: string | null
    note: string
  }>(`/pancake/pages/${encodeURIComponent(pageId)}/sync`, {}, {
    timeout: 8 * 60 * 1000,
  })
  return data
}

export async function syncAllPancakePages() {
  const { data } = await apiClient.post<{
    totalPages: number
    ok: number
    failed: number
    results: Array<{
      pageId: string
      pageName: string | null
      ok: boolean
      upserted?: number
      storedInDb?: number
      error?: string
    }>
  }>('/pancake/sync-all', {}, {
    timeout: 60 * 60 * 1000,
  })
  return data
}

export async function autoLabelPancakePage(
  pageId: string,
  maxScan = 50,
  opts?: { onlyWithContact?: boolean },
) {
  const { data } = await apiClient.post<{
    candidates: number
    scanned: number
    closed: number
    follow: number
    errors: number
  }>(
    `/pancake/pages/${encodeURIComponent(pageId)}/auto-label`,
    { maxScan, onlyWithContact: opts?.onlyWithContact === true },
    { timeout: 8 * 60 * 1000 },
  )
  return data
}

export async function updatePancakeLead(
  leadId: string,
  body: {
    labels?: string[]
    follow?: boolean
    stage?: PancakeLeadStage
    phone?: string
    address?: string
    notes?: string
    orderRef?: string
  },
) {
  const { data } = await apiClient.patch(`/pancake/leads/${encodeURIComponent(leadId)}`, body)
  return data
}

export async function markPancakeLeadCustomer(
  leadId: string,
  body: { phone?: string; address?: string; orderRef?: string; notes?: string },
) {
  const { data } = await apiClient.post(
    `/pancake/leads/${encodeURIComponent(leadId)}/mark-customer`,
    body,
  )
  return data
}

export async function fetchPancakeConversations(pageId: string, opts?: { cursor?: string; limit?: number }) {
  const { data } = await apiClient.get<{
    conversations: PancakeConversation[]
    nextCursor: string | null
    pageTokenRegenerated: boolean
    warning: string | null
  }>(`/pancake/pages/${encodeURIComponent(pageId)}/conversations`, {
    params: { cursor: opts?.cursor, limit: opts?.limit ?? 30 },
  })
  return data
}

export async function fetchPancakeMessages(
  pageId: string,
  conversationId: string,
  opts?: { cursor?: string; limit?: number },
) {
  const { data } = await apiClient.get<{
    messages: PancakeMessage[]
    nextCursor: string | null
    pageTokenRegenerated: boolean
    warning: string | null
  }>(
    `/pancake/pages/${encodeURIComponent(pageId)}/conversations/${encodeURIComponent(conversationId)}/messages`,
    { params: { cursor: opts?.cursor, limit: opts?.limit ?? 50 } },
  )
  return data
}

export async function fetchPancakeLeadPreview(pageId: string, conversationId: string) {
  const { data } = await apiClient.get<{
    leadPreview: PancakeLeadPreview & {
      orderSignal?: { closed: boolean; confidence: string; reasons: string[] }
      leadUpgraded?: boolean
      leadStage?: string
      leadLabels?: string[]
      conversationType?: string | null
    }
    messages: PancakeMessage[]
    pageTokenRegenerated: boolean
    warning: string | null
    note: string
  }>(
    `/pancake/pages/${encodeURIComponent(pageId)}/conversations/${encodeURIComponent(conversationId)}/lead-preview`,
  )
  return data
}

export async function translatePancakeMessages(
  items: Array<{ id: string; text: string }>,
) {
  const { data } = await apiClient.post<{
    items: Array<{
      id: string
      originalText: string
      translatedText: string
      detectedLang: string
      sameLanguage: boolean
    }>
  }>('/pancake/translate', { items }, { timeout: 90_000 })
  return data
}
