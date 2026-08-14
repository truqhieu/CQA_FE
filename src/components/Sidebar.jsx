import { NavLink, useLocation } from 'react-router-dom';
import {
  Gauge, ChatCircleText, Brain, ShieldCheck, Users,
  UserCircle, Globe, Megaphone, Package, CurrencyDollar,
  ChartBar, Wrench, GearSix, Plugs
} from '@phosphor-icons/react';

// Viên Chi Bảo flower logo — 8 petals at 45° intervals
function VCBIcon({ size = 26 }) {
  // Each petal: inner tip slightly inside center, outer tip far out
  // Wide near inner third, tapering to points at both ends
  const petal = 'M 0,9 C 11,3 11,-21 0,-43 C -11,-21 -11,3 0,9 Z';
  return (
    <svg
      width={size}
      height={size}
      viewBox="-50 -50 100 100"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: size, height: size, display: 'block', flexShrink: 0 }}
    >
      {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
        <path
          key={a}
          d={petal}
          transform={`rotate(${a})`}
          fill="rgba(255,255,255,0.95)"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}

const navItems = [
  { to: '/', icon: Gauge, label: 'Tổng quan' },
  { to: '/conversations', icon: ChatCircleText, label: 'Hội thoại' },
  { to: '/pancake-test', icon: Plugs, label: 'Lead Pancake' },
  { to: '/ai-insight', icon: Brain, label: 'AI Insight' },
  { to: '/quality', icon: ShieldCheck, label: 'Chất lượng CSKH' },
  { to: '/employees', icon: Users, label: 'Nhân viên' },
  { to: '/customers', icon: UserCircle, label: 'Khách hàng' },
  { to: '/pages', icon: Globe, label: 'Page / Kênh' },
  { to: '/ads', icon: Megaphone, label: 'Quảng cáo' },
  { to: '/products', icon: Package, label: 'Sản phẩm' },
  { to: '/revenue', icon: CurrencyDollar, label: 'Doanh thu Chat' },
  { to: '/reports', icon: ChartBar, label: 'Báo cáo' },
  { to: '/warranty', icon: Wrench, label: 'Bảo hành' },
  { to: '/settings', icon: GearSix, label: 'Cài đặt' },
];

export default function Sidebar() {
  const location = useLocation();
  return (
    <aside className="flex h-screen w-[210px] min-w-[210px] flex-col overflow-y-auto overflow-x-hidden bg-gradient-to-b from-indigo-950 via-indigo-900 to-indigo-800 p-3.5 z-50">
      <div className="mb-5 flex items-center gap-2 px-2 py-1.5">
        <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-fuchsia-400">
          <VCBIcon size={26} />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="whitespace-nowrap text-[15px] font-bold text-white">VIENCHIBAO</span>
          <span className="whitespace-nowrap text-[10px] font-normal text-white/50">Chat Quality Agent</span>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-px">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-all duration-150 hover:bg-white/10 hover:text-white ${isActive ? 'bg-indigo-600/60 text-white shadow-sm' : 'text-white/60'}`}
            >
              <Icon weight="duotone" className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-indigo-400/20 bg-indigo-950/40 p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
            <Brain size={18} weight="duotone" className="text-indigo-600" />
          </div>
          <div className="flex flex-col">
            <div className="text-[11px] font-bold text-indigo-50">AI Assistant</div>
            <div className="text-[9px] text-indigo-200/70">Trợ lý AI sẵn sàng 24/7</div>
          </div>
        </div>
        <button className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-500/20 px-2 py-1.5 text-[11px] font-semibold text-indigo-100 transition-colors hover:bg-indigo-500/40">
          <ChatCircleText size={14} weight="fill" />
          <span>Trò chuyện ngay</span>
        </button>
      </div>
    </aside>
  );
}
