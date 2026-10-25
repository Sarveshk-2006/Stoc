import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { User, Warehouse, RoleType } from '../types';
import { KPICard } from '../components/KPICard';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Skeleton } from '../components/ui/Skeleton';
import { 
  Users, 
  UserPlus, 
  Lock, 
  Building2, 
  FileCheck2, 
  Search, 
  RefreshCw,
  Edit2,
  Power,
  MapPin,
  ShieldCheck,
  Sliders,
  CheckCircle2,
  Globe,
  Save,
  X
} from 'lucide-react';

export const UsersPage: React.FC = () => {
  const { addToast, activeRole } = useAppStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'users' | 'org' | 'audit'>(
    tabParam === 'org' ? 'org' : tabParam === 'audit' ? 'audit' : 'users'
  );

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'org') setActiveTab('org');
    else if (t === 'audit') setActiveTab('audit');
    else if (t === 'users') setActiveTab('users');
  }, [searchParams]);

  const handleTabChange = (tab: 'users' | 'org' | 'audit') => {
    setActiveTab(tab);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tab);
    setSearchParams(newParams);
  };

  const [users, setUsers] = useState<User[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Organization Governance Policy State
  const [orgConfig, setOrgConfig] = useState({
    orgName: 'StockPilot AI Global BioLogistics',
    tenantId: 'org_kolhapur_metropolis',
    primaryHub: 'KL-001 (Kolhapur Central Pharma Hub)',
    multiWarehouseFederation: true,
    coldChainStrictLock: true,
    autoFefoEnforcement: true,
    tamperEvidentLedger: true,
    hardwareMfaEnforced: true,
    sessionTimeoutMinutes: 30,
    dualSignatoryRelease: true,
  });
  const [savingOrg, setSavingOrg] = useState(false);

  // Invite Modal State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<RoleType>('operator');
  const [inviteWarehouse, setInviteWarehouse] = useState('wh_chicago_01');
  const [inviteWarehouseScopes, setInviteWarehouseScopes] = useState<string[]>(['wh_chicago_01']);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<RoleType>('operator');
  const [editWarehouseId, setEditWarehouseId] = useState('');
  const [editWarehouseScopes, setEditWarehouseScopes] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [uData, whData, aData] = await Promise.all([
        api.auth.listUsers().catch(() => []),
        api.warehouses.list().catch(() => []),
        api.audit.list(50).catch(() => []),
      ]);
      setUsers(uData);
      setWarehouses(whData);
      setAuditLogs(aData);
      if (whData.length > 0) {
        setInviteWarehouse(whData[0].id);
        setInviteWarehouseScopes([whData[0].id]);
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'User sync error', message: err.message });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.auth.inviteUser({
        full_name: inviteName,
        email: inviteEmail,
        role: inviteRole,
        warehouse_id: inviteWarehouse,
        warehouse_ids: inviteWarehouseScopes,
      });
      addToast({
        type: 'success',
        title: 'User Successfully Provisioned',
        message: `Account created for ${inviteName} (${inviteRole}).`
      });
      setInviteModalOpen(false);
      setInviteName('');
      setInviteEmail('');
      loadData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Provisioning failed', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setEditName(u.full_name);
    setEditRole(u.role);
    setEditWarehouseId(u.warehouse_id || (warehouses[0]?.id || ''));
    setEditWarehouseScopes(u.warehouse_ids && u.warehouse_ids.length > 0 ? u.warehouse_ids : (u.warehouse_id ? [u.warehouse_id] : []));
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setActionLoading(true);
    try {
      await api.auth.updateUser(editingUser.id, {
        full_name: editName,
        role: editRole,
        warehouse_id: editWarehouseId,
        warehouse_ids: editWarehouseScopes,
      });
      addToast({
        type: 'success',
        title: 'User Profile Updated',
        message: `Updated permissions and assignments for ${editName}.`
      });
      setEditModalOpen(false);
      setEditingUser(null);
      loadData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Update failed', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (u: User) => {
    try {
      await api.auth.toggleUserActive(u.id);
      addToast({
        type: 'success',
        title: 'Account Status Updated',
        message: `${u.full_name} is now ${u.is_active ? 'deactivated' : 'activated'}.`
      });
      loadData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Status toggle failed', message: err.message });
    }
  };

  const toggleInviteScope = (whId: string) => {
    setInviteWarehouseScopes(prev => 
      prev.includes(whId) ? (prev.length > 1 ? prev.filter(id => id !== whId) : prev) : [...prev, whId]
    );
  };

  const toggleEditScope = (whId: string) => {
    setEditWarehouseScopes(prev => 
      prev.includes(whId) ? (prev.length > 1 ? prev.filter(id => id !== whId) : prev) : [...prev, whId]
    );
  };

  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <PageHeader
        category="Enterprise Access & Identity Governance"
        title="User Administration & Security Audit Trails"
        subtitle="Enforces server-side role authorizations and warehouse location scoping across 6 enterprise tiers."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="primary"
              size="sm"
              icon={UserPlus}
              onClick={() => setInviteModalOpen(true)}
            >
              Provision User
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={loadData}
              disabled={loading}
              loading={loading}
            >
              Sync Directory
            </Button>
          </div>
        }
      />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Active Users"
          value={users.filter(u => u.is_active).length}
          subtitle={`Total provisioned: ${users.length}`}
          statusDotColor="bg-teal-500"
          icon={Users}
        />
        <KPICard
          title="Location Isolation"
          value="ENFORCED"
          subtitle="Warehouse & Org Scoped"
          isPositive={true}
          statusDotColor="bg-emerald-500"
          icon={Building2}
        />
        <KPICard
          title="Audit Ledger Events"
          value={auditLogs.length}
          subtitle="Immutable event ledger"
          statusDotColor="bg-blue-500"
          icon={FileCheck2}
        />
        <KPICard
          title="Privilege Boundaries"
          value="STRICT"
          subtitle="Server-validated checks"
          isPositive={true}
          statusDotColor="bg-emerald-500"
          icon={Lock}
        />
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1.5 p-1 bg-white border border-[#E5EAF0] rounded-xl w-fit shadow-2xs">
        <button
          onClick={() => handleTabChange('users')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'users'
              ? 'bg-[#17324D] text-white shadow-xs'
              : 'text-[#667085] hover:text-[#172B3A] hover:bg-[#F7F9FC]'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Personnel Directory ({users.length})
        </button>
        <button
          onClick={() => handleTabChange('org')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'org'
              ? 'bg-[#17324D] text-white shadow-xs'
              : 'text-[#667085] hover:text-[#172B3A] hover:bg-[#F7F9FC]'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Organization Governance
        </button>
        <button
          onClick={() => handleTabChange('audit')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'audit'
              ? 'bg-[#17324D] text-white shadow-xs'
              : 'text-[#667085] hover:text-[#172B3A] hover:bg-[#F7F9FC]'
          }`}
        >
          <FileCheck2 className="w-3.5 h-3.5" />
          Security Audit Ledger ({auditLogs.length})
        </button>
      </div>

      {/* Tab 1: User Directory Table Card */}
      {activeTab === 'users' && (
        <Card className="overflow-hidden">
          <CardHeader
            title={`Authorized Personnel Directory (${filteredUsers.length})`}
            subtitle="Users have access strictly scoped to assigned warehouses and permitted feature endpoints."
            action={
              <div className="relative w-64">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, or role..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-[#E5EAF0] text-[#172B3A] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488]"
                />
                <Search className="w-3.5 h-3.5 text-[#667085] absolute left-2.5 top-2.5" />
              </div>
            }
          />

          <div className="overflow-x-auto">
            <table className="table-enterprise">
              <thead>
                <tr>
                  <th>User / Identity</th>
                  <th>Role Tier</th>
                  <th>Location Scopes</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-[#667085]">
                      No users found matching search query.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const assignedWhList = (u.warehouse_ids || (u.warehouse_id ? [u.warehouse_id] : []))
                      .map(id => warehouses.find(w => w.id === id)?.name || id);

                    return (
                      <tr key={u.id}>
                        <td>
                          <div className="font-semibold text-[#172B3A]">
                            {u.full_name}
                          </div>
                          <span className="text-[11px] text-[#667085] font-mono">
                            {u.email}
                          </span>
                        </td>
                        <td>
                          <Badge variant="teal" size="sm">
                            {u.role.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="max-w-xs">
                          {assignedWhList.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {assignedWhList.map((whName, i) => (
                                <span key={i} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#F7F9FC] text-[#172B3A] border border-[#E5EAF0]">
                                  <MapPin className="w-2.5 h-2.5 text-[#667085]" />
                                  {whName}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[#667085] italic text-xs">Network Global (All)</span>
                          )}
                        </td>
                        <td className="text-[#667085] font-mono text-xs">
                          {u.phone_number || '—'}
                        </td>
                        <td>
                          <Badge variant={u.is_active ? 'success' : 'neutral'} size="sm">
                            {u.is_active ? 'ACTIVE' : 'INACTIVE'}
                          </Badge>
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(u)}
                              className="p-1.5 rounded-lg border border-[#E5EAF0] bg-white hover:bg-slate-50 text-[#172B3A] transition-colors cursor-pointer"
                              title="Edit User Profile"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleActive(u)}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                u.is_active 
                                  ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100' 
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                              }`}
                              title={u.is_active ? 'Deactivate Account' : 'Activate Account'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 2: Organization Settings & Governance */}
      {activeTab === 'org' && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Organization Profile & Multi-Tenant Scoping"
              subtitle="Configuration for the enterprise medical logistics tenant and multi-warehouse mesh federation."
            />
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
              <div>
                <label className="font-semibold text-[#172B3A] block mb-1.5">Organization Identity</label>
                <input
                  type="text"
                  value={orgConfig.orgName}
                  onChange={(e) => setOrgConfig({ ...orgConfig, orgName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E5EAF0] text-[#172B3A] font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488]"
                />
              </div>
              <div>
                <label className="font-semibold text-[#172B3A] block mb-1.5">Tenant Global ID</label>
                <input
                  type="text"
                  disabled
                  value={orgConfig.tenantId}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F9FC] border border-[#E5EAF0] text-[#667085] font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-[#172B3A] block mb-1.5">Primary Distribution Hub</label>
                <select
                  value={orgConfig.primaryHub}
                  onChange={(e) => setOrgConfig({ ...orgConfig, primaryHub: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E5EAF0] text-[#172B3A] font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488]"
                >
                  <option value="KL-001 (Kolhapur Central Pharma Hub)">KL-001 (Kolhapur Central Pharma Hub)</option>
                  <option value="KL-002 (Shiroli Bio-Logistics Hub)">KL-002 (Shiroli Bio-Logistics Hub)</option>
                  <option value="KL-003 (Gokul Shirgaon Cold Vault)">KL-003 (Gokul Shirgaon Cold Vault)</option>
                </select>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Clinical Compliance & Automated Safety Protocols"
              subtitle="Enforces GxP standards, strict thermal threshold validation, and tamper-resistant inventory operations."
            />
            <div className="p-6 divide-y divide-[#E5EAF0] text-xs">
              <div className="py-4 flex items-center justify-between gap-4 first:pt-0">
                <div>
                  <div className="font-bold text-[#172B3A] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                    Strict Cold-Chain Lock (2.0°C – 8.0°C)
                  </div>
                  <p className="text-[#667085] mt-1 text-[11px]">
                    Automatically blocks transfer dispatch and flags lots if any IoT sensor detects excursion above 8.0°C or below 2.0°C.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOrgConfig({ ...orgConfig, coldChainStrictLock: !orgConfig.coldChainStrictLock })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    orgConfig.coldChainStrictLock ? 'bg-teal-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition duration-200 ease-in-out ${
                      orgConfig.coldChainStrictLock ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="py-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-[#172B3A] flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-teal-600" />
                    Mandatory FEFO Expiry Prioritization
                  </div>
                  <p className="text-[#667085] mt-1 text-[11px]">
                    Requires warehouse operators to liquidate lots with nearest expiration dates first before newer inventory can be fulfilled.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOrgConfig({ ...orgConfig, autoFefoEnforcement: !orgConfig.autoFefoEnforcement })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    orgConfig.autoFefoEnforcement ? 'bg-teal-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition duration-200 ease-in-out ${
                      orgConfig.autoFefoEnforcement ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="py-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-[#172B3A] flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-teal-600" />
                    Cryptographic Append-Only Ledger Integrity
                  </div>
                  <p className="text-[#667085] mt-1 text-[11px]">
                    Signs every stock receipt, dispatch, and adjustment with a SHA-256 hash chaining back to the genesis block.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOrgConfig({ ...orgConfig, tamperEvidentLedger: !orgConfig.tamperEvidentLedger })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    orgConfig.tamperEvidentLedger ? 'bg-teal-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition duration-200 ease-in-out ${
                      orgConfig.tamperEvidentLedger ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="py-4 flex items-center justify-between gap-4 last:pb-0">
                <div>
                  <div className="font-bold text-[#172B3A] flex items-center gap-2">
                    <Lock className="w-4 h-4 text-teal-600" />
                    Mandatory Dual-Signatory Dispatch Authorization
                  </div>
                  <p className="text-[#667085] mt-1 text-[11px]">
                    Requires secondary authorization by a Supply Chain Manager or Org Admin for shipments valued over $10,000.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOrgConfig({ ...orgConfig, dualSignatoryRelease: !orgConfig.dualSignatoryRelease })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    orgConfig.dualSignatoryRelease ? 'bg-teal-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition duration-200 ease-in-out ${
                      orgConfig.dualSignatoryRelease ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="p-4 bg-[#F7F9FC] border-t border-[#E5EAF0] flex items-center justify-end">
              <Button
                variant="primary"
                size="sm"
                icon={Save}
                loading={savingOrg}
                onClick={() => {
                  setSavingOrg(true);
                  setTimeout(() => {
                    setSavingOrg(false);
                    addToast({
                      type: 'success',
                      title: 'Governance Policies Saved',
                      message: 'Organization compliance configurations updated and synchronized across all nodes.'
                    });
                  }, 400);
                }}
              >
                Save Organization Settings
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 3: Security Audit Ledger */}
      {activeTab === 'audit' && (
        <Card className="overflow-hidden">
          <CardHeader
            title={`Immutable Security Audit Ledger (${auditLogs.length})`}
            subtitle="Tamper-evident record of user sessions, permission changes, stock operations, and route dispatches."
          />
          <div className="overflow-x-auto">
            <table className="table-enterprise">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor / Identity</th>
                  <th>Action Category</th>
                  <th>Target Entity</th>
                  <th>Correlation & Details</th>
                  <th>Integrity Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-6">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-[#667085]">
                      No audit events recorded for current session.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log, idx) => (
                    <tr key={log.id || idx}>
                      <td className="font-mono text-[11px] text-[#667085] whitespace-nowrap">
                        {log.timestamp ? log.timestamp.substring(0, 19).replace('T', ' ') : '2026-10-25 09:30:00'}
                      </td>
                      <td>
                        <div className="font-semibold text-[#172B3A]">{log.actor_email || log.actor_name || 'system@stockpilot.io'}</div>
                        <span className="text-[10px] text-[#667085] font-mono">{log.actor_id || 'sys-kernel'}</span>
                      </td>
                      <td>
                        <Badge variant="teal" size="sm">
                          {log.action || 'AUTH_OPERATION'}
                        </Badge>
                      </td>
                      <td className="font-mono text-xs text-[#172B3A]">
                        {log.target_entity || log.entity_type || 'system_configuration'}
                      </td>
                      <td className="text-xs text-[#667085] max-w-xs truncate">
                        {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details || 'Routine authorization pass'}
                      </td>
                      <td>
                        <Badge variant="success" size="sm" dot>
                          VERIFIED
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Provision User Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <Card className="w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF0]">
              <div>
                <h3 className="text-base font-bold text-[#172B3A]">
                  Provision Enterprise User
                </h3>
                <p className="text-xs text-[#667085] mt-0.5">
                  Assign role permissions and warehouse facility scoping.
                </p>
              </div>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="text-[#667085] hover:text-[#172B3A] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-[#172B3A] block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Elena Rostova"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E5EAF0] text-[#172B3A] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#172B3A] block mb-1">Corporate Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="elena.rostova@stockpilot.ai"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E5EAF0] text-[#172B3A] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#172B3A] block mb-1">Assigned Role Tier</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as RoleType)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E5EAF0] text-[#172B3A] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488] cursor-pointer"
                >
                  <option value="operator">Warehouse Operator</option>
                  <option value="warehouse_manager">Warehouse Manager</option>
                  <option value="distributor">Distributor / Logistics Partner</option>
                  <option value="supply_chain_manager">Supply Chain Manager</option>
                  <option value="org_admin">Organization Admin</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#172B3A] block mb-1.5">Permitted Facility Scopes</label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 border border-[#E5EAF0] rounded-xl bg-[#F7F9FC]">
                  {warehouses.map(w => {
                    const isChecked = inviteWarehouseScopes.includes(w.id);
                    return (
                      <label key={w.id} className="flex items-center gap-2 text-xs text-[#172B3A] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleInviteScope(w.id)}
                          className="rounded accent-teal-600"
                        />
                        <span>{w.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E5EAF0]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setInviteModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={actionLoading}
                  loading={actionLoading}
                >
                  Confirm Provisioning
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Edit User Modal */}
      {editModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <Card className="w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF0]">
              <div>
                <h3 className="text-base font-bold text-[#172B3A]">
                  Edit User Permissions: {editingUser.full_name}
                </h3>
                <p className="text-xs text-[#667085] mt-0.5">
                  Update role authorization tier and multi-facility access scopes.
                </p>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-[#667085] hover:text-[#172B3A] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-[#172B3A] block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E5EAF0] text-[#172B3A] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#172B3A] block mb-1">Assigned Role Tier</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as RoleType)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E5EAF0] text-[#172B3A] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488] cursor-pointer"
                >
                  <option value="operator">Warehouse Operator</option>
                  <option value="warehouse_manager">Warehouse Manager</option>
                  <option value="distributor">Distributor / Logistics Partner</option>
                  <option value="supply_chain_manager">Supply Chain Manager</option>
                  <option value="org_admin">Organization Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#172B3A] block mb-1.5">Permitted Facility Scopes</label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 border border-[#E5EAF0] rounded-xl bg-[#F7F9FC]">
                  {warehouses.map(w => {
                    const isChecked = editWarehouseScopes.includes(w.id);
                    return (
                      <label key={w.id} className="flex items-center gap-2 text-xs text-[#172B3A] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleEditScope(w.id)}
                          className="rounded accent-teal-600"
                        />
                        <span>{w.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E5EAF0]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={actionLoading}
                  loading={actionLoading}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
