import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { RoleType, Warehouse } from '../types';
import { 
  Building2, 
  ChevronDown, 
  LogOut, 
  Check, 
  ShieldCheck,
  Menu,
  Search,
  Bell,
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { api } from '../services/api';

const ROLES_INFO: Record<RoleType, { label: string; desc: string; badge: string }> = {
  super_admin: { label: 'Super Admin', desc: 'Tenant isolation & platform health', badge: 'ROOT' },
  org_admin: { label: 'Organization Admin', desc: 'Warehouses, users & stock policies', badge: 'ADMIN' },
  supply_chain_manager: { label: 'Supply Chain Manager', desc: 'Optimization runs, forecasts & transfers', badge: 'LEAD' },
  warehouse_manager: { label: 'Warehouse Manager', desc: 'Hub inventory, batches & IoT telemetry', badge: 'HUB' },
  distributor: { label: 'Distributor / Fleet', desc: 'Assigned dispatches & delivery logs', badge: 'FLEET' },
  operator: { label: 'Warehouse Operator', desc: 'QR scanning, pick & pack, stock receipts', badge: 'FLOOR' },
};

interface NotificationItem {
  id: string;
  title: string;
  desc: string;
  time: string;
  type: 'warning' | 'info' | 'success';
  to: string;
}

const SAMPLE_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Cold-Chain Alert',
    desc: 'KL-001 Cold Zone A at 4.2°C (target 2-8°C optimal)',
    time: '12m ago',
    type: 'warning',
    to: '/iot'
  },
  {
    id: 'notif-2',
    title: 'Transfer Dispatched',
    desc: 'Shiroli MIDC ➔ CPR Trauma Hospital (240 units)',
    time: '34m ago',
    type: 'info',
    to: '/simulation'
  },
  {
    id: 'notif-3',
    title: 'Low Stock Threshold',
    desc: 'Insulin Glargine 100IU/ml at 45 units remaining',
    time: '1h ago',
    type: 'warning',
    to: '/inventory'
  }
];

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    user, 
    setUser,
    activeRole, 
    setActiveRole, 
    selectedWarehouseId, 
    setSelectedWarehouseId,
    setMobileSidebarOpen,
    addToast 
  } = useAppStore();

  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;
    api.warehouses.list()
      .then((whs) => {
        if (isMounted) {
          setWarehouses(whs);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn('Warehouse fetch in Navbar:', err);
        }
      });

    // Global keyboard listener for Ctrl+K / Cmd+K
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleRoleSelect = async (role: RoleType) => {
    setRoleMenuOpen(false);
    try {
      const res = await api.auth.switchRole(role);
      setUser(res.user, res.access_token);
      setActiveRole(role);

      addToast({
        type: 'info',
        title: `Switched Persona to ${ROLES_INFO[role]?.label || role}`,
        message: `Workstation controls loaded for ${role}.`
      });

      const currentPath = location.pathname;
      const restrictedForOperator = ['/forecasting', '/optimizer', '/users', '/iot', '/whatsapp', '/express'];
      if (role === 'operator' && restrictedForOperator.some(p => currentPath.startsWith(p))) {
        navigate('/');
      } else if (role === 'distributor' && ['/forecasting', '/optimizer', '/users', '/iot', '/whatsapp'].some(p => currentPath.startsWith(p))) {
        navigate('/');
      }
    } catch (e: any) {
      console.warn('Role switch network sync:', e);
      addToast({
        type: 'error',
        title: 'Role Switch Unavailable',
        message: e.message || 'Server rejected role switch.'
      });
    }
  };

  const handleLogout = () => {
    setUser(null, null);
    localStorage.removeItem('stockpilot_token');
    addToast({
      type: 'info',
      title: 'Signed Out',
      message: 'Your authenticated session has ended.'
    });
    navigate('/login');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/inventory?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  // Breadcrumbs calculation from current path
  const getBreadcrumbs = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    if (path.startsWith('/inventory')) return 'Inventory & Stock';
    if (path.startsWith('/simulation')) return 'Operations / Route Simulator';
    if (path.startsWith('/express')) return 'Operations / Transfers';
    if (path.startsWith('/optimizer')) return 'Operations / Optimization Engine';
    if (path.startsWith('/scanner')) return 'Operations / QR Scanner';
    if (path.startsWith('/forecasting')) return 'Analytics / Demand Forecasting';
    if (path.startsWith('/iot')) return 'Integrations / IoT Monitoring';
    if (path.startsWith('/whatsapp')) return 'Integrations / WhatsApp Engine';
    if (path.startsWith('/users')) return 'Administration / Access Control';
    if (path.startsWith('/login')) return 'Security / Role Authentication';
    return 'StockPilot AI';
  };

  const userDisplayName = user?.full_name || (activeRole === 'operator' ? 'James O\'Connor' : 'Sarvesh Kulkarni');
  const userInitials = userDisplayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'SO';

  return (
    <header className="h-16 px-4 sm:px-6 lg:px-8 bg-white border-b border-[#E2E8F0] flex items-center justify-between sticky top-0 z-20 shadow-xs">
      {/* Left: Mobile Toggle + Global Search Bar + Breadcrumb */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="md:hidden p-2 rounded-xl border border-[#E2E8F0] text-[#172B3A] hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
          title="Open Navigation Menu"
        >
          <Menu className="w-4 h-4 text-[#172B3A]" />
        </button>

        {/* Global Search Bar with Ctrl+K shortcut */}
        <form onSubmit={handleSearchSubmit} className="relative w-full max-w-md hidden sm:block">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, batches, transfers... (Ctrl+K)"
              className="w-full pl-9 pr-16 py-1.5 text-xs text-[#172B3A] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-[#0D9488] focus:bg-white transition-all placeholder:text-[#94A3B8]"
            />
            <div className="absolute right-2.5 flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-medium text-[#64748B] bg-[#EDF2F7] border border-[#CBD5E1] rounded">
                Ctrl K
              </kbd>
            </div>
          </div>
        </form>

        {/* Breadcrumb Context (hidden on small viewports) */}
        <div className="hidden xl:flex items-center gap-1.5 text-xs text-[#64748B] pl-2 border-l border-[#E2E8F0]">
          <span className="font-medium truncate">{getBreadcrumbs()}</span>
        </div>
      </div>

      {/* Right Controls: Facility Dropdown, Notification Bell, Role Switcher, User Avatar */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Facility Selector Dropdown */}
        <div className="relative flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#E2E8F0] bg-white hover:bg-slate-50 transition-colors text-xs shadow-2xs">
          <Building2 className="w-3.5 h-3.5 text-[#0D9488]" />
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="bg-transparent text-xs font-semibold text-[#172B3A] focus:outline-none cursor-pointer pr-1"
          >
            <option value="all">Kolhapur Central (KL-001)</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </option>
            ))}
          </select>
        </div>

        {/* Notification Bell with Dropdown Popover */}
        <div className="relative">
          <button 
            type="button"
            onClick={() => {
              setNotifMenuOpen(!notifMenuOpen);
              setRoleMenuOpen(false);
              setUserMenuOpen(false);
            }}
            className="w-9 h-9 rounded-xl border border-[#E2E8F0] hover:border-[#CBD5E1] bg-white hover:bg-slate-50 flex items-center justify-center text-[#64748B] hover:text-[#172B3A] transition-all cursor-pointer relative shadow-2xs"
            title="Operational Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#DC2626] text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                {unreadCount}
              </span>
            )}
          </button>

          {notifMenuOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white border border-[#E2E8F0] shadow-[0_12px_32px_rgba(20,43,64,0.12)] p-3 z-50 animate-in fade-in zoom-in-95 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
                <div className="text-xs font-bold text-[#172B3A]">System Alerts</div>
                {unreadCount > 0 && (
                  <button 
                    onClick={() => setUnreadCount(0)}
                    className="text-[10px] text-[#0D9488] hover:underline font-semibold cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {SAMPLE_NOTIFICATIONS.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      setNotifMenuOpen(false);
                      navigate(n.to);
                    }}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-[#F0FDFA] transition-colors cursor-pointer border border-transparent hover:border-[#CCFBF1] space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#172B3A] flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${n.type === 'warning' ? 'bg-[#D97706]' : 'bg-[#0D9488]'}`} />
                        {n.title}
                      </span>
                      <span className="text-[10px] text-[#94A3B8] font-mono">{n.time}</span>
                    </div>
                    <p className="text-[11px] text-[#64748B] line-clamp-2">{n.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Persona Switcher Dropdown */}
        <div className="relative hidden sm:block">
          <button
            onClick={() => {
              setRoleMenuOpen(!roleMenuOpen);
              setUserMenuOpen(false);
              setNotifMenuOpen(false);
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#E2E8F0] hover:border-[#CBD5E1] bg-white hover:bg-slate-50 text-xs font-semibold text-[#172B3A] transition-all cursor-pointer shadow-2xs"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#0D9488]" />
            <span className="hidden md:inline">{ROLES_INFO[activeRole]?.label}</span>
            <span className="md:hidden">{ROLES_INFO[activeRole]?.badge}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
          </button>

          {roleMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white border border-[#E2E8F0] shadow-[0_12px_32px_rgba(20,43,64,0.12)] p-2 z-50 animate-in fade-in zoom-in-95">
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8] border-b border-[#F1F5F9]">
                Switch Operating Persona
              </div>
              <div className="space-y-1 mt-1 max-h-80 overflow-y-auto">
                {(Object.keys(ROLES_INFO) as RoleType[]).map((r) => {
                  const info = ROLES_INFO[r];
                  const isCur = activeRole === r;
                  return (
                    <button
                      key={r}
                      onClick={() => handleRoleSelect(r)}
                      className={`w-full text-left p-2.5 rounded-xl transition-colors flex items-start justify-between cursor-pointer ${
                        isCur
                          ? 'bg-[#0D9488]/10 text-[#0D9488] font-bold'
                          : 'hover:bg-slate-50 text-[#172B3A]'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <span>{info.label}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-semibold uppercase font-mono">
                            {info.badge}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#64748B] mt-0.5 font-normal">
                          {info.desc}
                        </div>
                      </div>
                      {isCur && <Check className="w-4 h-4 text-[#0D9488] shrink-0 mt-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* User Avatar Circle */}
        <div className="relative">
          <button
            onClick={() => {
              setUserMenuOpen(!userMenuOpen);
              setRoleMenuOpen(false);
              setNotifMenuOpen(false);
            }}
            className="flex items-center gap-2 p-0.5 rounded-full border border-transparent hover:border-[#E2E8F0] transition-all cursor-pointer"
            title={`${userDisplayName} (${ROLES_INFO[activeRole]?.label})`}
          >
            <div className="w-9 h-9 rounded-full bg-[#17324D] text-white flex items-center justify-center font-bold text-xs shadow-xs hover:ring-2 hover:ring-[#0D9488]/30 transition-all">
              {userInitials}
            </div>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-[#E2E8F0] shadow-[0_12px_32px_rgba(20,43,64,0.12)] p-2 z-50 animate-in fade-in zoom-in-95">
              <div className="p-3 border-b border-[#F1F5F9]">
                <div className="text-xs font-bold text-[#172B3A]">{userDisplayName}</div>
                <div className="text-[11px] text-[#64748B] truncate font-mono">{user?.email || 'operator@stockpilot.ai'}</div>
                <div className="mt-1.5 inline-block text-[10px] px-2 py-0.5 rounded-full bg-[#0D9488]/10 text-[#0D9488] font-semibold">
                  {ROLES_INFO[activeRole]?.label || activeRole}
                </div>
              </div>

              <div className="pt-1">
                <button
                  onClick={handleLogout}
                  className="w-full text-left p-2 rounded-xl text-xs text-[#DC2626] hover:bg-[#FEF2F2] flex items-center gap-2 transition-colors cursor-pointer font-semibold"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out Session</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
