import { useState, useEffect, useRef } from "react";
import {
  Bell,
  User,
  SignOut,
} from "@phosphor-icons/react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchInboxConversationStats } from "@/features/cskh-quality/api";

const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const pageTitles = {
  "/": {
    title: "Tổng quan",
    sub: "Theo dõi chất lượng hội thoại và hiệu suất chăm sóc khách hàng",
  },
  "/conversations": {
    title: "Hội thoại",
    sub: "Quản lý và phân tích toàn bộ hội thoại với khách hàng",
  },
  "/ai-insight": {
    title: "AI Insight",
    sub: "Phân tích chuyên sâu từ toàn bộ hội thoại bằng AI",
    badge: "Beta",
  },
  "/quality": {
    title: "Chất lượng CSKH",
    sub: "Đánh giá và theo dõi chất lượng chăm sóc khách hàng",
  },
  "/pancake-test": {
    title: "Lead Pancake",
    sub: "Lead khách hàng theo từng kênh từ Pancake",
  },
  "/settings": {
    title: "Cài đặt",
    sub: "Cấu hình hệ thống, AI và kênh kết nối",
  },
  "/employees": {
    title: "Nhân viên",
    sub: "Quản lý và đánh giá hiệu suất nhân viên",
  },
};

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const page = pageTitles[location.pathname] || pageTitles["/"];

  const needsInboxStats =
    location.pathname.startsWith("/conversations") ||
    location.pathname.startsWith("/quality");

  const { data: user } = useQuery({
    queryKey: ["currentUserProfile"],
    queryFn: async () => {
      const { apiClient } = await import("@/lib/axios");
      const response = await apiClient.get("/auth/me");
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: convStats } = useQuery({
    queryKey: ["cskh", "inbox", "conversation-stats", "all"],
    queryFn: () => fetchInboxConversationStats(),
    enabled: needsInboxStats,
    staleTime: 90_000,
    refetchInterval: needsInboxStats ? 90_000 : false,
  });

  const unreadCount = convStats?.unread ?? 0;

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      const { apiClient } = await import("@/lib/axios");
      await apiClient.post("/auth/logout");
    } catch {
      /* cookie vẫn bị xóa phía client khi hết phiên */
    }
    queryClient.clear();
    toast.success("Đăng xuất thành công!");
    navigate("/login");
  };

  return (
    <header className="flex h-[52px] items-center justify-between border-b border-slate-200/80 bg-white px-5 z-40 shrink-0">
      {/* Left - Page Title */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <h1 className="flex items-center gap-2 text-[15px] font-bold text-slate-800 leading-tight tracking-tight">
            {page.title}
            {page.badge && (
              <span className="inline-flex items-center justify-center rounded-md bg-gradient-to-r from-violet-500 to-purple-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
                {page.badge}
              </span>
            )}
          </h1>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5 hidden sm:block">{page.sub}</p>
        </div>
      </div>

      {/* Right - Notification + Profile */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-all duration-200 hover:bg-slate-50 hover:text-slate-600 cursor-pointer"
          title="Thông báo"
          onClick={() => navigate("/conversations")}
        >
          <Bell size={18} weight="duotone" />
          {unreadCount > 0 && (
            <span
              className="absolute top-1 right-1 min-w-[16px] h-[16px] bg-red-500 rounded-full border-[1.5px] border-white text-[9px] font-bold text-white flex items-center justify-center px-0.5 shadow-sm"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Separator */}
        <div className="h-6 w-px bg-slate-200 mx-1" />

        {/* Profile dropdown */}
        <div className="relative" ref={dropdownRef}>
          <div 
            className="flex cursor-pointer items-center gap-2.5 rounded-xl p-1.5 pr-3 transition-all duration-200 hover:bg-slate-50" 
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-xs ring-2 ring-slate-100"
              style={{
                background: user?.avatarUrl ? "transparent" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: user?.avatarUrl ? "inherit" : "#fff",
              }}
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.fullName}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                getInitials(user?.fullName)
              )}
            </div>
            
            <div className="hidden flex-col md:flex">
              <span className="text-[13px] font-semibold leading-tight text-slate-700">{user?.fullName || "Chưa đăng nhập"}</span>
              <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                {user?.role === "admin" ? "Quản trị viên" : user?.role || "Nhân viên"}
              </span>
            </div>
          </div>

          {showDropdown && (
            <div className="absolute right-0 top-[calc(100%+6px)] z-[1000] flex w-[220px] origin-top-right flex-col rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-xl p-1.5 shadow-xl shadow-slate-200/50 animate-in fade-in zoom-in-95">
              <div className="mb-1.5 border-b border-slate-100 px-3.5 py-3">
                <div className="text-[13px] font-bold leading-tight text-slate-900">{user?.fullName || "Người dùng"}</div>
                <div className="mt-1 break-all text-[11px] text-slate-400">{user?.email || ""}</div>
              </div>
              <div
                className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] font-medium text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:text-indigo-600"
                onClick={() => {
                  setShowDropdown(false);
                  navigate("/settings");
                }}
              >
                <User weight="bold" size={16} />
                <span>Hồ sơ cá nhân</span>
              </div>
              <div className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] font-medium text-red-500 transition-all duration-200 hover:bg-red-50 hover:text-red-600" onClick={handleLogout}>
                <SignOut weight="bold" size={16} />
                <span>Đăng xuất</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
