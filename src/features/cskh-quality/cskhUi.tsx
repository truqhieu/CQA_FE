import type { ReactNode } from 'react'
import { useState } from 'react'
import { Loader2, X, AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DatePicker } from '@/components/custom-ui/date-picker'
import { formatAuditDateLabel } from './auditHelpers'
import { cskhCustomerAvatarSrc, cskhPageAvatarSrc } from './messageMedia'

/** Facebook CDN — proxy qua BE vì img tag không gửi JWT. */
export function cskhAvatarSrc(pictureUrl?: string | null): string | undefined {
  if (!pictureUrl?.startsWith('http')) return undefined
  if (/fbcdn|fbsbx|facebook\.com|fb\.com/i.test(pictureUrl)) {
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:3003').replace(/\/$/, '')
    return `${base}/cskh/media/avatar?url=${encodeURIComponent(pictureUrl)}`
  }
  return pictureUrl
}

export { cskhCustomerAvatarSrc, cskhMediaSrc, cskhPageAvatarSrc } from './messageMedia'

export function avatarGradient(name: string) {
  const palettes = [
    'from-violet-500 via-purple-500 to-fuchsia-500',
    'from-sky-500 via-blue-500 to-indigo-600',
    'from-emerald-500 via-teal-500 to-cyan-600',
    'from-rose-500 via-pink-500 to-orange-400',
    'from-amber-500 via-orange-500 to-red-500',
  ]
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % palettes.length
  return palettes[idx]
}

export function CskhPageAvatar({
  name,
  pictureUrl,
  pageId,
  psid,
  liveFetch,
  className,
}: {
  name: string
  pictureUrl?: string | null
  pageId?: string | null
  psid?: string | null
  /** Gọi Graph khi chưa có URL — chỉ dùng cho hội thoại đang mở, không dùng trên list. */
  liveFetch?: boolean
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const [forcePageFetch, setForcePageFetch] = useState(false)
  const letter = (name.charAt(0) || 'P').toUpperCase()

  const imgSrc = psid
    ? cskhCustomerAvatarSrc({ pictureUrl, pageId, psid, liveFetch })
    : forcePageFetch && pageId
      ? cskhPageAvatarSrc({ pageId })
      : cskhPageAvatarSrc({ pictureUrl, pageId })

  const showImage = imgSrc && !failed

  if (showImage) {
    return (
      <img
        src={imgSrc}
        alt=""
        referrerPolicy="no-referrer"
        className={cn(
          'h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-slate-200/80',
          className
        )}
        onError={() => {
          if (!psid && pageId && !forcePageFetch) {
            setForcePageFetch(true)
            return
          }
          setFailed(true)
        }}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xs font-bold text-white',
        avatarGradient(name),
        className
      )}
    >
      {letter}
    </div>
  )
}

export function CskhPageShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
        className
      )}
    >
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col gap-2 sm:gap-3',
          className?.includes('!h-auto') ? '' : 'overflow-hidden'
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function CskhHero({
  title,
  subtitle,
  badge,
  stats,
}: {
  title: string
  subtitle: string
  badge?: ReactNode
  stats?: ReactNode
}) {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-white/60 bg-white/70 px-5 py-6 shadow-lg shadow-indigo-100/50 backdrop-blur-xl sm:px-8 sm:py-7">
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-400/20 to-violet-400/10 blur-2xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-2 w-8 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600/80">
              Facebook Messenger
            </span>
            {badge}
          </div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            <span className="bg-gradient-to-r from-indigo-700 via-violet-700 to-fuchsia-600 bg-clip-text text-transparent">
              {title}
            </span>
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-[15px]">
            {subtitle}
          </p>
        </div>
        {stats ? <div className="flex shrink-0 flex-wrap gap-2">{stats}</div> : null}
      </div>
    </header>
  )
}

