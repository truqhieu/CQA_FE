import type { CskhAuditRow, CskhInboxConversation, CskhInboxMessage } from './api'

export function formatAuditDateLabel(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

/** Nhãn khoảng ngày chấm điểm — một ngày hoặc from–to. */
export function formatAuditRangeLabel(from: string, to?: string) {
  if (!from) return '…'
  const end = to?.trim() || from
  if (from === end) return formatAuditDateLabel(from)
  return `${formatAuditDateLabel(from)} – ${formatAuditDateLabel(end)}`
}

export function auditRowMatchesScoreRange(row: CskhAuditRow, from: string, to: string): boolean {
  const meta = row.metadata
  const rowFrom = meta?.auditDateFrom || meta?.auditDate
  const rowTo = meta?.auditDateTo || meta?.auditDate
  if (!rowFrom || !rowTo) return false
  return rowFrom === from && rowTo === to
}

/** Khoảng ngày chấm điểm của một audit row (ưu tiên from–to, fallback auditDate). */
export function resolveAuditScopeFromRow(
  row: CskhAuditRow | null | undefined,
  fallbackFrom?: string,
  fallbackTo?: string
): { from: string; to: string; label: string } | null {
  const meta = row?.metadata
  const from = (meta?.auditDateFrom || meta?.auditDate || fallbackFrom || '').trim()
  const to = (meta?.auditDateTo || meta?.auditDate || fallbackTo || from).trim()
  if (!from) return null
  return { from, to: to || from, label: formatAuditRangeLabel(from, to) }
}

export function vietnamTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
}

/** Page "Kim Nhạn - Vân Phong Các" → NV "Kim Nhạn". */
export function extractAgentFromPageLabel(pageName?: string | null): string | null {
  if (!pageName?.trim()) return null
  const m = pageName.trim().match(/^([^-–—|/]+?)\s[-–—|/]\s+/)
  const candidate = m?.[1]?.trim()
  if (!candidate || candidate.length > 40) return null
  if (/shop|store|page|official|cửa hàng|cua hang|fanpage/i.test(candidate)) return null
  return candidate
}

export function displayAgentName(row: CskhAuditRow): string {
  const name = row.agentName?.trim()
  if (name && name !== 'Nhân viên') return name
  return extractAgentFromPageLabel(row.metadata?.pageName) || '—'
}

export function displayChannelName(row: CskhAuditRow): string {
  const pageName = row.metadata?.pageName
  return (
    extractAgentFromPageLabel(pageName) ||
    pageName?.trim() ||
    displayPageShopLabel(pageName) ||
    row.channel ||
    '—'
  )
}

export function displayCustomerName(name?: string | null): string {
  const n = name?.trim()
  if (n && n !== 'Khách hàng') return n
  return '—'
}

export function displayPageShopLabel(pageName?: string | null): string | null {
  if (!pageName?.trim()) return null
  const parts = pageName.trim().split(/\s[-–—|/]\s+/)
  if (parts.length >= 2) return parts.slice(1).join(' - ').trim() || null
  return pageName.trim()
}

export function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200'
  if (score >= 50) return 'text-amber-600 bg-amber-50 border-amber-200'
  return 'text-rose-600 bg-rose-50 border-rose-200'
}

export function parseBulletLines(text?: string | null): string[] {
  if (!text?.trim()) return []
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[\s•+\-–*]+/, '').trim())
    .filter(Boolean)
}

