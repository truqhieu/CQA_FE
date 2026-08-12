import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link2, Loader2, RefreshCw, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import {
  MagnifyingGlass, FloppyDisk, Sparkle, CheckCircle, CaretRight, CaretLeft, Sliders, Play, GearSix,
  Shield, HardDrive, ArrowsCounterClockwise, Megaphone, Package, Wrench, Brain, Key,
  Bell, Link, ClipboardText, Lightbulb, FacebookLogo
} from '@phosphor-icons/react';
import { settingsTabs, qaPrompts, qaCriteria, settingsQuickLinks } from '../../data/mockData';
import {
  fetchCskhPages,
  getCskhOAuthStartUrl,
  refreshCskhOAuth,
  setCskhPageEnabled,
  deleteCskhPage,
  syncInboxFromGraph,
  isAsyncInboxSync,
} from '@/features/cskh-quality/api';
import { buildOAuthChannelReturnUrl } from '@/lib/authSession';

const CHANNELS_PAGE_SIZE = 10;

export default function SettingsPage() {
  const [anim, setAnim] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const channelTabIdx = settingsTabs.indexOf('Cài đặt kênh');
  const defaultTabIdx = searchParams.get('tab') === 'channel' && channelTabIdx !== -1 ? channelTabIdx : 1;
  const [activeTabIdx, setActiveTabIdx] = useState(defaultTabIdx);

  const [criteria, setCriteria] = useState(qaCriteria);
  const [prompts, setPrompts] = useState(qaPrompts);
  const [selectedPromptIdx, setSelectedPromptIdx] = useState(0);
  const [promptContent, setPromptContent] = useState(
    `Bạn là một chuyên gia đánh giá chất lượng chăm sóc khách hàng của thương hiệu trang sức VIENCHIBAO. Hãy phân tích đoạn hội thoại chat giữa Nhân viên tư vấn (Agent) và Khách hàng (Customer) để chấm điểm và rút ra nhận xét.

Các tiêu chí cần đánh giá:
1. Chào hỏi thân thiện, tạo thiện cảm ban đầu (Trọng số 10%)
2. Khai thác nhu cầu, hỏi rõ thắc mắc về size, chất liệu (Trọng số 25%)
3. Tư vấn giải pháp, gửi ảnh thật, báo giá đúng sản phẩm (Trọng số 20%)
4. Xử lý từ chối khéo léo khi khách hàng chần chừ về giá (Trọng số 10%)
5. Kỹ năng dẫn dắt chốt đơn, chốt size, tạo đơn hàng thành công (Trọng số 25%)
6. Theo dõi chăm sóc sau bán (Trọng số 10%)

Đầu ra định dạng JSON chứa điểm tổng quan, điểm từng tiêu chí, lý do chi tiết, ưu điểm và điểm cần cải thiện.`
  );
  
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-pro');
  const [showSavedNotification, setShowSavedNotification] = useState(false);
  const [autoAssign, setAutoAssign] = useState(true);
  const [backupFreq, setBackupFreq] = useState('daily');

  // Fetch real channels/pages
  const { data: pagesData, isLoading: isLoadingPages, isFetching: isFetchingPages } = useQuery({
    queryKey: ['cskh', 'pages'],
    queryFn: () => fetchCskhPages(),
    refetchInterval: (query) =>
      query.state.data?.oauthSyncStatus === 'running' ? 2_000 : false,
  });

  const [channelsPage, setChannelsPage] = useState(1);
  const [channelSearch, setChannelSearch] = useState('');
  const [channelManagerFilter, setChannelManagerFilter] = useState('all');
  const [channelRegionFilter, setChannelRegionFilter] = useState('all');
  const [channelTeamFilter, setChannelTeamFilter] = useState('all');
  const [channelStatusFilter, setChannelStatusFilter] = useState('all');
  const [channelSortBy, setChannelSortBy] = useState('pageName');
  const [channelSortDir, setChannelSortDir] = useState('asc');

  const channelManagerOptions = useMemo(
    () => [...new Set((pagesData?.pages || []).map((p) => p.managerName).filter(Boolean))],
    [pagesData?.pages]
  );
  const channelRegionOptions = useMemo(
    () => [...new Set((pagesData?.pages || []).map((p) => p.region).filter(Boolean))],
    [pagesData?.pages]
  );
  const channelTeamOptions = useMemo(
    () => [...new Set((pagesData?.pages || []).map((p) => p.team).filter(Boolean))],
    [pagesData?.pages]
  );

  const isChannelFilterActive =
    channelSearch.trim() !== '' ||
    channelManagerFilter !== 'all' ||
    channelRegionFilter !== 'all' ||
    channelTeamFilter !== 'all' ||
    channelStatusFilter !== 'all';

  const filteredChannelPages = useMemo(() => {
    const q = channelSearch.trim().toLowerCase();
    return (pagesData?.pages || []).filter((page) => {
      const matchesSearch =
        !q ||
        (page.pageName || '').toLowerCase().includes(q) ||
        (page.pageId || '').toLowerCase().includes(q);
      const matchesManager = channelManagerFilter === 'all' || page.managerName === channelManagerFilter;
      const matchesRegion = channelRegionFilter === 'all' || page.region === channelRegionFilter;
      const matchesTeam = channelTeamFilter === 'all' || page.team === channelTeamFilter;
      const matchesStatus =
        channelStatusFilter === 'all' ||
        (channelStatusFilter === 'enabled' ? page.enabled : !page.enabled);
      return matchesSearch && matchesManager && matchesRegion && matchesTeam && matchesStatus;
    });
  }, [pagesData?.pages, channelSearch, channelManagerFilter, channelRegionFilter, channelTeamFilter, channelStatusFilter]);

  const sortedChannelPages = useMemo(() => {
    const dir = channelSortDir === 'asc' ? 1 : -1;
    const getValue = (page) => {
      if (channelSortBy === 'enabled') return page.enabled ? 1 : 0;
      return (page[channelSortBy] || '').toString().toLowerCase();
    };
    return [...filteredChannelPages].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [filteredChannelPages, channelSortBy, channelSortDir]);

  const channelsTotal = sortedChannelPages.length;
  const channelsTotalPages = Math.max(1, Math.ceil(channelsTotal / CHANNELS_PAGE_SIZE));
  const channelsCurrentItems = sortedChannelPages.slice(
    (channelsPage - 1) * CHANNELS_PAGE_SIZE,
    channelsPage * CHANNELS_PAGE_SIZE
  );
  const channelsRangeStart = channelsTotal ? (channelsPage - 1) * CHANNELS_PAGE_SIZE + 1 : 0;
  const channelsRangeEnd = Math.min(channelsPage * CHANNELS_PAGE_SIZE, channelsTotal);

  useEffect(() => {
    setChannelsPage(1);
  }, [channelsTotal, channelSearch, channelManagerFilter, channelRegionFilter, channelTeamFilter, channelStatusFilter]);

  const resetChannelFilters = () => {
    setChannelSearch('');
    setChannelManagerFilter('all');
    setChannelRegionFilter('all');
    setChannelTeamFilter('all');
    setChannelStatusFilter('all');
  };

  // Toggle active/inactive status
  const toggleMutation = useMutation({
    mutationFn: ({ pageId, enabled }) => setCskhPageEnabled(pageId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cskh', 'pages'] });
      toast.success('Cập nhật trạng thái trang thành công!');
    },
    onError: (err) => {
      toast.error('Lỗi khi cập nhật trạng thái trang: ' + (err.message || err));
    }
  });

  // Delete page
  const deleteMutation = useMutation({
    mutationFn: (pageId) => deleteCskhPage(pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cskh', 'pages'] });
      toast.success('Đã xóa trang thành công!');
    },
    onError: (err) => {
      toast.error('Lỗi khi xóa trang: ' + (err.message || err));
    }
  });

  // Sync messages
  const [isSyncing, setIsSyncing] = useState(false);
  const syncMutation = useMutation({
    mutationFn: (pageId) => syncInboxFromGraph(pageId),
    onMutate: () => {
      setIsSyncing(true);
    },
    onSuccess: (data) => {
      setIsSyncing(false);
      if (isAsyncInboxSync(data)) {
        toast.info(data.message || 'Đang đồng bộ nền — làm mới danh sách sau vài phút');
        return;
      }
      toast.success(`Đồng bộ thành công ${data.synced} tin nhắn từ ${data.pageCount} trang!`);
    },
    onError: (err) => {
      setIsSyncing(false);
      toast.error('Lỗi khi đồng bộ tin nhắn: ' + (err.message || err));
    }
  });

  // Refresh OAuth pages list
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshMutation = useMutation({
    mutationFn: () => refreshCskhOAuth(),
    onMutate: () => {
      setIsRefreshing(true);
    },
    onSuccess: (data) => {
      setIsRefreshing(false);
      queryClient.invalidateQueries({ queryKey: ['cskh', 'pages'] });
      const adsNote =
        typeof data.adAccountCount === 'number'
          ? data.adsReadConnected
            ? ` Marketing API: ${data.adAccountCount} tài khoản QC.`
            : ' Chưa thấy tài khoản QC — cần OAuth bằng admin quảng cáo.'
          : '';
      toast.success(`Đã đồng bộ lại ${data.pageCount} trang.${adsNote}`);
    },
    onError: (err) => {
      setIsRefreshing(false);
      toast.error('Lỗi khi đồng bộ lại danh sách trang: ' + (err.message || err));
    }
  });

  const isPagesBusy = isLoadingPages || isFetchingPages || isRefreshing;
  const isOAuthSyncing = pagesData?.oauthSyncStatus === 'running';

  useEffect(() => {
    setTimeout(() => setAnim(true), 200);
  }, []);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'channel') {
      const idx = settingsTabs.indexOf('Cài đặt kênh');
      if (idx !== -1) {
        setActiveTabIdx(idx);
      }
    }
  }, [searchParams]);

  const handleWeightChange = (id, newWeight) => {
    setCriteria(prev => prev.map(c => c.id === id ? { ...c, weight: parseInt(newWeight) || 0 } : c));
  };

  const handleSaveSettings = () => {
    setShowSavedNotification(true);
    setTimeout(() => {
      setShowSavedNotification(false);
    }, 3000);
  };

  const currentCriteriaTotalWeight = criteria.reduce((sum, c) => sum + (c.active ? c.weight : 0), 0);

  return (
    <div style={{ display: 'flex', gap: '14px', height: '100%' }}>
      {/* Left - Settings Tabs Navigation */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col" style={{ width: '220px', minWidth: '220px', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px' }}>
        <div style={{ fontWeight: 700, fontSize: '14px', color: '#1f2937', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <GearSix size={16} weight="duotone" style={{ color: '#4f46e5' }} />
          Cấu hình hệ thống
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, overflow: 'auto' }}>
          {settingsTabs.map((tab, idx) => (
            <div 
              key={idx}
              onClick={() => setActiveTabIdx(idx)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 10px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: activeTabIdx === idx ? '#eef2ff' : 'transparent',
                color: activeTabIdx === idx ? '#3730a3' : '#374151',
                fontWeight: activeTabIdx === idx ? 600 : 500,
                fontSize: '13px',
                transition: 'all var(--tr-fast)'
              }}
            >
              <span>{tab}</span>
              {activeTabIdx === idx && <CaretRight size={14} />}
            </div>
          ))}
        </div>

        <button 
          onClick={handleSaveSettings}
          style={{ 
            marginTop: '10px', 
            padding: '8px', 
            borderRadius: '6px', 
            fontSize: '13px', 
            fontWeight: 700, 
            background: '#4f46e5', 
            color: '#fff', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '6px' 
          }}
        >
          <FloppyDisk size={14} /> Lưu tất cả
        </button>
      </div>

      {/* Center - Detailed settings parameters based on tab */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'auto', minWidth: 0 }}>
        {showSavedNotification && (
          <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #dcfce7', color: '#16a34a', borderRadius: '8px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', animation: 'fadeIn 0.3s ease' }}>
            <CheckCircle size={16} weight="duotone" />
            Đã cập nhật cấu hình hệ thống thành công! Tất cả các mô hình chấm điểm AI đang tự động học lại theo tiêu chí mới.
          </div>
        )}

        {/* Cài đặt Hệ thống (Tab 0) */}
        {settingsTabs[activeTabIdx] === 'Cài đặt hệ thống' && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col animate-in fade-in slide-in-from-bottom-4" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Cài đặt hệ thống chung</h3>
              <p style={{ fontSize: '11px', color: '#6b7280' }}>Quản lý hoạt động phân phối, múi giờ và tần suất sao lưu</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Tên nền tảng (Platform Title)</span>
                <input style={{ padding: '8px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12.5px', color: '#1f2937' }} defaultValue="VIENCHIBAO Chat Quality Agent Platform" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Múi giờ</span>
                  <select style={{ padding: '8px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12.5px', color: '#1f2937' }} defaultValue="gmt7">
                    <option value="gmt7">(GMT+07:00) Hà Nội, Bangkok, Jakarta</option>
                    <option value="gmt8">(GMT+08:00) Singapore, Manila, Beijing</option>
                    <option value="gmt0">(GMT+00:00) UTC Greenwich Mean Time</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Tần suất sao lưu hệ thống</span>
                  <select 
                    value={backupFreq} 
                    onChange={(e) => setBackupFreq(e.target.value)}
                    style={{ padding: '8px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12.5px', color: '#1f2937' }}
                  >
                    <option value="hourly">Hàng giờ</option>
                    <option value="daily">Hàng ngày (Vào lúc 00:00)</option>
                    <option value="weekly">Hàng tuần (Chủ nhật)</option>
                    <option value="monthly">Hàng tháng (Ngày 1)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: '#f9fafb', borderRadius: '8px' }}>
                <input 
                  type="checkbox" 
                  id="autoAssign" 
                  checked={autoAssign} 
                  onChange={(e) => setAutoAssign(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }} 
                />
                <label htmlFor="autoAssign" style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#1f2937' }}>Tự động phân phối hội thoại (Smart Routing AI)</span>
                  <span style={{ fontSize: '10.5px', color: '#6b7280' }}>Tự động gán hội thoại mới từ QC cho nhân viên đang rảnh và có tỷ lệ chốt sản phẩm đó cao nhất</span>
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: '#f9fafb', borderRadius: '8px' }}>
                <input 
                  type="checkbox" 
                  id="slackAlerts" 
                  defaultChecked={true}
                  style={{ width: 16, height: 16, cursor: 'pointer' }} 
                />
                <label htmlFor="slackAlerts" style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#1f2937' }}>Thông báo cảnh báo tiêu cực tức thời</span>
                  <span style={{ fontSize: '10.5px', color: '#6b7280' }}>Gửi thông báo gấp về kênh Slack quản lý ngay khi AI phát hiện hội thoại có cảm xúc &quot;Rất tiêu cực&quot;</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* AI & Chấm điểm (Tab 1) */}
        {settingsTabs[activeTabIdx] === 'AI & Chấm điểm' && (
          <>
            {/* Criteria weights setting */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col animate-in fade-in slide-in-from-bottom-4" style={{ padding: '14px', animationDelay: '50ms' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px', marginBottom: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Thiết lập Tiêu chí & Trọng số chấm điểm</h3>
                  <p style={{ fontSize: '10.5px', color: '#6b7280' }}>Chỉnh sửa hệ thống thang điểm đánh giá cuộc hội thoại của Agent (Tổng trọng số phải bằng 100%)</p>
                </div>
                
                <span className="tag" style={{ 
                  background: currentCriteriaTotalWeight === 100 ? '#f0fdf4' : '#fef2f2',
                  color: currentCriteriaTotalWeight === 100 ? '#16a34a' : '#dc2626',
                  fontWeight: 700,
                  fontSize: '12px'
                }}>
                  Tổng trọng số: {currentCriteriaTotalWeight}% {currentCriteriaTotalWeight === 100 ? '✓' : '⚠️'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {criteria.map((c, i) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '6px 8px', background: '#f9fafb', borderRadius: '6px' }}>
                    <input 
                      type="checkbox" 
                      checked={c.active} 
                      onChange={(e) => {
                        setCriteria(prev => prev.map(item => item.id === c.id ? { ...item, active: e.target.checked } : item));
                      }}
                      style={{ width: 14, height: 14, cursor: 'pointer' }}
                    />
                    <div style={{ width: '130px', minWidth: '130px' }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: c.active ? '#1f2937' : '#9ca3af' }}>{c.name}</div>
                      <div style={{ fontSize: '9.5px', color: '#9ca3af' }}>{c.desc}</div>
                    </div>

                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input 
                        type="range" 
                        min="0" 
                        max="50" 
                        disabled={!c.active}
                        value={c.weight} 
                        onChange={(e) => handleWeightChange(c.id, e.target.value)}
                        style={{ flex: 1, height: '4px', cursor: c.active ? 'pointer' : 'default', accentColor: '#4f46e5' }}
                      />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: c.active ? '#1f2937' : '#9ca3af', minWidth: '30px', textAlign: 'right' }}>
                        {c.weight}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Model selector & System Prompts templates */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col animate-in fade-in slide-in-from-bottom-4" style={{ padding: '14px', animationDelay: '150ms', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '6px' }}>
                <h3 style={{ fontSize: '14.5px', fontWeight: 700, color: '#111827' }}>Cấu hình Mô hình & AI System Prompts</h3>
                <p style={{ fontSize: '10.5px', color: '#6b7280' }}>Tùy chọn LLM làm nhiệm vụ chấm điểm tự động và chỉnh sửa hướng dẫn Prompt mẫu</p>
              </div>

              {/* Model selection */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#eef2ff', padding: '10px', borderRadius: '8px' }}>
                <Sparkle size={18} weight="duotone" style={{ color: '#4f46e5' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--primary-900)' }}>Trí tuệ nhân tạo chấm điểm (LLM Audit Engine)</div>
                  <div style={{ fontSize: '10.5px', color: '#3730a3' }}>Lựa chọn model phù hợp nhất cho bài toán đánh giá ngữ cảnh hội thoại phức tạp</div>
                </div>
                <select 
                  value={selectedModel} 
                  onChange={(e) => setSelectedModel(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '6px', background: '#fff', border: '1px solid var(--primary-200)', fontSize: '12px', fontWeight: 600, color: 'var(--primary-800)', cursor: 'pointer' }}
                >
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro (Khuyên dùng)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (Tốc độ cao)</option>
                  <option value="claude-3.5-sonnet">Claude 3.5 Sonnet (Đọc sâu)</option>
                  <option value="gpt-4o">GPT-4o (Đa dụng)</option>
                </select>
              </div>

              {/* Prompts config */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ width: '180px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Danh sách Prompt mẫu</span>
                  {prompts.map((p, idx) => (
                    <button 
                      key={idx}
                      onClick={() => {
                        setSelectedPromptIdx(idx);
                        if (idx === 0) setPromptContent(`Bạn là một chuyên gia đánh giá chất lượng chăm sóc khách hàng của thương hiệu trang sức VIENCHIBAO. Hãy phân tích đoạn hội thoại chat giữa Nhân viên tư vấn (Agent) và Khách hàng (Customer) để chấm điểm và rút ra nhận xét.

Các tiêu chí cần đánh giá:
1. Chào hỏi thân thiện, tạo thiện cảm ban đầu (Trọng số 10%)
2. Khai thác nhu cầu, hỏi rõ thắc mắc về size, chất liệu (Trọng số 25%)
3. Tư vấn giải pháp, gửi ảnh thật, báo giá đúng sản phẩm (Trọng số 20%)
4. Xử lý từ chối khéo léo khi khách hàng chần chừ về giá (Trọng số 10%)
5. Kỹ năng dẫn dắt chốt đơn, chốt size, tạo đơn hàng thành công (Trọng số 25%)
6. Theo dõi chăm sóc sau bán (Trọng số 10%)

Đầu ra định dạng JSON chứa điểm tổng quan, điểm từng tiêu chí, lý do chi tiết, ưu điểm và điểm cần cải thiện.`);
                        else if (idx === 1) setPromptContent(`Hướng dẫn chấm điểm CSKH cho AI:
- Nhận diện các câu nói nhạy cảm, thiếu lịch sự hoặc chậm trễ phản hồi (trên 15 phút).
- Chấm điểm nghiêm khắc các lỗi không chào hỏi và kết thúc hội thoại hời hợt.
- Kiểm tra nhân viên có chủ động tư vấn ưu đãi/ship hay không.`);
                        else setPromptContent(`Prompt gợi ý trả lời tự động cho Agent:
- Dựa trên câu hỏi khách hàng về: giá, size nhẫn, bảo hành, chất liệu.
- Tra cứu nhanh bảng size nhẫn tiêu chuẩn và tóm tắt ngắn gọn trong 2-3 câu, giọng điệu ấm áp và chuyên nghiệp.
- Luôn kết thúc bằng một câu hỏi gợi mở chốt đơn.`);
                      }}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: selectedPromptIdx === idx ? 600 : 500,
                        background: selectedPromptIdx === idx ? '#e0e7ff' : 'transparent',
                        color: selectedPromptIdx === idx ? '#3730a3' : '#4b5563',
                        border: selectedPromptIdx === idx ? '1px solid var(--primary-200)' : '1px solid transparent',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Lightbulb size={12} weight={selectedPromptIdx === idx ? 'fill' : 'duotone'} />
                        <span>{p.name}</span>
                      </div>
                    </button>
                  ))}
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>HƯỚNG DẪN PROMPT HỆ THỐNG</span>
                  <textarea 
                    value={promptContent}
                    onChange={(e) => setPromptContent(e.target.value)}
                    style={{ 
                      flex: 1, 
                      minHeight: '160px', 
                      background: '#f9fafb', 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '6px', 
                      padding: '8px', 
                      fontSize: '12px', 
                      fontFamily: 'monospace',
                      color: '#1f2937',
                      lineHeight: 1.45,
                      resize: 'none'
                    }} 
                  />
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <button style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '12px', background: '#f3f4f6', color: '#374151', fontWeight: 500 }}>Khôi phục mặc định</button>
                    <button onClick={handleSaveSettings} style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '12px', background: '#4f46e5', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}><Play size={10} weight="fill" /> Lưu và Thử nghiệm</button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Cài đặt kênh (Real Facebook Integration) */}
        {settingsTabs[activeTabIdx] === 'Cài đặt kênh' && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col animate-in fade-in slide-in-from-bottom-4" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
            {isLoadingPages && !pagesData ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', gap: '12px', color: '#6b7280' }}>
                <Loader2 size={32} className="animate-spin" style={{ color: '#4f46e5' }} />
                <span style={{ fontSize: '13px', fontWeight: 500 }}>Đang tải cấu hình kênh...</span>
              </div>
            ) : (
            <>
            <div style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Cấu hình Kênh Kết nối</h3>
                <p style={{ fontSize: '11px', color: '#6b7280' }}>Kết nối tài khoản Facebook để quét và chấm điểm tự động các hội thoại chăm sóc khách hàng</p>
              </div>
              
              {pagesData?.oauthConnected && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => refreshMutation.mutate()}
                    disabled={isRefreshing}
                    style={{ 
                      padding: '6px 12px', 
                      borderRadius: '6px', 
                      fontSize: '12px', 
                      fontWeight: 600, 
                      background: '#f9fafb', 
                      border: '1px solid #e5e7eb', 
                      color: '#374151',
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px',
                      cursor: 'pointer' 
                    }}
                  >
                    <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                    Đồng bộ lại Pages
                  </button>
                  
                  <button 
                    onClick={() => syncMutation.mutate(undefined)}
                    disabled={isSyncing}
                    style={{ 
                      padding: '6px 12px', 
                      borderRadius: '6px', 
                      fontSize: '12px', 
                      fontWeight: 600, 
                      background: '#4f46e5', 
                      color: '#fff',
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px',
                      cursor: 'pointer' 
                    }}
                  >
                    <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                    Đồng bộ tin nhắn
                  </button>
                </div>
              )}
            </div>

            <div style={{ 
              background: pagesData?.oauthConnected ? '#f0fdf4' : '#f9fafb', 
              border: pagesData?.oauthConnected ? '1px solid #dcfce7' : '1px solid #e5e7eb',
              borderRadius: '8px', 
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: '50%', 
                  background: pagesData?.oauthConnected ? '#1877f2' : '#e5e7eb', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: '#fff',
                  flexShrink: 0
                }}>
                  <FacebookLogo size={20} weight={pagesData?.oauthConnected ? 'fill' : 'regular'} />
                </div>
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#1f2937' }}>
                    {pagesData?.oauthConnected ? `Tài khoản Facebook: ${pagesData.oauthUser}` : 'Chưa kết nối tài khoản Facebook'}
                  </h4>
                  <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {isPagesBusy ? (
                      <>
                        <Loader2 size={12} className="animate-spin" style={{ color: '#4f46e5' }} />
                        Đang cập nhật thông tin kết nối...
                      </>
                    ) : pagesData?.oauthConnected 
                      ? `Kết nối hoạt động. Đồng bộ cuối: ${pagesData.oauthUpdatedAt ? new Date(pagesData.oauthUpdatedAt).toLocaleString('vi-VN') : 'Chưa rõ'}`
                      : 'Kết nối Facebook để đồng bộ tin nhắn từ Fanpage của bạn.'}
                  </p>
                  {pagesData?.oauthConnected && !isPagesBusy && (
                    <>
                      <p style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        marginTop: '6px',
                        color: pagesData.adAccountCount === undefined
                          ? '#6b7280'
                          : pagesData.adsReadConnected
                            ? '#15803d'
                            : '#b45309',
                      }}>
                        {pagesData.adAccountCount === undefined
                          ? 'Trạng thái Marketing API: cần cập nhật server mới'
                          : pagesData.adsReadConnected
                            ? `✓ Marketing API: ${pagesData.adAccountCount} tài khoản QC (Ads Manager)`
                            : '⚠ Chưa thấy tài khoản QC — OAuth bằng admin trên Business Manager'}
                      </p>
                      {pagesData.adsReadConnected && pagesData.adAccountCount != null && (
                        <p style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px', lineHeight: 1.45, maxWidth: '420px' }}>
                          Đây là số <strong>tài khoản chi tiêu QC</strong> trên Ads Manager —{' '}
                          <strong>không phải</strong> số Fanpage đang chạy quảng cáo.
                          Nhiều Page có thể chạy QC qua chung một tài khoản; bạn đang quản lý{' '}
                          <strong>{pagesData.pages.length} Fanpage</strong> bên dưới.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              <button 
                onClick={() => {
                  window.location.href = getCskhOAuthStartUrl(buildOAuthChannelReturnUrl());
                }}
                style={{ 
                  padding: '8px 16px', 
                  borderRadius: '6px', 
                  fontSize: '12.5px', 
                  fontWeight: 600, 
                  background: '#1877f2', 
                  color: '#fff',
                  border: 'none',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  cursor: 'pointer' 
                }}
              >
                <Link2 size={14} />
                {pagesData?.oauthConnected ? 'Cập nhật kết nối Facebook' : 'Kết nối tài khoản Facebook'}
              </button>
            </div>

            {isOAuthSyncing && (
              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '11px',
                color: '#1d4ed8',
                lineHeight: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <Loader2 size={14} className="animate-spin" style={{ flexShrink: 0 }} />
                <span>
                  <strong>Đang đồng bộ Fanpage từ Facebook...</strong> Bạn có thể dùng hệ thống ngay;
                  danh sách Page sẽ cập nhật tự động trong vài giây.
                </span>
              </div>
            )}

            {pagesData?.oauthSyncStatus === 'failed' && pagesData?.oauthSyncError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '11px',
                color: '#b91c1c',
                lineHeight: 1.5,
              }}>
                <strong>Đồng bộ Page thất bại:</strong> {pagesData.oauthSyncError}
              </div>
            )}

            {pagesData?.oauthConnected && pagesData.adsReadConnected === false && (
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '11px',
                color: '#92400e',
                lineHeight: 1.5,
              }}>
                <strong>Chưa kết nối Marketing API:</strong> Facebook Page đã kết nối nhưng hệ thống không thấy tài khoản quảng cáo.
                Bấm <strong>Cập nhật kết nối Facebook</strong> và đăng nhập bằng tài khoản <strong>admin tài khoản QC</strong> trên Business Manager
                (không phải nút &quot;Đồng bộ lại Pages&quot;).
              </div>
            )}

            {pagesData?.oauthConnected && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Danh sách trang quản lý ({channelsTotal}{channelsTotal !== pagesData.pages.length ? `/${pagesData.pages.length}` : ''})
                  {isPagesBusy && (
                    <Loader2 size={14} className="animate-spin" style={{ color: '#4f46e5' }} />
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px', alignItems: 'stretch' }}>
                  <div style={{ position: 'relative', gridColumn: 'span 2' }}>
                    <MagnifyingGlass size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                      type="search"
                      value={channelSearch}
                      onChange={(e) => setChannelSearch(e.target.value)}
                      placeholder="Tìm theo tên trang hoặc Page ID..."
                      style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #e5e7eb', padding: '0 10px 0 28px', fontSize: '12px', color: '#374151', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ display: 'flex', height: '32px', borderRadius: '6px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                    <select
                      value={channelSortBy}
                      onChange={(e) => setChannelSortBy(e.target.value)}
                      style={{ flex: 1, minWidth: 0, height: '100%', border: 'none', padding: '0 8px', fontSize: '12px', color: '#374151', background: '#fff' }}
                    >
                      <option value="pageName">Sắp xếp: Tên trang</option>
                      <option value="managerName">Sắp xếp: Người quản lý</option>
                      <option value="region">Sắp xếp: Khu vực</option>
                      <option value="team">Sắp xếp: Nhóm / Team</option>
                      <option value="enabled">Sắp xếp: Trạng thái</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setChannelSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                      title={channelSortDir === 'asc' ? 'Đang tăng dần — bấm để đổi giảm dần' : 'Đang giảm dần — bấm để đổi tăng dần'}
                      style={{ height: '100%', width: '32px', flexShrink: 0, border: 'none', borderLeft: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {channelSortDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                    </button>
                  </div>

                  <select
                    value={channelManagerFilter}
                    onChange={(e) => setChannelManagerFilter(e.target.value)}
                    style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #e5e7eb', padding: '0 8px', fontSize: '12px', color: '#374151', background: '#fff' }}
                  >
                    <option value="all">Tất cả quản lý</option>
                    {channelManagerOptions.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={channelRegionFilter}
                    onChange={(e) => setChannelRegionFilter(e.target.value)}
                    style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #e5e7eb', padding: '0 8px', fontSize: '12px', color: '#374151', background: '#fff' }}
                  >
                    <option value="all">Tất cả khu vực</option>
                    {channelRegionOptions.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <select
                    value={channelTeamFilter}
                    onChange={(e) => setChannelTeamFilter(e.target.value)}
                    style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #e5e7eb', padding: '0 8px', fontSize: '12px', color: '#374151', background: '#fff' }}
                  >
                    <option value="all">Tất cả nhóm / team</option>
                    {channelTeamOptions.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <select
                    value={channelStatusFilter}
                    onChange={(e) => setChannelStatusFilter(e.target.value)}
                    style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #e5e7eb', padding: '0 8px', fontSize: '12px', color: '#374151', background: '#fff' }}
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="enabled">Đang hoạt động</option>
                    <option value="disabled">Tạm dừng</option>
                  </select>
                  <button
                    type="button"
                    onClick={resetChannelFilters}
                    disabled={!isChannelFilterActive}
                    style={{
                      width: '100%', height: '32px', borderRadius: '6px', padding: '0 10px', fontSize: '12px', fontWeight: 600,
                      border: '1px solid #e5e7eb',
                      color: isChannelFilterActive ? '#dc2626' : '#c1c7d0',
                      background: '#f9fafb',
                      cursor: isChannelFilterActive ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Xóa lọc
                  </button>
                </div>

                {isPagesBusy ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: '10px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', color: '#6b7280' }}>
                    <Loader2 size={28} className="animate-spin" style={{ color: '#4f46e5' }} />
                    <span style={{ fontSize: '12px', fontWeight: 500 }}>
                      {isRefreshing ? 'Đang đồng bộ lại danh sách trang...' : 'Đang tải danh sách trang...'}
                    </span>
                  </div>
                ) : pagesData.pages.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', background: '#f9fafb', borderRadius: '8px', color: '#6b7280', fontSize: '12px' }}>
                    Không tìm thấy Fanpage nào. Vui lòng kiểm tra lại quyền truy cập Facebook.
                  </div>
                ) : channelsTotal === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', background: '#f9fafb', borderRadius: '8px', color: '#6b7280', fontSize: '12px' }}>
                    Không có kênh nào khớp với bộ lọc hiện tại.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', overflowY: 'hidden', maxWidth: '100%', border: '1px solid #e5e7eb', borderRadius: '8px', scrollbarWidth: 'thin' }}>
                    <table className="data-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Hình ảnh</th>
                          <th>Tên Trang / Fanpage</th>
                          <th>Page ID</th>
                          <th>Người quản lý</th>
                          <th>Khu vực</th>
                          <th>Nhóm / Team</th>
                          <th>Trạng thái hoạt động</th>
                          <th style={{ textAlign: 'right' }}>Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {channelsCurrentItems.map((page) => (
                          <tr key={page.pageId}>
                            <td>
                              <img 
                                src={page.pagePictureUrl || 'https://www.facebook.com/images/profile/timeline/homepage/composer/logo_graphic.png'} 
                                alt={page.pageName || ''} 
                                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #e5e7eb' }}
                                onError={(e) => {
                                  e.target.src = 'https://www.facebook.com/images/profile/timeline/homepage/composer/logo_graphic.png';
                                }}
                              />
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, fontSize: '12.5px', color: '#1f2937' }}>
                                {page.pageName || 'Tên trang không khả dụng'}
                              </div>
                            </td>
                            <td style={{ fontSize: '11.5px', color: '#6b7280', fontFamily: 'monospace' }}>
                              {page.pageId}
                            </td>
                            <td style={{ fontSize: '12px', color: '#374151' }}>
                              {page.managerName || <span style={{ color: '#9ca3af' }}>—</span>}
                            </td>
                            <td style={{ fontSize: '12px', color: '#374151' }}>
                              {page.region || <span style={{ color: '#9ca3af' }}>—</span>}
                            </td>
                            <td style={{ fontSize: '12px', color: '#374151' }}>
                              {page.team || <span style={{ color: '#9ca3af' }}>—</span>}
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input 
                                  type="checkbox"
                                  id={`toggle-${page.pageId}`}
                                  checked={page.enabled}
                                  onChange={(e) => toggleMutation.mutate({ pageId: page.pageId, enabled: e.target.checked })}
                                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: '12px', color: page.enabled ? '#16a34a' : '#6b7280', fontWeight: 600 }}>
                                  {page.enabled ? 'Đang hoạt động' : 'Tạm dừng'}
                                </span>
                              </div>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button 
                                onClick={() => {
                                  if (confirm(`Bạn có chắc muốn xóa trang ${page.pageName || page.pageId} khỏi hệ thống?`)) {
                                    deleteMutation.mutate(page.pageId);
                                  }
                                }}
                                style={{ 
                                  padding: '4px 8px', 
                                  borderRadius: '4px', 
                                  border: '1px solid #fee2e2', 
                                  background: '#fef2f2', 
                                  color: '#dc2626',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                Xóa
                              </button>
                            </td>
                          </tr>
                        ))}
                        {channelsCurrentItems.length < CHANNELS_PAGE_SIZE &&
                          Array.from({ length: CHANNELS_PAGE_SIZE - channelsCurrentItems.length }).map((_, idx) => (
                            <tr key={`channel-filler-${idx}`} aria-hidden="true" style={{ visibility: 'hidden' }}>
                              <td><div style={{ width: '32px', height: '32px' }} /></td>
                              <td colSpan={7}>&nbsp;</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {!isPagesBusy && channelsTotal > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', paddingTop: '4px' }}>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      Hiển thị {channelsRangeStart}-{channelsRangeEnd} trong {channelsTotal} kênh
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setChannelsPage((page) => Math.max(1, page - 1))}
                        disabled={channelsPage === 1}
                        style={{
                          height: '30px', border: '1px solid #e5e7eb', borderRadius: '7px', background: '#fff',
                          color: '#374151', fontSize: '12px', padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: '4px',
                          cursor: channelsPage === 1 ? 'not-allowed' : 'pointer', opacity: channelsPage === 1 ? 0.5 : 1,
                        }}
                      >
                        <CaretLeft size={12} weight="bold" />
                        Trước
                      </button>
                      <span style={{ minWidth: '60px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#374151' }}>
                        {channelsPage}/{channelsTotalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setChannelsPage((page) => Math.min(channelsTotalPages, page + 1))}
                        disabled={channelsPage === channelsTotalPages}
                        style={{
                          height: '30px', border: '1px solid #e5e7eb', borderRadius: '7px', background: '#fff',
                          color: '#374151', fontSize: '12px', padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: '4px',
                          cursor: channelsPage === channelsTotalPages ? 'not-allowed' : 'pointer', opacity: channelsPage === channelsTotalPages ? 0.5 : 1,
                        }}
                      >
                        Sau
                        <CaretRight size={12} weight="bold" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            </>
            )}
          </div>
        )}

        {/* Phân quyền (Tab Phân quyền) */}
        {settingsTabs[activeTabIdx] === 'Phân quyền' && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col animate-in fade-in slide-in-from-bottom-4" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Phân quyền & Quản trị viên</h3>
              <p style={{ fontSize: '11px', color: '#6b7280' }}>Quản lý vai trò truy cập nền tảng và gán quyền cho nhân viên</p>
            </div>

            <div style={{ overflow: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Người dùng</th>
                    <th>Email</th>
                    <th>Vai trò</th>
                    <th>Quyền chính</th>
                    <th>Hoạt động cuối</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'Bùi Duy Cường', email: 'cuong@vienchibao.com', role: 'Admin', permission: 'Toàn bộ hệ thống, chỉnh sửa tiêu chí & API', active: 'Vừa xong' },
                    { name: 'Nguyễn Thu Hương', email: 'huongnt@vienchibao.com', role: 'Manager', permission: 'Xem báo cáo, phê duyệt audit nháp', active: '10 phút trước' },
                    { name: 'Lê Thảo Vy', email: 'vylt@vienchibao.com', role: 'Auditor', permission: 'Chấm điểm thủ công, đánh giá phụ', active: '30 phút trước' },
                    { name: 'Trần Minh Quân', email: 'quantm@vienchibao.com', role: 'Agent', permission: 'Chỉ xem điểm cá nhân và chat khách hàng', active: '2 giờ trước' },
                  ].map((user, idx) => (
                    <tr key={idx}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '12.5px', color: '#1f2937' }}>{user.name}</div>
                      </td>
                      <td style={{ fontSize: '12px', color: '#6b7280' }}>{user.email}</td>
                      <td>
                        <span className="tag" style={{ 
                          background: user.role === 'Admin' ? '#e0e7ff' : user.role === 'Manager' ? '#f0fdf4' : '#f3f4f6', 
                          color: user.role === 'Admin' ? '#3730a3' : user.role === 'Manager' ? '#16a34a' : '#4b5563',
                          fontWeight: 700
                        }}>
                          {user.role}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: '#4b5563' }}>{user.permission}</td>
                      <td style={{ fontSize: '11px', color: '#9ca3af' }}>{user.active}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <button style={{ padding: '6px', fontSize: '12.5px', color: '#4f46e5', fontWeight: 600, border: '1px dashed var(--primary-300)', borderRadius: '6px', marginTop: '6px' }}>
              + Thêm người dùng mới / Gán vai trò
            </button>
          </div>
        )}

        {/* Mock for other tabs */}
        {settingsTabs[activeTabIdx] !== 'Cài đặt hệ thống' && settingsTabs[activeTabIdx] !== 'AI & Chấm điểm' && settingsTabs[activeTabIdx] !== 'Cài đặt kênh' && settingsTabs[activeTabIdx] !== 'Phân quyền' && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col animate-in fade-in slide-in-from-bottom-4" style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', textAlign: 'center' }}>
              <GearSix size={32} weight="duotone" style={{ color: '#4f46e5' }} />
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>{settingsTabs[activeTabIdx]}</h3>
              <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px', maxWidth: '300px' }}>
                Hệ thống đang cấu hình các thông số mặc định tốt nhất cho thương hiệu Viên Chi Bảo. Bạn có thể sử dụng ngay lập tức hoặc nhấn nút kích hoạt để ghi đè.
              </p>
            </div>
            <button onClick={handleSaveSettings} style={{ padding: '6px 16px', background: '#4f46e5', color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>Kích hoạt mặc định</button>
          </div>
        )}
      </div>

      {/* Right - Quick settings links and Backup status */}
      <div style={{ width: '280px', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col animate-in fade-in slide-in-from-bottom-4" style={{ padding: '14px', animationDelay: '200ms' }}>
          <div style={{ fontWeight: 700, fontSize: '13px', color: '#1f2937', marginBottom: '8px' }}>Liên kết thiết lập nhanh</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {settingsQuickLinks.map((link, idx) => (
              <div 
                key={idx} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: '8px', 
                  padding: '6px', 
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'background var(--tr-fast)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {(() => {
                  const quickLinkIcons = {
                    '📢': Megaphone,
                    '📦': Package,
                    '🔧': Wrench,
                    '🤖': Brain,
                    '🔐': Key,
                    '🔔': Bell,
                    '🔗': Link,
                    '🧠': Brain,
                    '💾': HardDrive,
                    '📋': ClipboardText
                  };
                  const IconComp = quickLinkIcons[link.icon] || GearSix;
                  return <IconComp size={16} weight="duotone" style={{ color: '#4f46e5', flexShrink: 0, marginTop: '2px' }} />;
                })()}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#1f2937' }}>{link.title}</div>
                  <div style={{ fontSize: '10px', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{link.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Database Health Card */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col animate-in fade-in slide-in-from-bottom-4" style={{ padding: '14px', animationDelay: '250ms', background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', color: '#fff' }}>
          <div style={{ fontWeight: 700, fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <HardDrive size={14} weight="duotone" /> Trạng thái dữ liệu
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', color: 'rgba(255,255,255,0.7)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Dung lượng đã dùng:</span>
              <strong style={{ color: '#fff' }}>12.4 GB / 50 GB (24.8%)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Số hội thoại lưu trữ:</span>
              <strong style={{ color: '#fff' }}>52.362 chat</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Độ trễ API AI:</span>
              <strong style={{ color: '#22c55e' }}>Tốt (84ms)</strong>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Sao lưu tự động:</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#22c55e' }}><CheckCircle size={10} weight="fill" /> Bật</span>
            </div>
          </div>
          <button style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.15)', color: '#fff', borderRadius: '4px', fontSize: '11px', fontWeight: 600, marginTop: '8px', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <ArrowsCounterClockwise size={10} /> Sao lưu ngay lập tức
          </button>
        </div>
      </div>
    </div>
  );
}
