import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const CSRF_COOKIE = 'cqacrm_csrf';
const CSRF_HEADER = 'X-CSRF-Token';

export const apiClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

function clearLegacyTokenStorage(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem('authToken');
  localStorage.removeItem('refreshToken');
}

clearLegacyTokenStorage();

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&')}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

let csrfMemory: string | null = null;
let csrfFetchInFlight: Promise<string | null> | null = null;

function isCsrfRequest(url?: string): boolean {
  return !!url && url.includes('/auth/csrf');
}

function isAuthLoginRequest(url?: string): boolean {
  return !!url && url.includes('/auth/login');
}

function isAuthRegisterRequest(url?: string): boolean {
  return !!url && url.includes('/auth/register');
}

function isAuthRefreshRequest(url?: string): boolean {
  return !!url && url.includes('/auth/refresh');
}

function isAuthLogoutRequest(url?: string): boolean {
  return !!url && url.includes('/auth/logout');
}

function captureCsrfFromBody(data: unknown): void {
  const token = (data as { data?: { csrfToken?: string } } | undefined)?.data?.csrfToken;
  if (typeof token === 'string' && token.length > 0) {
    csrfMemory = token;
  }
}

async function fetchCsrfToken(): Promise<string | null> {
  if (csrfFetchInFlight) return csrfFetchInFlight;
  csrfFetchInFlight = (async () => {
    try {
      const res = await axios.get(`${baseURL}/auth/csrf`, { withCredentials: true });
      captureCsrfFromBody(res.data);
      return csrfMemory;
    } catch {
      return csrfMemory;
    } finally {
      csrfFetchInFlight = null;
    }
  })();
  return csrfFetchInFlight;
}

async function resolveCsrfToken(): Promise<string | null> {
  const fromCookie = readCookie(CSRF_COOKIE);
  if (fromCookie) {
    csrfMemory = fromCookie;
    return fromCookie;
  }
  if (csrfMemory) return csrfMemory;
  return fetchCsrfToken();
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const csrf = await resolveCsrfToken();
      const res = await axios.post(
        `${baseURL}/auth/refresh`,
        {},
        {
          withCredentials: true,
          headers: csrf ? { [CSRF_HEADER]: csrf } : undefined,
        },
      );
      captureCsrfFromBody(res.data);
      return true;
    } catch {
      csrfMemory = null;
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function clearAuthAndRedirectLogin(): void {
  clearLegacyTokenStorage();
  csrfMemory = null;
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.assign('/login');
  }
}

apiClient.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return config;
  }
  if (
    isCsrfRequest(config.url) ||
    isAuthLoginRequest(config.url) ||
    isAuthRegisterRequest(config.url)
  ) {
    return config;
  }

  const csrf = await resolveCsrfToken();
  if (csrf) {
    config.headers = config.headers || {};
    config.headers[CSRF_HEADER] = csrf;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    captureCsrfFromBody(response.data);
    if (isAuthLogoutRequest(response.config?.url)) {
      csrfMemory = null;
    }
    return response;
  },
  async (error) => {
    const status = error.response?.status;
    const original = error.config as (typeof error.config & { _retried?: boolean }) | undefined;

    if (status === 401 && isAuthLoginRequest(original?.url)) {
      return Promise.reject(error);
    }

    if (status === 401 && original && !original._retried && !isAuthRefreshRequest(original.url)) {
      original._retried = true;
      const ok = await refreshAccessToken();
      if (ok) {
        return apiClient(original);
      }
    }

    if (status === 401) {
      clearAuthAndRedirectLogin();
    }
    return Promise.reject(error);
  },
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
    if (typeof msg === 'string' && /csrf/i.test(msg)) {
      return 'Phiên bảo mật hết hạn. Tải lại trang rồi đăng nhập lại.';
    }
    if (typeof msg === 'string' && msg.trim()) return msg;
    if (error.response.status === 401) return 'Tài khoản hoặc mật khẩu không đúng';
    if (error.response.status === 403) return 'Bạn không có quyền truy cập';
    if (error.message) return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Đã có lỗi xảy ra';
}
