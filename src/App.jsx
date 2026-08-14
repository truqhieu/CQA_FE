import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import axios from "axios";
import { routes } from "@/router/routes";
import MainLayout from "./components/MainLayout";
import LoginPage from "./pages/Login/LoginPage";
import PrivacyPage from "./pages/PrivacyPage";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/axios";
import { restoreAuthAfterOAuth } from "@/lib/authSession";
import PageLoader from "@/components/PageLoader";
import { CSKH_PAGES_LITE_QUERY_KEY, fetchCskhPages } from "@/features/cskh-quality/api";
import SapoOAuthBridge, { sapoOAuthBridgeRedirect } from "./pages/SapoOAuthBridge";

function ProtectedLayout() {
  restoreAuthAfterOAuth();
  const queryClient = useQueryClient();

  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
  const hasToken = !!token && token !== 'undefined' && token !== 'null';

  const { data: userProfile, isLoading, isError, error, failureReason } = useQuery({
    queryKey: ['currentUserProfile'],
    queryFn: async () => {
      const response = await apiClient.get('/auth/me');
      return response.data.data;
    },
    enabled: hasToken,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!userProfile) return;
    void queryClient.prefetchQuery({
      queryKey: CSKH_PAGES_LITE_QUERY_KEY,
      queryFn: () => fetchCskhPages({ lite: true }),
      staleTime: 300_000,
    });
  }, [userProfile, queryClient]);

  if (!hasToken) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <PageLoader label="Đang xác thực phiên đăng nhập..." />
      </div>
    );
  }

  // Chỉ đá login khi 401 (token hết hạn / không hợp lệ) — giữ session khi BE restart / network lỗi tạm.
  const authStatus = axios.isAxiosError(error)
    ? error.response?.status
    : axios.isAxiosError(failureReason)
      ? failureReason.response?.status
      : undefined;
  if (isError && authStatus === 401) {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
    }
    return <Navigate to="/login" replace />;
  }

  if (isError || !userProfile) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
        <PageLoader label="Không kết nối được máy chủ…" />
        <p className="max-w-sm text-sm text-slate-600">
          Kiểm tra BE đang chạy tại localhost:3001 rồi tải lại trang.
        </p>
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
          onClick={() => window.location.reload()}
        >
          Tải lại
        </button>
      </div>
    );
  }

  return <MainLayout />;
}

export default function App() {
  if (sapoOAuthBridgeRedirect()) {
    return <SapoOAuthBridge />;
  }

  const basename =
    import.meta.env.BASE_URL === "/"
      ? undefined
      : import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <BrowserRouter basename={basename}>
      <Toaster richColors position="top-center" closeButton />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route element={<ProtectedLayout />}>
          {routes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

