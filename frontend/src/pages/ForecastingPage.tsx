import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { Product } from '../types';
import { KPICard } from '../components/KPICard';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { 
  TrendingUp, 
  Target, 
  Clock, 
  Layers, 
  Info,
  Calendar,
  Download,
  ShieldCheck,
  Zap,
  Activity,
  ArrowUpRight,
  Sparkles
} from 'lucide-react';
import { 
  ComposedChart, 
  Line, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart,
  Bar,
  Cell
} from 'recharts';

// Custom chart tooltip styled with SaaS precision
const CustomForecastTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0]?.payload;
    return (
      <div className="bg-white/95 backdrop-blur-md border border-[#E5EAF0] shadow-xl rounded-xl p-3.5 min-w-[210px] text-xs">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E5EAF0]">
          <span className="font-semibold text-[#172B3A]">{dataPoint?.fullDate || label}</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${dataPoint?.isForecast ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-slate-100 text-slate-700'}`}>
            {dataPoint?.isForecast ? 'Predicted' : 'Observed'}
          </span>
        </div>

        <div className="space-y-1.5">
          {dataPoint?.['Historical Actual'] !== null && dataPoint?.['Historical Actual'] !== undefined && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[#667085]">
                <span className="w-2 h-2 rounded-full bg-[#17324D]" /> Actual Demand
              </span>
              <span className="font-bold text-[#17324D]">{dataPoint['Historical Actual']} units</span>
            </div>
          )}

          {dataPoint?.['ML Ridge Forecast'] !== null && dataPoint?.['ML Ridge Forecast'] !== undefined && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-teal-700">
                <span className="w-2 h-2 rounded-full bg-[#0D9488]" /> ML Ridge
              </span>
              <span className="font-bold text-[#0D9488]">{dataPoint['ML Ridge Forecast']} units</span>
            </div>
          )}

          {dataPoint?.['7-Day Moving Avg'] !== null && dataPoint?.['7-Day Moving Avg'] !== undefined && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[#667085]">
                <span className="w-2 h-2 rounded-full border border-dashed border-[#667085]" /> Moving Avg
              </span>
              <span className="font-medium text-[#667085]">{dataPoint['7-Day Moving Avg']} units</span>
            </div>
          )}

          {dataPoint?.['Lower Bound'] !== null && dataPoint?.['Upper Bound'] !== null && (
            <div className="pt-1.5 mt-1 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#667085]">
              <span>95% Confidence</span>
              <span className="font-mono text-slate-700">[{dataPoint['Lower Bound']} - {dataPoint['Upper Bound']}]</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export const ForecastingPage: React.FC = () => {
  const { addToast } = useAppStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('prd_vax_01');
  const [horizonDays, setHorizonDays] = useState(14);
  const [loading, setLoading] = useState(false);
  const [forecastResult, setForecastResult] = useState<any>(null);

  const loadForecast = useCallback(async () => {
    if (!selectedProductId) return;
    setLoading(true);
    try {
      const res = await api.forecast.getProductForecast(selectedProductId, horizonDays);
      setForecastResult(res);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Forecast calculation failed', message: err.message || 'API connection failed' });
    } finally {
      setLoading(false);
    }
  }, [selectedProductId, horizonDays, addToast]);

  useEffect(() => {
    api.products.list()
      .then((prods) => {
        setProducts(prods);
        if (prods.length > 0) {
          setSelectedProductId((prev) => prev || prods[0].id);
        }
      })
      .catch((err) => {
        console.error('Failed to load products for forecasting:', err);
      });
  }, []);

  useEffect(() => {
    loadForecast();
  }, [loadForecast]);

  // Process timeline data for chart
  const chartData = useMemo(() => {
    if (!forecastResult?.timeline) return [];
    return forecastResult.timeline.map((pt: any) => ({
      date: pt.date ? pt.date.substring(5) : '', // MM-DD
      fullDate: pt.date,
      isForecast: pt.is_forecast,
      'Historical Actual': pt.historical_actual ?? null,
      '7-Day Moving Avg': pt.baseline_ma ? Math.round(pt.baseline_ma * 10) / 10 : null,
      'ML Ridge Forecast': pt.ml_forecast ? Math.round(pt.ml_forecast * 10) / 10 : null,
      'Upper Bound': pt.upper_bound ? Math.round(pt.upper_bound * 10) / 10 : null,
      'Lower Bound': pt.lower_bound ? Math.round(pt.lower_bound * 10) / 10 : null,
      boundSpread: (pt.upper_bound && pt.lower_bound) ? Math.max(0, pt.upper_bound - pt.lower_bound) : null,
    }));
  }, [forecastResult]);

  // Derived metrics
  const totalForecastDemand = useMemo(() => {
    if (!forecastResult?.timeline) return 0;
    const forecastPoints = forecastResult.timeline.filter((pt: any) => pt.is_forecast && pt.ml_forecast);
    const sum = forecastPoints.reduce((acc: number, cur: any) => acc + (cur.ml_forecast || 0), 0);
    return Math.round(sum);
  }, [forecastResult]);

  const historicalAvgDemand = useMemo(() => {
    if (!forecastResult?.timeline) return 0;
    const histPoints = forecastResult.timeline.filter((pt: any) => !pt.is_forecast && pt.historical_actual != null);
    if (!histPoints.length) return 0;
    const sum = histPoints.reduce((acc: number, cur: any) => acc + cur.historical_actual, 0);
    return Math.round(sum / histPoints.length);
  }, [forecastResult]);

  const demandDeltaPercent = useMemo(() => {
    if (!historicalAvgDemand || !forecastResult?.timeline) return null;
    const forecastPoints = forecastResult.timeline.filter((pt: any) => pt.is_forecast && pt.ml_forecast);
    if (!forecastPoints.length) return null;
    const forecastAvg = totalForecastDemand / forecastPoints.length;
    const delta = ((forecastAvg - historicalAvgDemand) / historicalAvgDemand) * 100;
    return Math.round(delta * 10) / 10;
  }, [historicalAvgDemand, totalForecastDemand, forecastResult]);

  // Weekly bucket data for right-side demand distribution bar chart
  const weeklyDistribution = useMemo(() => {
    if (!forecastResult?.timeline) return [];
    const forecastPoints = forecastResult.timeline.filter((pt: any) => pt.is_forecast && pt.ml_forecast);
    const weeks: { name: string; units: number }[] = [];
    let curWeekUnits = 0;
    let weekNum = 1;
    forecastPoints.forEach((pt: any, idx: number) => {
      curWeekUnits += (pt.ml_forecast || 0);
      if ((idx + 1) % 7 === 0 || idx === forecastPoints.length - 1) {
        weeks.push({
          name: `Wk ${weekNum}`,
          units: Math.round(curWeekUnits),
        });
        weekNum++;
        curWeekUnits = 0;
      }
    });
    return weeks;
  }, [forecastResult]);

  // CSV Export handler
  const handleExportCSV = () => {
    if (!forecastResult?.timeline?.length) return;
    const headers = ['Date', 'Type', 'Historical_Actual', 'Baseline_MA', 'ML_Ridge_Forecast', 'Lower_Bound', 'Upper_Bound'];
    const rows = forecastResult.timeline.map((pt: any) => [
      pt.date,
      pt.is_forecast ? 'FORECAST' : 'HISTORICAL',
      pt.historical_actual ?? '',
      pt.baseline_ma ?? '',
      pt.ml_forecast ?? '',
      pt.lower_bound ?? '',
      pt.upper_bound ?? ''
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `StockPilot_Forecast_${selectedProductId}_${horizonDays}D.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast({ type: 'success', title: 'Export Generated', message: 'Forecast ledger exported as CSV successfully.' });
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);

  return (
    <div className="space-y-6">
      {/* Top Page Header with Controls */}
      <PageHeader
        category="Predictive Intelligence & Demand Engine"
        title="Demand Forecasting & Uncertainty Horizons"
        subtitle="Multi-horizon ridge regression models calibrated on historical consumption patterns with automated holdout evaluation."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {/* SKU Selector */}
            <div className="flex items-center gap-2 bg-white border border-[#E5EAF0] shadow-xs rounded-xl px-3 py-1.5 text-xs text-[#172B3A]">
              <Layers className="w-4 h-4 text-[#0D9488]" />
              <select
                id="forecast-product-select"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="bg-transparent border-none text-[#172B3A] font-medium focus:outline-none cursor-pointer pr-2"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>

            {/* Horizon Selector */}
            <div className="flex items-center gap-2 bg-white border border-[#E5EAF0] shadow-xs rounded-xl px-3 py-1.5 text-xs text-[#172B3A]">
              <Calendar className="w-4 h-4 text-[#0D9488]" />
              <select
                id="forecast-horizon-select"
                value={horizonDays}
                onChange={(e) => setHorizonDays(parseInt(e.target.value))}
                className="bg-transparent border-none text-[#172B3A] font-medium focus:outline-none cursor-pointer pr-2"
              >
                <option value={7}>7-Day Forecast</option>
                <option value={14}>14-Day Forecast</option>
                <option value={30}>30-Day Forecast</option>
              </select>
            </div>

            {/* Export Action Button */}
            <Button
              id="forecast-export-btn"
              variant="outline"
              size="sm"
              icon={Download}
              onClick={handleExportCSV}
              disabled={loading || !forecastResult?.timeline?.length}
            >
              Export CSV
            </Button>
          </div>
        }
      />

      {/* Model Performance & Demand KPI Cards (4-column layout matching reference) */}
      {loading && !forecastResult ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : forecastResult ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Projected Demand Volume */}
          <KPICard
            title={`${horizonDays}-Day Projected Demand`}
            value={`${totalForecastDemand.toLocaleString()} units`}
            subtitle={`vs ${historicalAvgDemand} daily hist avg`}
            change={demandDeltaPercent !== null ? `${demandDeltaPercent > 0 ? '+' : ''}${demandDeltaPercent}%` : undefined}
            isPositive={demandDeltaPercent !== null ? demandDeltaPercent >= 0 : undefined}
            statusDotColor="bg-teal-500"
            icon={TrendingUp}
          />

          {/* Card 2: R2 Holdout Score */}
          <KPICard
            title="Model Holdout Fit (R²)"
            value={forecastResult.evaluation.r2_score.toFixed(3)}
            subtitle="Explained variance on 14d holdout"
            change={forecastResult.evaluation.r2_score > 0.8 ? "Optimal Fit" : "Acceptable"}
            isPositive={forecastResult.evaluation.r2_score > 0.75}
            statusDotColor="bg-emerald-500"
            icon={Sparkles}
          />

          {/* Card 3: MAE / Accuracy */}
          <KPICard
            title="Holdout Error (MAE)"
            value={`${forecastResult.evaluation.mae} units`}
            subtitle={
              forecastResult.evaluation.baseline_ma_mae 
                ? `vs ${forecastResult.evaluation.baseline_ma_mae} MA baseline` 
                : 'Mean absolute prediction deviation'
            }
            change={
              forecastResult.evaluation.baseline_ma_mae
                ? `-${Math.round(((forecastResult.evaluation.baseline_ma_mae - forecastResult.evaluation.mae) / forecastResult.evaluation.baseline_ma_mae) * 100)}% err`
                : undefined
            }
            isPositive={true}
            statusDotColor="bg-blue-500"
            icon={Target}
          />

          {/* Card 4: Confidence Horizon */}
          <KPICard
            title="Statistical Confidence"
            value="95% Horizon"
            subtitle="Normal distribution bounds (±1.96σ)"
            change="Gaussian"
            statusDotColor="bg-indigo-500"
            icon={ShieldCheck}
          />
        </div>
      ) : null}

      {/* Main Grid: Forecast Trajectory Chart (68%) & Benchmarks/Breakdown (32%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Composed Trajectory Chart */}
        <div className="lg:col-span-8">
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E5EAF0] gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#172B3A]">
                    Demand Trajectory & Confidence Envelope
                  </h3>
                  <Badge variant="teal" dot>
                    Ridge ML v1.2
                  </Badge>
                </div>
                <p className="text-xs text-[#667085] mt-1">
                  Historical actuals from daily facility receipts plotted against ridge regression projections with ±1.96σ confidence spread.
                </p>
              </div>

              {/* Chart Legend Pills */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#667085]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#17324D]" />
                  <span className="font-medium text-[#172B3A]">Actuals</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0D9488]" />
                  <span className="font-medium text-teal-700">ML Forecast</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 border-t-2 border-dashed border-[#667085]" />
                  <span>7D Moving Avg</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#0D9488]/20 border border-[#0D9488]/40" />
                  <span>95% Bounds</span>
                </div>
              </div>
            </div>

            {/* Chart Area */}
            <div className="pt-6 h-88 w-full">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <Skeleton className="w-full h-full rounded-xl" />
                </div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="confidenceFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0D9488" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#0D9488" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF0" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#667085"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: '#E5EAF0' }}
                    />
                    <YAxis
                      stroke="#667085"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomForecastTooltip />} />

                    {/* Confidence Range Shading */}
                    <Area
                      type="monotone"
                      dataKey="Upper Bound"
                      stroke="none"
                      fill="url(#confidenceFill)"
                      fillOpacity={1}
                    />

                    {/* Historical Actuals Line */}
                    <Line
                      type="monotone"
                      dataKey="Historical Actual"
                      stroke="#17324D"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#17324D', strokeWidth: 1, stroke: '#FFFFFF' }}
                      activeDot={{ r: 5, fill: '#17324D' }}
                      connectNulls={false}
                    />

                    {/* Baseline Moving Average */}
                    <Line
                      type="monotone"
                      dataKey="7-Day Moving Avg"
                      stroke="#667085"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                      connectNulls={false}
                    />

                    {/* Ridge ML Forecast */}
                    <Line
                      type="monotone"
                      dataKey="ML Ridge Forecast"
                      stroke="#0D9488"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#0D9488', strokeWidth: 1, stroke: '#FFFFFF' }}
                      activeDot={{ r: 6, fill: '#0D9488' }}
                      connectNulls={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  title="No Forecast Generated"
                  description="Select a pharmaceutical product SKU above to calculate machine learning demand forecasts."
                  actionLabel="Reload Forecast"
                  onAction={loadForecast}
                />
              )}
            </div>

            {/* Model Provenance Banner */}
            <div className="mt-6 p-4 rounded-xl bg-[#F7F9FC] border border-[#E5EAF0] flex items-start gap-3">
              <div className="p-2 rounded-lg bg-teal-50 text-[#0D9488] shrink-0">
                <Info className="w-4 h-4" />
              </div>
              <div className="text-xs text-[#667085] leading-relaxed">
                <span className="font-semibold text-[#172B3A]">Production Provenance: </span>
                Calibrated against {forecastResult?.evaluation?.history_days || 90} daily observations for {selectedProduct?.name || 'selected SKU'}. Residual metrics are computed strictly on an isolated {forecastResult?.evaluation?.holdout_sample_size || 14}-day holdout window to eliminate backtesting lookahead bias.
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Model Benchmarks & Horizon Distribution (32%) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card: Model Accuracy Comparison */}
          <Card className="p-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF0]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#172B3A]">
                Algorithm Benchmark
              </h4>
              <Badge variant="success" size="sm">Holdout Validated</Badge>
            </div>

            <div className="py-4 space-y-4">
              {/* ML Ridge Progress */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-[#172B3A] flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-teal-600" />
                    Ridge Regression (Alpha=1.0)
                  </span>
                  <span className="font-bold text-teal-700">
                    MAE: {forecastResult?.evaluation?.mae ?? '--'}
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0D9488] rounded-full transition-all duration-500"
                    style={{
                      width: forecastResult?.evaluation?.mae
                        ? `${Math.min(100, Math.max(15, 100 - (forecastResult.evaluation.mae * 3)))}%`
                        : '85%'
                    }}
                  />
                </div>
              </div>

              {/* 7-Day Moving Average Baseline */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[#667085] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    7-Day Moving Avg Baseline
                  </span>
                  <span className="font-medium text-[#667085]">
                    MAE: {forecastResult?.evaluation?.baseline_ma_mae ?? '--'}
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-400 rounded-full transition-all duration-500"
                    style={{
                      width: forecastResult?.evaluation?.baseline_ma_mae
                        ? `${Math.min(100, Math.max(15, 100 - (forecastResult.evaluation.baseline_ma_mae * 3)))}%`
                        : '60%'
                    }}
                  />
                </div>
              </div>

              {/* Accuracy Delta Highlight */}
              {forecastResult?.evaluation?.baseline_ma_mae && (
                <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-100 flex items-center justify-between text-xs">
                  <span className="text-emerald-800 font-medium">Error Reduction vs Naive Baseline</span>
                  <span className="font-bold text-emerald-700 flex items-center gap-0.5">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    {Math.round(((forecastResult.evaluation.baseline_ma_mae - forecastResult.evaluation.mae) / forecastResult.evaluation.baseline_ma_mae) * 100)}% Better
                  </span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#E5EAF0] grid grid-cols-2 gap-2 text-center text-xs">
              <div className="p-2 rounded-lg bg-[#F7F9FC]">
                <div className="text-[10px] text-[#667085] uppercase">RMSE Error</div>
                <div className="font-bold text-[#172B3A] mt-0.5">{forecastResult?.evaluation?.rmse ?? '--'}</div>
              </div>
              <div className="p-2 rounded-lg bg-[#F7F9FC]">
                <div className="text-[10px] text-[#667085] uppercase">Holdout Sample</div>
                <div className="font-bold text-[#172B3A] mt-0.5">{forecastResult?.evaluation?.holdout_sample_size ?? 14} Days</div>
              </div>
            </div>
          </Card>

          {/* Card: Weekly Projected Distribution */}
          <Card className="p-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF0]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#172B3A]">
                Weekly Demand Aggregation
              </h4>
              <span className="text-[11px] text-[#667085]">{horizonDays}-Day Horizon</span>
            </div>

            <div className="pt-4 h-44 w-full">
              {weeklyDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF0" vertical={false} />
                    <XAxis dataKey="name" stroke="#667085" fontSize={11} tickLine={false} axisLine={{ stroke: '#E5EAF0' }} />
                    <YAxis stroke="#667085" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={(val: any) => [`${val} units`, 'Projected']}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E5EAF0',
                        borderRadius: '8px',
                        fontSize: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                      }}
                    />
                    <Bar dataKey="units" fill="#17324D" radius={[4, 4, 0, 0]}>
                      {weeklyDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#0D9488' : '#17324D'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-[#667085]">
                  No weekly distribution available
                </div>
              )}
            </div>

            <div className="mt-2 text-center text-[11px] text-[#667085]">
              First week requirement allocated with highest dispatch priority
            </div>
          </Card>
        </div>
      </div>

      {/* Daily Holdout Validation Ledger Table */}
      <Card id="evaluation" className="overflow-hidden scroll-mt-20">
        <CardHeader
          title="Holdout Evaluation Ledger & Daily Observations"
          subtitle="Direct daily comparison of real clinical consumption against ML predictions with individual residuals"
          action={
            <Button
              variant="outline"
              size="sm"
              icon={Download}
              onClick={handleExportCSV}
            >
              Export Ledger
            </Button>
          }
        />

        <div className="overflow-x-auto">
          <table className="table-enterprise">
            <thead>
              <tr>
                <th>Date</th>
                <th>Phase</th>
                <th className="text-right">Historical Actual</th>
                <th className="text-right">7-Day Moving Avg</th>
                <th className="text-right">Ridge ML Forecast</th>
                <th className="text-right">95% Interval</th>
                <th className="text-right">Residual / Variance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {forecastResult?.timeline?.slice(0, 14).map((pt: any, idx: number) => {
                const isForecast = pt.is_forecast;
                const residual = (!isForecast && pt.historical_actual != null && pt.ml_forecast != null)
                  ? Math.round((pt.historical_actual - pt.ml_forecast) * 10) / 10
                  : null;

                return (
                  <tr key={pt.date || idx}>
                    <td className="font-semibold text-[#172B3A]">
                      {pt.date}
                    </td>
                    <td>
                      <Badge variant={isForecast ? 'teal' : 'neutral'} size="sm">
                        {isForecast ? 'Projected' : 'Historical'}
                      </Badge>
                    </td>
                    <td className="text-right font-medium text-[#172B3A]">
                      {pt.historical_actual != null ? `${pt.historical_actual} units` : '—'}
                    </td>
                    <td className="text-right text-[#667085]">
                      {pt.baseline_ma != null ? `${Math.round(pt.baseline_ma * 10) / 10}` : '—'}
                    </td>
                    <td className="text-right font-bold text-teal-700">
                      {pt.ml_forecast != null ? `${Math.round(pt.ml_forecast * 10) / 10} units` : '—'}
                    </td>
                    <td className="text-right font-mono text-xs text-[#667085]">
                      {pt.lower_bound != null && pt.upper_bound != null
                        ? `[${Math.round(pt.lower_bound)} - ${Math.round(pt.upper_bound)}]`
                        : '—'}
                    </td>
                    <td className="text-right">
                      {residual !== null ? (
                        <span className={`font-mono text-xs font-semibold ${Math.abs(residual) <= (forecastResult?.evaluation?.mae || 10) ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {residual > 0 ? `+${residual}` : residual}
                        </span>
                      ) : (
                        <span className="text-[#667085] text-xs">—</span>
                      )}
                    </td>
                    <td>
                      {isForecast ? (
                        <span className="inline-flex items-center gap-1 text-xs text-teal-700 font-medium">
                          <Activity className="w-3.5 h-3.5" /> Projected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                          <ShieldCheck className="w-3.5 h-3.5" /> Calibrated
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default ForecastingPage;
