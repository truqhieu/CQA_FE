import { Fragment, startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CloudDownload,
  Hash,
  Languages,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  Tag,
  Users,
  AlertTriangle,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getApiErrorMessage } from '@/lib/axios'
import {
  LEAD_LABEL_OPTIONS,
  fetchPancakeLeadPreview,
  fetchPancakeLeads,
  fetchPancakePages,
  fetchPancakeStatus,
  markPancakeLeadCustomer,
  syncPancakePageCustomers,
  syncAllPancakePages,
  autoLabelPancakePage,
  translatePancakeMessages,
  updatePancakeLead,
  type PancakeLead,
  type PancakeMessage,
  type PancakePage,
} from './api'
import { platformLabel } from './PancakeChannelsPanel'
import {
  detectChannelMarket,
  marketLabel,
  type ChannelMarket,
} from './channelMarket'

type StageTab = 'all' | 'conversation' | 'customer' | 'follow'

function errMsg(e: unknown, fallback = 'Lỗi') {
  const msg = getApiErrorMessage(e)
  if (msg && msg !== 'Đã có lỗi xảy ra') return msg
  return fallback
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function stripHtml(html: string | null | undefined) {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function pancakeMediaSrc(url: string) {
  if (/fbcdn|fbsbx|facebook\.com|scontent/i.test(url)) {
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '')
    return `${base}/cskh/media/proxy?url=${encodeURIComponent(url)}`
  }
  return url
}

function isAttachmentPlaceholderText(text: string) {
  const t = text.trim().replace(/\s+/g, ' ')
  return (
    /^\[?\s*attachments?\s*\]?$/i.test(t) ||
    /^attachment$/i.test(t) ||
    /^\[(ảnh|image|photo|file|video|sticker|tệp)\]$/i.test(t) ||
    /^(tệp\s*)?đính kèm$/i.test(t) ||
    /^ảnh đính kèm$/i.test(t) ||
    /^attached file$/i.test(t)
  )
}

function isFacebookMarketingNoise(text: string) {
  const t = text.trim()
  if (
    /^ข้อเสนอและประกาศ$|^ưu đãi và thông báo$|^offers and announcements$/i.test(t)
  ) {
    return true
  }
  return /muốn gửi tin nhắn cho bạn|tin nhắn quảng cáo|promotional message|advertising message|wants to send you a message|facebook\.com\/help\/messenger|messenger-app\/564030381383143|this (may|might) be (an? )?(ad|advert)|ต้องการส่งข้อความถึงคุณ|ข้อความโฆษณา/i.test(
    t,
  )
}

function looksLikeImageUrl(text: string) {
  return (
    /^https?:\/\//i.test(text.trim()) &&
    (/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i.test(text) ||
      /fbcdn|scontent|cdninstagram|tiktokcdn/i.test(text))
  )
}

function isAdReferralSystemText(text: string) {
  return /đã trả lời một quảng cáo|replied to (?:your|an?) ad|trả lời qua quảng cáo|qua quảng cáo trên facebook|ตอบกลับโฆษณ|ตอบผ่านโฆษณ|ผ่านโฆษณ|จากโฆษณ/i.test(
    text,
  )
}

function isFacebookAdIdText(text: string) {
  return /^\d{10,20}$/.test(text.trim())
}

function isFacebookAdLink(url: string) {
  return /facebook\.com|fb\.com|fb\.me/i.test(url) && !/fbcdn|scontent/i.test(url)
}

function needsVietnameseTranslation(text: string) {
  const t = text.trim()
  if (!t || isAttachmentPlaceholderText(t) || /tin nhắn đã hết hạn/i.test(t)) return false
  if (isAdReferralSystemText(t) || isFacebookMarketingNoise(t) || looksLikeImageUrl(t)) return false
  const rest = t.replace(/[\u0E00-\u0E7F\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+/g, ' ').trim()
  if (rest && /[àáạảãâăèéêìíòóôơùúưỳỵđ]/i.test(rest) && !/[\u0E00-\u0E7F]/.test(rest)) {
    return false
  }
  return /[\u0E00-\u0E7F\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(t)
}

function attachmentLooksLikeImage(a: { url: string; type?: string | null; name?: string | null }) {
  const type = String(a.type || '')
  if (/video|audio|file/i.test(type) && !/image|photo|sticker|gif/i.test(type)) {
    if (/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i.test(a.url) || /fbcdn|scontent/i.test(a.url)) {
      return !/\.(mp4|mov|webm|pdf|zip|docx?)(\?|$)/i.test(a.url)
    }
    return false
  }
  return (
    /image|photo|sticker|gif|^$|null/i.test(type || 'image') ||
    /\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i.test(a.url) ||
    /fbcdn|scontent|cdninstagram|tiktokcdn/i.test(a.url)
  )
}

function fileLabelFromUrl(url: string, name?: string | null) {
  const n = (name || '').trim()
  if (n && !isAttachmentPlaceholderText(n) && n.toLowerCase() !== 'tệp đính kèm') return n
  try {
    const path = decodeURIComponent(new URL(url).pathname)
    const base = path.split('/').filter(Boolean).pop() || ''
    if (base && !/^l\.php$/i.test(base)) return base
  } catch {
    /* ignore */
  }
  return 'Mở tệp đính kèm'
}

function tidyChatMessages(messages: PancakeMessage[]): PancakeMessage[] {
  const sorted = [...messages].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
    if (ta !== tb) return ta - tb
    return String(a.id).localeCompare(String(b.id))
  })
  const out: PancakeMessage[] = []
  const seen = new Set<string>()
  for (const m of sorted) {
    if (m.id && seen.has(m.id)) continue
    if (m.id) seen.add(m.id)
    const attachments = (m.attachments ?? []).filter(
      (a) => !isFacebookAdLink(a.url) && !isFacebookAdIdText(fileLabelFromUrl(a.url, a.name)),
    )
    const text = stripHtml(m.message)
    if (isFacebookMarketingNoise(text)) continue
    const isSystem = isAdReferralSystemText(text) || isFacebookAdIdText(text)
    const last = out[out.length - 1]
    if (isSystem) {
      if (last && (isAdReferralSystemText(stripHtml(last.message)) || last.message === 'Khách đã trả lời một quảng cáo')) {
        continue
      }
      out.push({
        ...m,
        message: 'Khách đã trả lời một quảng cáo',
        isFromPage: false,
        attachments: [],
      })
      continue
    }
    if (
      last &&
      text &&
      stripHtml(last.message) === text &&
      last.isFromPage === m.isFromPage
    ) {
      const t1 = last.createdAt ? new Date(last.createdAt).getTime() : 0
      const t2 = m.createdAt ? new Date(m.createdAt).getTime() : 0
      if (Math.abs(t2 - t1) <= 180_000) continue
    }
    if (!text && !attachments.length) continue
    out.push({ ...m, attachments })
  }
  return out
}

function hasPancakeChat(lead: { conversationId?: string | null }) {
  return Boolean(lead.conversationId?.trim())
}

function displayLeadLabels(lead: {
  stage?: string | null
  labels?: string[] | null
  conversationId?: string | null
}) {
  if (!hasPancakeChat(lead)) return []
  const raw = lead.labels ?? []
  const closed = lead.stage === 'customer' || raw.includes('Đã chốt')
  const labels = closed
    ? raw.filter((l) => l.toLowerCase() !== 'follow' && l !== 'Follow' && l !== 'follow-up')
    : [...raw]
  if (closed && !labels.includes('Đã chốt')) labels.unshift('Đã chốt')
  return labels
}

function pageWithMarket(p: PancakePage) {
  return { ...p, market: detectChannelMarket(p.name, p.username) }
}

function conversationKindLabel(type?: string | null, conversationId?: string | null) {
  if (!conversationId?.trim()) return null
  const t = (type || '').trim().toLowerCase()
  const id = conversationId.toLowerCase()
  if (
    t.includes('comment') ||
    t === 'feed' ||
    t === 'post' ||
    t === 'rate' ||
    t === 'rating' ||
    t === 'review' ||
    id.includes('comment') ||
    id.includes('feed') ||
    id.includes('_post')
  ) {
    return 'comment'
  }
  if (t || conversationId) return 'inbox'
  return null
}

function StageBadge({
  stage,
  hasConversation,
  onOpenChat,
}: {
  stage?: string | null
  hasConversation?: boolean
  onOpenChat?: () => void
}) {
  if (!hasConversation) {
    return <span className="text-[11px] text-slate-400">Không có hội thoại</span>
  }
  const isCustomer = stage === 'customer'
  const label = isCustomer ? 'Đã khách' : 'Hội thoại'
  const baseClass = isCustomer
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100'
    : 'border-slate-200 bg-slate-100 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'

  if (onOpenChat) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onOpenChat()
        }}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition ${baseClass}`}
        title="Xem hội thoại"
      >
        <MessageCircle className="size-3" />
        {label}
      </button>
    )
  }

  return (
    <Badge
      variant="secondary"
      className={
        isCustomer
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50'
          : 'bg-slate-100 text-slate-600'
      }
    >
      {label}
    </Badge>
  )
}

export default function PancakeTestPage() {
  const qc = useQueryClient()
  const [selectedPageId, setSelectedPageId] = useState('')
  const [marketFilter, setMarketFilter] = useState<'all' | ChannelMarket>('all')
  const [stageTab, setStageTab] = useState<StageTab>('all')
  const [searchName, setSearchName] = useState('')
  const [searchId, setSearchId] = useState('')
  const [channelQuery, setChannelQuery] = useState('')
  const [channelOpen, setChannelOpen] = useState(false)
  const channelBoxRef = useRef<HTMLDivElement>(null)
  const contactScanAtRef = useRef<Record<string, number>>({})
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null)
  const [chatLead, setChatLead] = useState<PancakeLead | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [orderPhone, setOrderPhone] = useState('')
  const [orderAddress, setOrderAddress] = useState('')
  const [orderRef, setOrderRef] = useState('')

  const statusQ = useQuery({
    queryKey: ['pancake', 'status'],
    queryFn: fetchPancakeStatus,
    staleTime: 5 * 60_000,
  })

  const pagesQ = useQuery({
    queryKey: ['pancake', 'pages'],
    queryFn: fetchPancakePages,
    enabled: Boolean(statusQ.data?.connected),
    staleTime: 5 * 60_000,
    retry: (count, err) => {
      if (/429|giới hạn tần suất/i.test(String((err as Error)?.message || ''))) return false
      return count < 1
    },
  })

  const pagesAll = useMemo(
    () => (pagesQ.data?.pages ?? []).map(pageWithMarket),
    [pagesQ.data?.pages],
  )
  const pages = useMemo(() => {
    if (marketFilter === 'all') return pagesAll
    return pagesAll.filter((p) => p.market === marketFilter)
  }, [pagesAll, marketFilter])

  const filteredPages = useMemo(() => {
    const q = channelQuery.trim().toLowerCase()
    if (!q) return pages
    return pages.filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        p.name?.toLowerCase().includes(q) ||
        p.username?.toLowerCase().includes(q) ||
        platformLabel(p.platform).toLowerCase().includes(q),
    )
  }, [pages, channelQuery])

  const selectedPage = pagesAll.find((p) => p.id === selectedPageId) ?? null
  const connected = Boolean(statusQ.data?.connected)

  useEffect(() => {
    if (!channelOpen) return
    const onDoc = (e: MouseEvent) => {
      if (!channelBoxRef.current?.contains(e.target as Node)) setChannelOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [channelOpen])

  const leadsQ = useQuery({
    queryKey: ['pancake', 'leads', selectedPageId],
    queryFn: async () => {
      const data = await fetchPancakeLeads(selectedPageId, { limit: 200, from: 'db' })
      if (data.warning) setWarning(data.warning)
      else setWarning(null)
      return data
    },
    enabled: Boolean(selectedPageId),
    retry: 1,
    refetchInterval: (query) => {
      const leads = (query.state.data as { leads?: Array<{ conversationId?: string | null; lastMessage?: string | null }> } | undefined)?.leads
      if (!leads?.length) return false
      const incomplete = leads.some((l) => {
        if (!l.conversationId) return false
        const msg = (l.lastMessage || '').trim()
        return !msg || /^ảnh đính kèm$/i.test(msg)
      })
      return incomplete ? 3000 : false
    },
  })

  const syncM = useMutation({
    mutationFn: (pageId: string) => syncPancakePageCustomers(pageId),
    onSuccess: async (data, pageId) => {
      toast.success(data.note)
      if (data.warning) setWarning(data.warning)
      await qc.invalidateQueries({ queryKey: ['pancake', 'leads', pageId] })
    },
    onError: (e) => toast.error(errMsg(e, 'Đồng bộ thất bại')),
  })

  const syncAllM = useMutation({
    mutationFn: () => syncAllPancakePages(),
    onSuccess: async (data) => {
      toast.success(
        `Đã đồng bộ ${data.ok}/${data.totalPages} kênh` +
          (data.failed ? ` · lỗi ${data.failed}` : ''),
      )
      await qc.invalidateQueries({ queryKey: ['pancake', 'leads'] })
      await qc.invalidateQueries({ queryKey: ['pancake', 'pages'] })
    },
    onError: (e) => toast.error(errMsg(e, 'Đồng bộ toàn bộ thất bại')),
  })

  const autoLabelM = useMutation({
    mutationFn: (args: string | { pageId: string; silent?: boolean; onlyWithContact?: boolean }) => {
      const pageId = typeof args === 'string' ? args : args.pageId
      const onlyWithContact = typeof args === 'object' ? Boolean(args.onlyWithContact) : false
      return autoLabelPancakePage(pageId, onlyWithContact ? 40 : 50, { onlyWithContact })
    },
    onSuccess: async (data, args) => {
      const pageId = typeof args === 'string' ? args : args.pageId
      const silent = typeof args === 'object' && args.silent
      if (!silent) {
        toast.success(
          `Quét ${data.scanned} hội thoại → ${data.closed} Đã chốt · ${data.follow} follow`,
        )
      } else if (data.closed > 0) {
        toast.success(`Đã gắn ${data.closed} nhãn Đã chốt từ hội thoại có SĐT + địa chỉ`)
      }
      await qc.invalidateQueries({ queryKey: ['pancake', 'leads', pageId] })
    },
    onError: (e) => toast.error(errMsg(e, 'Quét nhãn thất bại')),
  })

  const updateM = useMutation({
    mutationFn: (args: {
      leadId: string
      body: Parameters<typeof updatePancakeLead>[1]
    }) => updatePancakeLead(args.leadId, args.body),
    onSuccess: async () => {
      toast.success('Đã cập nhật lead')
      await qc.invalidateQueries({ queryKey: ['pancake', 'leads', selectedPageId] })
    },
    onError: (e) => toast.error(errMsg(e, 'Cập nhật thất bại')),
  })

  const markCustomerM = useMutation({
    mutationFn: (args: {
      leadId: string
      body: { phone?: string; address?: string; orderRef?: string }
    }) => markPancakeLeadCustomer(args.leadId, args.body),
    onSuccess: async () => {
      toast.success('Đã lên khách — gắn SĐT/địa chỉ từ đơn')
      setOrderPhone('')
      setOrderAddress('')
      setOrderRef('')
      await qc.invalidateQueries({ queryKey: ['pancake', 'leads', selectedPageId] })
    },
    onError: (e) => toast.error(errMsg(e, 'Không đánh dấu được khách')),
  })

  const leads = leadsQ.data?.leads ?? []
  const stageCounts = leadsQ.data?.stageCounts

  useEffect(() => {
    if (!selectedPageId || leadsQ.isLoading || autoLabelM.isPending) return
    const last = contactScanAtRef.current[selectedPageId] ?? 0
    if (Date.now() - last < 60_000) return
    const needScan = leads.some(
      (l) =>
        hasPancakeChat(l) &&
        l.phones.length > 0 &&
        Boolean(l.address?.trim()) &&
        l.stage !== 'customer' &&
        !displayLeadLabels(l).includes('Đã chốt'),
    )
    if (!needScan) return
    contactScanAtRef.current[selectedPageId] = Date.now()
    autoLabelM.mutate({ pageId: selectedPageId, silent: true, onlyWithContact: true })
  }, [selectedPageId, leads, leadsQ.isLoading, autoLabelM])

  const filteredLeads = useMemo(() => {
    let list = leads
    if (stageTab === 'conversation') {
      list = list.filter((l) => (l.stage || 'conversation') !== 'customer')
    }
    if (stageTab === 'customer') list = list.filter((l) => l.stage === 'customer')
    if (stageTab === 'follow') list = list.filter((l) => Boolean(l.followAt))

    const nameQ = searchName.trim().toLowerCase()
    if (nameQ) {
      list = list.filter(
        (l) =>
          l.fullName?.toLowerCase().includes(nameQ) ||
          l.phones.some((p) => p.includes(nameQ)) ||
          l.address?.toLowerCase().includes(nameQ) ||
          l.lastMessage?.toLowerCase().includes(nameQ) ||
          l.labels?.some((x) => x.toLowerCase().includes(nameQ)) ||
          l.orderRef?.toLowerCase().includes(nameQ),
      )
    }

    const idQ = searchId.trim().toLowerCase()
    if (idQ) {
      list = list.filter(
        (l) =>
          l.id.toLowerCase().includes(idQ) ||
          l.pancakeCustomerId?.toLowerCase().includes(idQ) ||
          l.conversationId?.toLowerCase().includes(idQ) ||
          l.customerId?.toLowerCase().includes(idQ) ||
          l.psid?.toLowerCase().includes(idQ),
      )
    }
    return list
  }, [leads, stageTab, searchName, searchId])

  const expandedLead =
    filteredLeads.find((l) => l.id === expandedLeadId) ||
    leads.find((l) => l.id === expandedLeadId) ||
    null

  const chatPreviewQ = useQuery({
    queryKey: ['pancake', 'chat', selectedPageId, chatLead?.conversationId],
    queryFn: () => fetchPancakeLeadPreview(selectedPageId, chatLead!.conversationId!),
    enabled: Boolean(selectedPageId && chatLead?.conversationId),
    retry: 1,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
  const chatMessages: PancakeMessage[] = useMemo(
    () => tidyChatMessages(chatPreviewQ.data?.messages ?? []),
    [chatPreviewQ.data?.messages],
  )
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const [chatTranslations, setChatTranslations] = useState<Record<string, string>>({})

  useEffect(() => {
    setChatTranslations({})
  }, [chatLead?.conversationId])

  useEffect(() => {
    const el = chatScrollRef.current
    if (!el || !chatMessages.length) return
    el.scrollTop = el.scrollHeight
  }, [chatLead?.conversationId, chatMessages.length, chatPreviewQ.isFetching])

  const translateChatM = useMutation({
    mutationFn: async () => {
      const items = chatMessages
        .map((m, i) => ({ id: m.id || `idx-${i}`, text: stripHtml(m.message) }))
        .filter((m) => needsVietnameseTranslation(m.text))
      if (!items.length) {
        return { items: [] as Array<{ id: string; originalText: string; translatedText: string; sameLanguage: boolean }> }
      }
      return translatePancakeMessages(items)
    },
    onSuccess: (data) => {
      const next: Record<string, string> = {}
      for (const row of data.items) {
        if (row.translatedText && !row.sameLanguage && row.translatedText.trim() !== row.originalText?.trim()) {
          next[row.id] = row.translatedText
        }
      }
      startTransition(() => {
        setChatTranslations((prev) => ({ ...prev, ...next }))
      })
      if (!Object.keys(next).length) toast.message('Các tin đã là tiếng Việt hoặc không dịch được.')
    },
    onError: (e) => toast.error(errMsg(e, 'Dịch thất bại')),
  })

  const chatUpgradedToastRef = useRef<string | null>(null)

  useEffect(() => {
    const preview = chatPreviewQ.data?.leadPreview
    const convId = chatLead?.conversationId
    if (!preview || !convId || !selectedPageId) return
    const closed =
      Boolean(preview.orderSignal?.closed) ||
      preview.leadStage === 'customer' ||
      Boolean(preview.leadLabels?.includes('Đã chốt'))
    const lastMessage = preview.lastMessage || null
    const type = preview.conversationType || null

    qc.setQueryData(['pancake', 'leads', selectedPageId], (prev: unknown) => {
      if (!prev || typeof prev !== 'object') return prev
      const data = prev as { leads?: PancakeLead[] }
      if (!Array.isArray(data.leads)) return prev
      return {
        ...data,
        leads: data.leads.map((l) => {
          if (l.conversationId !== convId && l.id !== chatLead?.id) return l
          const labels = closed
            ? displayLeadLabels({
                stage: 'customer',
                labels: preview.leadLabels?.length ? preview.leadLabels : ['Đã chốt'],
              })
            : l.labels
          return {
            ...l,
            ...(closed ? { stage: 'customer' as const, labels, followAt: null } : {}),
            ...(lastMessage ? { lastMessage } : {}),
            ...(type && !l.type ? { type } : {}),
          }
        }),
      }
    })

    if (!closed) return
    if (chatUpgradedToastRef.current === convId) return
    chatUpgradedToastRef.current = convId
    if (preview.leadUpgraded) {
      toast.success('Phát hiện chốt đơn từ chat — đã gắn nhãn Đã chốt')
    }
    void qc.invalidateQueries({ queryKey: ['pancake', 'leads', selectedPageId] })
  }, [chatPreviewQ.data, chatLead?.conversationId, chatLead?.id, qc, selectedPageId])

  const selectPage = (id: string) => {
    setSelectedPageId(id)
    setExpandedLeadId(null)
    setChatLead(null)
    setSearchName('')
    setSearchId('')
    setChannelOpen(false)
    setChannelQuery('')
    setWarning(null)
  }

  const openLead = (lead: PancakeLead) => {
    if (expandedLeadId === lead.id) {
      setExpandedLeadId(null)
      return
    }
    setExpandedLeadId(lead.id)
    setOrderPhone(lead.phones[0] || '')
    setOrderAddress(lead.address || '')
    setOrderRef(lead.orderRef || '')
  }

  const toggleLabel = (lead: PancakeLead, label: string) => {
    const current = lead.labels ?? []
    const aliases =
      label === 'follow'
        ? ['follow', 'follow-up', 'Follow']
        : label === 'Đã chốt'
          ? ['Đã chốt']
          : [label]
    const has = aliases.some((a) => current.includes(a))
    let next = has
      ? current.filter((x) => !aliases.includes(x))
      : [...current.filter((x) => !(label === 'follow' && ['Follow', 'follow-up'].includes(x))), label]
    if (label === 'Đã chốt' && !has) {
      next = next.filter((x) => x !== 'follow' && x !== 'follow-up' && x !== 'Follow')
    }
    if (label === 'follow' && !has) {
      next = next.filter((x) => x !== 'Đã chốt')
    }
    updateM.mutate({ leadId: lead.id, body: { labels: next } })
  }

  const tabCounts = {
    all: leads.length,
    conversation: stageCounts?.conversation ?? leads.filter((l) => l.stage !== 'customer').length,
    customer: stageCounts?.customer ?? leads.filter((l) => l.stage === 'customer').length,
    follow: stageCounts?.follow ?? leads.filter((l) => l.followAt).length,
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/40 bg-white shadow-md shadow-slate-200/50">
        {/* Toolbar */}
        <div className="flex h-[46px] shrink-0 items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/50 px-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Users className="size-3.5" />
            </div>
            <p className="truncate text-[13px] font-semibold text-slate-800">Lead Pancake</p>
          </div>

          <div className="ml-2 hidden items-center gap-1 rounded-xl bg-slate-50/80 p-0.5 sm:flex">
            {(
              [
                ['all', 'Tất cả'],
                ['th', 'Thái'],
                ['jp', 'Nhật'],
                ['other', 'Khác'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setMarketFilter(id)
                  if (selectedPageId) {
                    const still = pagesAll.find((p) => p.id === selectedPageId)
                    if (still && id !== 'all' && still.market !== id) selectPage('')
                  }
                }}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  marketFilter === id
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div ref={channelBoxRef} className="relative min-w-[200px] max-w-[360px] flex-1">
            <div className="flex h-8 items-center gap-1 rounded-lg border border-slate-200/60 bg-slate-50/80 px-2 focus-within:border-indigo-300">
              <Search className="size-3.5 shrink-0 text-slate-400" />
              <input
                value={
                  channelOpen
                    ? channelQuery
                    : selectedPage
                      ? selectedPage.name || selectedPage.id
                      : channelQuery
                }
                onChange={(e) => {
                  setChannelQuery(e.target.value)
                  setChannelOpen(true)
                }}
                onFocus={() => {
                  setChannelOpen(true)
                  setChannelQuery('')
                }}
                disabled={!connected || pagesQ.isLoading || syncM.isPending}
                placeholder={
                  pagesQ.isLoading ? 'Đang tải kênh…' : `Tìm kênh theo tên / ID (${pages.length})`
                }
                className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-medium text-slate-700 outline-none placeholder:font-normal placeholder:text-slate-400"
              />
              {selectedPageId ? (
                <button
                  type="button"
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600"
                  onClick={() => selectPage('')}
                  title="Bỏ chọn kênh"
                >
                  <X className="size-3.5" />
                </button>
              ) : (
                <ChevronDown className="size-3.5 shrink-0 text-slate-400" />
              )}
            </div>
            {channelOpen ? (
              <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-200/80">
                {filteredPages.length === 0 ? (
                  <p className="px-3 py-4 text-center text-[12px] text-slate-400">
                    Không thấy kênh khớp tên / ID
                  </p>
                ) : (
                  filteredPages.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectPage(p.id)}
                      className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-indigo-50/70 ${
                        p.id === selectedPageId ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <span className="truncate text-[12px] font-semibold text-slate-800">
                        [{marketLabel(p.market)}] [{platformLabel(p.platform)}] {p.name || '—'}
                      </span>
                      <span className="truncate font-mono text-[10px] text-slate-400">{p.id}</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <span
              className={`hidden rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide sm:inline ${
                connected
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {connected
                ? `Connected · ${statusQ.data?.activatedPageCount ?? pagesQ.data?.count ?? 0}`
                : 'Offline'}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!selectedPageId || leadsQ.isFetching}
              onClick={() => void leadsQ.refetch()}
              className="h-8 border-slate-200"
            >
              <RefreshCw className={`size-3.5 ${leadsQ.isFetching ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!selectedPageId || autoLabelM.isPending || syncM.isPending}
              onClick={() => {
                if (!selectedPageId) return
                autoLabelM.mutate(selectedPageId)
              }}
              className="h-8 border-slate-200"
              title="Quét chat: có CK/đơn → Đã chốt; chưa → follow (ưu tiên lead có SĐT+địa chỉ)"
            >
              {autoLabelM.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Tag className="size-3.5" />
              )}
              <span className="hidden sm:inline">
                {autoLabelM.isPending ? 'Đang quét…' : 'Quét nhãn'}
              </span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!connected || syncAllM.isPending || syncM.isPending}
              onClick={() => {
                if (
                  !window.confirm(
                    'Đồng bộ toàn bộ kênh FB/IG/TikTok? Có thể mất nhiều phút.',
                  )
                ) {
                  return
                }
                syncAllM.mutate()
              }}
              className="h-8 border-slate-200"
              title="Đồng bộ mọi kênh chat đã kích hoạt"
            >
              {syncAllM.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CloudDownload className="size-3.5" />
              )}
              <span className="hidden sm:inline">
                {syncAllM.isPending ? 'Sync all…' : 'Sync all'}
              </span>
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!selectedPageId || syncM.isPending || syncAllM.isPending}
              onClick={() => {
                if (!selectedPageId) return
                syncM.mutate(selectedPageId)
              }}
              className="h-8 bg-indigo-600 text-white hover:bg-indigo-500"
            >
              {syncM.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CloudDownload className="size-3.5" />
              )}
              <span className="hidden sm:inline">
                {syncM.isPending ? 'Đang đồng bộ…' : 'Đồng bộ'}
              </span>
            </Button>
          </div>
        </div>

        {warning ? (
          <div className="flex items-start gap-2 border-b border-amber-100 bg-amber-50/80 px-3 py-1.5 text-[12px] text-amber-800">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {warning}
          </div>
        ) : null}

        {/* Filters */}
        {selectedPageId ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
            <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-50/60 p-0.5">
              {(
                [
                  ['all', 'Tất cả', tabCounts.all],
                  ['conversation', 'Hội thoại', tabCounts.conversation],
                  ['customer', 'Đã khách', tabCounts.customer],
                  ['follow', 'follow', tabCounts.follow],
                ] as const
              ).map(([id, label, count]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStageTab(id)}
                  className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                    stageTab === id
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {label}
                  <span className="text-[10px] opacity-70">{count}</span>
                </button>
              ))}
            </div>
            <div className="relative min-w-[160px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Tìm theo tên / SĐT / nhãn…"
                className="h-8 w-full rounded-lg border border-slate-200/60 bg-slate-50/80 pl-8 pr-2 text-[12px] outline-none focus:border-indigo-300"
              />
            </div>
            <div className="relative min-w-[160px] flex-1 sm:max-w-[240px]">
              <Hash className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="Tìm theo ID lead / customer…"
                className="h-8 w-full rounded-lg border border-slate-200/60 bg-slate-50/80 pl-8 pr-2 font-mono text-[12px] outline-none focus:border-indigo-300"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              {selectedPage?.name ? `${selectedPage.name} · ` : ''}
              {filteredLeads.length}/{leads.length} lead
            </p>
          </div>
        ) : null}

        {/* Table */}
        <div className="min-h-0 flex-1 overflow-auto">
          {!selectedPageId ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
                <Users className="size-6" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-slate-800">Chọn kênh để xem bảng lead</p>
                <p className="mt-1 max-w-sm text-[12px] text-slate-500">
                  Danh sách profile: SĐT, địa chỉ, nhãn follow / Đã chốt. Có địa chỉ chưa đơn = vẫn là lead hội thoại.
                </p>
              </div>
            </div>
          ) : leadsQ.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[12px] text-slate-500">
              <Loader2 className="size-4 animate-spin" /> Đang tải lead…
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="px-4 py-16 text-center text-[12px] text-slate-500">
              {leads.length === 0
                ? 'Chưa có lead — bấm Đồng bộ để kéo từ Pancake.'
                : 'Không có lead khớp bộ lọc.'}
            </div>
          ) : (
            <Table className="min-w-[980px]">
              <TableHeader className="sticky top-0 z-10 bg-white/95 backdrop-blur">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-8" />
                  <TableHead className="min-w-[160px]">Lead</TableHead>
                  <TableHead className="min-w-[110px]">SĐT</TableHead>
                  <TableHead className="min-w-[160px]">Địa chỉ</TableHead>
                  <TableHead className="min-w-[100px]">Trạng thái</TableHead>
                  <TableHead className="min-w-[140px]">Nhãn</TableHead>
                  <TableHead className="min-w-[120px]">Loại (inbox / comment)</TableHead>
                  <TableHead className="min-w-[180px]">Tin gần nhất</TableHead>
                  <TableHead className="min-w-[100px]">Cập nhật</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => {
                  const open = lead.id === expandedLeadId
                  return (
                    <Fragment key={lead.id}>
                      <TableRow
                        data-state={open ? 'selected' : undefined}
                        className="cursor-pointer"
                        onClick={() => openLead(lead)}
                      >
                        <TableCell className="text-slate-400">
                          {open ? (
                            <ChevronDown className="size-3.5" />
                          ) : (
                            <ChevronRight className="size-3.5" />
                          )}
                        </TableCell>
                        <TableCell className="max-w-[220px] whitespace-normal">
                          <p className="truncate text-[13px] font-semibold text-slate-800">
                            {lead.fullName || 'Khách chưa tên'}
                          </p>
                          <p className="truncate font-mono text-[10px] text-slate-400" title={lead.id}>
                            {lead.pancakeCustomerId || lead.id}
                          </p>
                          {lead.orderRef ? (
                            <p className="text-[10px] text-slate-400">Đơn {lead.orderRef}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="font-mono text-[12px] text-slate-700">
                          {lead.phones[0] || (
                            <span className="font-sans text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] whitespace-normal">
                          <p className="line-clamp-2 text-[12px] text-slate-600">
                            {lead.address || (
                              <span className="text-slate-400">—</span>
                            )}
                          </p>
                          {lead.address &&
                          lead.stage !== 'customer' &&
                          !lead.orderRef &&
                          !displayLeadLabels(lead).includes('Đã chốt') ? (
                            <p className="mt-0.5 text-[10px] text-amber-600">
                              ĐC profile · chưa đơn
                            </p>
                          ) : null}
                          {lead.stage === 'customer' || displayLeadLabels(lead).includes('Đã chốt') ? (
                            <p className="mt-0.5 text-[10px] text-emerald-600">Đã chốt đơn</p>
                          ) : null}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <StageBadge
                            stage={lead.stage}
                            hasConversation={hasPancakeChat(lead)}
                            onOpenChat={
                              hasPancakeChat(lead) ? () => setChatLead(lead) : undefined
                            }
                          />
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <div className="flex max-w-[180px] flex-wrap gap-1">
                            {(displayLeadLabels(lead).length ? displayLeadLabels(lead) : []).length ? (
                              displayLeadLabels(lead).map((lb) => (
                                <Badge
                                  key={lb}
                                  variant="outline"
                                  className={
                                    lb === 'Đã chốt'
                                      ? 'border-emerald-200 bg-emerald-50/80 text-[10px] font-medium text-emerald-700'
                                      : 'border-indigo-100 bg-indigo-50/60 text-[10px] font-medium text-indigo-700'
                                  }
                                >
                                  {lb}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-[11px] text-slate-400">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const kind = conversationKindLabel(lead.type, lead.conversationId)
                            if (!kind) {
                              return <span className="text-[11px] text-slate-400">—</span>
                            }
                            return (
                              <Badge
                                variant="outline"
                                className={
                                  kind === 'comment'
                                    ? 'border-amber-200 bg-amber-50/80 text-amber-800'
                                    : kind === 'inbox'
                                      ? 'border-sky-200 bg-sky-50/80 text-sky-800'
                                      : 'border-slate-200 text-slate-600'
                                }
                              >
                                {kind}
                              </Badge>
                            )
                          })()}
                        </TableCell>
                        <TableCell className="max-w-[220px] whitespace-normal">
                          {(() => {
                            const preview = stripHtml(lead.lastMessage)
                            if (!preview) {
                              return <span className="text-[12px] text-slate-400">—</span>
                            }
                            if (isFacebookMarketingNoise(preview)) {
                              return <span className="text-[12px] text-slate-400">—</span>
                            }
                            if (looksLikeImageUrl(preview)) {
                              return (
                                <img
                                  src={pancakeMediaSrc(preview)}
                                  alt=""
                                  className="h-10 w-10 rounded-md object-cover ring-1 ring-slate-200"
                                />
                              )
                            }
                            if (isAttachmentPlaceholderText(preview)) {
                              return <span className="text-[12px] text-slate-500">Ảnh đính kèm</span>
                            }
                            return (
                              <p className="line-clamp-2 text-[12px] text-slate-600">{preview}</p>
                            )
                          })()}
                        </TableCell>
                        <TableCell className="text-[11px] text-slate-500">
                          {formatTime(lead.dataAt)}
                        </TableCell>
                      </TableRow>
                      {open && expandedLead?.id === lead.id ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={9} className="bg-slate-50/70 p-0">
                            <div className="grid gap-3 border-t border-slate-100 p-3 md:grid-cols-2">
                              <div>
                                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                  Nhãn theo dõi
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {LEAD_LABEL_OPTIONS.map((label) => {
                                    const on =
                                      expandedLead.labels?.includes(label) ||
                                      (label === 'follow' &&
                                        (expandedLead.labels?.includes('Follow') ||
                                          expandedLead.labels?.includes('follow-up')))
                                    return (
                                      <button
                                        key={label}
                                        type="button"
                                        disabled={updateM.isPending}
                                        onClick={() => toggleLabel(expandedLead, label)}
                                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                                          on
                                            ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                        }`}
                                      >
                                        {label}
                                      </button>
                                    )
                                  })}
                                </div>
                                <p className="mt-3 text-[11px] text-slate-400">
                                  {platformLabel(expandedLead.platform)}
                                  {expandedLead.orderedAt
                                    ? ` · Đặt hàng ${formatTime(expandedLead.orderedAt)}`
                                    : ''}
                                </p>
                              </div>
                              <div>
                                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                  Lên khách khi có đơn
                                </p>
                                <div className="space-y-2 rounded-xl border border-slate-200/70 bg-white p-3">
                                  <Input
                                    value={orderPhone}
                                    onChange={(e) => setOrderPhone(e.target.value)}
                                    placeholder="SĐT từ đơn"
                                    className="h-8 bg-slate-50/80 text-[12px]"
                                  />
                                  <Textarea
                                    value={orderAddress}
                                    onChange={(e) => setOrderAddress(e.target.value)}
                                    placeholder="Địa chỉ giao hàng"
                                    className="min-h-[56px] bg-slate-50/80 text-[12px]"
                                  />
                                  <Input
                                    value={orderRef}
                                    onChange={(e) => setOrderRef(e.target.value)}
                                    placeholder="Mã đơn (vd. CQA-123)"
                                    className="h-8 bg-slate-50/80 text-[12px]"
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-8 w-full bg-emerald-600 hover:bg-emerald-500"
                                    disabled={
                                      markCustomerM.isPending ||
                                      (!orderPhone.trim() && !orderAddress.trim())
                                    }
                                    onClick={() =>
                                      markCustomerM.mutate({
                                        leadId: expandedLead.id,
                                        body: {
                                          phone: orderPhone.trim() || undefined,
                                          address: orderAddress.trim() || undefined,
                                          orderRef: orderRef.trim() || undefined,
                                        },
                                      })
                                    }
                                  >
                                    {markCustomerM.isPending ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="size-3.5" />
                                    )}
                                    Đánh dấu đã đặt hàng
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {chatLead ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setChatLead(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-slate-900">
                  {chatLead.fullName || 'Khách chưa tên'}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {conversationKindLabel(chatLead.type, chatLead.conversationId) || 'inbox'}
                  {chatLead.conversationId
                    ? ` · ${chatLead.conversationId.slice(0, 18)}…`
                    : ''}
                </p>
                {chatPreviewQ.data?.leadPreview?.orderSignal?.closed ? (
                  <Badge className="mt-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                    Đã chốt đơn (từ chat)
                  </Badge>
                ) : null}
                {chatPreviewQ.data?.note ? (
                  <p className="mt-1 text-[10px] leading-snug text-slate-400">
                    {chatPreviewQ.data.note}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 border-slate-200 px-2 text-[11px]"
                  disabled={translateChatM.isPending || chatPreviewQ.isLoading || !chatMessages.length}
                  onClick={() => translateChatM.mutate()}
                  title="Giữ nguyên tin gốc, dịch tiếng Việt bên dưới"
                >
                  {translateChatM.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Languages className="size-3.5" />
                  )}
                  {translateChatM.isPending ? 'Đang dịch…' : 'Dịch'}
                </Button>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  onClick={() => setChatLead(null)}
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div
              ref={chatScrollRef}
              className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50/50 px-4 py-3"
            >
              {!chatLead.conversationId ? (
                <p className="py-10 text-center text-[12px] text-slate-500">
                  Lead chưa gắn conversationId — đồng bộ lại kênh.
                </p>
              ) : chatPreviewQ.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-slate-500">
                  <Loader2 className="size-4 animate-spin" /> Đang tải tin nhắn…
                </div>
              ) : chatPreviewQ.isError ? (
                <p className="py-10 text-center text-[12px] text-rose-600">
                  {errMsg(chatPreviewQ.error, 'Không tải được hội thoại')}
                </p>
              ) : chatMessages.length === 0 ? (
                <p className="py-10 text-center text-[12px] text-slate-500">Chưa có tin nhắn.</p>
              ) : (
                chatMessages.map((m, idx) => {
                  const attachments = m.attachments ?? []
                  const images = attachments.filter(attachmentLooksLikeImage)
                  const files = attachments.filter(
                    (a) =>
                      !images.some((img) => img.url === a.url) &&
                      !isFacebookAdLink(a.url) &&
                      !isFacebookAdIdText(fileLabelFromUrl(a.url, a.name)),
                  )
                  const text = stripHtml(m.message)
                  const expired = /tin nhắn đã hết hạn/i.test(text)
                  const placeholder = isAttachmentPlaceholderText(text)
                  const marketing = isFacebookMarketingNoise(text)
                  const adSystem = isAdReferralSystemText(text) || isFacebookAdIdText(text)
                  const imageFromText =
                    looksLikeImageUrl(text) && !images.some((img) => img.url === text)
                      ? [{ url: text, type: 'image', name: null as string | null }]
                      : []
                  const allImages = [...images, ...imageFromText]
                  const showText =
                    Boolean(text) &&
                    !placeholder &&
                    !expired &&
                    !adSystem &&
                    !marketing &&
                    !looksLikeImageUrl(text)
                  const msgKey = m.id || `idx-${idx}`
                  const vi = chatTranslations[msgKey]
                  const canTranslateOne = needsVietnameseTranslation(text) && !vi
                  if (marketing && !allImages.length && !files.length) return null
                  if (!allImages.length && !files.length && !showText && !adSystem) {
                    if (placeholder || !text) return null
                  }
                  if (adSystem && !allImages.length && !files.length) {
                    return (
                      <div key={msgKey} className="flex justify-center py-1">
                        <p className="max-w-[90%] rounded-full bg-slate-100 px-3 py-1 text-center text-[11px] text-slate-500">
                          Khách đã trả lời một quảng cáo
                        </p>
                      </div>
                    )
                  }
                  return (
                  <div
                    key={msgKey}
                    className={`flex ${m.isFromPage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed shadow-sm ${
                        m.isFromPage
                          ? 'rounded-br-md bg-indigo-600 text-white'
                          : 'rounded-bl-md border border-slate-100 bg-white text-slate-700'
                      }`}
                    >
                      {allImages.length ? (
                        <div className="mb-1.5 flex flex-col gap-1.5">
                          {allImages.map((img) => (
                            <a
                              key={img.url}
                              href={img.url}
                              target="_blank"
                              rel="noreferrer"
                              className="block overflow-hidden rounded-lg"
                            >
                              <img
                                src={pancakeMediaSrc(img.url)}
                                alt={img.name || 'Ảnh đính kèm'}
                                className="max-h-64 w-full object-contain bg-black/5"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  const el = e.currentTarget
                                  el.style.display = 'none'
                                  const fallback = el.nextElementSibling as HTMLElement | null
                                  if (fallback) fallback.hidden = false
                                }}
                              />
                              <span
                                hidden
                                className={`block text-[11px] underline ${
                                  m.isFromPage ? 'text-indigo-100' : 'text-indigo-600'
                                }`}
                              >
                                Mở ảnh đính kèm
                              </span>
                            </a>
                          ))}
                        </div>
                      ) : null}
                      {files.map((f) => (
                        <a
                          key={f.url}
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                          className={`mb-1 block text-[11px] underline ${
                            m.isFromPage ? 'text-indigo-100' : 'text-indigo-600'
                          }`}
                        >
                          {fileLabelFromUrl(f.url, f.name)}
                        </a>
                      ))}
                      {showText ? (
                        <p className="whitespace-pre-wrap">{text}</p>
                      ) : !images.length && !files.length ? (
                        <p className="opacity-70">
                          {expired || placeholder
                            ? 'Tin nhắn đã hết hạn'
                            : 'Ảnh/file đính kèm (không lấy được URL)'}
                        </p>
                      ) : null}
                      {vi ? (
                        <p
                          className={`mt-1.5 border-t pt-1.5 text-[11px] leading-snug font-medium ${
                            m.isFromPage
                              ? 'border-white/20 text-green-300'
                              : 'border-slate-200 text-green-600'
                          }`}
                        >
                          <span className={m.isFromPage ? 'text-green-200' : 'text-green-700'}>
                            {m.isFromPage ? 'Tiếng Việt: ' : 'Dịch: '}
                          </span>
                          {vi}
                        </p>
                      ) : canTranslateOne ? (
                        <button
                          type="button"
                          className={`mt-1.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                            m.isFromPage
                              ? 'bg-white/15 text-indigo-50 hover:bg-white/25'
                              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                          }`}
                          disabled={translateChatM.isPending}
                          onClick={() => translateChatM.mutate()}
                        >
                          Dịch
                        </button>
                      ) : null}
                      <p
                        className={`mt-1 text-[10px] ${
                          m.isFromPage ? 'text-indigo-100' : 'text-slate-400'
                        }`}
                      >
                        {m.fromName || (m.isFromPage ? 'Page' : 'Khách')} · {formatTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