export function CskhStatPill({
  label,
  value,
  tone = 'default',
  hint,
}: {
  label: string
  value: string | number
  tone?: 'default' | 'live' | 'warn' | 'rose' | 'sky'
  hint?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-2.5 text-center shadow-sm backdrop-blur-sm min-w-[5.5rem]',
        tone === 'live' && 'border-emerald-200/80 bg-emerald-50/90',
        tone === 'warn' && 'border-amber-200/80 bg-amber-50/90',
        tone === 'rose' && 'border-rose-200/80 bg-rose-50/90',
        tone === 'sky' && 'border-sky-200/80 bg-sky-50/90',
        tone === 'default' && 'border-indigo-100/80 bg-white/90'
      )}
    >
      <p
        className={cn(
          'text-lg font-bold tabular-nums',
          tone === 'live' && 'text-emerald-700',
          tone === 'warn' && 'text-amber-700',
          tone === 'rose' && 'text-rose-700',
          tone === 'sky' && 'text-sky-700',
          tone === 'default' && 'text-indigo-700'
        )}
      >
        {value}
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      {hint ? <p className="mt-0.5 text-[10px] leading-tight text-slate-400">{hint}</p> : null}
    </div>
  )
}

/** Thống kê nhanh theo ngày audit — đạt / không đạt / tổng / quảng cáo. */
export function AuditDayStatsCards({
  stats,
  loading,
  auditDayLabel,
  className,
}: {
  stats?: { total?: number; passed?: number; failed?: number; fromAd?: number } | null
  loading?: boolean
  auditDayLabel?: string | null
  className?: string
}) {
  const val = (n: number | undefined) => (loading ? '…' : (n ?? '—'))
  const dayHint = auditDayLabel ? `Khoảng ${auditDayLabel}` : 'Chọn khoảng ngày'

  return (
    <div className={cn('grid grid-cols-2 gap-2 sm:grid-cols-4', className)}>
      <CskhStatPill label="Không đạt (<70)" value={val(stats?.failed)} tone="rose" hint={dayHint} />
      <CskhStatPill
        label="Đạt (≥70)"
        value={val(stats?.passed)}
        tone="live"
        hint={stats?.total != null && !loading ? `${stats.total} hội thoại` : dayHint}
      />
      <CskhStatPill
        label="Tổng hội thoại"
        value={val(stats?.total)}
        tone="default"
        hint={dayHint}
      />
      <CskhStatPill label="Từ quảng cáo" value={val(stats?.fromAd)} tone="sky" hint={dayHint} />
    </div>
  )
}

export function CskhTokenStat({
  model,
  totalTokens,
  promptTokens,
  completionTokens,
  perAuditAvg,
  running,
}: {
  model?: string
  totalTokens?: number
  promptTokens?: number
  completionTokens?: number
  perAuditAvg?: number
  running?: boolean
}) {
  const hasData = totalTokens != null && totalTokens > 0
  return (
    <div
      className={cn(
        'min-w-[8.5rem] rounded-xl border px-4 py-2.5 shadow-sm backdrop-blur-sm',
        running ? 'border-violet-200/80 bg-violet-50/90' : 'border-indigo-100/80 bg-white/90'
      )}
    >
      <p
        className={cn(
          'text-lg font-bold tabular-nums',
          running ? 'text-violet-700' : 'text-indigo-700'
        )}
      >
        {hasData ? totalTokens.toLocaleString('vi-VN') : '—'}
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Token audit {model ? `· ${model}` : ''}
      </p>
      {hasData ? (
        <p className="mt-0.5 text-[10px] leading-snug text-slate-400">
          In {(promptTokens ?? 0).toLocaleString('vi-VN')} · Out{' '}
          {(completionTokens ?? 0).toLocaleString('vi-VN')}
          {perAuditAvg ? (
            <>
              <br />~{perAuditAvg.toLocaleString('vi-VN')}/hội thoại
            </>
          ) : null}
        </p>
      ) : (
        <p className="mt-0.5 text-[10px] text-slate-400">Quét và chấm điểm để xem</p>
      )}
    </div>
  )
}

