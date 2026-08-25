/** Tháng lịch inbox — cùng múi giờ Asia/Ho_Chi_Minh với BE. */

export type InboxMonthRange = { key: string; fromMs: number; toMs: number }

const VN = 'Asia/Ho_Chi_Minh'

export function parseInboxMonthKey(raw?: string | null): InboxMonthRange | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec((raw ?? '').trim())
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const fromMs = new Date(`${m[1]}-${m[2]}-01T00:00:00+07:00`).getTime()
  const toMonth = month === 12 ? 1 : month + 1
  const toYear = month === 12 ? year + 1 : year
  const toMs = new Date(
    `${toYear}-${String(toMonth).padStart(2, '0')}-01T00:00:00+07:00`,
  ).getTime()
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return null
  return { key: `${m[1]}-${m[2]}`, fromMs, toMs }
}

export function currentInboxMonthKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: VN,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  return year && month ? `${year}-${month}` : now.toISOString().slice(0, 7)
}

export function formatInboxMonthLabel(key: string, compact = false): string {
  const parsed = parseInboxMonthKey(key)
  if (!parsed) return key
  const [y, m] = key.split('-')
  const monthNum = Number(m)
  return compact ? `Thg ${monthNum}/${y}` : `Tháng ${monthNum}, ${y}`
}

export function inboxMonthOptions(count = 18): { value: string; label: string }[] {
  const current = parseInboxMonthKey(currentInboxMonthKey())
  if (!current) return []
  const [y0, m0] = current.key.split('-').map(Number)
  const out: { value: string; label: string }[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(y0, m0 - 1 - i, 1))
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    out.push({ value, label: formatInboxMonthLabel(value) })
  }
  return out
}

export function conversationInInboxMonth(
  lastMessageAt: string | Date | undefined,
  monthKey: string | undefined,
): boolean {
  if (!monthKey) return true
  const range = parseInboxMonthKey(monthKey)
  if (!range) return true
  const t = new Date(lastMessageAt ?? 0).getTime()
  return t >= range.fromMs && t < range.toMs
}
