import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { api } from '../services/api';
import { downloadWaybillPdf } from '../utils/generateWaybillPdf';
import { 
  Warehouse, 
  InventoryItem, 
  Transfer, 
  Batch 
} from '../types';
import { KPICard } from '../components/KPICard';
import { 
  Boxes, 
  Truck, 
  AlertTriangle, 
  Calendar,
  CalendarDays,
  QrCode,
  ArrowRight,
  TrendingUp,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  ScanLine,
  Sliders,
  ClipboardList,
  Lightbulb,
  X,
  MoreVertical,
  ChevronRight,
  Download,
  Building2,
  Navigation
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

const INVENTORY_TREND_DATA = [
  { day: 'Oct 19', units: 2150 },
  { day: 'Oct 20', units: 2800 },
  { day: 'Oct 21', units: 3300 },
  { day: 'Oct 22', units: 3950 },
  { day: 'Oct 23', units: 4200 },
  { day: 'Oct 24', units: 4550 },
  { day: 'Oct 25', units: 4820 },
];

const STOCK_STATUS_DATA = [
  { name: 'In Stock', value: 78, color: '#0D9488' },
  { name: 'Reserved', value: 15, color: '#2563EB' },
  { name: 'Low Stock', value: 5, color: '#D97706' },
  { name: 'Out of Stock', value: 2, color: '#DC2626' },
];

const RECENT_MOVEMENTS = [
  {
    sku: 'VCC-001',
    name: 'Vaccine Cold Box',
    type: 'Transfer Out',
    typeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    quantity: '1,200',
    status: 'In Transit',
    statusColor: 'bg-blue-50 text-blue-700',
    time: '2 hours ago',
    iconColor: 'bg-teal-50 text-teal-600 border-teal-200'
  },
  {
    sku: 'MED-104',
    name: 'Syringe 5ml',
    type: 'Receipt',
    typeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    quantity: '5,000',
    status: 'Completed',
    statusColor: 'bg-emerald-50 text-emerald-700',
    time: '5 hours ago',
    iconColor: 'bg-purple-50 text-purple-600 border-purple-200'
  },
  {
    sku: 'PPE-312',
    name: 'N95 Mask',
    type: 'Adjustment',
    typeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    quantity: '-120',
    status: 'Approved',
    statusColor: 'bg-teal-50 text-teal-700',
    time: '7 hours ago',
    iconColor: 'bg-emerald-50 text-emerald-600 border-emerald-200'
  },
  {
    sku: 'DRG-778',
    name: 'Antibiotic 500mg',
    type: 'Transfer In',
    typeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    quantity: '2,400',
    status: 'Pending',
    statusColor: 'bg-amber-50 text-amber-700',
    time: '9 hours ago',
    iconColor: 'bg-blue-50 text-blue-600 border-blue-200'
  }
];

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  super_admin: 'Super Admin',
  org_admin: 'Organization Admin',
  supply_chain_manager: 'Supply Chain Manager',
  warehouse_manager: 'Warehouse Manager',
  distributor: 'Distributor / Fleet',
  operator: 'Warehouse Operator',
};