export function formatDeepSeekBalance(amount: number, currency?: string) {
  const cur = (currency || 'USD').toUpperCase()
  const formatted = amount.toLocaleString('vi-VN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  if (cur === 'CNY') return `¥${formatted}`
  if (cur === 'USD') return `$${formatted}`
  return `${formatted} ${cur}`
}

export function CskhDeepSeekBalanceStat({
  totalBalance,
  currency,
  model,
  isAvailable,
  grantedBalance,
  toppedUpBalance,
  loading,
  error,
}: {
  totalBalance?: number
  currency?: string
  model?: string
  isAvailable?: boolean
  grantedBalance?: number
  toppedUpBalance?: number
  loading?: boolean
  error?: boolean
}) {
  const hasBalance = totalBalance != null && !error
  const lowBalance = hasBalance && totalBalance < 5

  return (
    <div
      className={cn(
        'min-w-[8.5rem] rounded-xl border px-4 py-2.5 shadow-sm backdrop-blur-sm',
        error && 'border-slate-200/80 bg-white/90',
        !error && lowBalance && 'border-amber-200/80 bg-amber-50/90',
        !error && !lowBalance && isAvailable === false && 'border-rose-200/80 bg-rose-50/90',
        !error && !lowBalance && isAvailable !== false && 'border-emerald-200/80 bg-emerald-50/90'
      )}
    >
      <p
        className={cn(
          'text-lg font-bold tabular-nums',
          error && 'text-slate-500',
          !error && lowBalance && 'text-amber-700',
          !error && !lowBalance && isAvailable === false && 'text-rose-700',
          !error && !lowBalance && isAvailable !== false && 'text-emerald-700'
        )}
      >
        {loading ? (
          <Loader2 className="inline h-5 w-5 animate-spin" />
        ) : hasBalance ? (
          formatDeepSeekBalance(totalBalance, currency)
        ) : (
          '—'
        )}
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Số dư DeepSeek {model ? `· ${model}` : ''}
      </p>
      {loading ? (
        <p className="mt-0.5 text-[10px] text-slate-400">Đang tải…</p>
      ) : hasBalance ? (
        <p className="mt-0.5 text-[10px] leading-snug text-slate-400">
          {isAvailable === false ? 'Hết số dư · cần nạp thêm' : 'Còn khả dụng'}
          {(grantedBalance ?? 0) > 0 || (toppedUpBalance ?? 0) > 0 ? (
            <>
              <br />
              {(grantedBalance ?? 0) > 0
                ? `Tặng ${formatDeepSeekBalance(grantedBalance ?? 0, currency)}`
                : null}
              {(grantedBalance ?? 0) > 0 && (toppedUpBalance ?? 0) > 0 ? ' · ' : null}
              {(toppedUpBalance ?? 0) > 0
                ? `Nạp ${formatDeepSeekBalance(toppedUpBalance ?? 0, currency)}`
                : null}
            </>
          ) : null}
        </p>
      ) : (
        <p className="mt-0.5 text-[10px] text-slate-400">Không lấy được số dư</p>
      )}
    </div>
  )
}

export function CskhTabNav({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: string; label: string; icon: ReactNode; busy?: boolean }>
  active: string
  onChange: (id: string) => void
}) {
  return (
    <nav className="flex shrink-0 gap-1.5 overflow-x-auto rounded-xl border border-white/70 bg-white/60 p-1 shadow-md shadow-indigo-100/40 backdrop-blur-xl">
      {tabs.map(({ id, label, icon, busy }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              'flex min-w-[7rem] flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200',
              isActive
                ? 'bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-lg shadow-indigo-300/40'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
            )}
          >
            {icon}
            {label}
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin opacity-80" /> : null}
          </button>
        )
      })}
    </nav>
  )
}

export function CskhGlassPanel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 flex flex-col h-full w-full min-h-0',
        className
      )}
    >
      {children}
    </div>
  )
}

export function CskhToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="cskh-toolbar-container shrink-0 border-b border-indigo-100/80 bg-gradient-to-r from-indigo-50/80 via-white/50 to-violet-50/80 p-3 sm:p-4">
      {children}
    </div>
  )
}

export type MessengerWorkspacePane = 'list' | 'chat' | 'analysis'

