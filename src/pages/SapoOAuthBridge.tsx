import PageLoader from '@/components/PageLoader'

/** Sapo redirect về domain FE (callback URL cố định) — chuyển code sang BE đổi token. */
export function sapoOAuthBridgeRedirect(): boolean {
  if (typeof window === 'undefined') return false

  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')?.trim()
  if (!code) return false

  // Facebook OAuth dùng state; Sapo Partner OAuth thường chỉ trả code.
  if (params.get('state')) return false

  const base = (import.meta.env.VITE_API_URL || 'http://localhost:3003/api/v1').replace(/\/$/, '')
  const error = params.get('error')
  const errorDescription = params.get('error_description')

  const target = new URL(`${base}/cskh/sapo/oauth/callback`)
  if (error) {
    target.searchParams.set('error', error)
    if (errorDescription) target.searchParams.set('error_description', errorDescription)
  } else {
    target.searchParams.set('code', code)
  }

  window.location.replace(target.toString())
  return true
}

export default function SapoOAuthBridge() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <PageLoader label="Đang kết nối Sapo OAuth..." />
    </div>
  )
}
