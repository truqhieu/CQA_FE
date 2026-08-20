const FB_MEDIA_URL = /https?:\/\/(?:[\w.-]+\.)*(?:fbcdn\.net|fbsbx\.com)\/[^\s<>"']+/i

export type ResolvedMessageMedia = {
  displayText: string | null
  attachmentUrl: string | null
  messageType: 'text' | 'image' | 'video' | 'sticker'
}

function isVideoUrl(url: string): boolean {
  return (
    /\.(mp4|mpeg|webm|mov)(\?|$)/i.test(url) ||
    /\/video\//i.test(url) ||
    /\/v\/t\d+\/\d+\/\d+\/\d+\/[^/?]+\.mp4/i.test(url)
  )
}

function isImageUrl(url: string): boolean {
  return (
    /\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i.test(url) ||
    /\/v\/t39\.|\/v\/t1\.|image\//i.test(url) ||
    (/fbcdn\.net|fbsbx\.com/i.test(url) && !isVideoUrl(url))
  )
}

function looksLikeFragment(text: string): boolean {
  const t = text.trim()
  if (!t || t.startsWith('http')) return false
  return /[&?](oh=03_|oe=|dl=1)/.test(t) && t.length > 30
}

function parseTextMedia(text?: string | null): ResolvedMessageMedia {
  const raw = (text || '').trim()
  if (!raw) {
    return { displayText: null, attachmentUrl: null, messageType: 'text' }
  }

  const videoPrefix = raw.match(/^\[Video\]\s*(https?:\/\/\S+)?/i)
  if (videoPrefix) {
    const url = videoPrefix[1] ?? raw.match(FB_MEDIA_URL)?.[0] ?? null
    return {
      displayText: url ? null : '[Video]',
      attachmentUrl: url,
      messageType: 'video',
    }
  }

  const imagePrefix = raw.match(/^\[Ảnh\]\s*(https?:\/\/\S+)?/i)
  if (imagePrefix) {
    const url = imagePrefix[1] ?? raw.match(FB_MEDIA_URL)?.[0] ?? null
    return {
      displayText: url ? null : '[Ảnh]',
      attachmentUrl: url,
      messageType: 'image',
    }
  }

  const url = raw.match(FB_MEDIA_URL)?.[0] ?? null
  if (url) {
    const rest = raw.replace(url, '').trim()
    if (isVideoUrl(url)) {
      return { displayText: rest || null, attachmentUrl: url, messageType: 'video' }
    }
    if (isImageUrl(url)) {
      return { displayText: rest || null, attachmentUrl: url, messageType: 'image' }
    }
  }

  if (looksLikeFragment(raw)) {
    return { displayText: null, attachmentUrl: null, messageType: 'image' }
  }

  if (/^\[Sticker\]$/i.test(raw)) {
    return { displayText: '[Sticker]', attachmentUrl: null, messageType: 'sticker' }
  }

  if (raw === '[Ảnh]' || raw === '[attachment]' || /^image\//i.test(raw)) {
    return { displayText: null, attachmentUrl: null, messageType: 'image' }
  }

  return { displayText: raw, attachmentUrl: null, messageType: 'text' }
}

/** Gộp text + attachmentUrl + messageType từ API (kể cả dữ liệu legacy). */
export function resolveMessageMedia(input: {
  text?: string | null
  attachmentUrl?: string | null
  messageType?: string | null
}): ResolvedMessageMedia {
  const parsed = parseTextMedia(input.text)
  let attachmentUrl = input.attachmentUrl ?? parsed.attachmentUrl
  let messageType = parsed.messageType

  if (input.messageType === 'video' || input.messageType === 'image') {
    messageType = input.messageType
  }

  if (attachmentUrl && messageType === 'text') {
    messageType = isVideoUrl(attachmentUrl) ? 'video' : 'image'
  }

  let displayText = parsed.displayText
  if (messageType === 'video' && displayText?.startsWith('[Video]')) {
    displayText = null
  }
  if (messageType === 'image' && (displayText === '[Ảnh]' || displayText === '[attachment]')) {
    displayText = null
  }

  return { displayText, attachmentUrl, messageType }
}

/** Số ảnh trong preview danh sách — `[4 ảnh]`. */
export function parseInboxPhotoPreviewCount(preview?: string | null): number {
  const m = /^\[(\d+)\s+ảnh\]$/i.exec((preview ?? '').trim())
  return m ? Number(m[1]) : 0
}

/** Proxy media Facebook CDN qua BE (fallback khi load trực tiếp thất bại). */
export function cskhMediaProxySrc(mediaUrl?: string | null): string | undefined {
  if (!mediaUrl?.startsWith('http')) return undefined
  if (/fbcdn|fbsbx|facebook\.com|fb\.com/i.test(mediaUrl)) {
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:3003').replace(/\/$/, '')
    return `${base}/cskh/media/proxy?url=${encodeURIComponent(mediaUrl)}`
  }
  return mediaUrl
}

/** Ưu tiên URL gốc fbcdn — trình duyệt load trực tiếp với no-referrer. */
export function cskhMediaSrc(mediaUrl?: string | null): string | undefined {
  if (!mediaUrl?.startsWith('http')) return undefined
  return mediaUrl
}

/** Avatar Page Facebook — URL đã lưu hoặc fetch Graph qua BE. */
export function cskhPageAvatarSrc(input: {
  pictureUrl?: string | null
  pageId?: string | null
}): string | undefined {
  const { pictureUrl, pageId } = input
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:3003').replace(/\/$/, '')

  if (pictureUrl?.startsWith('http')) {
    if (/fbcdn|fbsbx|facebook\.com|fb\.com/i.test(pictureUrl)) {
      return `${base}/cskh/media/avatar?url=${encodeURIComponent(pictureUrl)}`
    }
    return pictureUrl
  }

  if (pageId) {
    return `${base}/cskh/media/page-avatar?pageId=${encodeURIComponent(pageId)}`
  }

  return undefined
}

/** Avatar khách — ưu tiên URL đã lưu. Chỉ live-fetch Graph khi `liveFetch` (hội thoại đang mở). */
export function cskhCustomerAvatarSrc(input: {
  pictureUrl?: string | null
  pageId?: string | null
  psid?: string | null
  liveFetch?: boolean
}): string | undefined {
  const { pictureUrl, pageId, psid, liveFetch } = input
  if (pictureUrl?.startsWith('http')) {
    if (/fbcdn|fbsbx|facebook\.com|fb\.com/i.test(pictureUrl)) {
      const base = (import.meta.env.VITE_API_URL || 'http://localhost:3003').replace(/\/$/, '')
      return `${base}/cskh/media/avatar?url=${encodeURIComponent(pictureUrl)}`
    }
    return pictureUrl
  }
  if (liveFetch && pageId && psid) {
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:3003').replace(/\/$/, '')
    return `${base}/cskh/media/customer-avatar?pageId=${encodeURIComponent(pageId)}&psid=${encodeURIComponent(psid)}`
  }
  return undefined
}