export function MessengerWorkspace({
  sidebar,
  main,
  aside,
  pane = 'chat',
  className,
  layout = 'default',
}: {
  sidebar: ReactNode
  main: ReactNode
  aside?: ReactNode
  /** Dưới xl: chỉ hiện một cột; từ xl: luôn 3 cột. */
  pane?: MessengerWorkspacePane
  className?: string
  /** audit: danh sách hẹp, panel phân tích rộng hơn */
  layout?: 'default' | 'audit'
}) {
  const isAuditLayout = layout === 'audit'
  const showList = pane === 'list'
  const showChat = pane === 'chat'
  const showAnalysis = pane === 'analysis'

  const auditPanelClass =
    'min-h-0 min-w-0 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm'

  return (
    <div
      className={cn(
        'flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden',
        'h-[calc(100dvh-12rem)] md:h-[calc(100dvh-10rem)] xl:h-[calc(100dvh-8rem)]',
        className
      )}
    >
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
          isAuditLayout && 'xl:bg-slate-100/70 xl:p-2',
          !isAuditLayout && 'xl:flex-row xl:items-stretch'
        )}
      >
        {isAuditLayout ? (
          <div
            className={cn(
              'flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden',
              /* Danh sách hẹp hơn · hội thoại + phân tích AI rộng hơn */
              'xl:grid xl:w-full xl:grid-cols-[minmax(240px,19%)_minmax(400px,42%)_minmax(320px,39%)] xl:gap-2.5 xl:2xl:grid-cols-[minmax(248px,17%)_minmax(440px,43%)_minmax(340px,40%)]'
            )}
          >
            <aside
              className={cn(
                auditPanelClass,
                'flex flex-col',
                showList ? 'min-h-0 flex-1' : 'hidden xl:flex xl:min-h-0'
              )}
            >
              {sidebar}
            </aside>
            <div
              className={cn(
                auditPanelClass,
                'flex flex-col',
                showChat ? 'min-h-0 flex-1' : 'hidden xl:flex xl:min-h-0'
              )}
            >
              {main}
            </div>
            {aside ? (
              <aside
                className={cn(
                  auditPanelClass,
                  'flex flex-col',
                  showAnalysis ? 'min-h-0 flex-1' : 'hidden xl:flex xl:min-h-0'
                )}
              >
                {aside}
              </aside>
            ) : null}
          </div>
        ) : (
          <>
            <aside
              className={cn(
                'flex min-h-0 shrink-0 flex-col overflow-hidden bg-white',
                'border-b border-slate-200/80 xl:h-full xl:w-[min(300px,24vw)] xl:min-w-[260px] xl:max-w-[340px] xl:border-b-0 xl:border-r',
                showList ? 'min-h-0 flex-1 xl:flex-none' : 'hidden xl:flex'
              )}
            >
              {sidebar}
            </aside>
            <div
              className={cn(
                'flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#f0f2f5]',
                showChat ? 'min-h-0 flex-1' : 'hidden xl:flex xl:min-w-0 xl:flex-1'
              )}
            >
              {main}
            </div>
            {aside ? (
              <aside
                className={cn(
                  'flex min-h-0 min-w-0 flex-col overflow-hidden bg-white',
                  'border-t border-slate-200/80 xl:h-full xl:w-[min(380px,32vw)] xl:max-w-[420px] xl:flex-none xl:border-l xl:border-t-0',
                  showAnalysis ? 'min-h-0 flex-1 xl:flex' : 'hidden xl:flex'
                )}
              >
                {aside}
              </aside>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

export function MessengerSidebarHeader({
  title,
  action,
  search,
}: {
  title: string
  action?: ReactNode
  search?: ReactNode
}) {
  return (
    <div className="space-y-2.5 border-b border-indigo-100/60 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-indigo-600">{title}</p>
        {action}
      </div>
      {search}
    </div>
  )
}

export function CskhEmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="rounded-3xl bg-gradient-to-br from-indigo-100 via-violet-100 to-fuchsia-100 p-6 shadow-inner">
        {icon}
      </div>
      <div className="max-w-xs space-y-1">
        <p className="font-semibold text-slate-800">{title}</p>
        <p className="text-sm leading-relaxed text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  )
}

export function CskhLoading({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-slate-500">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-indigo-300/30" />
        <Loader2 className="relative h-8 w-8 animate-spin text-indigo-500" />
      </div>
      <p className="text-sm font-medium">{label}</p>
    </div>
  )
}

/** Toolbar chấm điểm — nhãn + control cùng cỡ. */
export const cskhAuditToolbarLabelClass =
  'mb-1 block h-4 text-[11px] font-semibold leading-4 uppercase tracking-wide text-slate-500'
export const cskhAuditToolbarControlClass =
  'h-9 min-h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 shadow-sm'

/** Calendar popover — dùng chung DatePicker của app, style gọn cho toolbar chấm điểm. */
export function CskhAuditDatePicker({
  value,
  onChange,
  disabled,
  max,
  min,
  placeholder = 'Chọn ngày',
  compact,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  max?: string
  min?: string
  placeholder?: string
  /** Toolbar: cùng chiều cao với select/input khác. */
  compact?: boolean
}) {
  return (
    <DatePicker
      value={value}
      onChange={onChange}
      disabled={disabled}
      max={max}
      min={min}
      placeholder={placeholder}
      size={compact ? 'toolbar' : 'default'}
      displayLabel={value ? formatAuditDateLabel(value) : undefined}
      className={
        compact
          ? undefined
          : 'h-10 min-w-[9.5rem] rounded-xl border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:border-indigo-300'
      }
    />
  )
}

/** Khoảng ngày từ – đến (chấm điểm). */
export function CskhAuditDateRangePickers({
  from,
  to,
  onFromChange,
  onToChange,
  disabled,
  max = vietnamTodayIso(),
  compact,
  balanced,
}: {
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  disabled?: boolean
  max?: string
  compact?: boolean
  /** Toolbar: hai ô ngày chia đều chiều ngang cột. */
  balanced?: boolean
}) {
  const wrapClass = balanced
    ? 'grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2'
    : compact
      ? 'inline-flex flex-nowrap items-center gap-1'
      : 'flex flex-wrap items-center gap-2'

  return (
    <div className={wrapClass}>
      <CskhAuditDatePicker
        value={from}
        onChange={(v) => {
          onFromChange(v)
          if (to && v > to) onToChange(v)
        }}
        disabled={disabled}
        max={max}
        placeholder={compact && !balanced ? 'Từ' : 'Từ ngày'}
        compact={compact}
      />
      <span
        className={cn(
          'shrink-0 text-center text-slate-400',
          compact ? 'text-xs' : 'text-sm font-medium'
        )}
        aria-hidden
      >
        →
      </span>
      <CskhAuditDatePicker
        value={to}
        onChange={(v) => {
          onToChange(v)
          if (from && v < from) onFromChange(v)
        }}
        disabled={disabled}
        max={max}
        min={from || undefined}
        placeholder={compact && !balanced ? 'Đến' : 'Đến ngày'}
        compact={compact}
      />
    </div>
  )
}

/** Nhãn trường nhỏ cho toolbar chấm điểm. */
export function CskhAuditFieldLabel({
  children,
  required,
  htmlFor,
  hint,
  className,
}: {
  children: ReactNode
  required?: boolean
  htmlFor?: string
  hint?: string
  className?: string
}) {
  return (
    <label
      htmlFor={htmlFor}
      title={hint}
      className={cn(cskhAuditToolbarLabelClass, 'mb-1 flex items-center gap-1', className)}
    >
      {children}
      {required && <span className="text-rose-500">*</span>}
    </label>
  )
}

function vietnamTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
}

export function CskhConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[10px] font-semibold uppercase tracking-wide',
        connected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
      )}
      title={connected ? 'Nhận tin nhắn realtime qua webhook' : 'Đang thử kết nối realtime…'}
    >
      <span className="relative flex h-1.5 w-1.5">
        {connected && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={cn(
            'relative inline-flex h-1.5 w-1.5 rounded-full',
            connected ? 'bg-emerald-500' : 'bg-slate-400'
          )}
        />
      </span>
      {connected ? 'Live' : 'Offline'}
    </span>
  )
}

