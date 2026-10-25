import React, { useState, useEffect, useCallback } from 'react';
import { 
  Zap, 
  Clock, 
  ShieldAlert, 
  CheckCircle2, 
  RefreshCw,
  Sliders,
  DollarSign,
  TrendingUp,
  Percent
} from 'lucide-react';
import { api } from '../services/api';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { KPICard } from '../components/KPICard';
import { Skeleton } from '../components/ui/Skeleton';

interface UrgencyClock {
  node_id: string;
  node_name: string;
  product_sku: string;
  product_name: string;
  current_stock: number;
  hourly_burn_rate: number;
  hours_to_stockout: number;
  next_delivery_eta_hours: number;
  stockout_probability: number;
  is_urgent: boolean;
  is_critical: boolean;
  is_essential: boolean;
  demand_slot: string;
  slot_share: number;
}

interface FulfillmentOption {
  option_type: string;
  name: string;
  tagline: string;
  eta_hours: number;
  extra_cost: number;
  units_delivered: number;
  units_saved: number;
  expected_lost_units: number;
  margin_saved: number;
  goodwill_saved: number;
  rescue_bonus: number;
  expected_waste_cost: number;
  net_benefit: number;
  is_feasible: boolean;
  infeasible_reason?: string;
  donor_node_id?: string;
  donor_node_name?: string;
  transit_km: number;
}

interface ExpressRecommendation {
  node_id: string;
  node_name: string;
  product_sku: string;
  product_name: string;
  clock: UrgencyClock;
  options: FulfillmentOption[];
  recommended_option_type: string;
  recommended_option: FulfillmentOption;
  rationale: string;
  is_critical_override: boolean;
  generated_at: string;
}

