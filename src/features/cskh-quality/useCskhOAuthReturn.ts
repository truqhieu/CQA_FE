import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchCskhPages } from './api'

const OAUTH_SYNC_POLL_MS = 2_000
const OAUTH_SYNC_MAX_POLLS = 90

async function pollOAuthSyncUntilDone(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> {
  for (let i = 0; i < OAUTH_SYNC_MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, OAUTH_SYNC_POLL_MS))
    const data = await queryClient.fetchQuery({
      queryKey: ['cskh', 'pages'],
      queryFn: () => fetchCskhPages(),
    })
    if (data.oauthSyncStatus === 'done') {
      const n = data.pages?.length ?? 0
      toast.success(
        n > 0
          ? `Đồng bộ xong ${n} Fanpage từ Facebook.`
          : 'Kết nối Facebook thành công!',
      )
      return
    }
    if (data.oauthSyncStatus === 'failed') {
      toast.error(data.oauthSyncError || 'Đồng bộ Fanpage thất bại — thử lại sau.')
      return
    }
  }
  toast.message('Đồng bộ Page vẫn đang chạy nền — làm mới trang sau vài phút.')
}

/** Xử lý redirect sau OAuth Facebook — refetch pages ngay, không cần restart. */
export function useCskhOAuthReturn() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const handledRef = useRef<string | null>(null)
  const pollStartedRef = useRef(false)

  useEffect(() => {
    const oauthError = searchParams.get('oauth_error')
    const fbConnected = searchParams.get('fb_connected')
    const signature = oauthError
      ? `err:${oauthError}`
      : fbConnected != null && fbConnected !== ''
        ? `ok:${fbConnected}`
        : null

    if (!signature || handledRef.current === signature) return
    handledRef.current = signature

    const next = new URLSearchParams(searchParams)

    if (oauthError) {
      toast.error(`Lỗi kết nối Facebook: ${decodeURIComponent(oauthError)}`)
      next.delete('oauth_error')
      next.delete('fb_connected')
      setSearchParams(next, { replace: true })
      return
    }

    if (fbConnected === 'syncing') {
      toast.success('Đã kết nối Facebook — đang đồng bộ danh sách Page...')
      void queryClient.invalidateQueries({ queryKey: ['cskh'] })
      void queryClient.refetchQueries({ queryKey: ['cskh', 'pages'] })
      if (!pollStartedRef.current) {
        pollStartedRef.current = true
        void pollOAuthSyncUntilDone(queryClient).finally(() => {
          pollStartedRef.current = false
        })
      }
    } else {
      const pageCount = Number(fbConnected)
      toast.success(
        Number.isFinite(pageCount) && pageCount > 0
          ? `Kết nối Facebook thành công! Đã đồng bộ ${pageCount} trang.`
          : 'Kết nối Facebook thành công!',
      )
      void queryClient.invalidateQueries({ queryKey: ['cskh'] })
      void queryClient.refetchQueries({ queryKey: ['cskh', 'pages'] })
    }

    next.delete('fb_connected')
    next.delete('oauth_error')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, queryClient])
}