export function CskhAdSourceBadge({
  fromAd,
  adTitle,
  compact,
}: {
  fromAd?: boolean
  adTitle?: string | null
  compact?: boolean
}) {
  if (!fromAd) return null
  const label = adTitle?.trim() ? (compact ? 'QC' : `Quảng cáo`) : compact ? 'QC' : 'Từ quảng cáo'
  const title =
    label === 'QC'
      ? adTitle?.trim()
        ? `Quảng cáo: ${adTitle}`
        : 'Khách vào từ quảng cáo'
      : adTitle?.trim() || 'Khách vào từ quảng cáo Click-to-Messenger'
  return (
    <span
      title={title}
      className={cn(
        'inline-flex max-w-full items-center rounded-full bg-sky-100 font-semibold text-sky-800',
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
      )}
    >
      <span className="truncate">{label}</span>
      {!compact && adTitle?.trim() ? (
        <span className="ml-1 truncate font-medium opacity-90">· {adTitle.trim()}</span>
      ) : null}
    </span>
  )
}

export function CskhOrganicSourceBadge({ show }: { show?: boolean }) {
  if (!show) return null
  return (
    <span
      title="Khách nhắn trực tiếp, không qua quảng cáo"
      className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600"
    >
      Tự nhắn
    </span>
  )
}