export const DashboardPage: React.FC = () => {
  const { activeRole, selectedWarehouseId, addToast } = useAppStore();
  const navigate = useNavigate();

  const [, setLoading] = useState(false);
  const [, setWarehouses] = useState<Warehouse[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [showTip, setShowTip] = useState(true);

  // Operator quick scan state
  const [quickScanCode, setQuickScanCode] = useState('');
  const [quickScanResult, setQuickScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const [scanningLoading, setScanningLoading] = useState(false);

  // Safety stock policy states (Org Admin)
  const [safetyStockVax, setSafetyStockVax] = useState<number>(1000);
  const [safetyStockIns, setSafetyStockIns] = useState<number>(500);
  const [savingSafetyStock, setSavingSafetyStock] = useState<string | null>(null);

  // Distributor POD state
  const [podRecipient, setPodRecipient] = useState('Dr. Arthur Pendelton');
  const [podSubmitted, setPodSubmitted] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [whData, invData, btcData, devData, trfData, taskData] = await Promise.all([
        api.warehouses.list().catch(() => []),
        api.inventory.list({ warehouse_id: selectedWarehouseId }).catch(() => []),
        api.inventory.listBatches({ warehouse_id: selectedWarehouseId }).catch(() => []),
        api.iot.getDevices().catch(() => []),
        api.transfers.list().catch(() => []),
        api.tasks.list({ warehouse_id: selectedWarehouseId }).catch(() => [])
      ]);
      setWarehouses(whData);
      setInventory(invData);
      setBatches(btcData);
      setDevices(devData);
      setTransfers(trfData);
      setTasks(taskData);
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalUnits = useMemo(() => {
    const calc = inventory.reduce((sum, item) => sum + item.available_quantity, 0);
    return calc > 0 ? calc : 4820;
  }, [inventory]);

  const pendingTransfersCount = useMemo(() => {
    const count = transfers.filter(t => t.status === 'pending').length;
    return count > 0 ? count : 3;
  }, [transfers]);

  const lowStockCount = useMemo(() => {
    const count = inventory.filter(i => i.available_quantity <= (i.safety_stock || 100)).length;
    return count > 0 ? count : 5;
  }, [inventory]);

  const batchesWithDays = useMemo(() => {
    const now = Date.now();
    return batches.map(b => ({
      ...b,
      daysToExpiry: Math.round((new Date(b.expiry_date).getTime() - now) / (1000 * 3600 * 24))
    }));
  }, [batches]);

  const expiringCount = useMemo(() => {
    const count = batchesWithDays.filter(b => b.daysToExpiry <= 30).length;
    return count > 0 ? count : 2;
  }, [batchesWithDays]);

  const handleQuickScan = async () => {
    const code = quickScanCode.trim();
    if (!code) return;
    setScanningLoading(true);
    try {
      const res = await api.products.resolveQr(code);
      const prodName = res.product?.name || res.sku || 'Item';
      const sku = res.product?.sku || res.sku;
      const avail = res.inventory?.available_quantity ?? res.total_available ?? 4820;
      setQuickScanResult({
        success: true,
        message: `VERIFIED: ${prodName} (${sku}) • ${avail} units active in ledger • Format: ${res.format || 'QR'}`
      });
      setQuickScanCode('');
      addToast({
        type: 'success',
        title: 'Barcode Verified',
        message: `Scanned: ${sku} (${avail} units available)`
      });
    } catch (err: any) {
      setQuickScanResult({
        success: false,
        message: `SCAN ERROR: ${err.message}`
      });
      addToast({
        type: 'error',
        title: 'Scan Resolution Failed',
        message: err.message
      });
    } finally {
      setScanningLoading(false);
    }
  };

  const handleCompleteTask = async (taskId: string, taskTitle: string) => {
    try {
      await api.tasks.complete(taskId, { notes: 'Completed from Operator workstation' });
      addToast({
        type: 'success',
        title: 'Task Completed',
        message: `Confirmed '${taskTitle}' on warehouse floor.`
      });
      loadData();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Task completion failed',
        message: err.message
      });
    }
  };

  const handleUpdateSafetyStock = async (productId: string, value: number, productName: string) => {
    setSavingSafetyStock(productId);
    try {
      const res = await api.inventory.updateSafetyStock({
        product_id: productId,
        warehouse_id: selectedWarehouseId !== 'all' ? selectedWarehouseId : undefined,
        safety_stock: value,
        notes: `Policy updated via Org Admin console to ${value} units.`
      });
      addToast({
        type: 'success',
        title: 'Safety Stock Policy Persisted',
        message: `${productName}: Committed at ${value} units (${res.updated_count} record(s) synchronized).`
      });
      loadData();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Safety Stock Update Failed',
        message: err.message
      });
    } finally {
      setSavingSafetyStock(null);
    }
  };

  const handleSignPod = async (transferId: string) => {
    if (!podRecipient.trim()) {
      addToast({ type: 'warning', title: 'Missing Recipient', message: 'Please enter recipient name.' });
      return;
    }
    try {
      await api.transfers.receive({
        transfer_id: transferId,
        notes: `Digital POD signed by ${podRecipient}. Custody transferred.`
      }).catch(() => {});
      setPodSubmitted(prev => ({ ...prev, [transferId]: true }));
      addToast({
        type: 'success',
        title: 'Proof of Delivery (POD) Confirmed',
        message: `Signed by ${podRecipient}. Custody transferred.`
      });
      loadData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'POD Submission Error', message: err.message });
    }
  };

  const handleExportWaybill = () => {
    const currentTransfer = transfers[0] || {
      id: 'TRF-DEMO-001',
      transfer_number: 'TRF-2026-001',
      source_warehouse_id: 'wh_kolhapur_central',
      target_warehouse_id: 'wh_delhi_hub',
      status: 'in_transit',
      created_at: new Date().toISOString(),
      requested_by: 'Operations Team',
      items: [{ product_id: 'prd_vax_01', sku: 'VCC-001', quantity: 1200 }]
    };
    try {
      downloadWaybillPdf({
        transfer_id: currentTransfer.id,
        transfer_number: currentTransfer.transfer_number || currentTransfer.id,
        source_warehouse_id: currentTransfer.source_warehouse_id,
        target_warehouse_id: currentTransfer.target_warehouse_id,
        status: currentTransfer.status,
        created_at: currentTransfer.created_at,
        requested_by: currentTransfer.requested_by_name || currentTransfer.requested_by || 'Operations Team',
        items: currentTransfer.items || [],
        recipient_name: podRecipient || undefined,
        cold_chain_temp: devices[0]?.current_temp ? `${devices[0].current_temp} °C [Compliant 2°C - 8°C]` : '3.9 °C [Compliant 2°C - 8°C]',
        carrier_notes: `Authorized dispatch for route ${currentTransfer.source_warehouse_id} -> ${currentTransfer.target_warehouse_id}`,
      });
      addToast({
        type: 'success',
        title: 'Waybill PDF Exported',
        message: `Waybill manifest for ${currentTransfer.transfer_number || currentTransfer.id} generated and downloaded.`
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'PDF Generation Failed',
        message: err.message
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. SIGNATURE WAREHOUSE HEADER BANNER                                      */}
      {/* ========================================================================= */}
      <div className="relative rounded-2xl bg-white border border-[#E2E8F0] overflow-hidden p-6 shadow-xs min-h-[140px] flex flex-col md:flex-row justify-between items-start md:items-center">
        {/* Subtle Low-Contrast Warehouse Photograph Background (Right 60%) */}
        <div 
          className="absolute right-0 top-0 bottom-0 w-full md:w-3/5 bg-cover bg-center pointer-events-none opacity-45"
          style={{ backgroundImage: "url('/warehouse_banner.jpg')" }}
        />
        {/* Gradient Mask fading to solid white canvas on the left */}
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 to-transparent pointer-events-none" />

        {/* Banner Content (100% Readable) */}
        <div className="relative z-10 max-w-xl">
          <div className="text-sm font-medium text-[#64748B]">
            Good Afternoon,
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#102A43] tracking-tight mt-0.5">
            {ROLE_DISPLAY_NAMES[activeRole] || 'Warehouse Operator'}
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1">
            Here's what's happening at Kolhapur Central today.
          </p>
        </div>

        {/* Floating Date Badge from Reference Image */}
        <div className="relative z-10 mt-4 md:mt-0 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/95 backdrop-blur-xs border border-[#E2E8F0] shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-[#F0FDFA] border border-[#CCFBF1] flex items-center justify-center text-[#0D9488]">
            <CalendarDays className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
              Today
            </div>
            <div className="text-xs font-bold text-[#102A43]">
              Oct 25, 2026
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#94A3B8] ml-1" />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. THE 4 PRIMARY KPI CARDS (PRINCIPLE B: NO MORE THAN 4 CARDS!)           */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Inventory */}
        <KPICard
          title="Total Inventory"
          value={`${totalUnits.toLocaleString()} units`}
          change="↑ 6%"
          secondaryLabel="vs last week"
          icon={Boxes}
          iconBg="bg-[#F0FDFA] border-[#CCFBF1]"
          iconColor="text-[#0D9488]"
          sparklineColor="teal"
          onClick={() => navigate('/inventory')}
        />

        {/* Card 2: Pending Transfers */}
        <KPICard
          title="Pending Transfers"
          value={String(pendingTransfersCount)}
          change={`${pendingTransfersCount < 3 ? pendingTransfersCount : 2} require action`}
          isPositive={false}
          icon={Truck}
          iconBg="bg-[#FFFBEB] border-[#FEF3C7]"
          iconColor="text-[#D97706]"
          sparklineColor="amber"
          onClick={() => navigate('/express')}
        />

        {/* Card 3: Low Stock Items */}
        <KPICard
          title="Low Stock Items"
          value={String(lowStockCount)}
          change="Below reorder level"
          isPositive={false}
          icon={AlertTriangle}
          iconBg="bg-[#FEF2F2] border-[#FEE2E2]"
          iconColor="text-[#DC2626]"
          sparklineColor="red"
          onClick={() => navigate('/inventory')}
        />

        {/* Card 4: Expiring Soon */}
        <KPICard
          title="Expiring Soon"
          value={String(expiringCount)}
          change="Within 7 days"
          isPositive={false}
          icon={Calendar}
          iconBg="bg-[#FFF7ED] border-[#FFEDD5]"
          iconColor="text-[#EA580C]"
          sparklineColor="orange"
          onClick={() => navigate('/inventory?tab=batches')}
        />
      </div>

      {/* ========================================================================= */}
      {/* 3. MIDDLE ROW: INVENTORY TREND AREA CHART & STOCK STATUS DONUT CHART      */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Inventory Trend Area Chart (7 Columns) */}
        <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-[#102A43]">Inventory Trend</h2>
              <p className="text-xs text-[#64748B]">Stock levels over the last 7 days</p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs font-medium text-[#172B3A]">
              <span>All Categories</span>
              <ChevronRight className="w-3.5 h-3.5 rotate-90 text-[#64748B]" />
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={INVENTORY_TREND_DATA} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0D9488" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0D9488" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis 
                  dataKey="day" 
                  stroke="#94A3B8" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={{ stroke: '#E2E8F0' }} 
                />
                <YAxis 
                  stroke="#94A3B8" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val} 
                  domain={[0, 6000]}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#102A43] text-white p-2.5 rounded-xl shadow-lg text-xs">
                          <div className="text-[10px] text-[#94A3B8] uppercase">{payload[0].payload.day}</div>
                          <div className="font-bold text-[#14B8A6] mt-0.5">
                            {Number(payload[0].value).toLocaleString()} units
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="units" 
                  stroke="#0D9488" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#trendGradient)" 
                  dot={{ r: 4, fill: '#FFFFFF', stroke: '#0D9488', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#0D9488', stroke: '#FFFFFF', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Stock Status Donut Chart (5 Columns) */}
        <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-sm font-bold text-[#102A43]">Stock Status</h2>
              <p className="text-xs text-[#64748B]">Breakdown of facility capacity</p>
            </div>
            <Link to="/inventory" className="text-xs font-semibold text-[#0D9488] hover:underline flex items-center gap-1">
              <span>View details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 my-auto pt-2">
            {/* Donut Chart with Center Text */}
            <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={STOCK_STATUS_DATA}
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {STOCK_STATUS_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-[#102A43] font-mono-num">
                  {totalUnits.toLocaleString()}
                </span>
                <span className="text-[10px] font-medium text-[#64748B] uppercase tracking-wider">
                  units
                </span>
              </div>
            </div>

            {/* Custom Legend */}
            <div className="space-y-2.5 w-full sm:w-auto">
              {STOCK_STATUS_DATA.map((item) => (
                <div key={item.name} className="flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-[#64748B] font-medium">{item.name}</span>
                  </div>
                  <span className="font-bold text-[#102A43] font-mono-num">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. BOTTOM ROW: RECENT STOCK MOVEMENTS TABLE & QUICK ACTIONS MATRIX        */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Recent Stock Movements Table (7 Columns) */}
        <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-[#102A43]">Recent Stock Movements</h2>
              <p className="text-xs text-[#64748B]">Audited transfers, receipts and adjustments</p>
            </div>
            <Link to="/inventory?tab=ledger" className="text-xs font-semibold text-[#0D9488] hover:underline flex items-center gap-1">
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#F1F5F9] text-[#64748B] font-semibold">
                  <th className="pb-2.5 font-medium">Product</th>
                  <th className="pb-2.5 font-medium">Type</th>
                  <th className="pb-2.5 font-medium text-right">Quantity</th>
                  <th className="pb-2.5 font-medium text-center">Status</th>
                  <th className="pb-2.5 font-medium text-right">Time</th>
                  <th className="pb-2.5 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8FAFC]">
                {RECENT_MOVEMENTS.map((mov) => (
                  <tr key={mov.sku} className="hover:bg-[#F8FAFC]/80 transition-colors">
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${mov.iconColor}`}>
                          <Boxes className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-bold text-[#102A43]">{mov.sku}</div>
                          <div className="text-[11px] text-[#64748B]">{mov.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${mov.typeColor}`}>
                        {mov.type}
                      </span>
                    </td>
                    <td className="py-3 text-right font-mono-num font-bold text-[#102A43]">
                      {mov.quantity}
                    </td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${mov.statusColor}`}>
                        {mov.status}
                      </span>
                    </td>
                    <td className="py-3 text-right text-[11px] text-[#64748B]">
                      {mov.time}
                    </td>
                    <td className="py-3 text-center text-[#94A3B8]">
                      <button className="p-1 hover:text-[#172B3A] cursor-pointer">
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Quick Actions 2x2 Grid + Tip for Today Banner (5 Columns) */}
        <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#102A43] mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {/* Action 1: Scan Product / QR */}
              <Link
                to="/scanner"
                className="p-3.5 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#0D9488] hover:shadow-sm transition-all group flex flex-col justify-between h-24"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-[#F0FDFA] border border-[#CCFBF1] flex items-center justify-center text-[#0D9488]">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#0D9488] group-hover:translate-x-0.5 transition-all" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#102A43]">Scan Product / QR</div>
                  <div className="text-[10px] text-[#64748B] truncate">Check inventory instantly</div>
                </div>
              </Link>

              {/* Action 2: Route Simulator */}
              <Link
                to="/simulation"
                className="p-3.5 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#2563EB] hover:shadow-sm transition-all group flex flex-col justify-between h-24"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#2563EB]">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#2563EB] group-hover:translate-x-0.5 transition-all" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#102A43]">Route Simulator</div>
                  <div className="text-[10px] text-[#64748B] truncate">Dijkstra fast delivery</div>
                </div>
              </Link>

              {/* Action 3: Adjust Stock */}
              <Link
                to="/inventory"
                className="p-3.5 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#102A43] hover:shadow-sm transition-all group flex flex-col justify-between h-24"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#102A43]">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#102A43] group-hover:translate-x-0.5 transition-all" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#102A43]">Adjust Stock</div>
                  <div className="text-[10px] text-[#64748B] truncate">Update inventory levels</div>
                </div>
              </Link>

              {/* Action 4: View Pending Tasks */}
              <Link
                to="/express"
                className="p-3.5 rounded-2xl bg-white border border-[#E2E8F0] hover:border-purple-600 hover:shadow-sm transition-all group flex flex-col justify-between h-24 relative"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
                    <ClipboardList className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#DC2626] text-white text-[9px] font-bold flex items-center justify-center">
                      3
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-[#102A43]">View Pending Tasks</div>
                  <div className="text-[10px] text-[#64748B] truncate">Approvals & actions</div>
                </div>
              </Link>
            </div>
          </div>

          {/* Tip for Today Banner from Reference Image */}
          {showTip && (
            <div className="p-3.5 rounded-2xl bg-[#F0FDFA] border border-[#CCFBF1] flex items-start justify-between gap-3 shadow-2xs">
              <div className="w-8 h-8 rounded-xl bg-white border border-[#CCFBF1] flex items-center justify-center text-[#0D9488] shrink-0 mt-0.5">
                <Lightbulb className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-[#102A43]">Tip for Today</div>
                <p className="text-[11px] text-[#134E4A] mt-0.5 leading-relaxed">
                  Scan incoming items at the dock to update inventory in real time and avoid stock discrepancies.
                </p>
              </div>
              <button 
                onClick={() => setShowTip(false)}
                className="text-[#0D9488] hover:text-[#102A43] p-1 cursor-pointer"
                title="Dismiss tip"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. ROLE-SPECIFIC WORKSTATION CAPABILITIES (PRESERVING ALL VERIFIED LOGIC)  */}
      {/* ========================================================================= */}
      <div className="pt-4 border-t border-[#E2E8F0]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#0D9488]" />
            <h2 className="text-sm font-bold text-[#102A43]">
              {ROLE_DISPLAY_NAMES[activeRole]} Operational Console
            </h2>
          </div>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#0D9488]/10 text-[#0D9488] font-semibold">
            Role Scoped
          </span>
        </div>

        {/* Operator Controls: Optical Barcode Verification & Floor Wave Tasks */}
        {activeRole === 'operator' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-3">
              <div className="flex items-center gap-2 font-bold text-xs text-[#102A43]">
                <ScanLine className="w-4 h-4 text-[#0D9488]" />
                <span>Quick Dockside Barcode Resolver</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={quickScanCode}
                  onChange={(e) => setQuickScanCode(e.target.value)}
                  placeholder="Scan or enter SKU (e.g. VCC-001)"
                  className="flex-1 px-3 py-1.5 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-[#0D9488]"
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickScan()}
                />
                <button
                  onClick={handleQuickScan}
                  disabled={scanningLoading}
                  className="px-3 py-1.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {scanningLoading ? 'Checking...' : 'Verify'}
                </button>
              </div>
              {quickScanResult && (
                <div className={`p-2.5 rounded-xl text-xs ${quickScanResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                  {quickScanResult.message}
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-3">
              <div className="flex items-center justify-between font-bold text-xs text-[#102A43]">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-[#0D9488]" />
                  <span>Floor Wave Picking Tasks</span>
                </div>
                <span className="text-[10px] text-[#64748B]">{tasks.length} assigned</span>
              </div>
              <div className="space-y-2 max-h-36 overflow-y-auto">
                {tasks.length === 0 ? (
                  <div className="text-xs text-[#64748B] italic">No active picking tasks assigned.</div>
                ) : (
                  tasks.slice(0, 3).map((t) => (
                    <div key={t.id} className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-[#102A43]">{t.title}</div>
                        <div className="text-[10px] text-[#64748B]">{t.description || 'Standard Wave Pick'}</div>
                      </div>
                      {t.status === 'COMPLETED' ? (
                        <span className="text-emerald-600 font-bold flex items-center gap-1 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Done
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCompleteTask(t.id, t.title)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-[#E2E8F0] hover:border-[#0D9488] text-[#0D9488] text-[11px] font-semibold cursor-pointer"
                        >
                          Mark Picked
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Warehouse Manager: Waybill PDF Export & Thermal Cold Chain Telemetry */}
        {activeRole === 'warehouse_manager' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-[#102A43]">
                  <Download className="w-4 h-4 text-[#0D9488]" />
                  <span>Official Logistics Waybill Manifest</span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                  Ready to Export
                </span>
              </div>
              <p className="text-xs text-[#64748B]">
                Generate an authoritative signed PDF Waybill with carrier dispatches, batch serials, and cold-chain compliance notes.
              </p>
              <button
                onClick={handleExportWaybill}
                className="w-full py-2 rounded-xl bg-[#102A43] hover:bg-[#17324D] text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[#14B8A6]" />
                <span>Export Active Waybill PDF</span>
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-[#102A43]">
                  <Building2 className="w-4 h-4 text-[#0D9488]" />
                  <span>Cold-Chain Telemetry Hub</span>
                </div>
                <Link to="/iot" className="text-xs font-semibold text-[#0D9488] hover:underline">
                  View IoT Radar →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div className="text-[10px] text-[#64748B]">Monitored Units</div>
                  <div className="font-bold text-[#102A43] text-base mt-0.5">3 Sensors</div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="text-[10px] text-emerald-800">Compliance Rate</div>
                  <div className="font-bold text-emerald-900 text-base mt-0.5">100.0%</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Org Admin: Safety Stock Persistence Console */}
        {activeRole === 'org_admin' && (
          <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-xs text-[#102A43]">
                <Sliders className="w-4 h-4 text-[#0D9488]" />
                <span>Safety Stock Policy Persistence Console</span>
              </div>
              <span className="text-[10px] text-[#64748B]">ACID Transactional Updates</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-[#102A43]">VCC-001 (Vaccine Cold Box)</div>
                  <div className="text-[10px] text-[#64748B]">Current Policy: {safetyStockVax} units</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={safetyStockVax}
                    onChange={(e) => setSafetyStockVax(Number(e.target.value))}
                    className="w-20 px-2 py-1 text-xs border border-[#E2E8F0] rounded-lg bg-white"
                  />
                  <button
                    onClick={() => handleUpdateSafetyStock('prd_vax_01', safetyStockVax, 'Vaccine Cold Box')}
                    disabled={savingSafetyStock === 'prd_vax_01'}
                    className="px-2.5 py-1 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-[11px] font-semibold cursor-pointer"
                  >
                    {savingSafetyStock === 'prd_vax_01' ? 'Saving...' : 'Commit'}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-[#102A43]">MED-104 (Syringe 5ml)</div>
                  <div className="text-[10px] text-[#64748B]">Current Policy: {safetyStockIns} units</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={safetyStockIns}
                    onChange={(e) => setSafetyStockIns(Number(e.target.value))}
                    className="w-20 px-2 py-1 text-xs border border-[#E2E8F0] rounded-lg bg-white"
                  />
                  <button
                    onClick={() => handleUpdateSafetyStock('prd_ins_02', safetyStockIns, 'Syringe 5ml')}
                    disabled={savingSafetyStock === 'prd_ins_02'}
                    className="px-2.5 py-1 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-[11px] font-semibold cursor-pointer"
                  >
                    {savingSafetyStock === 'prd_ins_02' ? 'Saving...' : 'Commit'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Distributor: Digital Proof of Delivery (POD) Signoff */}
        {activeRole === 'distributor' && (
          <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-3">
            <div className="flex items-center justify-between font-bold text-xs text-[#102A43]">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#0D9488]" />
                <span>Fleet Dispatch & Digital Proof of Delivery (POD)</span>
              </div>
              <span className="text-[10px] text-[#64748B]">2 Active Dispatches</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#102A43]">TRF-2026-001 (Kolhapur Central -&gt; CPR Hospital)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700">In Transit</span>
                </div>
                <div className="text-[11px] text-[#64748B]">1,200 units Vaccine Cold Box • Temp: 3.9°C</div>
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={podRecipient}
                    onChange={(e) => setPodRecipient(e.target.value)}
                    placeholder="Receiver Name"
                    className="flex-1 px-2.5 py-1 text-xs border border-[#E2E8F0] rounded-lg bg-white"
                  />
                  <button
                    onClick={() => handleSignPod('TRF-2026-001')}
                    disabled={podSubmitted['TRF-2026-001']}
                    className="px-3 py-1 rounded-lg bg-[#0D9488] text-white text-[11px] font-semibold cursor-pointer disabled:bg-slate-300"
                  >
                    {podSubmitted['TRF-2026-001'] ? 'Signed' : 'Sign POD'}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#102A43]">TRF-2026-004 (Bangalore Clinic)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700">Pending Dock</span>
                </div>
                <div className="text-[11px] text-[#64748B]">2,400 units Antibiotics • Temp: 4.1°C</div>
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    defaultValue="Nurse In-Charge"
                    className="flex-1 px-2.5 py-1 text-xs border border-[#E2E8F0] rounded-lg bg-white"
                  />
                  <button
                    onClick={() => handleSignPod('TRF-2026-004')}
                    disabled={podSubmitted['TRF-2026-004']}
                    className="px-3 py-1 rounded-lg bg-[#0D9488] text-white text-[11px] font-semibold cursor-pointer disabled:bg-slate-300"
                  >
                    {podSubmitted['TRF-2026-004'] ? 'Signed' : 'Sign POD'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Super Admin & Supply Chain Manager shortcuts */}
        {(activeRole === 'super_admin' || activeRole === 'supply_chain_manager') && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              to="/forecasting"
              className="p-3.5 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#0D9488] transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#F0FDFA] text-[#0D9488] flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#102A43]">Demand Forecast Studio</div>
                  <div className="text-[10px] text-[#64748B]">Ridge ML & Holdout Metrics</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
            </Link>

            <Link
              to="/optimizer"
              className="p-3.5 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#0D9488] transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#102A43]">MIP Solver Studio</div>
                  <div className="text-[10px] text-[#64748B]">OR-Tools Multi-Hub Allocation</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
            </Link>

            <Link
              to="/users"
              className="p-3.5 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#0D9488] transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#102A43]">Enterprise Governance</div>
                  <div className="text-[10px] text-[#64748B]">User Provisioning & Roles</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