function splitLongListItem(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const byViolation = trimmed
    .split(/(?=Vi phạm Quy tắc)/i)
    .map((s) => s.trim())
    .filter(Boolean)
  if (byViolation.length > 1) return byViolation

  const byRule = trimmed
    .split(/(?=Quy tắc [IVXLC\d]+(?:\s*\(|:))/i)
    .map((s) => s.trim())
    .filter(Boolean)
  if (byRule.length > 1) return byRule

  const bySemicolon = trimmed
    .split(/;\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (bySemicolon.length > 1) return bySemicolon

  return [trimmed]
}

/** Chuẩn hóa field AI trả về dạng string | string[] | JSON string */
export function parseAiListField(raw: unknown): string[] {
  if (raw == null) return []

  if (Array.isArray(raw)) {
    return raw.flatMap((item) => splitLongListItem(String(item)))
  }

  if (typeof raw === 'string') {
    const text = raw.trim()
    if (!text) return []
    if (text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text) as unknown
        if (Array.isArray(parsed)) {
          return parsed.flatMap((item) => splitLongListItem(String(item)))
        }
      } catch {
        /* fall through */
      }
    }
    const lines = parseBulletLines(text)
    if (lines.length > 1) return lines
    return splitLongListItem(text)
  }

  return []
}

export function parseViolations(row: CskhAuditRow): string[] {
  return parseAiListField(row.metadata?.violations)
}

export function parseSuggestedReplies(row: CskhAuditRow): string[] {
  return parseAiListField(row.metadata?.suggestedReplies)
}

export type AuditActionItem = {
  issue: string
  suggestedReply: string
}

function parseActionItemsFromPipeText(text: string): AuditActionItem[] {
  return text
    .split(/\n+/)
    .map((line) => {
      const cleaned = line.replace(/^[\s•+\-–*]+/, '').trim()
      const sep = cleaned.indexOf('||')
      if (sep < 0) return null
      const issue = cleaned.slice(0, sep).trim()
      const suggestedReply = cleaned.slice(sep + 2).trim()
      if (!issue || !suggestedReply) return null
      return { issue, suggestedReply }
    })
    .filter((item): item is AuditActionItem => item != null)
}

/** Vi phạm/lỗi kèm gợi ý trả lời tương ứng — 1 mục = 1 card */
export function parseAuditActionItems(row: CskhAuditRow): AuditActionItem[] {
  const raw = row.metadata?.actionItems
  if (Array.isArray(raw)) {
    const parsed = raw
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const rowItem = item as Record<string, unknown>
        const issue = String(rowItem.issue ?? rowItem.violation ?? '').trim()
        const suggestedReply = String(
          rowItem.suggestedReply ?? rowItem.suggested_reply ?? ''
        ).trim()
        if (!issue || !suggestedReply) return null
        return { issue, suggestedReply }
      })
      .filter((item): item is AuditActionItem => item != null)
    if (parsed.length) return parsed
  }

  if (typeof raw === 'string' && raw.trim()) {
    const parsed = parseActionItemsFromPipeText(raw)
    if (parsed.length) return parsed
  }

  const violations = parseViolations(row)
  const suggestions = parseSuggestedReplies(row)
  if (violations.length && suggestions.length) {
    const count = Math.max(violations.length, suggestions.length)
    return Array.from({ length: count }, (_, i) => ({
      issue: violations[i] ?? violations[violations.length - 1] ?? 'Cần cải thiện',
      suggestedReply: suggestions[i] ?? suggestions[suggestions.length - 1] ?? '',
    })).filter((item) => item.suggestedReply)
  }

  if (suggestions.length) {
    return suggestions.map((suggestedReply, i) => ({
      issue: violations[i] ?? `Gợi ý ${i + 1}`,
      suggestedReply,
    }))
  }

  return violations.map((issue) => ({ issue, suggestedReply: '' }))
}

export function lastMessagePreview(row: CskhAuditRow): string {
  const transcript = Array.isArray(row.transcript) ? row.transcript : []
  const last = transcript[transcript.length - 1]
  return (last?.text || '').trim() || '—'
}