export function CskhNoticeBanner({
  tone = 'error',
  title,
  message,
  onDismiss,
  action,
}: {
  tone?: 'error' | 'warn' | 'success' | 'info'
  title?: string
  message: string
  onDismiss?: () => void
  action?: ReactNode
}) {
  const Icon =
    tone === 'success'
      ? CheckCircle2
      : tone === 'warn'
        ? AlertTriangle
        : tone === 'info'
          ? Info
          : AlertCircle

  return (
    <div
      className={cn(
        'mx-4 mt-3 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm sm:mx-5',
        tone === 'error' && 'border-rose-200 bg-rose-50 text-rose-800',
        tone === 'warn' && 'border-amber-200 bg-amber-50 text-amber-900',
        tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
        tone === 'info' && 'border-indigo-200 bg-indigo-50 text-indigo-800'
      )}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        <p className={cn(title && 'mt-0.5', 'leading-relaxed')}>{message}</p>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg p-1 opacity-60 hover:bg-black/5 hover:opacity-100"
          aria-label="Đóng"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  )
}

type AuditProgressSummary = {
  phase?: string
  auditDate?: string
  pagesTotal?: number
  pagesProcessed?: number
  currentPage?: string
  scanned?: number
  fetched?: number
  total?: number
  processed?: number
  audited?: number
  errors?: number
  currentCustomer?: string
  auditCount?: number
  pauseRequested?: boolean
  skippedAlready?: number
  paused?: boolean
  maxConversations?: number | null
}

export function auditProgressPercent(summary?: AuditProgressSummary | null): number {
  if (!summary?.phase) return 3
  if (summary.phase === 'fetch') {
    const pagesTotal = summary.pagesTotal ?? 0
    const pagesDone = summary.pagesProcessed ?? 0
    const fetched = summary.fetched ?? 0
    const scanned = summary.scanned ?? 0

    if (pagesTotal <= 0) return 8

    const pageShare = pagesTotal > 0 ? pagesDone / pagesTotal : 0
    const withinPage =
      fetched > 0
        ? Math.min(0.85, Math.log10(fetched + 1) / 3)
        : scanned > 0
          ? Math.min(0.5, Math.log10(scanned + 1) / 4)
          : 0.05
    const pageSlice = 1 / pagesTotal
    const raw = pageShare + withinPage * pageSlice
    return Math.min(45, Math.max(5, Math.round(raw * 45)))
  }
  if (summary.phase === 'audit') {
    const total = summary.total ?? 0
    const processed = summary.processed ?? 0
    if (total <= 0) return 50
    return Math.round(45 + (processed / total) * 55)
  }
  return 5
}

