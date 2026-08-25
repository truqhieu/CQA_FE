import React, { useState } from 'react'
import { Copy, Check, Sparkles, User, Megaphone, MessageSquare, Zap, Loader2, RefreshCw, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import type { CskhInboxConversation, CskhCustomerIntent, CskhAdInsights } from './api'
import { CskhPageAvatar } from './cskhUi'
import { OmsCreateOrderDialog } from './OmsCreateOrderDialog'
import { cn } from '@/lib/utils'

type ChatRightSidebarProps = {
  conversation: CskhInboxConversation
  intent?: CskhCustomerIntent | null
  isLoadingIntent?: boolean
  adInsights?: CskhAdInsights | null
  isLoadingAdInsights?: boolean
  onApplySuggestedReply: (text: string) => void
  onRefreshAdInsights?: () => void
  isRefreshingAdInsights?: boolean
}

function formatAdMoney(amount: number | null | undefined, currency?: string | null): string {
  if (amount == null || !Number.isFinite(amount)) return '—'
  const cur = (currency || 'VND').toUpperCase()
  if (cur === 'VND') {
    return `${Math.round(amount).toLocaleString('vi-VN')}đ`
  }
  return `${amount.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ${cur}`
}

function formatAdPeriod(dateStart?: string | null, dateStop?: string | null): string | null {
  if (!dateStart || !dateStop) return null
  return `${dateStart} → ${dateStop}`
}

function hasAdCampaignInfo(
  conversation: CskhInboxConversation,
  adInsights?: CskhAdInsights | null,
): boolean {
  return Boolean(
    conversation.adTitle?.trim() ||
      adInsights?.campaignName ||
      adInsights?.adName ||
      adInsights?.adsetName ||
      conversation.adId ||
      adInsights?.adId ||
      (adInsights?.topCampaigns?.length ?? 0) > 0,
  )
}
function adInsightsHint(reason: string | null | undefined): string {
  switch (reason) {
    case 'no_ad_id':
      return 'Hội thoại cũ: Meta không gửi mã QC — đang lấy chi phí TB tài khoản QC.'
    case 'no_ad_accounts':
      return 'OAuth chưa có tài khoản QC hoặc thiếu quyền ads_read — đăng nhập lại bằng admin Business Manager.'
    case 'no_messaging_insights':
      return 'Chưa lấy được chi phí messaging từ Meta — xem gợi ý bên dưới (có thể cần OAuth lại đúng tài khoản QC).'
    case 'oauth_required':
      return 'Cần kết nối lại Facebook (OAuth) với quyền ads_read.'
    case 'ads_read_missing':
      return 'Thiếu quyền ads_read — vào Meta App → Marketing API → OAuth lại và chấp nhận quyền quảng cáo.'
    case 'not_from_ad':
      return 'Hội thoại không từ quảng cáo.'
    case 'api_error':
      return 'Không lấy được dữ liệu từ Marketing API — thử lại sau vài giờ (Insights có độ trễ).'
    default:
      return 'Chưa có dữ liệu chi phí.'
  }
}

export function ChatRightSidebar({
  conversation,
  intent,
  isLoadingIntent,
  adInsights,
  isLoadingAdInsights,
  onApplySuggestedReply,
  onRefreshAdInsights,
  isRefreshingAdInsights,
}: ChatRightSidebarProps) {
  const [copied, setCopied] = useState(false)
  const [sapoOrderOpen, setSapoOrderOpen] = useState(false)

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Đã sao chép vào bộ nhớ tạm')
    setTimeout(() => setCopied(false), 2000)
  }

  const getUrgencyText = (urgency: string) => {
    switch (urgency) {
      case 'high':
        return 'Gấp'
      case 'low':
        return 'Thấp'
      default:
        return 'Bình thường'
    }
  }

  const showAdDetails =
    conversation.fromAd ||
    conversation.referralSource === 'HEURISTIC' ||
    Boolean(adInsights && !adInsights.unavailableReason)

  const hasSpecificAd =
    adInsights?.insightsScope === 'ad' || Boolean(conversation.adId || adInsights?.adId)

  const isCampaignEstimate =
    adInsights?.insightsScope === 'campaign' || adInsights?.insightsScope === 'adset'

  const isPageEstimate =
    adInsights?.insightsScope === 'page' || adInsights?.isPageLevelEstimate === true

  const showCampaignSpend =
    (hasSpecificAd || isCampaignEstimate) && adInsights?.spend != null

  const hasCostData =
    adInsights != null &&
    !adInsights.unavailableReason &&
    (adInsights.estimatedForThisConversation != null || adInsights.costPerConversation != null)

  const showCampaignBlock = hasAdCampaignInfo(conversation, adInsights)

  const campaignName =
    adInsights?.campaignName ||
    adInsights?.topCampaigns?.[0]?.campaignName ||
    null
  const adDisplayName =
    conversation.adTitle?.trim() ||
    adInsights?.adName ||
    null
  const adPeriod = formatAdPeriod(adInsights?.dateStart, adInsights?.dateStop)

  return (
    <div className="w-[300px] border-l border-slate-200/60 bg-gradient-to-b from-slate-50/80 to-white flex flex-col h-full font-sans">
      <div className="flex-1 overflow-y-auto min-h-0">
      {/* Customer Profile */}
      <div className="px-5 pt-5 pb-4 flex flex-col items-center text-center">
        <CskhPageAvatar
          name={conversation.customerName || 'K'}
          pictureUrl={conversation.customerPictureUrl}
          pageId={conversation.pageId}
          psid={conversation.participantPsid}
          liveFetch
          className="mb-3 h-14 w-14 rounded-full text-lg shadow-lg ring-3 ring-white"
        />
        <h3 className="text-sm font-bold text-slate-800 truncate max-w-full">
          {conversation.customerName ||
            (conversation.platform === 'instagram' ? 'Khách Instagram' : 'Khách hàng Messenger')}
        </h3>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border',
            conversation.platform === 'instagram'
              ? 'bg-pink-50 text-pink-600 border-pink-100/50'
              : 'bg-blue-50 text-blue-600 border-blue-100/50',
          )}
        >
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              conversation.platform === 'instagram' ? 'bg-pink-500' : 'bg-blue-500',
            )}
          />
          {conversation.platform === 'instagram'
            ? 'Instagram · Instagram User'
            : 'Messenger · Facebook User'}
        </span>
      </div>

      {/* Divider */}
      <div className="h-px mx-4 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      {/* Customer Info */}
      <div className="px-5 py-4 space-y-3">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <User className="w-3 h-3" />
          Thông tin khách
        </h4>
        
        <div className="space-y-2.5 text-[11px]">
          <div className="flex items-start gap-2">
            <span className="text-slate-400 font-medium min-w-[60px] pt-0.5">Kênh nhận:</span>
            <span className="text-slate-700 font-semibold truncate">
              {conversation.pageName?.trim() ||
                (conversation.pageId ? `ID: ${conversation.pageId}` : '—')}
            </span>
          </div>

          <div className="flex items-start gap-2">
            <span className="text-slate-400 font-medium min-w-[60px] pt-0.5">Nguồn:</span>
            <span className="font-semibold">
              {conversation.fromAd ? (
                <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md text-[10px]">
                  <Megaphone className="w-2.5 h-2.5" />
                  Facebook Ads
                </span>
              ) : (
                <span className="text-slate-500 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-md text-[10px]">
                  Organic
                </span>
              )}
            </span>
          </div>

          <div className="flex items-start gap-2">
            <span className="text-slate-400 font-medium min-w-[60px] pt-0.5">PSID:</span>
            <span className="text-slate-600 font-mono text-[10px] select-all bg-slate-50 px-1.5 py-0.5 rounded">
              {conversation.participantPsid?.trim() || '—'}
            </span>
          </div>
        </div>

        {/* Ads Campaign Details */}
        {showAdDetails && (
          <div className="mt-2 bg-gradient-to-br from-amber-50/80 to-orange-50/50 rounded-xl border border-amber-100/60 p-3 space-y-3 text-[11px]">
            <div className="flex items-center justify-between font-bold text-amber-800 text-[10px]">
              <div className="flex items-center gap-1.5">
                <Megaphone className="w-3 h-3 text-amber-600" />
                Quảng cáo Facebook
              </div>
              {onRefreshAdInsights && (
                <button
                  type="button"
                  onClick={onRefreshAdInsights}
                  disabled={isRefreshingAdInsights || isLoadingAdInsights}
                  className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:text-amber-800 hover:bg-amber-100/50 transition-all duration-200 cursor-pointer disabled:opacity-50"
                  title="Làm mới số liệu chi phí từ Meta"
                >
                  <RefreshCw className={cn("w-3 h-3", (isRefreshingAdInsights || isLoadingAdInsights) && "animate-spin")} />
                </button>
              )}
            </div>

            {isLoadingAdInsights ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg bg-white/70 border border-amber-100/80 px-3 py-6 text-center">
                <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                <p className="text-[11px] font-medium text-slate-600">Đang tải quảng cáo Facebook...</p>
                <p className="text-[9px] text-slate-400 leading-relaxed max-w-[220px]">
                  Lấy chiến dịch và chi phí từ Meta cho hội thoại này
                </p>
              </div>
            ) : showCampaignBlock ? (
              <div className="space-y-2 rounded-lg bg-white/70 border border-amber-100/80 px-2.5 py-2.5">
                {campaignName && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-400 font-medium text-[10px]">Chiến dịch</span>
                    <span className="text-slate-800 font-semibold leading-snug">{campaignName}</span>
                  </div>
                )}
                {adInsights?.adsetName && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-400 font-medium text-[10px]">Nhóm quảng cáo</span>
                    <span className="text-slate-700 font-medium leading-snug">{adInsights.adsetName}</span>
                  </div>
                )}
                {adDisplayName && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-400 font-medium text-[10px]">
                      {hasSpecificAd ? 'Tên quảng cáo' : 'Quảng cáo tham chiếu'}
                    </span>
                    <span className="text-slate-700 font-medium leading-snug">{adDisplayName}</span>
                  </div>
                )}
                {(conversation.adId || adInsights?.adId) && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-400 font-medium text-[10px]">Mã quảng cáo</span>
                    <span className="text-slate-600 font-mono text-[10px] select-all">
                      {conversation.adId || adInsights?.adId}
                    </span>
                  </div>
                )}
                {!hasSpecificAd && isPageEstimate && (
                  <p className="text-[9px] text-slate-400 leading-relaxed pt-0.5">
                    Meta không gắn mã QC cho tin này — hiển thị camp QC đang chạy mạnh nhất trên Page.
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-lg bg-white/60 border border-amber-100/60 px-2.5 py-2 text-[10px] text-slate-500 leading-relaxed">
                Khách vào từ quảng cáo Click-to-Messenger. Chi tiết camp sẽ hiện khi Meta trả dữ liệu.
              </div>
            )}

            {/* Chi phí */}
            {!isLoadingAdInsights && (
            <div className="pt-0.5 space-y-2">
              {adInsights?.unavailableReason ? (
                <div className="rounded-lg bg-white/60 border border-slate-200/60 px-2.5 py-2 space-y-1">
                  <p className="text-[10px] text-slate-600 leading-relaxed">
                    {adInsightsHint(adInsights.unavailableReason)}
                  </p>
                  {adInsights.estimateNote && (
                    <p className="text-[9px] text-slate-400 leading-relaxed">{adInsights.estimateNote}</p>
                  )}
                </div>
              ) : hasCostData ? (
                <>
                  <div
                    className={cn(
                      'grid gap-2',
                      showCampaignSpend ? 'grid-cols-2' : 'grid-cols-1',
                    )}
                  >
                    {showCampaignSpend && (
                      <div className="bg-white rounded-lg px-2.5 py-2 border border-emerald-100/80 shadow-sm">
                        <div className="text-[9px] text-slate-400 font-medium">
                          {isCampaignEstimate ? 'Tổng chi tiêu chiến dịch' : 'Tổng chi tiêu QC'}
                        </div>
                        <div className="text-[12px] font-bold text-slate-800">
                          {formatAdMoney(adInsights.spend, adInsights.currency)}
                        </div>
                      </div>
                    )}
                    <div className="bg-white rounded-lg px-2.5 py-2 border border-emerald-100/80 shadow-sm">
                      <div className="text-[9px] text-slate-400 font-medium">
                        {hasSpecificAd || isCampaignEstimate
                          ? 'Chi phí / hội thoại'
                          : 'Chi phí TB / tin nhắn (Page)'}
                      </div>
                      <div className="text-[13px] font-bold text-emerald-700">
                        {formatAdMoney(
                          adInsights?.estimatedForThisConversation ?? adInsights?.costPerConversation,
                          adInsights?.currency,
                        )}
                      </div>
                    </div>
                  </div>
                  {(adInsights?.messagingConversations != null || adPeriod) && (
                    <p className="text-[9px] text-slate-400 leading-relaxed">
                      {adInsights.messagingConversations != null && (
                        <>
                          {adInsights.messagingConversations.toLocaleString('vi-VN')}
                          {hasSpecificAd
                            ? ' hội thoại từ QC này'
                            : isCampaignEstimate
                              ? adInsights?.insightsScope === 'adset'
                                ? ' hội thoại từ nhóm QC'
                                : ' hội thoại từ chiến dịch'
                              : ' hội thoại QC trên Page'}
                        </>
                      )}
                      {adPeriod && (
                        <>
                          {adInsights.messagingConversations != null ? ' · ' : ''}
                          {adPeriod}
                        </>
                      )}
                    </p>
                  )}
                  {isRefreshingAdInsights || isLoadingAdInsights ? (
                    <p className="text-[9px] text-amber-600 font-medium">
                      Đang quét lại từ Meta...
                    </p>
                  ) : adInsights?.metaFetchedAt ? (
                    <p className="text-[9px] text-slate-400">
                      {adInsights.refreshedFromMeta
                        ? 'Vừa lấy từ Meta'
                        : 'Từ cache'}
                      {' · '}
                      {new Date(adInsights.metaFetchedAt).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </p>
                  ) : null}
                  {adInsights?.connectedAdAccountName && (
                    <p className="text-[9px] text-slate-400">
                      Tài khoản QC: {adInsights.connectedAdAccountName}
                    </p>
                  )}
                </>
              ) : null}
            </div>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px mx-4 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      {/* AI Intent Analysis */}
      <div className="px-5 py-4 space-y-3">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-violet-500 flex items-center gap-1.5 w-full">
          <Sparkles className="w-3 h-3" />
          AI phân tích ý định
          {intent?.isStale && (
            <span className="ml-auto flex items-center gap-1 text-[9px] text-violet-400 normal-case font-medium animate-pulse">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              Đang cập nhật...
            </span>
          )}
        </h4>

        {isLoadingIntent ? (
          <div className="flex items-center gap-2 py-3 text-[11px] text-violet-600">
            <div className="w-3.5 h-3.5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            Đang phân tích cuộc hội thoại...
          </div>
        ) : !intent ? (
          <div className="text-[11px] text-slate-400 italic py-2">
            Chưa có đủ tin nhắn để AI phân tích ý định.
          </div>
        ) : (
          <div className="space-y-3">
            {/* Intent Label & Urgency */}
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm">
                {intent.intentLabel}
              </span>
              <span
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase',
                  intent.urgency === 'high'
                    ? 'bg-rose-50 text-rose-600 border border-rose-200/60'
                    : intent.urgency === 'low'
                      ? 'bg-slate-50 text-slate-500 border border-slate-200/60'
                      : 'bg-sky-50 text-sky-600 border border-sky-200/60'
                )}
              >
                {getUrgencyText(intent.urgency)}
              </span>
            </div>

            {/* Summary */}
            <div className="bg-white/80 rounded-xl border border-slate-200/60 p-3 shadow-sm">
              <div className="text-[10px] text-slate-400 font-semibold mb-1.5 uppercase tracking-wide">Tóm tắt nhu cầu:</div>
              <p className="text-[11px] text-slate-700 leading-relaxed">{intent.summary}</p>
            </div>

            {/* Topics */}
            {intent.topics?.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Chủ đề quan tâm
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {intent.topics.map((topic) => (
                    <span
                      key={topic}
                      className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-violet-50 text-violet-600 border border-violet-100/60"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Sapo Products match */}
            {intent.products && intent.products.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Sản phẩm quan tâm
                </span>
                <div className="space-y-1.5">
                  {intent.products.map((p) => (
                    <div
                      key={`${p.productId}-${p.variantId}`}
                      className="flex gap-2 rounded-xl bg-white border border-slate-200/60 p-2 shadow-sm hover:shadow-md transition-shadow duration-200"
                    >
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-lg object-cover border border-slate-100"
                        />
                      ) : (
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-100 flex items-center justify-center text-[9px] text-slate-400 font-bold">
                          SP
                        </div>
                      )}
                      <div className="min-w-0 flex-1 text-[11px]">
                        <p className="font-semibold text-slate-700 leading-snug break-words whitespace-normal">{p.name}</p>
                        <p className="text-[9px] text-emerald-700/90 font-medium mt-0.5 break-words">
                          {[
                            (() => {
                              const missingSize = 'chưa có size'
                              const missingColor = 'chưa có màu'
                              const vt = (p.variantTitle || '').trim()
                              if (!vt || /^default/i.test(vt)) {
                                return `${missingSize} · ${missingColor}`
                              }
                              if (vt.includes('/')) {
                                let size: string | null = null
                                let color: string | null = null
                                for (const part of vt.split('/').map((x) => x.trim()).filter(Boolean)) {
                                  if (/size|kích\s*thước|^\d+(\.\d+)?$/i.test(part)) {
                                    size = /^\d+(\.\d+)?$/.test(part) ? `Size ${part}` : part
                                  } else {
                                    color = /^màu\b/i.test(part) ? part : `Màu ${part}`
                                  }
                                }
                                return `${size ?? missingSize} · ${color ?? missingColor}`
                              }
                              if (/^\d+(\.\d+)?$/.test(vt) || /^(size|kích\s*thước)\b/i.test(vt)) {
                                const size = /^\d+(\.\d+)?$/.test(vt) ? `Size ${vt}` : vt
                                return `${size} · ${missingColor}`
                              }
                              const color = /^màu\b/i.test(vt) ? vt : `Màu ${vt}`
                              return `${missingSize} · ${color}`
                            })(),
                            p.sku ? `SKU ${p.sku}` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        <p className="text-violet-600 font-bold mt-0.5">{p.priceLabel}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px mx-4 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      {/* AI Suggested Response */}
      <div className="px-5 py-4 space-y-3">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-blue-500 flex items-center gap-1.5 w-full">
          <MessageSquare className="w-3 h-3" />
          AI gợi ý trả lời
          {intent?.isStale && (
            <span className="ml-auto flex items-center gap-1 text-[9px] text-blue-400 normal-case font-medium animate-pulse">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              Đang cập nhật...
            </span>
          )}
        </h4>

        {isLoadingIntent ? (
          <div className="flex items-center gap-2 py-3 text-[11px] text-blue-500">
            <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Đang tạo gợi ý phản hồi...
          </div>
        ) : !intent || (!intent.suggestedFocus && !intent.suggestedReply) ? (
          <div className="text-[11px] text-slate-400 italic py-2">
            Chưa có gợi ý trả lời nào từ AI.
          </div>
        ) : (
          <div className="space-y-3">
            {/* Guidance focus advice */}
            {intent.suggestedFocus && (
              <div className="bg-slate-50 border border-slate-200/40 rounded-xl p-3 text-[10px] text-slate-500 leading-relaxed">
                <span className="font-semibold text-slate-600 block mb-0.5">💡 Hướng xử lý:</span>
                {intent.suggestedFocus}
              </div>
            )}

            {/* Actual Suggested Reply Card */}
            <div className="relative bg-gradient-to-br from-blue-50/50 to-indigo-50/30 rounded-xl border border-blue-100/50 p-3.5 shadow-sm">
              <div className="absolute top-2 right-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-400/40" />
              </div>
              <span className="font-semibold text-blue-600 text-[10.5px] block mb-1">✨ Tin nhắn gợi ý:</span>
              <p className="text-[11px] text-slate-700 leading-relaxed pr-4 whitespace-pre-wrap">
                {intent.suggestedReply || intent.suggestedFocus}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                disabled={!intent.analyzedAt}
                onClick={() => handleCopy(intent.suggestedReply || intent.suggestedFocus)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200/60 rounded-xl hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] transition-all duration-200 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                Sao chép
              </button>
              <button
                disabled={!intent.analyzedAt}
                onClick={() => onApplySuggestedReply(intent.suggestedReply || intent.suggestedFocus)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl hover:from-blue-600 hover:to-indigo-700 active:scale-[0.98] transition-all duration-200 shadow-sm shadow-blue-200/50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Zap className="w-3.5 h-3.5" />
                Áp dụng
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="h-px mx-4 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      <div className="px-5 py-4 pb-6">
        <button
          type="button"
          onClick={() => setSapoOrderOpen(true)}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 text-[12px] font-bold text-white shadow-md hover:from-emerald-600 hover:to-teal-700 transition-all active:scale-[0.99] cursor-pointer"
        >
          <ShoppingCart className="w-4 h-4" />
          Tạo đơn hàng
        </button>
      </div>
      </div>

      <OmsCreateOrderDialog
        open={sapoOrderOpen}
        onClose={() => setSapoOrderOpen(false)}
        conversation={conversation}
        intent={intent}
      />
    </div>
  )
}