/** Nguồn hội thoại: quảng cáo Click-to-Messenger vs organic. */
export function resolveAuditFromAd(
  row: CskhAuditRow,
  inbox?: CskhInboxConversation | null
): { fromAd: boolean; adTitle: string | null; adId: string | null } {
  const fromAd = Boolean(row.fromAd ?? row.metadata?.fromAd ?? inbox?.fromAd)
  const adTitle = row.adTitle ?? row.metadata?.adTitle ?? inbox?.adTitle ?? null
  const adId = row.adId ?? row.metadata?.adId ?? inbox?.adId ?? null
  return { fromAd, adTitle, adId }
}

/** Tin hệ thống Facebook — lọc khi hiển thị transcript cũ. */
export function isNoiseMessageText(text?: string | null): boolean {
  const t = (text || '').trim()
  if (!t) return false
  return [
    /đã trả lời một quảng cáo/i,
    /replied to (?:your|an?) ad/i,
    /^Chào\s+.+\!\s*Chúng tôi có thể giúp gì cho bạn\??$/i,
    /Bạn đang phản hồi bình luận/i,
    /You(?:'re| are) responding to a comment/i,
    /facebook\.com\/.*comment_id=/i,
  ].some((p) => p.test(t))
}

export type DisplayTranscriptLine = {
  sender?: string
  text?: string
  timestamp?: string
  imageUrl?: string | null
  videoUrl?: string | null
  attachmentUrl?: string | null
  attachmentUrls?: string[]
  type?: string
}

export function filterDisplayTranscript(lines: DisplayTranscriptLine[]): DisplayTranscriptLine[] {
  return lines
    .filter((line) => !isNoiseMessageText(line.text))
    .map((line) => normalizeTranscriptMediaLine(line))
}

/** Loại URL ảnh/video trùng (Facebook hay trả cùng CDN cho nhiều attachment). */
export function dedupeMediaUrls(urls: (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of urls) {
    const u = (raw ?? '').trim()
    if (!u.startsWith('http')) continue
    const key = u.split('?')[0].replace(/\/$/, '')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(u)
  }
  return out
}

export function normalizeTranscriptMediaLine(line: DisplayTranscriptLine): DisplayTranscriptLine {
  const urls = dedupeMediaUrls([
    ...(line.attachmentUrls ?? []),
    line.attachmentUrl,
    line.imageUrl,
    line.videoUrl,
  ])
  if (!urls.length) return line
  const isVideo = line.type === 'video' || Boolean(line.videoUrl)
  return {
    ...line,
    attachmentUrl: urls[0],
    imageUrl: isVideo ? line.imageUrl : urls[0],
    videoUrl: isVideo ? urls[0] : line.videoUrl,
    attachmentUrls: urls.length > 1 ? urls : undefined,
  }
}

export function vietnamAuditDayEndMs(auditDate: string): number {
  return new Date(`${auditDate}T23:59:59.999+07:00`).getTime()
}

export function vietnamAuditDayStartMs(auditDate: string): number {
  return new Date(`${auditDate}T00:00:00+07:00`).getTime()
}

function parseMessageTime(iso?: string | null): number {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : t
}

export function messagesAfterAuditDate(
  messages: CskhInboxMessage[],
  auditDate: string
): CskhInboxMessage[] {
  return messagesAfterAuditRange(messages, auditDate, auditDate)
}

/** Tin inbox sau hết khoảng chấm điểm (dùng ngày kết thúc của range). */
export function messagesAfterAuditRange(
  messages: CskhInboxMessage[],
  auditDateFrom: string,
  auditDateTo?: string
): CskhInboxMessage[] {
  const end = (auditDateTo?.trim() || auditDateFrom).trim()
  if (!end) return messages
  const endMs = vietnamAuditDayEndMs(end)
  return messages.filter((m) => {
    const t = parseMessageTime(m.sentAt)
    return t > endMs && !isNoiseMessageText(m.text)
  })
}

/** Tin inbox chưa có trong transcript audit — dùng cho chat realtime kiểu Pancake. */
export function inboxMessagesAfterTranscript(
  transcript: Array<{ sender?: string; text?: string; timestamp?: string }>,
  messages: CskhInboxMessage[]
): CskhInboxMessage[] {
  let lastTranscriptTs = 0
  const seen = new Set<string>()
  for (const line of transcript) {
    lastTranscriptTs = Math.max(lastTranscriptTs, parseMessageTime(line.timestamp))
    const role = line.sender === 'Staff' ? 'staff' : 'customer'
    const text = (line.text ?? '').trim().toLowerCase()
    if (text) seen.add(`${role}|${text}`)
  }

  const cutoff = lastTranscriptTs > 0 ? lastTranscriptTs - 120_000 : 0

  return messages.filter((m) => {
    if (isNoiseMessageText(m.text)) return false
    const t = parseMessageTime(m.sentAt)
    if (lastTranscriptTs > 0 && t < cutoff) return false
    const role = m.senderType === 'staff' ? 'staff' : 'customer'
    const text = (m.text ?? '').trim().toLowerCase()
    const key = `${role}|${text}`
    if (text && seen.has(key)) {
      const lineTs = [...transcript]
        .filter((line) => {
          const r = line.sender === 'Staff' ? 'staff' : 'customer'
          return `${r}|${(line.text ?? '').trim().toLowerCase()}` === key
        })
        .map((line) => parseMessageTime(line.timestamp))
      if (lineTs.some((ts) => ts > 0 && Math.abs(ts - t) <= 120_000)) return false
    }
    return true
  })
}

/** Gộp nhiều tin ảnh cùng lúc (Facebook gửi 1 lần → nhiều row inbox) thành 1 bubble. */
export function groupLiveMediaMessages(
  messages: CskhInboxMessage[]
): Array<CskhInboxMessage & { attachmentUrls?: string[]; groupedMediaCount?: number }> {
  const grouped: Array<CskhInboxMessage & { attachmentUrls?: string[]; groupedMediaCount?: number }> =
    []

  const isImageRow = (m: CskhInboxMessage) => {
    const type = (m.messageType ?? '').toLowerCase()
    if (type === 'video' || type === 'sticker' || type === 'audio') return false
    return type === 'image' || type === 'photo' || type === 'file' || Boolean(m.attachmentUrl)
  }
  const isPlaceholderText = (text?: string | null) => {
    const t = (text ?? '').trim()
    return !t || /^(?:\[Ảnh\]|\[Video\]|\[attachment\])$/i.test(t)
  }

  for (const msg of messages) {
    const prev = grouped[grouped.length - 1]
    const msgTs = parseMessageTime(msg.sentAt)
    const prevTs = prev ? parseMessageTime(prev.sentAt) : 0
    const prevUrls = dedupeMediaUrls([
      ...(prev?.attachmentUrls ?? []),
      prev?.attachmentUrl,
    ])
    const msgUrls = dedupeMediaUrls([...(msg.attachmentUrls ?? []), msg.attachmentUrl])
    const canMerge =
      prev &&
      prev.senderType === msg.senderType &&
      isImageRow(prev) &&
      isImageRow(msg) &&
      isPlaceholderText(msg.text) &&
      Math.abs(msgTs - prevTs) <= 15000

    if (canMerge) {
      const merged = dedupeMediaUrls([...prevUrls, ...msgUrls])
      prev.groupedMediaCount =
        (prev.groupedMediaCount ?? Math.max(1, prevUrls.length)) + Math.max(1, msgUrls.length)
      if (merged.length) {
        prev.attachmentUrls = merged.length > 1 ? merged : undefined
        if (!prev.attachmentUrl) prev.attachmentUrl = merged[0]
      }
      continue
    }

    grouped.push({
      ...msg,
      attachmentUrls: msg.attachmentUrls?.length
        ? msg.attachmentUrls
        : msgUrls.length > 1
          ? msgUrls
          : undefined,
      groupedMediaCount: isImageRow(msg) ? Math.max(1, msgUrls.length) : undefined,
    })
  }

  return grouped
}
