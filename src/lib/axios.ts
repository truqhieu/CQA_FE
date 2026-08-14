import axios from 'axios';
import { restoreAuthAfterOAuth } from './authSession';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config) => {
    restoreAuthAfterOAuth();
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (token && token !== 'undefined' && token !== 'null') {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken =
      typeof localStorage !== 'undefined' ? localStorage.getItem('refreshToken') : null;
    if (!refreshToken || refreshToken === 'undefined' || refreshToken === 'null') return null;

    try {
      const { data } = await axios.post(
        `${baseURL}/auth/refresh`,
        { refreshToken },
        { withCredentials: true },
      );
      const newAccess = data?.data?.accessToken as string | undefined;
      const newRefresh = data?.data?.refreshToken as string | undefined;
      if (!newAccess) return null;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('authToken', newAccess);
        if (newRefresh) localStorage.setItem('refreshToken', newRefresh);
      }
      return newAccess;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function clearAuthAndRedirectLogin(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
  }
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.assign('/login');
  }
}

function isAuthLoginRequest(url?: string): boolean {
  if (!url) return false;
  return url.includes('/auth/login');
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const original = error.config as (typeof error.config & { _retried?: boolean }) | undefined;

    // Sai TK/MK trả 401 — không refresh / không đá lại /login
    if (status === 401 && isAuthLoginRequest(original?.url)) {
      return Promise.reject(error);
    }

    if (status === 401 && original && !original._retried) {
      original._retried = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      }
    }

    if (status === 401) {
      clearAuthAndRedirectLogin();
    }
    return Promise.reject(error);
  }
);

export function getApiErrorMessage(error: any): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')) {
        return 'Máy chủ phản hồi quá chậm (timeout). Thử lại sau.';
      }
      if (error.code === 'ERR_NETWORK' || /network|cors|connection refused/i.test(error.message || '')) {
        return 'Không kết nối được máy chủ. Kiểm tra BE đang chạy (localhost:3001).';
      }
      return error.message || 'Không kết nối được máy chủ';
    }
    const data = error.response?.data;
    const msg = data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string' && msg.trim()) return msg;
    if (error.response.status === 401) return 'Tài khoản hoặc mật khẩu không đúng';
    if (error.response.status === 403) return 'Bạn không có quyền truy cập';
    if (error.message) return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Đã có lỗi xảy ra';
}
