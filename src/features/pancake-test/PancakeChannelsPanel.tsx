import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowsClockwise, MagnifyingGlass, WarningCircle } from '@phosphor-icons/react'
import { fetchPancakePages, fetchPancakeStatus, type PancakePage } from './api'

function errMsg(e: unknown, fallback = 'Lỗi') {
  const ax = e as { response?: { data?: { message?: string | string[] } }; message?: string }
  const m = ax?.response?.data?.message
  if (Array.isArray(m)) return m.join(', ')
  if (typeof m === 'string' && m) return m
  return ax?.message || fallback
}

const PLATFORM_LABEL: Record<string, string> = {
  facebook: 'Facebook',
  instagram_official: 'Instagram',
  tiktok: 'TikTok',
  tiktok_business_messaging: 'TikTok Business',
  youtube: 'YouTube',
  threads: 'Threads',
}

export function platformLabel(platform: string | null | undefined) {
  if (!platform) return 'Khác'
  return PLATFORM_LABEL[platform] || platform
}

/** Danh sách kênh Pancake — dùng trong Cài đặt kênh. */
export default function PancakeChannelsPanel() {
  const [pageFilter, setPageFilter] = useState('')
  const [platformFilter, setPlatformFilter] = useState('all')

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
      const msg = String((err as { message?: string })?.message || '')
      if (/429|giới hạn tần suất/i.test(msg)) return false
      return count < 1
    },
  })

  const platforms = useMemo(() => {
    const set = new Set<string>()
    for (const p of pagesQ.data?.pages ?? []) {
      if (p.platform) set.add(p.platform)
    }
    return [...set].sort()
  }, [pagesQ.data?.pages])

  const pagesByPlatform = useMemo(() => {
    const list = pagesQ.data?.pages ?? []
    const q = pageFilter.trim().toLowerCase()
    const filtered = list.filter((p) => {
      if (platformFilter !== 'all' && p.platform !== platformFilter) return false
      if (!q) return true
      return (
        p.name?.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.platform?.toLowerCase().includes(q)
      )
    })
    const map = new Map<string, PancakePage[]>()
    for (const p of filtered) {
      const key = p.platform || 'other'
      const arr = map.get(key) ?? []
      arr.push(p)
      map.set(key, arr)
    }
    return [...map.entries()].sort(([a], [b]) =>
      platformLabel(a).localeCompare(platformLabel(b), 'vi'),
    )
  }, [pagesQ.data?.pages, pageFilter, platformFilter])

  const connected = Boolean(statusQ.data?.connected)
  const loading = statusQ.isLoading || (connected && pagesQ.isLoading)
  const error = statusQ.error || pagesQ.error
  const channelCount = pagesQ.data?.count ?? statusQ.data?.activatedPageCount ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          background: connected ? '#f0fdf4' : '#fffbeb',
          border: connected ? '1px solid #dcfce7' : '1px solid #fde68a',
          borderRadius: 8,
          padding: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>
            {connected
              ? `Pancake: ${statusQ.data?.userName || 'Đã kết nối'} · ${channelCount} kênh đang dùng`
              : 'Chưa kết nối Pancake'}
          </div>
          <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
            Token lấy từ <code>PANCAKE_USER_ACCESS_TOKEN</code> trên server (.env).
            {statusQ.data?.tokenMasked ? ` · ${statusQ.data.tokenMasked}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void statusQ.refetch()
            void pagesQ.refetch()
          }}
          disabled={statusQ.isFetching || pagesQ.isFetching}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            color: '#374151',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            cursor: 'pointer',
          }}
        >
          <ArrowsClockwise
            size={12}
            className={statusQ.isFetching || pagesQ.isFetching ? 'animate-spin' : ''}
          />
          Làm mới
        </button>
      </div>

      {error ? (
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 8,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            fontSize: 12,
          }}
        >
          <WarningCircle size={16} />
          {errMsg(error, 'Không tải được kênh Pancake')}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <MagnifyingGlass
            size={14}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}
          />
          <input
            value={pageFilter}
            onChange={(e) => setPageFilter(e.target.value)}
            placeholder="Tìm tên / page id…"
            style={{
              width: '100%',
              padding: '8px 10px 8px 30px',
              borderRadius: 6,
              border: '1px solid #e5e7eb',
              fontSize: 12,
              background: '#f9fafb',
            }}
          />
        </div>
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          style={{
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid #e5e7eb',
            fontSize: 12,
            background: '#f9fafb',
          }}
        >
          <option value="all">Tất cả nền tảng</option>
          {platforms.map((p) => (
            <option key={p} value={p}>
              {platformLabel(p)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 24 }}>
          Đang tải kênh Pancake…
        </p>
      ) : !connected ? (
        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 24 }}>
          Cấu hình PANCAKE_USER_ACCESS_TOKEN trong .env rồi restart BE.
        </p>
      ) : pagesByPlatform.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 24 }}>
          Không có kênh phù hợp bộ lọc
        </p>
      ) : (
        pagesByPlatform.map(([platform, items]) => (
          <div key={platform} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
              {platformLabel(platform)} · {items.length}
            </div>
            <div style={{ overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Tên page</th>
                    <th>Nền tảng</th>
                    <th>Quyền</th>
                    <th>Page ID</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, fontSize: 12.5 }}>{p.name || '—'}</td>
                      <td style={{ fontSize: 12 }}>{platformLabel(p.platform)}</td>
                      <td style={{ fontSize: 12, color: '#6b7280' }}>{p.roleInPage || '—'}</td>
                      <td style={{ fontSize: 11, fontFamily: 'monospace', color: '#6b7280' }}>
                        {p.id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
