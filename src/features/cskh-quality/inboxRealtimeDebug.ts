const PREFIX = '[CSKH Inbox RT]'

/** Bật mặc định. Tắt: localStorage.setItem('cskh_inbox_debug', '0') */
export function isInboxRealtimeDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('cskh_inbox_debug') !== '0'
}

export function inboxRtLog(step: string, detail?: Record<string, unknown>) {
  if (!isInboxRealtimeDebugEnabled()) return
  const at = new Date().toISOString()
  const lagMs =
    detail?.lastMessageAt && typeof detail.lastMessageAt === 'string'
      ? Date.now() - new Date(detail.lastMessageAt).getTime()
      : undefined
  const payload =
    lagMs != null && Number.isFinite(lagMs)
      ? { ...detail, lagFromMessageMs: lagMs }
      : detail
  if (payload) console.log(PREFIX, at, step, payload)
  else console.log(PREFIX, at, step)
}

export function inboxRtWarn(step: string, detail?: Record<string, unknown>) {
  if (!isInboxRealtimeDebugEnabled()) return
  console.warn(PREFIX, new Date().toISOString(), step, detail ?? '')
}
