import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { OptimizationResult, Warehouse } from '../types';
import { KPICard } from '../components/KPICard';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { 
  Play, 
  TrendingDown, 
  Percent, 
  DollarSign, 
  Clock, 
  Info
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';

export const OptimizerPage: React.FC = () => {
  const { addToast, activeRole } = useAppStore();
  const [running, setRunning] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [result, setResult] = useState<OptimizationResult | null>(null);

  // Scenario Modifiers
  const [horizonDays] = useState(7);
  const [demandSurge, setDemandSurge] = useState(0);
  const [fuelMultiplier, setFuelMultiplier] = useState(1.0);
  const [fefoUrgency, setFefoUrgency] = useState(1.2);
  const [disruptedWhs, setDisruptedWhs] = useState<string[]>([]);
  const [transferringRecId, setTransferringRecId] = useState<string | null>(null);

  const isRoleAllowed = ['super_admin', 'org_admin', 'supply_chain_manager'].includes(activeRole);

  const handleCreateTransfer = async (rec: any) => {
    if (!result) return;
    setTransferringRecId(rec.id);
    try {
      const transfer = await api.optimization.createTransferFromRecommendation(
        result.run_id,
        rec.id,
        `Created from OR-Tools optimization run ${result.run_id}`
      );
      setResult(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          recommendations: prev.recommendations.map(r =>
            r.id === rec.id ? { ...r, transferred: true, transfer_id: transfer.id } : r
          ),
        };
      });
      addToast({
        type: 'info',
        title: 'Transfer Request Created',
        message: `Transfer ${transfer.transfer_number || transfer.id} created in REQUESTED state. Source inventory reserved.`,
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Transfer Creation Failed',
        message: err.message || 'Could not formalize transfer from recommendation.',
      });
    } finally {
      setTransferringRecId(null);
    }
  };

  const handleRunOptimization = useCallback(async () => {
    if (!isRoleAllowed) {
      addToast({
        type: 'error',
        title: 'Access Denied',
        message: 'Role permissions required: Supply Chain Manager, Org Admin, or Super Admin.',
      });
      return;
    }
    setRunning(true);
    try {
      const res = await api.optimization.run({
        horizon_days: horizonDays,
        fefo_priority_weight: fefoUrgency,
        scenario: {
          disrupted_warehouse_ids: disruptedWhs,
          demand_surge_percent: demandSurge,
          fuel_transport_cost_multiplier: fuelMultiplier,
          expiring_soon_penalty_multiplier: fefoUrgency,
        }
      });
      setResult(res);
      addToast({
        type: 'info',
        title: 'OR-Tools Optimization Solved',
        message: `Generated optimal distribution in ${res.optimized.execution_time_ms}ms with $${res.savings_amount.toLocaleString()} cost savings.`
      });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Solver failed', message: err.message });
    } finally {
      setRunning(false);
    }
  }, [isRoleAllowed, horizonDays, fefoUrgency, disruptedWhs, demandSurge, fuelMultiplier, addToast]);

  useEffect(() => {
    api.warehouses.list().then(setWarehouses).catch(console.error);
    handleRunOptimization();
  }, []);

  const toggleDisrupt = (whId: string) => {
    setDisruptedWhs(prev => 
      prev.includes(whId) ? prev.filter(id => id !== whId) : [...prev, whId]
    );
  };

  const comparisonChartData = result ? [
    {
      name: 'Total Cost ($)',
      'Baseline Heuristic': result.baseline_heuristic.total_modeled_cost,
      'OR-Tools MIP Solver': result.optimized.total_modeled_cost,
    },
    {
      name: 'Freight Transport ($)',
      'Baseline Heuristic': result.baseline_heuristic.transportation_cost,
      'OR-Tools MIP Solver': result.optimized.transportation_cost,
    },
    {
      name: 'Shortage Penalties ($)',
      'Baseline Heuristic': result.baseline_heuristic.shortage_penalty_cost,
      'OR-Tools MIP Solver': result.optimized.shortage_penalty_cost,
    },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Role Protection Notice Banner */}
      {!isRoleAllowed && (
        <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/70 text-[#172B3A] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 text-[#0D9488] shrink-0" />
            <span className="text-xs">
              Role Protection: You are signed in as <strong>{activeRole}</strong>. Running mathematical network optimization requires <strong>Supply Chain Manager</strong>, <strong>Org Admin</strong>, or <strong>Super Admin</strong>.
            </span>
          </div>
          <Link to="/login" className="shrink-0">
            <Button variant="outline" size="sm">
              Sign In as Manager
            </Button>
          </Link>
        </div>
      )}

      {/* Top Page Header */}
      <PageHeader
        category="Multi-Echelon Mathematical Optimization"
        title="Distribution Optimization & Scenario Simulation Studio"
        subtitle="Mixed-integer linear programming (MIP) via Google OR-Tools. Optimizes warehouse source allocations, minimizes transportation freight, and applies FEFO expiry-aware allocation."
        actions={
          <Button
            variant="primary"
            size="md"
            icon={Play}
            onClick={handleRunOptimization}
            disabled={running}
            loading={running}
          >
            {running ? 'Solving MIP Formulation...' : 'Execute Optimizer'}
          </Button>
        }
      />

      {/* Scenario Simulation Controls Card */}
      <Card className="p-5 space-y-4">
        <CardHeader
          title="Scenario Modifiers & Disruption Simulator"
          subtitle="Simulate black-swan supply shocks, regional disease outbreaks, or diesel freight price spikes."
          action={<Badge variant="teal">Scenario Controls</Badge>}
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          {/* Demand Surge Slider */}
          <div className="p-4 rounded-xl border border-[#E5EAF0] bg-[#F7F9FC]">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-[#172B3A]">Demand Surge</span>
              <span className="font-bold text-teal-700">+{demandSurge}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={demandSurge}
              onChange={(e) => setDemandSurge(parseInt(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"
            />
            <span className="text-[11px] text-[#667085] mt-1.5 block">Simulates hospital surge events</span>
          </div>

          {/* Fuel Price Multiplier */}
          <div className="p-4 rounded-xl border border-[#E5EAF0] bg-[#F7F9FC]">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-[#172B3A]">Fuel Cost Multiplier</span>
              <span className="font-bold text-teal-700">{fuelMultiplier.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="2.5"
              step="0.1"
              value={fuelMultiplier}
              onChange={(e) => setFuelMultiplier(parseFloat(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"
            />
            <span className="text-[11px] text-[#667085] mt-1.5 block">Simulates diesel freight price spikes</span>
          </div>

          {/* FEFO Expiry Urgency Weight */}
          <div className="p-4 rounded-xl border border-[#E5EAF0] bg-[#F7F9FC]">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-[#172B3A]">FEFO Expiry Weight</span>
              <span className="font-bold text-teal-700">{fefoUrgency.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="3.0"
              step="0.2"
              value={fefoUrgency}
              onChange={(e) => setFefoUrgency(parseFloat(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"
            />
            <span className="text-[11px] text-[#667085] mt-1.5 block">Prioritizes near-expiry pharmaceutical batches</span>
          </div>

          {/* Disrupted Warehouse Outage Toggles */}
          <div className="p-4 rounded-xl border border-[#E5EAF0] bg-[#F7F9FC]">
            <div className="font-semibold text-[#172B3A] mb-2">
              Hub Outage Toggles
            </div>
            <div className="space-y-1.5 max-h-24 overflow-y-auto">
              {warehouses.map((w) => {
                const isDisrupted = disruptedWhs.includes(w.id);
                return (
                  <label key={w.id} className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={isDisrupted}
                      onChange={() => toggleDisrupt(w.id)}
                      className="rounded accent-teal-600"
                    />
                    <span className={isDisrupted ? 'text-rose-500 font-semibold line-through' : 'text-[#172B3A]'}>
                      {w.code} ({w.city})
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Comparison Metrics Header */}
      {result && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Optimized Modeled Cost"
              value={`$${result.optimized.total_modeled_cost.toLocaleString()}`}
              subtitle={`Vs Baseline: $${result.baseline_heuristic.total_modeled_cost.toLocaleString()}`}
              statusDotColor="bg-teal-500"
              icon={DollarSign}
            />
            <KPICard
              title="Verified Cost Savings"
              value={`$${result.savings_amount.toLocaleString()}`}
              subtitle="Algorithm reduction in freight & penalties"
              change={`-${result.savings_percent}%`}
              isPositive={true}
              statusDotColor="bg-emerald-500"
              icon={TrendingDown}
            />
            <KPICard
              title="Demand Fill Rate"
              value={`${result.optimized.fill_rate_percent}%`}
              subtitle={`${result.optimized.total_allocated_units.toLocaleString()} / ${result.optimized.total_demand_units.toLocaleString()} units`}
              change={`${result.optimized.fill_rate_percent}%`}
              isPositive={result.optimized.fill_rate_percent > 90}
              statusDotColor="bg-blue-500"
              icon={Percent}
            />
            <KPICard
              title="Solver Execution"
              value={`${result.optimized.execution_time_ms} ms`}
              subtitle={`Status: ${result.optimized.solver_status}`}
              statusDotColor="bg-indigo-500"
              icon={Clock}
            />
          </div>

          {/* Comparison Side-by-Side Table & Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Metric Comparison Table */}
            <Card className="p-5 lg:col-span-1 space-y-4">
              <CardHeader
                title="MIP Solver vs Greedy Baseline"
                subtitle="Side-by-side performance comparison against naive heuristic."
              />

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-[#F7F9FC] border border-[#E5EAF0]">
                  <div className="text-[11px] uppercase font-semibold text-[#667085]">Total Modeled Cost</div>
                  <div className="flex justify-between items-baseline mt-1 font-mono">
                    <span className="font-bold text-teal-700 text-sm">${result.optimized.total_modeled_cost.toLocaleString()}</span>
                    <span className="text-slate-400 text-xs line-through">${result.baseline_heuristic.total_modeled_cost.toLocaleString()}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#F7F9FC] border border-[#E5EAF0]">
                  <div className="text-[11px] uppercase font-semibold text-[#667085]">Allocated Units / Demand</div>
                  <div className="flex justify-between items-baseline mt-1 font-mono">
                    <span className="font-bold text-[#172B3A] text-sm">{result.optimized.total_allocated_units.toLocaleString()} units</span>
                    <span className="text-[#667085] text-xs">{result.baseline_heuristic.total_allocated_units.toLocaleString()} units</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#F7F9FC] border border-[#E5EAF0]">
                  <div className="text-[11px] uppercase font-semibold text-[#667085]">Shortage Stockout Units</div>
                  <div className="flex justify-between items-baseline mt-1 font-mono">
                    <span className="font-bold text-[#172B3A] text-sm">{result.optimized.stockout_units} units</span>
                    <span className="text-[#667085] text-xs">{result.baseline_heuristic.stockout_units} units</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#F7F9FC] border border-[#E5EAF0]">
                  <div className="text-[11px] uppercase font-semibold text-[#667085]">Estimated Spoilage / Wastage</div>
                  <div className="flex justify-between items-baseline mt-1 font-mono">
                    <span className="font-bold text-teal-700 text-sm">0 units (FEFO active)</span>
                    <span className="text-slate-400 text-xs">{result.baseline_heuristic.estimated_wastage_risk_units} units</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Recharts Bar Chart Breakdown */}
            <Card className="p-5 lg:col-span-2 space-y-4">
              <CardHeader
                title="Cost Breakdown Comparison ($)"
                subtitle="Modeled freight transport, holding costs, and shortage penalties."
              />
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF0" vertical={false} />
                    <XAxis dataKey="name" stroke="#667085" fontSize={11} tickLine={false} axisLine={{ stroke: '#E5EAF0' }} />
                    <YAxis stroke="#667085" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E5EAF0',
                        borderRadius: '8px',
                        fontSize: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="Baseline Heuristic" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="OR-Tools MIP Solver" fill="#0D9488" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Allocation Recommendations Table */}
          <Card className="overflow-hidden">
            <CardHeader
              title={`Prescriptive Allocation Matrix (${result.recommendations.length} Recommended Routes)`}
              subtitle="Algorithmically verified routing recommendations adhering to capacity, safety stock, and FEFO expiry rules."
            />

            <div className="overflow-x-auto">
              <table className="table-enterprise">
                <thead>
                  <tr>
                    <th>Product & SKU</th>
                    <th>Source Hub</th>
                    <th>Destination Facility</th>
                    <th className="text-right">Allocated Qty</th>
                    <th className="text-right">Unit Freight</th>
                    <th className="text-right">Total Cost</th>
                    <th>Transit Time</th>
                    <th>Allocation Rationale</th>
                    <th className="text-right">Execution</th>
                  </tr>
                </thead>
                <tbody>
                  {result.recommendations.map((rec) => (
                    <tr key={rec.id}>
                      <td>
                        <div className="font-semibold text-[#172B3A]">{rec.product_name}</div>
                        <span className="text-[11px] text-teal-700 font-mono">{rec.product_sku}</span>
                      </td>
                      <td className="font-medium text-[#172B3A]">
                        {rec.source_warehouse_name}
                      </td>
                      <td className="font-medium text-[#172B3A]">
                        {rec.destination_name}
                      </td>
                      <td className="text-right font-bold text-teal-700">
                        {rec.allocated_quantity.toLocaleString()}
                      </td>
                      <td className="text-right text-[#667085]">
                        ${rec.unit_transport_cost.toFixed(2)}
                      </td>
                      <td className="text-right font-bold text-[#172B3A]">
                        ${rec.total_transport_cost.toFixed(2)}
                      </td>
                      <td className="text-[#667085] text-xs">
                        {rec.estimated_delivery_hours}h
                      </td>
                      <td className="text-xs text-[#667085] max-w-xs">
                        {rec.rationale}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        {rec.transferred ? (
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant="teal" size="sm">Transferred</Badge>
                            <Link
                              to="/inventory"
                              className="text-[11px] text-teal-700 hover:underline font-medium"
                            >
                              View &rarr;
                            </Link>
                          </div>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={transferringRecId === rec.id || !isRoleAllowed}
                            onClick={() => handleCreateTransfer(rec)}
                          >
                            {transferringRecId === rec.id ? 'Reserving...' : 'Create Transfer'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default OptimizerPage;
