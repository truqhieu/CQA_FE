import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, Plus, Search, ShoppingCart, X } from 'lucide-react'
import { toast } from 'sonner'
import type { CskhCustomerIntent, CskhInboxConversation, OmsCatalogItem } from './api'
import { createOmsOrder, fetchOmsCatalog, fetchOmsOrderSuggest } from './api'
import { cn } from '@/lib/utils'

type LineItemDraft = {
  variantId: string
  productId: string
  name: string
  variantTitle: string
  sku: string | null
  priceLabel: string
  quantity: number
  maxQty: number
  locationId: string
  matchReason?: string
}

type OmsCreateOrderDialogProps = {
  open: boolean
  onClose: () => void
  conversation: CskhInboxConversation
  intent?: CskhCustomerIntent | null
}

function toLineItem(p: OmsCatalogItem, quantity = 1): LineItemDraft {
  return {
    variantId: p.variantId,
    productId: p.productId,
    name: p.name,
    variantTitle: p.variantTitle,
    sku: p.sku,
    priceLabel: p.priceLabel,
    quantity,
    maxQty: p.inventoryQuantity,
    locationId: p.locationId,
    matchReason: p.matchReason,
  }
}

export function OmsCreateOrderDialog({
  open,
  onClose,
  conversation,
  intent,
}: OmsCreateOrderDialogProps) {
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([])
  const [suggestNote, setSuggestNote] = useState<string | null>(null)
  const appliedSuggest = useRef(false)

  const mentions = useMemo(() => {
    return [
      ...new Set(
        (intent?.productMentions ?? [])
          .map((s) => s.trim())
          .filter((s) => s.length >= 4 && s.length <= 48 && !/HK\d{4,}/i.test(s) && !/chế tác/i.test(s)),
      ),
    ]
  }, [intent])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(productSearch.trim()), 350)
    return () => window.clearTimeout(t)
  }, [productSearch])

  useEffect(() => {
    if (!open) return
    appliedSuggest.current = false
    setPhone('')
    setAddress('')
    setNote('')
    setProductSearch('')
    setDebouncedQ('')
    setLineItems([])
    setSuggestNote(null)
  }, [open, conversation.id])

  const catalogQ = useQuery({
    queryKey: ['cskh', 'oms', 'catalog', debouncedQ],
    queryFn: () => fetchOmsCatalog(debouncedQ),
    enabled: open,
    staleTime: 30_000,
  })

  const suggestQ = useQuery({
    queryKey: ['cskh', 'oms', 'suggest', conversation.id, mentions.join('|')],
    queryFn: () => fetchOmsOrderSuggest(conversation.id, mentions),
    enabled: open,
    staleTime: 15_000,
  })

  useEffect(() => {
    if (!open || !suggestQ.data || appliedSuggest.current) return
    appliedSuggest.current = true
    if (suggestQ.data.phone) setPhone((prev) => prev || suggestQ.data!.phone!)
    if (suggestQ.data.items.length) {
      setLineItems(suggestQ.data.items.map((p) => toLineItem(p, 1)))
    }
    setSuggestNote(suggestQ.data.note)
  }, [open, suggestQ.data])

  const createMutation = useMutation({
    mutationFn: createOmsOrder,
    onSuccess: (result) => {
      toast.success(
        result.orderName
          ? `Đã gửi đơn ${result.orderName} sang kho`
          : `Đã gửi đơn #${result.orderId} sang kho`,
      )
      onClose()
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || err.message || 'Không tạo được đơn trên kho')
    },
  })

  const availableToAdd = useMemo(() => {
    return (catalogQ.data?.items ?? []).filter(
      (p) => !lineItems.some((l) => l.variantId === p.variantId),
    )
  }, [catalogQ.data?.items, lineItems])

  if (!open) return null

  const customerName = conversation.customerName?.trim() || 'Khách Messenger'

  const updateQuantity = (variantId: string, quantity: number) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.variantId !== variantId) return item
        const q = Math.min(item.maxQty, Math.max(1, Math.floor(quantity || 1)))
        return { ...item, quantity: q }
      }),
    )
  }

  const addCatalogItem = (p: OmsCatalogItem) => {
    if (!p.inStock) {
      toast.error('Sản phẩm hết hàng trên kho')
      return
    }
    setLineItems((prev) => {
      const existing = prev.find((i) => i.variantId === p.variantId)
      if (existing) {
        return prev.map((i) =>
          i.variantId === p.variantId
            ? { ...i, quantity: Math.min(i.quantity + 1, i.maxQty) }
            : i,
        )
      }
      return [...prev, toLineItem(p, 1)]
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!lineItems.length) {
      toast.error('Chọn ít nhất một sản phẩm')
      return
    }
    createMutation.mutate({
      customerName,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      note: note.trim() || undefined,
      conversationId: conversation.id,
      platform: conversation.platform,
      lineItems: lineItems.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
        locationId: item.locationId,
      })),
    })
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="oms-create-order-title"
        className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <ShoppingCart className="h-4 w-4" />
            </div>
            <div>
              <h2 id="oms-create-order-title" className="text-sm font-bold text-slate-800">
                Tạo đơn hàng
              </h2>
              <p className="text-[10px] text-slate-400">Gửi sang hệ thống kho Viễn Chí Bảo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Thông tin khách</h3>
            <div className="grid gap-2 text-[11px]">
              <label className="space-y-1">
                <span className="text-slate-500">Tên</span>
                <input
                  readOnly
                  value={customerName}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500">Số điện thoại</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09xx xxx xxx"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500">Địa chỉ giao hàng</span>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 resize-none focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sản phẩm trong đơn</h3>
            {suggestQ.isFetching && !lineItems.length ? (
              <p className="text-[11px] text-emerald-700 flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Đang quét hội thoại để khớp sản phẩm kho…
              </p>
            ) : null}
            {suggestNote ? (
              <p className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                {suggestNote}
              </p>
            ) : null}
            {lineItems.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic py-2">Tìm và chọn sản phẩm từ kho bên dưới.</p>
            ) : (
              <div className="space-y-2">
                {lineItems.map((item) => (
                  <div
                    key={item.variantId}
                    className="flex items-start gap-2 rounded-xl border border-slate-200/70 bg-slate-50/50 p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-slate-700 leading-snug break-words">
                        {item.name}
                      </p>
                      <p className="text-[9px] text-emerald-700/90 font-medium mt-0.5">
                        {[item.variantTitle, item.sku ? `SKU ${item.sku}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      <p className="text-[10px] text-violet-600 font-bold mt-0.5">{item.priceLabel}</p>
                      <p className="text-[9px] text-slate-400">Tồn: {item.maxQty}</p>
                      {item.matchReason ? (
                        <p className="text-[9px] text-amber-700 mt-0.5">{item.matchReason}</p>
                      ) : null}
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={item.maxQty}
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.variantId, Number(e.target.value))}
                      className="w-14 shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-center text-[11px] mt-0.5"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setLineItems((prev) => prev.filter((i) => i.variantId !== item.variantId))
                      }
                      className="shrink-0 text-[10px] text-slate-400 hover:text-rose-500 px-1 mt-1"
                    >
                      Xóa
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Thêm sản phẩm từ kho</h3>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="search"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Tìm tên hoặc SKU trên kho..."
                className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-2 text-[11px] focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            {catalogQ.isLoading ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-8 flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                <p className="text-[11px] text-slate-500">Đang tải catalog kho...</p>
              </div>
            ) : catalogQ.isError ? (
              <p className="text-[11px] text-rose-600">
                {(catalogQ.error as Error & { response?: { data?: { message?: string } } }).response
                  ?.data?.message || 'Không tải được sản phẩm từ kho.'}
              </p>
            ) : availableToAdd.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic py-2">
                {debouncedQ ? 'Không tìm thấy sản phẩm.' : 'Không có sản phẩm khả dụng.'}
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                {availableToAdd.map((p) => (
                  <button
                    key={p.variantId}
                    type="button"
                    disabled={!p.inStock}
                    onClick={() => addCatalogItem(p)}
                    className={cn(
                      'w-full flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] transition-colors',
                      p.inStock
                        ? 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                        : 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed',
                    )}
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0 text-emerald-600 mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-slate-700 leading-snug break-words">
                        {p.name}
                      </span>
                      <span className="block text-[9px] text-emerald-700/90 font-medium mt-0.5">
                        {[p.variantTitle, p.sku ? `SKU ${p.sku}` : null].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="text-[10px] text-violet-600 font-bold shrink-0 pt-0.5">
                      {p.priceLabel}
                    </span>
                    <span className={cn('text-[9px] shrink-0 pt-0.5', p.inStock ? 'text-slate-400' : 'text-rose-500')}>
                      Tồn {p.inventoryQuantity}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="block space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ghi chú đơn</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Ghi chú cho kho / đóng gói..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[11px] resize-none focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <div className="flex gap-2 pt-1 pb-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!lineItems.length || createMutation.isPending}
              className={cn(
                'flex-1 rounded-xl px-4 py-2.5 text-[11px] font-bold text-white transition-colors',
                lineItems.length ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-300 cursor-not-allowed',
              )}
            >
              {createMutation.isPending ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Đang gửi...
                </span>
              ) : (
                'Tạo đơn'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
