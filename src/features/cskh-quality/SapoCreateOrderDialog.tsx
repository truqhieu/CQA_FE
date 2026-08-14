import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Search, ShoppingCart, X } from 'lucide-react'
import { toast } from 'sonner'
import type { CskhCustomerIntent, CskhInboxConversation, CskhSapoCatalogItem } from './api'
import {
  createSapoOrder,
  fetchCskhSapoCatalog,
  fetchCskhSapoStatus,
} from './api'
import { cn } from '@/lib/utils'

type LineItemDraft = {
  variantId: number
  productId: number
  name: string
  sizeColor: string
  sku: string | null
  priceLabel: string
  quantity: number
  maxQty: number | null
}

type SapoCreateOrderDialogProps = {
  open: boolean
  onClose: () => void
  conversation: CskhInboxConversation
  intent?: CskhCustomerIntent | null
}

/** Tên SP sạch (không dính size/màu vào tên). */
function productDisplayName(p: Pick<CskhSapoCatalogItem, 'name' | 'productTitle' | 'variantTitle'>): string {
  const title = p.productTitle?.trim()
  if (title) return title
  const n = (p.name || '').trim()
  const vt = (p.variantTitle || '').trim()
  if (vt && n.endsWith(` · ${vt}`)) return n.slice(0, -(vt.length + 3)).trim()
  return n
}

/**
 * Phân tích size/màu từ variant.title Sapo.
 * Luôn trả về cả 2 chiều — thiếu thì ghi "chưa có size" / "chưa có màu".
 */
function parseSizeColor(variantTitle: string | null | undefined): {
  size: string
  color: string
} {
  const missingSize = 'chưa có size'
  const missingColor = 'chưa có màu'
  const vt = (variantTitle || '').trim()
  if (!vt || /^default(\s+title)?$/i.test(vt)) {
    return { size: missingSize, color: missingColor }
  }

  const normSize = (s: string) => {
    const t = s.trim()
    if (/^\d+(\.\d+)?$/.test(t)) return `Size ${t}`
    if (/^(size|kích\s*thước)\b/i.test(t)) return t.replace(/^kích\s*thước\s*/i, 'Size ').trim()
    return t
  }
  const normColor = (s: string) => {
    const t = s.trim()
    if (/^màu\b/i.test(t)) return t
    return `Màu ${t}`
  }

  // "Màu Đen / Size 22"
  if (vt.includes('/')) {
    let size: string | null = null
    let color: string | null = null
    for (const part of vt.split('/').map((p) => p.trim()).filter(Boolean)) {
      if (/size|kích\s*thước|^\d+(\.\d+)?$/i.test(part)) size = normSize(part)
      else color = normColor(part)
    }
    return { size: size ?? missingSize, color: color ?? missingColor }
  }

  // Chỉ size
  if (/^\d+(\.\d+)?$/.test(vt) || /^(size|kích\s*thước)\b/i.test(vt)) {
    return { size: normSize(vt), color: missingColor }
  }

  // Chỉ màu (option Màu sắc trên Sapo)
  if (/^màu\b/i.test(vt)) return { size: missingSize, color: vt }

  // Một giá trị option đơn (Đen, Gold…) = màu từ Sapo
  return { size: missingSize, color: normColor(vt) }
}

/** Dòng phụ: Size · Màu (thiếu thì "chưa có …") · SKU */
function sizeColorLabel(variantTitle: string | null | undefined): string {
  const { size, color } = parseSizeColor(variantTitle)
  return `${size} · ${color}`
}

function catalogMetaLine(p: CskhSapoCatalogItem): string {
  const parts = [sizeColorLabel(p.variantTitle)]
  if (p.sku?.trim()) parts.push(`SKU ${p.sku.trim()}`)
  return parts.join(' · ')
}

function catalogToLineItem(p: CskhSapoCatalogItem, quantity = 1): LineItemDraft {
  return {
    variantId: p.variantId,
    productId: p.productId,
    name: productDisplayName(p),
    sizeColor: sizeColorLabel(p.variantTitle),
    sku: p.sku?.trim() || null,
    priceLabel: p.priceLabel,
    quantity,
    maxQty: p.inventoryQuantity,
  }
}

