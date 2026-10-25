import React, { useState, useMemo, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  TrendingUp, 
  FileText,
  Boxes, 
  Building2,
  Calendar,
  Truck,
  Cpu, 
  QrCode, 
  ThermometerSnowflake, 
  MessageSquare, 
  Users, 
  Settings,
  ClipboardList,
  Warehouse,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  LogIn,
  Navigation
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { RoleType } from '../types';
import { 
  isRouteAuthorized, 
  ROLE_DISPLAY_NAMES,
  PERM_FORECASTS_VIEW,
  PERM_REPORTS_VIEW,
  PERM_INVENTORY_VIEW,
  PERM_WAREHOUSES_MANAGE,
  PERM_TRANSFERS_VIEW,
  PERM_OPTIMIZATION_RUN,
  PERM_SCANS_EXECUTE,
  PERM_IOT_READINGS_VIEW,
  PERM_INTEGRATIONS_MANAGE,
  PERM_USERS_MANAGE,
  PERM_ORGANIZATIONS_MANAGE,
  PERM_AUDIT_VIEW
} from '../utils/permissions';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  badge?: string;
  allowedRoles?: RoleType[];
  requiredPermission?: string;
}

interface NavGroup {
  name: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    name: 'ANALYTICS',
    items: [
      { 
        to: '/forecasting', 
        label: 'Forecasting', 
        icon: TrendingUp,
        allowedRoles: ['super_admin', 'org_admin', 'supply_chain_manager'],
        requiredPermission: PERM_FORECASTS_VIEW
      },
      { 
        to: '/reports', 
        label: 'Reports', 
        icon: FileText,
        allowedRoles: ['super_admin', 'org_admin', 'supply_chain_manager', 'warehouse_manager'],
        requiredPermission: PERM_REPORTS_VIEW
      }
    ]
  },
  {
    name: 'INVENTORY',
    items: [
      { 
        to: '/inventory', 
        label: 'Inventory', 
        icon: Boxes,
        allowedRoles: ['super_admin', 'org_admin', 'supply_chain_manager', 'warehouse_manager', 'distributor', 'operator'],
        requiredPermission: PERM_INVENTORY_VIEW
      },
      { 
        to: '/inventory?tab=warehouses', 
        label: 'Warehouses', 
        icon: Building2,
        allowedRoles: ['super_admin', 'org_admin'],
        requiredPermission: PERM_WAREHOUSES_MANAGE
      },
      { 
        to: '/inventory?tab=batches', 
        label: 'Batches & Expiry', 
        icon: Calendar,
        allowedRoles: ['super_admin', 'org_admin', 'supply_chain_manager', 'warehouse_manager', 'operator'],
        requiredPermission: PERM_INVENTORY_VIEW
      }
    ]
  },
  {
    name: 'OPERATIONS',
    items: [
      { 
        to: '/express', 
        label: 'Transfers', 
        icon: Truck,
        allowedRoles: ['super_admin', 'org_admin', 'supply_chain_manager', 'warehouse_manager', 'distributor'],
        requiredPermission: PERM_TRANSFERS_VIEW
      },
      { 
        to: '/simulation', 
        label: 'Route Simulator', 
        icon: Navigation, 
        badge: 'DIJKSTRA',
        allowedRoles: ['super_admin', 'org_admin', 'supply_chain_manager', 'warehouse_manager', 'distributor', 'operator']
      },
      { 
        to: '/optimizer', 
        label: 'Optimization', 
        icon: Cpu, 
        badge: 'MIP',
        allowedRoles: ['super_admin', 'org_admin', 'supply_chain_manager'],
        requiredPermission: PERM_OPTIMIZATION_RUN
      },
      { 
        to: '/scanner', 
        label: 'QR Scanner', 
        icon: QrCode,
        allowedRoles: ['super_admin', 'org_admin', 'warehouse_manager', 'distributor', 'operator', 'supply_chain_manager'],
        requiredPermission: PERM_SCANS_EXECUTE
      }
    ]
  },
  {
    name: 'INTEGRATIONS',
    items: [
      { 
        to: '/iot', 
        label: 'IoT Monitoring', 
        icon: ThermometerSnowflake, 
        badge: 'ESP32',
        allowedRoles: ['super_admin', 'org_admin', 'supply_chain_manager', 'warehouse_manager'],
        requiredPermission: PERM_IOT_READINGS_VIEW
      },
      { 
        to: '/whatsapp', 
        label: 'WhatsApp Alerts', 
        icon: MessageSquare,
        allowedRoles: ['super_admin', 'org_admin', 'supply_chain_manager', 'warehouse_manager'],
        requiredPermission: PERM_INTEGRATIONS_MANAGE
      }
    ]
  },
  {
    name: 'ADMINISTRATION',
    items: [
      { 
        to: '/users', 
        label: 'Users & Access', 
        icon: Users,
        allowedRoles: ['super_admin', 'org_admin'],
        requiredPermission: PERM_USERS_MANAGE
      },
      { 
        to: '/users?tab=org', 
        label: 'Organization Settings', 
        icon: Settings,
        allowedRoles: ['super_admin'],
        requiredPermission: PERM_ORGANIZATIONS_MANAGE
      },
      { 
        to: '/inventory?tab=ledger', 
        label: 'Audit Logs', 
        icon: ClipboardList,
        allowedRoles: ['super_admin', 'org_admin'],
        requiredPermission: PERM_AUDIT_VIEW
      }
    ]
  }
];