export const ExpressLanePage: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [config, setConfig] = useState<any>(null);
  const [clocks, setClocks] = useState<UrgencyClock[]>([]);
  const [selectedSku, setSelectedSku] = useState<string>('PRD-VAX-01');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('dest_boston_01');
  const [recommendation, setRecommendation] = useState<ExpressRecommendation | null>(null);
  const [simulation, setSimulation] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [approving, setApproving] = useState<boolean>(false);
  const [approvalResult, setApprovalResult] = useState<any>(null);

  // Contention state
  const [contentionAlphaHours, setContentionAlphaHours] = useState<number>(0.8);
  const [contentionBetaHours, setContentionBetaHours] = useState<number>(2.5);
  const [contentionResult, setContentionResult] = useState<any>(null);

  const evaluateNode = useCallback(async (nodeId: string, sku: string) => {
    setApprovalResult(null);
    try {
      const rec = await api.express.evaluateOptions(nodeId, sku);
      setRecommendation(rec);
      setSelectedNodeId(nodeId);
    } catch (err) {
      console.error('Failed to evaluate options:', err);
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, sos, sim] = await Promise.all([
        api.express.getConfig(),
        api.express.getSosClocks(selectedSku),
        api.express.simulate(),
      ]);
      setConfig(cfg);
      setEnabled(cfg.enabled);
      setClocks(sos.clocks || []);
      setSimulation(sim);

      const targetNode = sos.clocks?.[0]?.node_id || 'dest_boston_01';
      setSelectedNodeId(targetNode);
      await evaluateNode(targetNode, selectedSku);
    } catch (err) {
      console.error('Failed to load Express Lane data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSku, evaluateNode]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const toggleFeature = async () => {
    try {
      const nextState = !enabled;
      const res = await api.express.updateConfig({ enabled: nextState });
      setEnabled(res.enabled);
    } catch (err) {
      console.error('Failed to update config:', err);
    }
  };

  const handleApprove = async () => {
    if (!recommendation) return;
    setApproving(true);
    try {
      const best = recommendation.recommended_option;
      const res = await api.express.approve({
        node_id: recommendation.node_id,
        product_sku: recommendation.product_sku,
        quantity: best.units_delivered || 50,
        option_type: recommendation.recommended_option_type,
        donor_node_id: best.donor_node_id,
        rationale: recommendation.rationale
      });
      setApprovalResult(res);
    } catch (err) {
      console.error('Failed to approve transfer:', err);
    } finally {
      setApproving(false);
    }
  };

  const runContentionSimulation = async () => {
    try {
      const items = [
        {
          request_id: 'REQ-ALPHA',
          node_id: 'dest_alpha',
          node_name: 'Dark Store Alpha (Downtown Core)',
          product_sku: 'PRD-INS-02',
          hours_to_stockout: contentionAlphaHours,
          sku_priority_weight: 1.5,
          customer_density: 1.3
        },
        {
          request_id: 'REQ-BETA',
          node_id: 'dest_beta',
          node_name: 'Dark Store Beta (Suburban East)',
          product_sku: 'PRD-INS-02',
          hours_to_stockout: contentionBetaHours,
          sku_priority_weight: 1.5,
          customer_density: 1.0
        }
      ];
      const res = await api.express.rationContention(items);
      setContentionResult(res);
    } catch (err) {
      console.error('Contention simulation error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Page Header with Controls */}
      <PageHeader
        category="Quick-Commerce & Dark Store Logistics"
        title="Express Lane: Fast-Fulfillment Engine"
        subtitle="Evaluates in-flight truck detours, peer dark store courier rebalancing, and dedicated express vans against regular delivery economics."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge variant={enabled ? 'teal' : 'neutral'} dot={enabled}>
              {enabled ? 'FEATURE ACTIVE' : 'FEATURE OFF (STANDBY)'}
            </Badge>

            <Button
              variant={enabled ? 'outline' : 'primary'}
              size="sm"
              icon={Sliders}
              onClick={toggleFeature}
            >
              {enabled ? 'Disable Express' : 'Enable Express Lane'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={loadInitialData}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* Diurnal Demand Assumption Ribbon */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E5EAF0] gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#172B3A]">
              Diurnal Intra-Day Demand Distribution Curve
            </h3>
            <p className="text-xs text-[#667085] mt-0.5">
              Calibrated hourly dark store customer consumption profiles for rapid stockout estimation.
            </p>
          </div>
          <span className="text-xs font-medium text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
            ⚡ Evening Peak (16:00 - 20:00 UTC)
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(config?.hourly_demand_pattern || {}).map(([slot, share]: any) => (
            <div 
              key={slot}
              className={`p-3 rounded-xl border text-center transition-all ${
                slot === '16-20' 
                  ? 'bg-teal-50/60 border-teal-300 text-teal-900' 
                  : 'bg-[#F7F9FC] border-[#E5EAF0] text-[#667085]'
              }`}
            >
              <div className="text-xs font-mono font-semibold">{slot} UTC</div>
              <div className="text-base font-bold text-[#172B3A] mt-0.5">{(share * 100).toFixed(0)}% Vol</div>
              <div className="text-[10px] uppercase tracking-wider mt-0.5 font-medium">
                {slot === '16-20' ? 'Peak Surge' : 'Standard'}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Urgent Clocks Grid across Dark Stores */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#172B3A] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#0D9488]" />
              Live Dark Store Urgency Clocks
            </h2>
            <p className="text-xs text-[#667085]">
              Autonomous trigger when stockout probability before next scheduled replenishment exceeds 50%.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white border border-[#E5EAF0] px-3 py-1.5 rounded-xl text-xs">
            <span className="font-semibold text-[#667085]">Monitor SKU:</span>
            <select
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
              className="bg-transparent border-none text-[#172B3A] font-medium focus:outline-none cursor-pointer"
            >
              <option value="PRD-VAX-01">PRD-VAX-01 (Comirnaty Vaccine - Essential)</option>
              <option value="PRD-INS-02">PRD-INS-02 (Humalog Insulin - Essential)</option>
              <option value="PRD-PPE-04">PRD-PPE-04 (Surgical Gloves - Standard)</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {clocks.map((c) => {
              const isSelected = c.node_id === selectedNodeId;
              return (
                <div
                  key={c.node_id}
                  onClick={() => evaluateNode(c.node_id, selectedSku)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden text-xs ${
                    isSelected 
                      ? 'ring-2 ring-teal-500 border-teal-500 bg-teal-50/20 shadow-sm' 
                      : 'bg-white border-[#E5EAF0] hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  {c.is_critical && (
                    <div className="absolute top-0 right-0 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                      CRITICAL &lt; 1H
                    </div>
                  )}

                  <div className="text-[11px] font-semibold text-[#667085] mb-1">{c.node_id}</div>
                  <h3 className="font-bold text-[#172B3A] text-sm mb-3 truncate">{c.node_name}</h3>

                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-[#667085]">Hours to Stockout</span>
                    <span className={`text-xl font-mono font-bold ${
                      c.hours_to_stockout < 2 ? 'text-rose-600' : c.hours_to_stockout < 5 ? 'text-amber-600' : 'text-teal-700'
                    }`}>
                      {c.hours_to_stockout.toFixed(1)}h
                    </span>
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-2 mb-3 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        c.stockout_probability > 0.7 ? 'bg-rose-500' : c.stockout_probability > 0.4 ? 'bg-amber-500' : 'bg-teal-500'
                      }`}
                      style={{ width: `${Math.min(100, c.stockout_probability * 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#667085] pt-2 border-t border-[#E5EAF0]">
                    <span>Stock: <strong className="text-[#172B3A]">{c.current_stock.toFixed(0)} units</strong></span>
                    <span>P(Stockout): <strong className="text-[#172B3A]">{(c.stockout_probability * 100).toFixed(0)}%</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4 Fast-Fulfillment Options Matrix */}
      {recommendation && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[#172B3A] flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#0D9488]" />
                4-Option Fast Fulfillment Matrix: {recommendation.node_name}
              </h2>
              <p className="text-xs text-[#667085]">
                Evaluates transport premiums against preserved gross margins and customer retention.
              </p>
            </div>

            {recommendation.is_critical_override && (
              <Badge variant="danger" size="md">
                <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                Critical Override: Essential Medical SKU Protected
              </Badge>
            )}
          </div>

          {/* Winner Recommendation Banner */}
          <Card className={`p-5 border ${
            recommendation.recommended_option_type === 'WAIT'
              ? 'bg-[#F7F9FC] border-[#E5EAF0]'
              : 'bg-teal-50/40 border-teal-300'
          }`}>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className={`p-2.5 rounded-xl shrink-0 ${
                  recommendation.recommended_option_type === 'WAIT'
                    ? 'bg-slate-200 text-slate-700'
                    : 'bg-[#0D9488] text-white'
                }`}>
                  {recommendation.recommended_option_type === 'WAIT' ? (
                    <Clock className="w-5 h-5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#667085]">Autonomous Decision Engine:</span>
                    <Badge variant="teal" size="sm">
                      {recommendation.recommended_option.name}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#172B3A] mt-1 font-medium leading-relaxed">
                    {recommendation.rationale}
                  </p>
                </div>
              </div>

              {recommendation.recommended_option_type !== 'WAIT' && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleApprove}
                  disabled={approving || Boolean(approvalResult)}
                  loading={approving}
                  icon={CheckCircle2}
                >
                  {approvalResult ? 'Transfer Approved ✓' : 'One-Click Approve & Dispatch'}
                </Button>
              )}
            </div>
          </Card>

          {approvalResult && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <strong>Ledger Transfer Created:</strong> #{approvalResult.transfer_number} via {approvalResult.dispatch_method}. State set to APPROVED in global ledger with full audit rationale recorded.
              </div>
            </div>
          )}

          {/* 4 Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {recommendation.options.map((opt) => {
              const isWinner = opt.option_type === recommendation.recommended_option_type;
              return (
                <Card
                  key={opt.option_type}
                  className={`p-5 flex flex-col justify-between transition-all ${
                    isWinner 
                      ? 'border-[#0D9488] ring-2 ring-teal-500/20 shadow-sm' 
                      : 'border-[#E5EAF0]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono font-bold text-[#667085]">
                        {opt.option_type}
                      </span>
                      {isWinner && (
                        <Badge variant="teal" size="sm">
                          RECOMMENDED
                        </Badge>
                      )}
                    </div>

                    <h3 className="font-bold text-[#172B3A] text-sm mb-1">{opt.name}</h3>
                    <p className="text-[#667085] text-xs mb-4 min-h-[32px]">{opt.tagline}</p>

                    <div className="space-y-2 pt-3 border-t border-[#E5EAF0] text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#667085]">Transit ETA:</span>
                        <span className="font-semibold text-[#172B3A]">{opt.eta_hours.toFixed(1)} hours</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#667085]">Extra Surcharge:</span>
                        <span className="font-semibold text-[#172B3A]">${opt.extra_cost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#667085]">Units Saved:</span>
                        <span className="font-semibold text-[#172B3A]">{opt.units_saved.toFixed(0)} units</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#667085]">Margin Preserved:</span>
                        <span className="font-bold text-teal-700">+${opt.margin_saved.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#667085]">Goodwill Value:</span>
                        <span className="font-bold text-teal-700">+${opt.goodwill_saved.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#E5EAF0]">
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-xs font-semibold text-[#172B3A]">Net Benefit:</span>
                      <span className={`text-sm font-mono font-bold ${
                        opt.net_benefit > 0 ? 'text-teal-700' : 'text-[#667085]'
                      }`}>
                        {opt.net_benefit > 0 ? `+$${opt.net_benefit.toFixed(2)}` : `$${opt.net_benefit.toFixed(2)}`}
                      </span>
                    </div>

                    {!opt.is_feasible ? (
                      <div className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded-lg font-medium leading-tight">
                        {opt.infeasible_reason}
                      </div>
                    ) : (
                      <div className="text-[11px] text-teal-800 bg-teal-50 p-2 rounded-lg font-medium">
                        Feasible & Verified ({opt.transit_km.toFixed(0)} km corridor)
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Contention Rationing Studio */}
      <Card className="p-5 space-y-4">
        <CardHeader
          title="Contention Rationing Studio"
          subtitle="Priority Score = (1 / hours_to_stockout) × SKU Priority Weight × Customer Density"
          action={
            <Button
              variant="primary"
              size="sm"
              icon={Sliders}
              onClick={runContentionSimulation}
            >
              Simulate Contention
            </Button>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-[#F7F9FC] rounded-xl border border-[#E5EAF0] space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-[#172B3A]">Dark Store Alpha (Downtown Core)</span>
              <span className="text-[11px] font-mono px-2 py-0.5 bg-white border border-[#E5EAF0] text-[#667085] rounded font-semibold">
                Density: 1.3 • Weight: 1.5
              </span>
            </div>
            <div>
              <div className="flex justify-between text-xs text-[#667085] mb-1">
                <span>Stockout Clock: <strong>{contentionAlphaHours.toFixed(1)} hours</strong></span>
              </div>
              <input 
                type="range"
                min="0.2"
                max="6.0"
                step="0.1"
                value={contentionAlphaHours}
                onChange={(e) => setContentionAlphaHours(parseFloat(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />
            </div>
          </div>

          <div className="p-4 bg-[#F7F9FC] rounded-xl border border-[#E5EAF0] space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-[#172B3A]">Dark Store Beta (Suburban East)</span>
              <span className="text-[11px] font-mono px-2 py-0.5 bg-white border border-[#E5EAF0] text-[#667085] rounded font-semibold">
                Density: 1.0 • Weight: 1.5
              </span>
            </div>
            <div>
              <div className="flex justify-between text-xs text-[#667085] mb-1">
                <span>Stockout Clock: <strong>{contentionBetaHours.toFixed(1)} hours</strong></span>
              </div>
              <input 
                type="range"
                min="0.2"
                max="6.0"
                step="0.1"
                value={contentionBetaHours}
                onChange={(e) => setContentionBetaHours(parseFloat(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {contentionResult && (
          <div className="space-y-3 pt-3 border-t border-[#E5EAF0]">
            <div className="text-xs font-semibold text-[#667085] uppercase tracking-wider">Rationing Allocation Result:</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {contentionResult.items.map((item: any, idx: number) => (
                <div 
                  key={item.request_id}
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    idx === 0 
                      ? 'bg-teal-50/50 border-teal-300' 
                      : 'bg-[#F7F9FC] border-[#E5EAF0]'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    idx === 0 ? 'bg-[#0D9488] text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {idx + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#172B3A]">{item.node_name}</span>
                      <span className="text-[11px] font-mono px-2 py-0.5 bg-white border border-[#E5EAF0] rounded font-bold text-teal-800">
                        Score: {item.priority_score.toFixed(1)}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-teal-800 mt-1">
                      Awarded: {item.allocated_option}
                    </div>
                    <div className="text-xs text-[#667085] mt-0.5">{item.notes}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* 30-Day Comparative Simulation Report */}
      {simulation && (
        <Card className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5EAF0]">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-teal-700 mb-1">
                Historical Impact Assessment
              </div>
              <h2 className="text-base sm:text-lg font-bold text-[#172B3A]">
                30-Day Express Lane Historical Simulation
              </h2>
            </div>

            <Badge variant="teal" size="md">
              ROI Multiple: {simulation.roi_multiple}x Return
            </Badge>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Stockouts Avoided"
              value={`${simulation.total_stockouts_avoided_units.toFixed(0)} units`}
              subtitle="Critical inventory preserved"
              statusDotColor="bg-emerald-500"
              icon={CheckCircle2}
            />
            <KPICard
              title="Margin Preserved"
              value={`$${simulation.gross_margin_preserved.toLocaleString()}`}
              subtitle="Retained dark store revenue"
              statusDotColor="bg-teal-500"
              icon={DollarSign}
            />
            <KPICard
              title="Extra Transport Spend"
              value={`$${simulation.total_extra_spend.toLocaleString()}`}
              subtitle="Dedicated express surcharges"
              statusDotColor="bg-blue-500"
              icon={TrendingUp}
            />
            <KPICard
              title="Net Profit Impact"
              value={`+$${simulation.net_profit_impact.toLocaleString()}`}
              subtitle="Preserved margin minus freight"
              statusDotColor="bg-emerald-500"
              icon={Percent}
            />
          </div>

          <div className="space-y-3 pt-2">
            <div className="text-xs font-bold uppercase tracking-wider text-[#667085]">
              Evaluated Benchmark Scenarios (A, B, C):
            </div>
            <div className="space-y-3">
              {simulation.scenarios?.map((scen: any) => (
                <div key={scen.scenario_id} className="p-4 bg-[#F7F9FC] border border-[#E5EAF0] rounded-xl space-y-1.5 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-[#172B3A]">{scen.name}</span>
                    <Badge variant="neutral" size="sm">
                      Decision: {scen.recommended_decision}
                    </Badge>
                  </div>
                  <p className="text-[#667085]">{scen.description}</p>
                  <p className="text-teal-800 font-medium">{scen.audit_notes}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ExpressLanePage;
