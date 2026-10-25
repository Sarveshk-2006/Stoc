import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { InventoryItem, InventoryBatch, InventoryMovement, Warehouse, Product } from '../types';
import { KPICard } from '../components/KPICard';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Skeleton } from '../components/ui/Skeleton';
import { 
  Boxes, 
  ArrowDownLeft, 
  ArrowUpRight, 
  FileText, 
  AlertTriangle, 
  Clock, 
  Building2,
  Search,
  Thermometer,
  ShieldCheck,
  X
} from 'lucide-react';

export const InventoryPage: React.FC = () => {
  const { selectedWarehouseId, addToast, activeRole } = useAppStore();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const initialTab = (searchParams.get('tab') as any) || 'inventory';
  const validTabs = ['inventory', 'batches', 'warehouses', 'ledger'];
  const [activeTab, setActiveTab] = useState<'inventory' | 'batches' | 'warehouses' | 'ledger'>(
    validTabs.includes(initialTab) ? initialTab : 'inventory'
  );
  const [searchFilter, setSearchFilter] = useState(searchParams.get('search') || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
    const q = searchParams.get('search');
    if (q !== null) {
      setSearchFilter(q);
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'inventory' | 'batches' | 'warehouses' | 'ledger') => {
    setActiveTab(tab);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tab);
    setSearchParams(newParams);
  };

  const canReceive = ['super_admin', 'org_admin', 'supply_chain_manager', 'warehouse_manager', 'operator'].includes(activeRole);
  const canDispatch = ['super_admin', 'org_admin', 'warehouse_manager'].includes(activeRole);
  const canAdjust = ['super_admin', 'org_admin', 'warehouse_manager'].includes(activeRole);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Action Modals
  const [actionModal, setActionModal] = useState<'receive' | 'dispatch' | 'adjust' | null>(null);
  const [formWarehouse, setFormWarehouse] = useState('wh_chicago_01');
  const [formProduct, setFormProduct] = useState('prd_vax_01');
  const [formBatchNumber, setFormBatchNumber] = useState('');
  const [formSupplier, setFormSupplier] = useState('Pfizer-BioNTech-GmbH');
  const [formQuantity, setFormQuantity] = useState(100);
  const [formStorageBin, setFormStorageBin] = useState('CR-1-A08');
  const [formDestination, setFormDestination] = useState('dest_boston_01');
  const [formReason, setFormReason] = useState('Routine replenishment fulfillment');
  const [formExpiryDate, setFormExpiryDate] = useState('2026-11-30');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [invData, batData, movData, whData, prdData] = await Promise.all([
        api.inventory.list({ warehouse_id: selectedWarehouseId }).catch(() => []),
        api.inventory.listBatches({ warehouse_id: selectedWarehouseId }).catch(() => []),
        api.inventory.listMovements(50).catch(() => []),
        api.warehouses.list().catch(() => []),
        api.products.list().catch(() => []),
      ]);
      setItems(invData);
      setBatches(batData);
      setMovements(movData);
      setWarehouses(whData);
      setProducts(prdData);
      if (whData.length > 0) setFormWarehouse(whData[0].id);
      if (prdData.length > 0) setFormProduct(prdData[0].id);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Data load error', message: err.message });
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouseId, addToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const batchesWithDays = useMemo(() => {
    const now = Date.now();
    return batches.map(b => ({
      ...b,
      daysLeft: Math.round((new Date(b.expiry_date).getTime() - now) / (1000 * 3600 * 24))
    }));
  }, [batches]);

  const nearExpiryBatches = useMemo(() => {
    return batchesWithDays.filter(b => b.daysLeft <= 30);
  }, [batchesWithDays]);

  const lowStockItemsCount = useMemo(() => {
    return items.filter(i => i.available_quantity <= i.safety_stock).length;
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!searchFilter.trim()) return items;
    const q = searchFilter.toLowerCase();
    return items.filter(i => 
      i.product_name.toLowerCase().includes(q) ||
      i.product_sku.toLowerCase().includes(q) ||
      i.warehouse_name.toLowerCase().includes(q)
    );
  }, [items, searchFilter]);

  const filteredBatches = useMemo(() => {
    if (!searchFilter.trim()) return batchesWithDays;
    const q = searchFilter.toLowerCase();
    return batchesWithDays.filter(b => 
      b.batch_number.toLowerCase().includes(q) ||
      b.product_name.toLowerCase().includes(q) ||
      b.supplier_reference.toLowerCase().includes(q) ||
      b.warehouse_name.toLowerCase().includes(q)
    );
  }, [batchesWithDays, searchFilter]);

  const filteredWarehouses = useMemo(() => {
    if (!searchFilter.trim()) return warehouses;
    const q = searchFilter.toLowerCase();
    return warehouses.filter(w =>
      w.name.toLowerCase().includes(q) ||
      w.code.toLowerCase().includes(q) ||
      w.city.toLowerCase().includes(q) ||
      w.state.toLowerCase().includes(q)
    );
  }, [warehouses, searchFilter]);

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const correlationId = `WEB-ACT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    try {
      if (actionModal === 'receive') {
        await api.inventory.receiveStock({
          correlation_id: correlationId,
          warehouse_id: formWarehouse,
          product_id: formProduct,
          batch_number: formBatchNumber || `BN-AUT-${Date.now().toString().slice(-4)}`,
          supplier_reference: formSupplier,
          mfg_date: '2026-01-01',
          expiry_date: formExpiryDate,
          quantity: formQuantity,
          unit_cost: 22.50,
          storage_bin: formStorageBin,
        });
        addToast({ type: 'success', title: 'Stock Receipt Recorded', message: `Added ${formQuantity} units to batch.` });
      } else if (actionModal === 'dispatch') {
        await api.inventory.dispatchStock({
          correlation_id: correlationId,
          warehouse_id: formWarehouse,
          product_id: formProduct,
          destination_id: formDestination,
          quantity: formQuantity,
          reason: formReason,
        });
        addToast({ type: 'success', title: 'Stock Dispatched', message: `Dispatched ${formQuantity} units via FEFO.` });
      } else if (actionModal === 'adjust') {
        const matchingBatch = batches.find(b => b.warehouse_id === formWarehouse && b.product_id === formProduct);
        if (!matchingBatch) throw new Error('No matching batch found in selected warehouse.');
        await api.inventory.adjustStock({
          correlation_id: correlationId,
          warehouse_id: formWarehouse,
          product_id: formProduct,
          batch_id: matchingBatch.id,
          new_quantity: formQuantity,
          reason: formReason,
        });
        addToast({ type: 'warning', title: 'Cycle Count Reconciled', message: `Adjusted quantity to ${formQuantity}.` });
      }

      setActionModal(null);
      loadAll();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Operation rejected', message: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <PageHeader
        category="Multi-Echelon Warehousing & FEFO Controls"
        title="Inventory Catalog & Expiry Ledger"
        subtitle="Authoritative transaction engine with strict First-Expired-First-Out (FEFO) pallet rotation and append-only audit trail."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {canReceive && (
              <Button
                variant="primary"
                size="sm"
                icon={ArrowDownLeft}
                onClick={() => setActionModal('receive')}
              >
                Receive Stock
              </Button>
            )}
            {canDispatch && (
              <Button
                variant="outline"
                size="sm"
                icon={ArrowUpRight}
                onClick={() => setActionModal('dispatch')}
              >
                Dispatch Stock
              </Button>
            )}
            {canAdjust && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActionModal('adjust')}
              >
                Cycle Count
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Monitored Batches"
          value={batches.length}
          subtitle="Active supplier lot numbers"
          statusDotColor="bg-teal-500"
          icon={Boxes}
        />
        <KPICard
          title="Near Expiry Batches (<30d)"
          value={nearExpiryBatches.length}
          subtitle="FEFO high-priority liquidation"
          change={nearExpiryBatches.length > 0 ? "Urgent FEFO" : "Nominal"}
          isPositive={nearExpiryBatches.length === 0}
          statusDotColor={nearExpiryBatches.length > 0 ? "bg-amber-500" : "bg-emerald-500"}
          icon={Clock}
        />
        <KPICard
          title="Safety Stock Alerts"
          value={lowStockItemsCount}
          subtitle="Below safety buffer threshold"
          change={lowStockItemsCount > 0 ? "Action Req" : "Compliant"}
          isPositive={lowStockItemsCount === 0}
          statusDotColor={lowStockItemsCount > 0 ? "bg-rose-500" : "bg-emerald-500"}
          icon={AlertTriangle}
        />
        <KPICard
          title="Audit Transactions"
          value={movements.length}
          subtitle="Append-only immutable records"
          statusDotColor="bg-blue-500"
          icon={FileText}
        />
      </div>

      {/* Tab Switcher & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-white border border-[#E5EAF0] rounded-xl w-fit shadow-2xs overflow-x-auto max-w-full">
          <button
            onClick={() => handleTabChange('inventory')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'inventory'
                ? 'bg-[#17324D] text-white shadow-xs'
                : 'text-[#667085] hover:text-[#172B3A] hover:bg-[#F7F9FC]'
            }`}
          >
            Warehouse Aggregates ({items.length})
          </button>
          <button
            onClick={() => handleTabChange('batches')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'batches'
                ? 'bg-[#17324D] text-white shadow-xs'
                : 'text-[#667085] hover:text-[#172B3A] hover:bg-[#F7F9FC]'
            }`}
          >
            Batch & Expiry Controls ({batches.length})
            {nearExpiryBatches.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => handleTabChange('warehouses')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'warehouses'
                ? 'bg-[#17324D] text-white shadow-xs'
                : 'text-[#667085] hover:text-[#172B3A] hover:bg-[#F7F9FC]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Storage Hubs ({warehouses.length})
          </button>
          <button
            onClick={() => handleTabChange('ledger')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'ledger'
                ? 'bg-[#17324D] text-white shadow-xs'
                : 'text-[#667085] hover:text-[#172B3A] hover:bg-[#F7F9FC]'
            }`}
          >
            Append-Only Ledger ({movements.length})
          </button>
        </div>

        {/* In-table Search Bar */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search by SKU, product, batch..."
            className="w-full pl-8 pr-8 py-2 text-xs rounded-xl bg-white border border-[#E5EAF0] text-[#172B3A] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488] shadow-2xs"
          />
          <Search className="w-3.5 h-3.5 text-[#667085] absolute left-2.5 top-2.5" />
          {searchFilter && (
            <button
              onClick={() => setSearchFilter('')}
              className="absolute right-2.5 top-2.5 text-[#667085] hover:text-[#172B3A]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Warehouse Aggregates Table */}
      {activeTab === 'inventory' && (
        <Card className="overflow-hidden">
          <CardHeader
            title={`Warehouse Stock Aggregates (${filteredItems.length})`}
            subtitle="Available and reserved inventory balances across regional storage hubs."
          />
          <div className="overflow-x-auto">
            <table className="table-enterprise">
              <thead>
                <tr>
                  <th>Product & SKU</th>
                  <th>Warehouse Facility</th>
                  <th>Storage Handling</th>
                  <th className="text-right">Available Stock</th>
                  <th className="text-right">Reserved</th>
                  <th className="text-right">Safety Buffer</th>
                  <th>Inventory Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-6">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-xs text-[#667085]">
                      No inventory records found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const isLow = item.available_quantity <= item.safety_stock;
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="font-semibold text-[#172B3A]">{item.product_name}</div>
                          <span className="text-[11px] text-teal-700 font-mono">{item.product_sku}</span>
                        </td>
                        <td className="font-medium text-[#172B3A]">
                          {item.warehouse_name}
                        </td>
                        <td>
                          <Badge variant={item.handling === 'cold_chain' ? 'teal' : 'neutral'} size="sm">
                            {item.handling.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className={`text-right font-bold text-sm ${isLow ? 'text-amber-700' : 'text-teal-700'}`}>
                          {item.available_quantity.toLocaleString()} {item.unit}
                        </td>
                        <td className="text-right text-[#667085]">
                          {item.reserved_quantity}
                        </td>
                        <td className="text-right text-[#667085] font-medium">
                          {item.safety_stock}
                        </td>
                        <td>
                          <Badge variant={isLow ? 'warning' : 'success'} size="sm">
                            {isLow ? 'LOW BUFFER' : 'NOMINAL'}
                          </Badge>
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

      {/* Tab 2: Batch & FEFO Expiry Controls Table */}
      {activeTab === 'batches' && (
        <Card className="overflow-hidden">
          <CardHeader
            title={`Batch Lots & FEFO Expiry Matrix (${filteredBatches.length})`}
            subtitle="Batches scheduled for liquidation according to First-Expired-First-Out clinical prioritization."
          />
          <div className="overflow-x-auto">
            <table className="table-enterprise">
              <thead>
                <tr>
                  <th>Batch / Lot Number</th>
                  <th>Product</th>
                  <th>Warehouse Facility</th>
                  <th>Manufactured</th>
                  <th>Expiry Date</th>
                  <th className="text-right">Available Qty</th>
                  <th>Storage Bin</th>
                  <th>FEFO Urgency</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-6">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ) : filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-xs text-[#667085]">
                      No active batches found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map((b) => {
                    const daysLeft = b.daysLeft;
                    const isExpiringSoon = daysLeft <= 30;
                    return (
                      <tr key={b.id}>
                        <td>
                          <div className="font-mono font-bold text-teal-800">{b.batch_number}</div>
                          <div className="text-[11px] text-[#667085]">{b.supplier_reference}</div>
                        </td>
                        <td className="font-semibold text-[#172B3A]">
                          {b.product_name}
                        </td>
                        <td className="text-[#667085]">
                          {b.warehouse_name}
                        </td>
                        <td className="text-[#667085] font-mono text-xs">{b.mfg_date}</td>
                        <td className={`font-semibold font-mono text-xs ${isExpiringSoon ? 'text-amber-800' : 'text-[#172B3A]'}`}>
                          {b.expiry_date}
                        </td>
                        <td className="text-right font-bold text-[#172B3A]">
                          {b.quantity.toLocaleString()}
                        </td>
                        <td className="font-mono text-xs text-[#667085]">{b.storage_bin}</td>
                        <td>
                          <Badge variant={isExpiringSoon ? 'warning' : 'teal'} size="sm" dot={isExpiringSoon}>
                            {isExpiringSoon ? `EXPIRING (${daysLeft}d)` : 'ACTIVE ROTATION'}
                          </Badge>
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

      {/* Tab: Storage Facilities & Regional Warehouses */}
      {activeTab === 'warehouses' && (
        <Card className="overflow-hidden">
          <CardHeader
            title={`Regional Warehouses & Storage Hubs (${filteredWarehouses.length})`}
            subtitle="Operational capacity, cold-chain containment, and environmental certifications across active facilities."
          />
          <div className="overflow-x-auto">
            <table className="table-enterprise">
              <thead>
                <tr>
                  <th>Facility & Code</th>
                  <th>Location / Jurisdiction</th>
                  <th>Thermal Storage Types</th>
                  <th className="text-right">Pallet Capacity</th>
                  <th>Capacity Utilization</th>
                  <th className="text-right">Cold Storage Allotment</th>
                  <th>Operational Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-6">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ) : filteredWarehouses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-xs text-[#667085]">
                      No warehouse facilities found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredWarehouses.map((wh) => {
                    const used = wh.used_pallets || 0;
                    const total = wh.capacity_pallets || 1000;
                    const pct = Math.min(100, Math.round((used / total) * 100));
                    return (
                      <tr key={wh.id}>
                        <td>
                          <div className="font-semibold text-[#172B3A] flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-teal-600" />
                            {wh.name}
                          </div>
                          <span className="text-[11px] text-teal-700 font-mono">{wh.code || wh.id}</span>
                        </td>
                        <td>
                          <div className="text-[#172B3A] font-medium">{wh.city}, {wh.state}</div>
                          <div className="text-[11px] text-[#667085]">{wh.address}</div>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {wh.cold_storage_capacity > 0 && (
                              <Badge variant="teal" size="sm">
                                <Thermometer className="w-2.5 h-2.5 mr-0.5 inline" />
                                Cold Chain (2°-8°C)
                              </Badge>
                            )}
                            <Badge variant="neutral" size="sm">
                              Ambient / CRT
                            </Badge>
                          </div>
                        </td>
                        <td className="text-right font-bold text-[#172B3A]">
                          {wh.capacity_pallets.toLocaleString()} pallets
                        </td>
                        <td className="w-48">
                          <div className="flex items-center justify-between text-[11px] text-[#667085] mb-1 font-mono">
                            <span>{used} used</span>
                            <span className="font-semibold text-[#172B3A]">{pct}%</span>
                          </div>
                          <div className="w-full bg-[#E5EAF0] h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                pct > 85 ? 'bg-rose-500' : pct > 65 ? 'bg-amber-500' : 'bg-teal-600'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </td>
                        <td className="text-right font-semibold text-teal-800">
                          {wh.cold_storage_capacity > 0 ? `${wh.cold_storage_capacity.toLocaleString()} pallets` : '—'}
                        </td>
                        <td>
                          <Badge variant={wh.is_operational ? 'success' : 'neutral'} size="sm" dot={wh.is_operational}>
                            {wh.is_operational ? 'OPERATIONAL' : 'MAINTENANCE'}
                          </Badge>
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

      {/* Tab 3: Append-Only Immutable Transaction Ledger */}
      {activeTab === 'ledger' && (
        <Card className="overflow-hidden">
          <CardHeader
            title="Append-Only Transaction Ledger"
            subtitle="Tamper-evident audit sequence of all inventory receipts, dispatches, and reconciliation counts."
          />
          <div className="overflow-x-auto">
            <table className="table-enterprise">
              <thead>
                <tr>
                  <th>Correlation ID</th>
                  <th>Action</th>
                  <th>Product</th>
                  <th>Route / Facility</th>
                  <th className="text-right">Quantity Delta</th>
                  <th className="text-right">New Balance</th>
                  <th>Signatory</th>
                  <th>Timestamp</th>
                  <th>Audit Reason</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-6">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-xs text-[#667085]">
                      No movement transactions recorded.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m.id}>
                      <td className="font-mono text-teal-800 text-[11px]">
                        {m.correlation_id}
                      </td>
                      <td>
                        <Badge
                          variant={
                            m.movement_type === 'receipt'
                              ? 'teal'
                              : m.movement_type === 'dispatch'
                              ? 'navy'
                              : 'warning'
                          }
                          size="sm"
                        >
                          {m.movement_type}
                        </Badge>
                      </td>
                      <td className="font-semibold text-[#172B3A]">
                        {m.product_name}
                      </td>
                      <td className="text-[#667085] text-xs">
                        {m.source_name} ➔ {m.destination_name}
                      </td>
                      <td className={`text-right font-bold text-xs ${m.quantity_changed > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                        {m.quantity_changed > 0 ? `+${m.quantity_changed}` : m.quantity_changed}
                      </td>
                      <td className="text-right font-semibold text-[#172B3A]">
                        {m.balance_after}
                      </td>
                      <td className="text-[#667085] text-xs">{m.actor_name}</td>
                      <td className="text-[#667085] text-[11px] font-mono">{m.timestamp.substring(0, 19).replace('T', ' ')}</td>
                      <td className="text-[#667085] text-xs max-w-xs truncate">{m.reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Stock Mutation Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <Card className="w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF0]">
              <div>
                <h3 className="text-base font-bold text-[#172B3A]">
                  {actionModal === 'receive' && 'Receive Stock into Warehouse Batch'}
                  {actionModal === 'dispatch' && 'Dispatch Stock to Destination Center'}
                  {actionModal === 'adjust' && 'Reconcile Inventory Cycle Count'}
                </h3>
                <p className="text-xs text-[#667085] mt-0.5">
                  Atomic execution with append-only ledger audit trail.
                </p>
              </div>
              <button
                onClick={() => setActionModal(null)}
                className="text-[#667085] hover:text-[#172B3A] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleActionSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-[#172B3A] block mb-1">Target Warehouse</label>
                <select
                  value={formWarehouse}
                  onChange={(e) => setFormWarehouse(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E5EAF0] text-[#172B3A] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488]"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.city})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#172B3A] block mb-1">Product SKU</label>
                <select
                  value={formProduct}
                  onChange={(e) => setFormProduct(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E5EAF0] text-[#172B3A] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488]"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              {actionModal === 'receive' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-[#172B3A] block mb-1">Batch / Lot Number</label>
                      <input
                        type="text"
                        placeholder="e.g. BN-VX-2026-X9"
                        value={formBatchNumber}
                        onChange={(e) => setFormBatchNumber(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[#E5EAF0] text-[#172B3A] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-[#172B3A] block mb-1">Supplier Reference</label>
                      <input
                        type="text"
                        placeholder="e.g. Pfizer-BioNTech-GmbH"
                        value={formSupplier}
                        onChange={(e) => setFormSupplier(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[#E5EAF0] text-[#172B3A] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-[#172B3A] block mb-1">Expiry Date</label>
                      <input
                        type="date"
                        value={formExpiryDate}
                        onChange={(e) => setFormExpiryDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[#E5EAF0] text-[#172B3A] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-[#172B3A] block mb-1">Storage Bin</label>
                      <input
                        type="text"
                        value={formStorageBin}
                        onChange={(e) => setFormStorageBin(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[#E5EAF0] text-[#172B3A] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488]"
                      />
                    </div>
                  </div>
                </>
              )}

              {actionModal === 'dispatch' && (
                <div>
                  <label className="font-semibold text-[#172B3A] block mb-1">Destination Facility</label>
                  <input
                    type="text"
                    value={formDestination}
                    onChange={(e) => setFormDestination(e.target.value)}
                    placeholder="e.g. dest_boston_01"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#E5EAF0] text-[#172B3A] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488]"
                  />
                </div>
              )}

              {(actionModal === 'dispatch' || actionModal === 'adjust') && (
                <div>
                  <label className="font-semibold text-[#172B3A] block mb-1">Operation Audit Reason</label>
                  <input
                    type="text"
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    placeholder="e.g. Routine fulfillment or physical discrepancy reconcile"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#E5EAF0] text-[#172B3A] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488]"
                  />
                </div>
              )}

              <div>
                <label className="font-semibold text-[#172B3A] block mb-1">
                  {actionModal === 'adjust' ? 'Verified Physically Counted Quantity' : 'Quantity (Units)'}
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formQuantity}
                  onChange={(e) => setFormQuantity(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E5EAF0] text-[#172B3A] font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E5EAF0]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActionModal(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                >
                  Execute Mutation
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;