export function SapoCreateOrderDialog({
  open,
  onClose,
  conversation,
  intent,
}: SapoCreateOrderDialogProps) {
  const qc = useQueryClient()
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([])

  const { data: sapoStatus, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['cskh', 'sapo', 'status'],
    queryFn: fetchCskhSapoStatus,
    enabled: open,
    staleTime: 60_000,
  })

  const { data: catalogData, isLoading: isLoadingCatalog } = useQuery({
    queryKey: ['cskh', 'sapo', 'catalog'],
    queryFn: fetchCskhSapoCatalog,
    enabled: open,
    staleTime: 30_000,
  })

  const catalogByVariant = useMemo(() => {
    const map = new Map<number, CskhSapoCatalogItem>()
    for (const item of catalogData?.items ?? []) {
      map.set(item.variantId, item)
    }
    return map
  }, [catalogData?.items])

  const defaultLineItems = useMemo<LineItemDraft[]>(() => {
    // Chỉ tự thêm sản phẩm khách thực sự quan tâm (từ intent hội thoại).
    // Không auto-thêm SP đầu catalog — tránh tạo đơn nhầm sản phẩm bất kỳ.
    return (intent?.products ?? [])
      .filter((p) => p.variantId != null)
      .map((p) => {
        const cat = catalogByVariant.get(p.variantId)
        // Ưu tiên tồn kho thực tế từ catalog; nếu không có thì suy ra từ inStock.
        const maxQty = cat?.inventoryQuantity ?? (p.inStock ? null : 0)
        if (cat) return catalogToLineItem(cat, 1)
        return {
          variantId: p.variantId,
          productId: p.productId,
          name: p.name,
          sizeColor: sizeColorLabel(p.variantTitle),
          sku: p.sku?.trim() || null,
          priceLabel: p.priceLabel,
          quantity: 1,
          maxQty,
        }
      })
  }, [intent?.products, catalogByVariant])

  useEffect(() => {
    if (!open || isLoadingCatalog) return
    setPhone('')
    setAddress('')
    setNote('')
    setProductSearch('')
    setLineItems(defaultLineItems)
  }, [open, conversation.id, defaultLineItems, isLoadingCatalog])

  const createMutation = useMutation({
    mutationFn: createSapoOrder,
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['cskh', 'sapo', 'catalog'] })
      void qc.invalidateQueries({ queryKey: ['cskh', 'sapo', 'status'] })
      if (result.source === 'db') {
        toast.success(
          result.orderName
            ? `Đã tạo đơn ${result.orderName} · ${result.totalPrice ? `${Number(result.totalPrice).toLocaleString('vi-VN')}đ` : ''}`
            : `Đã tạo đơn #${result.orderId}`,
        )
      } else {
        toast.success(
          result.orderName
            ? `Đã tạo đơn ${result.orderName} trên Sapo`
            : `Đã tạo đơn #${result.orderId} trên Sapo`,
        )
        if (result.adminUrl) {
          window.open(result.adminUrl, '_blank', 'noopener,noreferrer')
        }
      }
      onClose()
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || err.message || 'Không tạo được đơn')
    },
  })

  const catalogLoading = isLoadingStatus || isLoadingCatalog

  const availableToAdd = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    return (catalogData?.items ?? [])
      .filter((p) => !lineItems.some((l) => l.variantId === p.variantId))
      .filter((p) => {
        if (!q) return true
        const hay = `${productDisplayName(p)} ${p.variantTitle ?? ''} ${p.sku ?? ''} ${p.category ?? ''} ${p.material ?? ''} ${p.priceLabel}`.toLowerCase()
        return hay.includes(q)
      })
  }, [catalogData?.items, lineItems, productSearch])

  if (!open) return null

  const customerName = conversation.customerName?.trim() || 'Khách Messenger'
  const catalogReady = (sapoStatus?.variantCount ?? 0) > 0 || (catalogData?.items.length ?? 0) > 0
  const sapoReady = Boolean(sapoStatus?.ordersReady || catalogReady)

  const updateQuantity = (variantId: number, quantity: number) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.variantId !== variantId) return item
        let q = Math.max(1, Math.floor(quantity || 1))
        if (item.maxQty != null) q = Math.min(q, item.maxQty)
        return { ...item, quantity: q }
      }),
    )
  }

  const removeLineItem = (variantId: number) => {
    setLineItems((prev) => prev.filter((item) => item.variantId !== variantId))
  }

  const addCatalogItem = (p: CskhSapoCatalogItem) => {
    if (!p.inStock) {
      toast.error('Sản phẩm hết hàng')
      return
    }
    setLineItems((prev) => {
      const existing = prev.find((i) => i.variantId === p.variantId)
      if (existing) {
        return prev.map((i) =>
          i.variantId === p.variantId
            ? {
                ...i,
                quantity: Math.min(
                  i.quantity + 1,
                  i.maxQty ?? i.quantity + 1,
                ),
              }
            : i,
        )
      }
      return [...prev, catalogToLineItem(p, 1)]
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
      psid: conversation.participantPsid,
      conversationId: conversation.id,
      lineItems: lineItems.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
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
        aria-labelledby="sapo-create-order-title"
        className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <ShoppingCart className="h-4 w-4" />
            </div>
            <div>
              <h2 id="sapo-create-order-title" className="text-sm font-bold text-slate-800">
                Tạo đơn hàng
              </h2>
              <p className="text-[10px] text-slate-400">Từ hội thoại Messenger</p>
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
          {!catalogLoading && !sapoReady ? (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 text-[11px] text-amber-900">
              <p className="font-semibold">Chưa có sản phẩm trong hệ thống</p>
              <p className="text-amber-800/90 mt-1">Liên hệ admin để import catalog sản phẩm.</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Thông tin khách</h3>
            <div className="grid gap-2 text-[11px]">
              <label className="space-y-1">
                <span className="text-slate-500">Tên</span>
                <input readOnly value={customerName} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700" />
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
            {lineItems.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic py-2">Chọn sản phẩm bên dưới.</p>
            ) : (
              <div className="space-y-2">
                {lineItems.map((item) => (
                  <div
                    key={item.variantId}
                    className="flex items-start gap-2 rounded-xl border border-slate-200/70 bg-slate-50/50 p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-slate-700 leading-snug break-words whitespace-normal">
                        {item.name}
                      </p>
                      <p className="text-[9px] text-emerald-700/90 font-medium mt-0.5 break-words whitespace-normal">
                        {[item.sizeColor, item.sku ? `SKU ${item.sku}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      <p className="text-[10px] text-violet-600 font-bold mt-0.5">{item.priceLabel}</p>
                      {item.maxQty != null && (
                        <p className="text-[9px] text-slate-400">Tồn: {item.maxQty}</p>
                      )}
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={item.maxQty ?? undefined}
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.variantId, Number(e.target.value))}
                      className="w-14 shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-center text-[11px] mt-0.5"
                    />
                    <button type="button" onClick={() => removeLineItem(item.variantId)} className="shrink-0 text-[10px] text-slate-400 hover:text-rose-500 px-1 mt-1">
                      Xóa
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Thêm sản phẩm</h3>
            {catalogLoading ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-10 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
                <p className="text-[12px] font-semibold text-slate-700">Đang tải danh sách sản phẩm...</p>
                <p className="text-[10px] text-slate-400">Có thể mất vài giây nếu catalog lớn</p>
                <div className="w-full max-w-xs space-y-2 mt-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-9 rounded-lg bg-slate-200/70 animate-pulse" />
                  ))}
                </div>
              </div>
            ) : (catalogData?.items.length ?? 0) > 0 ? (
              <>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="search"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Tìm theo tên, size, màu, SKU..."
                  className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-2 text-[11px] focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              {availableToAdd.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic py-2">
                  {productSearch.trim() ? 'Không tìm thấy sản phẩm.' : 'Đã thêm hết sản phẩm trong đơn.'}
                </p>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                  {availableToAdd.map((p) => {
                    const meta = catalogMetaLine(p)
                    return (
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
                      <span className="block font-medium text-slate-700 leading-snug break-words whitespace-normal">
                        {productDisplayName(p)}
                      </span>
                      {meta && (
                        <span className="block text-[9px] text-emerald-700/90 font-medium mt-0.5 break-words whitespace-normal">
                          {meta}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-violet-600 font-bold shrink-0 pt-0.5">{p.priceLabel}</span>
                    <span className={cn('text-[9px] shrink-0 pt-0.5', p.inStock ? 'text-slate-400' : 'text-rose-500')}>
                      {p.inventoryQuantity != null ? `Tồn ${p.inventoryQuantity}` : '—'}
                    </span>
                  </button>
                    )
                })}
                </div>
              )}
              </>
            ) : null}
          </div>

          <label className="block space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ghi chú đơn</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Ghi chú cho đơn hàng..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[11px] resize-none focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <div className="flex gap-2 pt-1 pb-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
              Hủy
            </button>
            <button
              type="submit"
              disabled={catalogLoading || !sapoReady || !lineItems.length || createMutation.isPending}
              className={cn(
                'flex-1 rounded-xl px-4 py-2.5 text-[11px] font-bold text-white transition-colors',
                !catalogLoading && sapoReady && lineItems.length ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-300 cursor-not-allowed',
              )}
            >
              {createMutation.isPending ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Đang tạo...
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