export const Sidebar: React.FC = () => {
  const { activeRole, user, selectedWarehouseId, mobileSidebarOpen, setMobileSidebarOpen } = useAppStore();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('stockpilot_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    try {
      localStorage.setItem('stockpilot_sidebar_collapsed', String(collapsed));
    } catch {
      // ignore
    }
  }, [collapsed]);

  const toggleGroupCollapse = (groupName: string) => {
    if (collapsed) return; // Do not collapse in icon mode
    setCollapsedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const userDisplayName = user?.full_name || (activeRole === 'operator' ? 'James O\'Connor' : 'Sarvesh Kulkarni');
  const userInitials = userDisplayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'SO';

  const facilityLabel = selectedWarehouseId && selectedWarehouseId !== 'all'
    ? selectedWarehouseId.replace(/^wh_/, '').replace(/_/g, ' ').toUpperCase()
    : 'Kolhapur Central';
  const facilityCode = selectedWarehouseId === 'wh_gokul_shirgaon' ? 'KL-002' : selectedWarehouseId === 'wh_kagal_midc' ? 'KL-003' : 'KL-001';

  // Filter Nav Groups based on authenticated user's effective permissions
  const authorizedNavGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => {
      const visibleItems = group.items.filter((item) =>
        isRouteAuthorized(
          item.allowedRoles,
          item.requiredPermission,
          activeRole,
          user?.permissions
        )
      );
      return {
        ...group,
        items: visibleItems,
      };
    }).filter((group) => group.items.length > 0);
  }, [activeRole, user?.permissions]);

  // Accurate active path matcher supporting query params & hash
  const isItemActive = (itemTo: string) => {
    const fullCurrent = location.pathname + location.search + location.hash;
    if (itemTo.includes('?') || itemTo.includes('#')) {
      return fullCurrent === itemTo;
    }
    return location.pathname === itemTo && !location.search && !location.hash;
  };

  const handleFacilityCardClick = () => {
    const canManageWarehouses = isRouteAuthorized(
      ['super_admin', 'org_admin'],
      PERM_WAREHOUSES_MANAGE,
      activeRole,
      user?.permissions
    );
    navigate(canManageWarehouses ? '/inventory?tab=warehouses' : '/inventory');
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-[#142B40]/70 backdrop-blur-xs z-40 md:hidden animate-in fade-in transition-opacity"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed md:sticky top-0 left-0 h-screen z-50 md:z-30 bg-[#142B40] border-r border-[#1B3A5A] text-[#94A3B8] transition-all duration-200 ease-in-out flex flex-col shrink-0 select-none ${
          collapsed ? 'w-20' : 'w-64'
        } ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header Branding */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-[#1E3B56] shrink-0">
            <div 
              className="flex items-center gap-3 cursor-pointer overflow-hidden" 
              onClick={() => navigate('/')}
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0D9488] to-[#14B8A6] flex items-center justify-center text-white shadow-sm shrink-0">
                <Boxes className="w-4.5 h-4.5 text-white" strokeWidth={2} />
              </div>
              {!collapsed && (
                <div className="truncate">
                  <div className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                    <span>StockPilot</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#0D9488]/20 text-[#14B8A6] border border-[#0D9488]/40 font-mono font-medium">
                      AI
                    </span>
                  </div>
                  <div className="text-[10px] font-medium text-[#64748B] tracking-wider uppercase">
                    Supply Intelligence
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setCollapsed(!collapsed)}
              className="w-7 h-7 rounded-lg border border-[#203D54] bg-[#142B40] text-[#94A3B8] hover:text-white hover:bg-[#203D54] flex items-center justify-center transition-all cursor-pointer"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" strokeWidth={1.8} /> : <ChevronLeft className="w-4 h-4" strokeWidth={1.8} />}
            </button>
          </div>

          {/* Permission-Aware Navigation Links */}
          <nav className="p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-14rem)] scrollbar-none">
            {/* Primary Dashboard Link (Always Authorized) */}
            <div className="space-y-1">
              <NavLink
                to="/"
                end
                onClick={() => setMobileSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all duration-150 group relative ${
                    isActive
                      ? 'bg-[#203D54] text-[#14B8A6] font-semibold border-l-3 border-[#0D9488] shadow-xs'
                      : 'text-[#94A3B8] hover:text-white hover:bg-[#203D54] font-medium'
                  }`
                }
                title={collapsed ? 'Dashboard' : undefined}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <LayoutDashboard className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" strokeWidth={1.8} />
                  {!collapsed && <span className="truncate">Dashboard</span>}
                </div>
              </NavLink>
            </div>

            {/* Filtered Authorized Navigation Groups */}
            {authorizedNavGroups.map((group) => {
              const isGroupCollapsed = !collapsed && !!collapsedGroups[group.name];
              return (
                <div key={group.name} className="space-y-1">
                  {!collapsed && (
                    <button
                      onClick={() => toggleGroupCollapse(group.name)}
                      className="w-full flex items-center justify-between px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#64748B] hover:text-[#94A3B8] transition-colors cursor-pointer"
                    >
                      <span>{group.name}</span>
                      <ChevronDown className={`w-3 h-3 text-[#64748B] transition-transform duration-200 ${isGroupCollapsed ? '-rotate-90' : 'rotate-0'}`} />
                    </button>
                  )}
                  {(!isGroupCollapsed || collapsed) && group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isItemActive(item.to);
                    return (
                      <NavLink
                        key={`${item.to}-${item.label}`}
                        to={item.to}
                        onClick={() => setMobileSidebarOpen(false)}
                        className={
                          `flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all duration-150 group relative ${
                            active
                              ? 'bg-[#203D54] text-[#14B8A6] font-semibold border-l-3 border-[#0D9488] shadow-xs'
                              : 'text-[#94A3B8] hover:text-white hover:bg-[#203D54] font-medium'
                          }`
                        }
                        title={collapsed ? item.label : undefined}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" strokeWidth={1.8} />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </div>
                        {!collapsed && item.badge && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#17324D] text-[#14B8A6] border border-[#0D9488]/30 uppercase tracking-wider font-mono">
                            {item.badge}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              );
            })}

            {/* Switch Persona / Role Selection link */}
            <div className="pt-2 border-t border-[#1E3B56]">
              <NavLink
                to="/login"
                onClick={() => setMobileSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all duration-150 ${
                    isActive
                      ? 'bg-[#203D54] text-white font-semibold'
                      : 'text-[#94A3B8] hover:text-white hover:bg-[#203D54] font-medium'
                  }`
                }
                title={collapsed ? 'Switch Persona' : undefined}
              >
                <div className="flex items-center gap-2.5">
                  <LogIn className="w-4 h-4 shrink-0 text-[#14B8A6]" strokeWidth={1.8} />
                  {!collapsed && <span>Switch Persona</span>}
                </div>
                {!collapsed && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#0D9488]/20 text-[#14B8A6] border border-[#0D9488]/30 font-mono">
                    6 ROLES
                  </span>
                )}
              </NavLink>
            </div>
          </nav>
        </div>

        {/* Footer Area: Facility Card + User Profile Row */}
        <div className="p-3 border-t border-[#1E3B56] space-y-2 bg-[#102334]">
          {/* Facility Selector Card */}
          {!collapsed ? (
            <div 
              onClick={handleFacilityCardClick}
              className="p-2.5 rounded-xl bg-[#17324D] border border-[#23456B] flex items-center justify-between text-left cursor-pointer hover:border-[#14B8A6]/50 transition-all group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#0D9488]/20 border border-[#0D9488]/30 flex items-center justify-center text-[#14B8A6] shrink-0">
                  <Warehouse className="w-3.5 h-3.5" strokeWidth={1.8} />
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold text-white truncate group-hover:text-[#14B8A6] transition-colors">
                    {facilityLabel}
                  </div>
                  <div className="text-[10px] text-[#64748B] font-mono">
                    {facilityCode}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-[#64748B] group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </div>
          ) : (
            <div 
              onClick={handleFacilityCardClick}
              className="w-full flex justify-center py-1 cursor-pointer" 
              title={`${facilityLabel} (${facilityCode})`}
            >
              <div className="w-8 h-8 rounded-lg bg-[#17324D] border border-[#23456B] flex items-center justify-center text-[#14B8A6] hover:border-[#14B8A6]/50 transition-colors">
                <Warehouse className="w-4 h-4" strokeWidth={1.8} />
              </div>
            </div>
          )}

          {/* User Profile Card */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#17324D] border border-[#23456B] flex items-center justify-center text-white font-bold text-xs shrink-0">
                {userInitials}
              </div>
              {!collapsed && (
                <div className="truncate">
                  <div className="text-xs font-semibold text-white truncate leading-tight">
                    {userDisplayName}
                  </div>
                  <div className="text-[10px] text-[#64748B] truncate leading-tight mt-0.5 font-mono">
                    {ROLE_DISPLAY_NAMES[activeRole] || activeRole}
                  </div>
                </div>
              )}
            </div>
            {!collapsed && (
              <span className="w-2 h-2 rounded-full bg-[#059669] shrink-0" title="System Connected & Operational" />
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