export function CskhAuditProgressPanel({
  auditDayLabel,
  summary,
  className,
}: {
  auditDayLabel?: string | null
  summary?: AuditProgressSummary | null
  className?: string
}) {
  const phase = summary?.phase ?? 'fetch'
  const isFetch = phase === 'fetch'
  const isAudit = phase === 'audit'
  const pagesTotal = summary?.pagesTotal ?? 0
  const pagesDone = summary?.pagesProcessed ?? 0
  const pageCurrent = pagesTotal > 0 ? Math.min(pagesDone + 1, pagesTotal) : null
  const auditTotal = summary?.total ?? 0
  const auditProcessed = summary?.processed ?? 0
  const percent = auditProgressPercent(summary)

  const statusLine = summary?.pauseRequested
    ? 'Đang tạm dừng — lưu kết quả đã chấm…'
    : isFetch
      ? pagesTotal > 0
        ? `Đang quét Page ${pageCurrent}/${pagesTotal}${summary?.currentPage ? ` · ${summary.currentPage}` : ''}`
        : 'Đang kết nối Facebook…'
      : isAudit
        ? auditTotal > 0
          ? `Đang chấm điểm ${auditProcessed}/${auditTotal} hội thoại${
              summary?.currentCustomer ? ` · ${summary.currentCustomer}` : ''
            }`
          : 'Đang chuẩn bị chấm điểm…'
        : 'Đang xử lý…'

  const fetchCap = summary?.maxConversations ?? 0
  const detailLine = isFetch
    ? [
        summary?.scanned != null && summary.scanned > 0
          ? `Đã lướt ${summary.scanned.toLocaleString('vi-VN')} hội thoại inbox`
          : null,
        summary?.fetched != null
          ? fetchCap > 0
            ? `Đủ ${Math.min(summary.fetched, fetchCap).toLocaleString('vi-VN')}/${fetchCap.toLocaleString('vi-VN')} cần chấm trong ${auditDayLabel ?? '…'}`
            : `Tìm thấy ${summary.fetched.toLocaleString('vi-VN')} hội thoại trong ${auditDayLabel ?? '…'}`
          : null,
        fetchCap > 0 && summary?.scanned != null && summary.scanned > fetchCap
          ? '(đã lướt thêm inbox không có tin trong khoảng ngày hoặc đã chấm trước đó)'
          : null,
      ]
        .filter(Boolean)
        .join(' · ') || 'Đang đọc inbox từng Page — vui lòng đợi.'
    : isAudit
      ? [
          summary?.audited != null ? `${summary.audited} thành công` : null,
          summary?.errors ? `${summary.errors} lỗi` : null,
          summary?.auditCount ? `${summary.auditCount} đã lưu` : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'AI đang phân tích chất lượng CSKH…'
      : ''

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10',
        className
      )}
    >
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 via-violet-100 to-fuchsia-100 shadow-inner">
            <Loader2 className="h-7 w-7 animate-spin text-violet-600" />
          </div>
          <p className="text-lg font-bold text-slate-800">
            Đang chấm điểm{auditDayLabel ? ` · ${auditDayLabel}` : '…'}
          </p>
          <p className="mt-1 text-sm font-medium text-violet-700">{statusLine}</p>
          {detailLine ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{detailLine}</p>
          ) : null}
        </div>

        <div className="flex gap-2">
          {[
            { id: 'fetch', label: '1. Quét inbox', active: isFetch, done: isAudit },
            { id: 'audit', label: '2. Chấm điểm AI', active: isAudit, done: false },
          ].map((step) => (
            <div
              key={step.id}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors',
                step.active && 'border-violet-300 bg-violet-50 text-violet-800',
                step.done && !step.active && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                !step.active && !step.done && 'border-slate-200 bg-slate-50 text-slate-400'
              )}
            >
              {step.active ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : step.done ? (
                <span className="text-emerald-600">✓</span>
              ) : null}
              {step.label}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Tiến độ tổng</span>
            <span className="tabular-nums text-violet-700">{percent}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500 ease-out"
              style={{ width: `${Math.max(percent, 4)}%` }}
            />
          </div>
        </div>

        {isFetch && pagesTotal > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Quét Page</span>
              <span className="tabular-nums">
                {pagesDone}/{pagesTotal}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-indigo-50">
              <div
                className="h-full rounded-full bg-indigo-400 transition-all duration-300"
                style={{
                  width: `${Math.max(Math.round((pagesDone / pagesTotal) * 100), pagesDone > 0 ? 6 : 2)}%`,
                }}
              />
            </div>
          </div>
        ) : null}

        {isAudit && auditTotal > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Chấm điểm AI</span>
              <span className="tabular-nums">
                {auditProcessed}/{auditTotal}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-fuchsia-50">
              <div
                className="h-full rounded-full bg-fuchsia-500 transition-all duration-300"
                style={{
                  width: `${Math.max(Math.round((auditProcessed / auditTotal) * 100), auditProcessed > 0 ? 6 : 2)}%`,
                }}
              />
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            {
              label: 'Page',
              value:
                pagesTotal > 0
                  ? `${Math.min(pagesDone + (isFetch ? 1 : 0), pagesTotal)}/${pagesTotal}`
                  : '—',
            },
            {
              label: 'Hội thoại',
              value: summary?.fetched != null ? summary.fetched.toLocaleString('vi-VN') : '—',
            },
            {
              label: 'Đã chấm',
              value:
                summary?.processed != null && auditTotal > 0
                  ? `${summary.processed}/${auditTotal}`
                  : (summary?.auditCount ?? summary?.audited ?? '—'),
            },
            {
              label: 'Lỗi',
              value: summary?.errors ?? 0,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-indigo-100/80 bg-white/90 px-3 py-2.5 text-center shadow-sm"
            >
              <p className="text-base font-bold tabular-nums text-indigo-700">{stat.value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function CskhAuditProgressBanner({
  auditDayLabel,
  summary,
}: {
  auditDayLabel?: string | null
  summary?: AuditProgressSummary | null
}) {
  const phase = summary?.phase ?? 'fetch'
  const isFetch = phase === 'fetch'
  const pagesTotal = summary?.pagesTotal ?? 0
  const pagesDone = summary?.pagesProcessed ?? 0
  const auditTotal = summary?.total ?? 0
  const auditProcessed = summary?.processed ?? 0

  const text = isFetch
    ? pagesTotal > 0
      ? `Quét Page ${Math.min(pagesDone + 1, pagesTotal)}/${pagesTotal}${
          summary?.currentPage ? ` · ${summary.currentPage}` : ''
        }${summary?.fetched != null ? ` · ${summary.fetched} hội thoại` : ''}`
      : 'Đang quét inbox…'
    : auditTotal > 0
      ? `Chấm ${auditProcessed}/${auditTotal}${
          summary?.currentCustomer ? ` · ${summary.currentCustomer}` : ''
        }`
      : 'Đang chấm điểm AI…'

  return (
    <div className="mx-4 mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-violet-200/80 bg-violet-50/90 px-4 py-2.5 sm:mx-5">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-600" />
      <p className="min-w-0 flex-1 text-sm font-medium text-violet-900">
        {auditDayLabel ? `Chấm điểm ${auditDayLabel} — ` : ''}
        {text}
      </p>
      <span className="text-xs font-bold tabular-nums text-violet-700">
        {auditProgressPercent(summary)}%
      </span>
    </div>
  )
}

export function ChatThreadHeader({
  name,
  subtitle,
  badge,
  pictureUrl,
  pageId,
  psid,
  leading,
}: {
  name: string
  subtitle: string
  badge?: ReactNode
  pictureUrl?: string | null
  pageId?: string | null
  psid?: string | null
  leading?: ReactNode
}) {
  return (
    <header className="flex items-center gap-2 border-b border-white/50 bg-white/75 px-3 py-3 backdrop-blur-md sm:gap-3 sm:px-4 sm:py-3.5">
      {leading}
      <CskhPageAvatar
        name={name}
        pictureUrl={pictureUrl}
        pageId={pageId}
        psid={psid}
        liveFetch
        className="h-11 w-11 rounded-2xl text-sm shadow-md ring-2 ring-white/80"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900">{name}</p>
        <p className="truncate text-xs text-slate-500">{subtitle}</p>
      </div>
      {badge}
    </header>
  )
}
