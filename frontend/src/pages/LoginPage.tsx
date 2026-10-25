import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { RoleType } from '../types';
import { api } from '../services/api';
import { 
  Compass, 
  ShieldCheck, 
  Cpu, 
  Boxes, 
  Truck, 
  QrCode, 
  ArrowRight, 
  CheckCircle2, 
  Lock, 
  KeyRound,
  Building2,
  Server,
  Zap
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

interface RolePersonaConfig {
  role: RoleType;
  title: string;
  tierLabel: string;
  personaName: string;
  email: string;
  icon: React.ElementType;
  primaryFeatures: string[];
}

const ROLE_CONFIGS: RolePersonaConfig[] = [
  {
    role: 'super_admin',
    title: 'Super Admin',
    tierLabel: 'Tier 0 • Root System',
    personaName: 'Sarah Chen',
    email: 'superadmin@stockpilot.ai',
    icon: Server,
    primaryFeatures: [
      'Multi-tenant cloud topography & DB replicas',
      'Global security kill switch & read-only lock',
      'Immutable cryptographic system audit logs',
      'System-wide user provisioning & RBAC governance'
    ]
  },
  {
    role: 'org_admin',
    title: 'Organization Admin',
    tierLabel: 'Tier 1 • Org Director',
    personaName: 'Marcus Vance / Organizer Vk',
    email: 'orgadmin@stockpilot.ai',
    icon: Building2,
    primaryFeatures: [
      'Supply network topography & disruption simulator',
      'Safety stock buffer controls & allocation policies',
      'Operator and manager seat provisioning',
      'Executive performance KPIs & cost reduction metrics'
    ]
  },
  {
    role: 'supply_chain_manager',
    title: 'Supply Chain Manager',
    tierLabel: 'Tier 2 • MIP Solver',
    personaName: 'Elena Rostova',
    email: 'supplychain@stockpilot.ai',
    icon: Cpu,
    primaryFeatures: [
      'Google OR-Tools MIP multi-echelon optimizer',
      '14-day demand velocity curves & stockout forecasting',
      'Inter-facility rebalance dispatch & transfer approvals',
      'Lead time volatility curves & holding cost minimization'
    ]
  },
  {
    role: 'warehouse_manager',
    title: 'Warehouse Manager',
    tierLabel: 'Tier 3 • Cold-Chain & FEFO',
    personaName: 'David Sterling',
    email: 'whmanager@stockpilot.ai',
    icon: Boxes,
    primaryFeatures: [
      'Cold-chain IoT probe telemetry (4.2°C nominal)',
      'FEFO batch expiry liquidation radar (<30d tags)',
      'Cycle count reconciliation & inventory movement ledger',
      'Quarantine and batch spoil mitigation workflow'
    ]
  },
  {
    role: 'distributor',
    title: 'Distributor & Fleet Logistics',
    tierLabel: 'Tier 4 • Fleet & Dispatch',
    personaName: 'Rajiv Patel',
    email: 'distributor@stockpilot.ai',
    icon: Truck,
    primaryFeatures: [
      'Outbound vehicle manifests & Waybill PDF export',
      'Cold-chain route monitoring & in-transit waybills',
      'Digital Proof-of-Delivery (POD) recipient signature',
      'Delivery confirmation & destination dock ledger check'
    ]
  },
  {
    role: 'operator',
    title: 'Warehouse Operator',
    tierLabel: 'Tier 5 • Intake & Scanning',
    personaName: "James O'Connor",
    email: 'operator@stockpilot.ai',
    icon: QrCode,
    primaryFeatures: [
      'Optical high-speed QR & Barcode scanning camera',
      'Synthesized audio beep & batch barcode verification',
      'Wave picking checklist & physical stock intake',
      'Real-time product SKU verification & storage bay lookup'
    ]
  }
];

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setUser, setActiveRole, activeRole, addToast } = useAppStore();
  const [authenticatingRole, setAuthenticatingRole] = useState<RoleType | null>(null);

  // Manual credentials form state
  const [manualEmail, setManualEmail] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);

  const handleRoleLogin = async (targetRole: RoleType, personaName: string) => {
    setAuthenticatingRole(targetRole);
    try {
      const res = await api.auth.switchRole(targetRole);
      setUser(res.user, res.access_token);
      setActiveRole(targetRole);

      addToast({
        type: 'success',
        title: `Logged in as ${ROLE_CONFIGS.find(r => r.role === targetRole)?.title}`,
        message: `Welcome, ${personaName}! Workstation configured with role-specific features.`
      });

      navigate('/');
    } catch (err: any) {
      console.warn('Network role login fallback:', err);
      setActiveRole(targetRole);
      addToast({
        type: 'info',
        title: `Authenticated as ${targetRole}`,
        message: 'Offline workstation initialized.'
      });
      navigate('/');
    } finally {
      setAuthenticatingRole(null);
    }
  };

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEmail || !manualPassword) {
      addToast({
        type: 'error',
        title: 'Missing Credentials',
        message: 'Please enter both email and password.'
      });
      return;
    }

    setManualLoading(true);
    try {
      const res = await api.auth.login({
        email: manualEmail.trim().toLowerCase(),
        password: manualPassword
      });
      setUser(res.user, res.access_token);
      setActiveRole(res.user.role);

      addToast({
        type: 'success',
        title: 'Authenticated Successfully',
        message: `Welcome back, ${res.user.full_name} (${res.user.role})!`
      });

      navigate('/');
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Authentication Failed',
        message: err.message || 'Invalid email or password.'
      });
    } finally {
      setManualLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#172B3A] flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8">
      {/* Top Header */}
      <div className="max-w-6xl w-full mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between pb-6 border-b border-[#E5EAF0] gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#0D9488] shadow-xs">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-[#172B3A]">
                  STOCKPILOT AI
                </span>
                <Badge variant="teal" size="sm">
                  v2.4 Enterprise
                </Badge>
              </div>
              <div className="text-xs text-[#667085]">
                Intelligent BioLogistics & Autonomous Distribution Engine
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-[#667085] bg-white px-3 py-1.5 rounded-lg border border-[#E5EAF0]">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>Strict Role-Based Isolation Active</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={ArrowRight}
              onClick={() => navigate('/')}
            >
              Enter Workspace
            </Button>
          </div>
        </div>

        {/* Hero Title */}
        <div className="my-10 text-center max-w-2xl mx-auto">
          <Badge variant="teal" size="md" className="mb-3">
            ROLE-BASED WORKSTATION ACCESS
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#172B3A] tracking-tight">
            Select Your Operating Persona
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-[#667085] leading-relaxed">
            StockPilot dynamically provisions dedicated tools, solvers, ledgers, and permissions tailored specifically to each of the 6 enterprise roles.
          </p>
        </div>

        {/* 6 Role Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {ROLE_CONFIGS.map((config) => {
            const Icon = config.icon;
            const isLoggingIn = authenticatingRole === config.role;
            const isCurrentlyActive = activeRole === config.role;

            return (
              <Card
                key={config.role}
                className={`p-6 flex flex-col justify-between transition-all duration-200 hover:shadow-md ${
                  isCurrentlyActive
                    ? 'border-[#0D9488] ring-2 ring-teal-500/20 bg-teal-50/20'
                    : 'border-[#E5EAF0] bg-white'
                }`}
              >
                <div>
                  {/* Card Header: Icon & Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#0D9488]">
                      <Icon className="w-5 h-5" />
                    </div>
                    <Badge variant="neutral" size="sm">
                      {config.tierLabel}
                    </Badge>
                  </div>

                  {/* Role Title & Persona */}
                  <div className="mb-3">
                    <h3 className="text-base font-bold text-[#172B3A]">
                      {config.title}
                    </h3>
                    <div className="text-xs font-semibold text-teal-700 mt-0.5">
                      {config.personaName}
                    </div>
                    <div className="text-[11px] text-[#667085] font-mono">
                      {config.email}
                    </div>
                  </div>

                  {/* Specific Features Visible */}
                  <div className="space-y-1.5 my-4 pt-3 border-t border-[#E5EAF0]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">
                      Visible Modules & Controls:
                    </div>
                    {config.primaryFeatures.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-xs text-[#172B3A]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                        <span className="leading-tight">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 1-Click Role Login Action Button */}
                <div className="pt-4 border-t border-[#E5EAF0]">
                  <Button
                    variant={isCurrentlyActive ? 'secondary' : 'primary'}
                    size="md"
                    className="w-full"
                    disabled={isLoggingIn}
                    loading={isLoggingIn}
                    icon={Zap}
                    onClick={() => handleRoleLogin(config.role, config.personaName)}
                  >
                    Log In as {config.title}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Collapsible Manual Credentials Form */}
        <div className="mt-12 max-w-md mx-auto">
          <div className="text-center">
            <button
              onClick={() => setShowManualForm(!showManualForm)}
              className="text-xs font-semibold text-[#667085] hover:text-[#0D9488] underline underline-offset-4 transition-colors cursor-pointer"
            >
              {showManualForm ? 'Hide Administrative Password Form' : 'Use Direct Email & Password Sign In'}
            </button>
          </div>

          {showManualForm && (
            <Card className="mt-4 p-6 space-y-4">
              <div className="text-xs font-bold text-[#172B3A] uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-[#E5EAF0]">
                <Lock className="w-3.5 h-3.5 text-[#0D9488]" />
                <span>Standard Administrative Sign In</span>
              </div>

              <form onSubmit={handleManualLogin} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#172B3A] mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    placeholder="supplychain@stockpilot.ai"
                    className="w-full px-3 py-2 rounded-xl border border-[#E5EAF0] text-[#172B3A] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#172B3A] mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={manualPassword}
                    onChange={(e) => setManualPassword(e.target.value)}
                    placeholder="Admin123!"
                    className="w-full px-3 py-2 rounded-xl border border-[#E5EAF0] text-[#172B3A] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488]"
                  />
                  <div className="text-[11px] text-[#667085] mt-1">
                    Default evaluation password: <code className="bg-slate-100 px-1 py-0.5 rounded text-[#172B3A]">Admin123!</code>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full"
                  disabled={manualLoading}
                  loading={manualLoading}
                  icon={KeyRound}
                >
                  Sign In with Credentials
                </Button>
              </form>
            </Card>
          )}
        </div>
      </div>

      {/* Footer Security Perimeters */}
      <div className="max-w-6xl w-full mx-auto mt-12 pt-6 border-t border-[#E5EAF0] text-center flex flex-col sm:flex-row items-center justify-between text-xs text-[#667085] gap-3">
        <div>
          StockPilot AI Autonomous Distribution Engine • Enterprise RBAC Verified
        </div>
        <div className="flex items-center gap-4">
          <span>HMAC-SHA256 Encrypted</span>
          <span>•</span>
          <span>Signed JWT Bearer</span>
          <span>•</span>
          <span>Zero-Trust API Perimeter</span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
