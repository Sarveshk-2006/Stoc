import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { IoTDevice, SensorReading, IoTAlert } from '../types';
import { KPICard } from '../components/KPICard';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Skeleton } from '../components/ui/Skeleton';
import { 
  ThermometerSnowflake, 
  Droplets, 
  Wifi, 
  AlertTriangle, 
  Radio, 
  Send,
  DoorOpen,
  DoorClosed,
  RefreshCw,
  Check
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';

export const IoTPage: React.FC = () => {
  const { addToast } = useAppStore();
  const [devices, setDevices] = useState<IoTDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('ESP32-COLD-CHI-01');
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [alerts, setAlerts] = useState<IoTAlert[]>([]);
  const [loading, setLoading] = useState(false);

  // Simulator injection states
  const [simTemp, setSimTemp] = useState(4.2);
  const [simHumidity, setSimHumidity] = useState(50.0);
  const [simDoorOpen, setSimDoorOpen] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [devData, readData, altData] = await Promise.all([
        api.iot.getDevices().catch(() => []),
        api.iot.getReadings(selectedDeviceId).catch(() => []),
        api.iot.getAlerts().catch(() => []),
      ]);
      setDevices(devData);
      setReadings(readData);
      setAlerts(altData);
      
      const currDev = devData.find(d => d.device_id === selectedDeviceId);
      if (currDev) {
        setSimTemp(currDev.current_temp);
        setSimHumidity(currDev.current_humidity);
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'IoT sync error', message: err.message });
    } finally {
      setLoading(false);
    }
  }, [selectedDeviceId, addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await api.iot.acknowledgeAlert(alertId);
      addToast({ type: 'success', title: 'Alert Acknowledged', message: 'Logged in compliance history.' });
      loadData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Acknowledgment failed', message: err.message });
    }
  };

  const handleInjectTelemetry = async () => {
    setSimulating(true);
    try {
      const res = await api.iot.injectSimulator({
        device_id: selectedDeviceId,
        temperature_c: simTemp,
        humidity_percent: simHumidity,
        door_open: simDoorOpen,
        battery_level_percent: 96.5,
      });

      if (res.alerts_triggered && res.alerts_triggered.length > 0) {
        addToast({
          type: 'warning',
          title: 'Cold-Chain Breach Triggered!',
          message: `${res.alerts_triggered[0].message}`
        });
      } else {
        addToast({
          type: 'success',
          title: 'Telemetry Ingested',
          message: `Storage conditions nominal at ${simTemp}°C.`
        });
      }
      loadData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Injection error', message: err.message });
    } finally {
      setSimulating(false);
    }
  };

  const activeDevice = devices.find(d => d.device_id === selectedDeviceId);
  
  const chartData = useMemo(() => {
    return readings.map(r => ({
      time: r.timestamp ? r.timestamp.substring(11, 16) : '',
      'Temperature (°C)': r.temperature_c,
      'Humidity (%)': r.humidity_percent,
    }));
  }, [readings]);

  const unackAlerts = useMemo(() => {
    return alerts.filter(a => !a.acknowledged);
  }, [alerts]);

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <PageHeader
        category="Cold-Chain Environmental Telemetry & IoT"
        title="IoT Warehouse Storage Telemetry & Anomaly Detection"
        subtitle="Monitors real-time ultra-low vaccine cold rooms, insulin vaults, and ambient pharmaceutical aisles with automated excursion alerts."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Device Switcher */}
            <div className="flex items-center gap-2 bg-white border border-[#E5EAF0] shadow-xs rounded-xl px-3 py-1.5 text-xs text-[#172B3A]">
              <Radio className="w-4 h-4 text-[#0D9488]" />
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="bg-transparent border-none text-[#172B3A] font-medium focus:outline-none cursor-pointer pr-2"
              >
                {devices.map(d => {
                  const statusTag = d.connectivity_status ? d.connectivity_status.toUpperCase() : (d.is_online ? "ONLINE" : "OFFLINE");
                  return (
                    <option key={d.device_id} value={d.device_id}>
                      {d.device_name} [{statusTag}] ({d.storage_zone.split('(')[0]})
                    </option>
                  );
                })}
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={loadData}
              disabled={loading}
              loading={loading}
            >
              Sync
            </Button>
          </div>
        }
      />

      {/* Gauges & Status Cards for Active Device */}
      {activeDevice ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Storage Temperature"
            value={`${activeDevice.current_temp.toFixed(1)}°C`}
            subtitle={`Safe: ${activeDevice.temp_min_threshold}°C to ${activeDevice.temp_max_threshold}°C`}
            change={
              activeDevice.current_temp >= activeDevice.temp_min_threshold && activeDevice.current_temp <= activeDevice.temp_max_threshold
                ? "In Spec"
                : "Excursion"
            }
            isPositive={activeDevice.current_temp >= activeDevice.temp_min_threshold && activeDevice.current_temp <= activeDevice.temp_max_threshold}
            statusDotColor={
              activeDevice.current_temp >= activeDevice.temp_min_threshold && activeDevice.current_temp <= activeDevice.temp_max_threshold
                ? "bg-teal-500"
                : "bg-rose-500"
            }
            icon={ThermometerSnowflake}
          />
          <KPICard
            title="Storage Humidity"
            value={`${activeDevice.current_humidity.toFixed(1)}%`}
            subtitle={`Threshold: < ${activeDevice.humidity_max_threshold}%`}
            isPositive={activeDevice.current_humidity <= activeDevice.humidity_max_threshold}
            statusDotColor="bg-blue-500"
            icon={Droplets}
          />
          <KPICard
            title="Sensor Connectivity"
            value={activeDevice.connectivity_status ? activeDevice.connectivity_status.toUpperCase() : (activeDevice.is_online ? "ONLINE" : "OFFLINE")}
            subtitle={activeDevice.last_seen_text ? `Last Ping: ${activeDevice.last_seen_text}` : `MAC: ${activeDevice.mac_address}`}
            isPositive={activeDevice.connectivity_status === 'online' || (activeDevice.connectivity_status === undefined && activeDevice.is_online)}
            statusDotColor="bg-emerald-500"
            icon={Wifi}
          />
          <KPICard
            title="Excursion Incidents"
            value={unackAlerts.length}
            subtitle={`${alerts.length} total event logs`}
            change={unackAlerts.length > 0 ? "Requires Review" : "Nominal"}
            isPositive={unackAlerts.length === 0}
            statusDotColor={unackAlerts.length > 0 ? "bg-rose-500" : "bg-emerald-500"}
            icon={AlertTriangle}
          />
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : null}

      {/* Main Historical Chart & Interactive Hardware Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 24-Hour Telemetry Line Chart */}
        <Card className="p-5 lg:col-span-2 space-y-4">
          <CardHeader
            title={`24-Hour Thermal Continuity Chart (${activeDevice?.storage_zone || 'Active Zone'})`}
            subtitle="Hourly temperature readings demonstrating strict continuous cold-chain compliance."
            action={<Badge variant="teal">24 Intervals</Badge>}
          />

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF0" vertical={false} />
                <XAxis dataKey="time" stroke="#667085" fontSize={11} tickLine={false} axisLine={{ stroke: '#E5EAF0' }} />
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
                <Line
                  type="monotone"
                  dataKey="Temperature (°C)"
                  stroke="#0D9488"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#0D9488' }}
                />
                <Line
                  type="monotone"
                  dataKey="Humidity (%)"
                  stroke="#17324D"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Interactive Hardware Simulator Tool - VISIBLY ISOLATED FROM PRODUCTION */}
        <Card className="p-5 lg:col-span-1 space-y-4 border-amber-200 bg-amber-50/20">
          <CardHeader
            title="ESP32 Telemetry Injector"
            subtitle="Diagnostic test harness for simulating thermal drift and door ajar incidents."
            action={<Badge variant="warning">SIMULATOR LAB</Badge>}
          />

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
            <strong>Isolated Test Injection:</strong> Injected readings are marked with <code className="font-mono text-[10px] px-1 py-0.5 bg-amber-200/50 rounded">is_simulated: true</code> to prevent corrupting physical sensor history.
          </div>

          <div className="space-y-4 text-xs">
            {/* Temp Slider */}
            <div>
              <div className="flex justify-between items-center mb-1.5 font-semibold text-[#172B3A]">
                <span>Simulate Temperature</span>
                <span className={`font-mono text-sm font-bold ${simTemp > (activeDevice?.temp_max_threshold || 8) ? 'text-amber-700' : 'text-teal-700'}`}>
                  {simTemp.toFixed(1)}°C
                </span>
              </div>
              <input
                type="range"
                min="-30"
                max="35"
                step="0.5"
                value={simTemp}
                onChange={(e) => setSimTemp(parseFloat(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#667085] mt-1">
                <span>-30°C Cryo</span>
                <span>Safe: 2°C - 8°C</span>
                <span>+35°C Surge</span>
              </div>
            </div>

            {/* Humidity Slider */}
            <div>
              <div className="flex justify-between items-center mb-1.5 font-semibold text-[#172B3A]">
                <span>Simulate Humidity</span>
                <span className="font-mono text-sm font-bold text-teal-700">{simHumidity.toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="95"
                step="5"
                value={simHumidity}
                onChange={(e) => setSimHumidity(parseFloat(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />
            </div>

            {/* Door Switch */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-[#E5EAF0] bg-white">
              <div className="flex items-center gap-2 font-semibold text-[#172B3A]">
                {simDoorOpen ? <DoorOpen className="w-4 h-4 text-amber-600" /> : <DoorClosed className="w-4 h-4 text-teal-700" />}
                <span>Cold Bay Door Ajar</span>
              </div>
              <button
                type="button"
                onClick={() => setSimDoorOpen(!simDoorOpen)}
                className={`text-[10px] font-bold px-2 py-1 rounded transition-colors cursor-pointer ${
                  simDoorOpen ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {simDoorOpen ? 'DOOR AJAR' : 'CLOSED'}
              </button>
            </div>

            <Button
              variant="primary"
              size="md"
              className="w-full"
              icon={Send}
              onClick={handleInjectTelemetry}
              disabled={simulating}
              loading={simulating}
            >
              {simulating ? 'Transmitting to Simulator...' : 'Inject Simulated Reading'}
            </Button>
          </div>
        </Card>
      </div>

      {/* Active IoT Cold-Chain Alerts Table */}
      <Card className="overflow-hidden">
        <CardHeader
          title={`Cold-Chain Excursion & Environmental Incident Alerts (${alerts.length})`}
          subtitle="Mandatory quality compliance incident registry with managerial sign-off audit trail."
        />

        {alerts.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#667085]">
            ✓ All cold-chain zones operating strictly within defined temperature and humidity limits.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-enterprise">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Source Mode</th>
                  <th>Device Identifier</th>
                  <th>Incident Message</th>
                  <th className="text-right">Observed Value</th>
                  <th className="text-right">Safety Limit</th>
                  <th>Timestamp</th>
                  <th>Resolution Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alt) => (
                  <tr key={alt.id}>
                    <td>
                      <Badge variant={alt.severity === 'critical' ? 'danger' : 'warning'} size="sm">
                        {alt.severity}
                      </Badge>
                    </td>
                    <td>
                      <Badge variant={alt.is_simulated ? 'warning' : 'teal'} size="sm">
                        {alt.is_simulated ? 'SIMULATED' : 'ESP32 LIVE'}
                      </Badge>
                    </td>
                    <td className="font-mono text-teal-800 font-semibold">{alt.device_id}</td>
                    <td className="font-medium text-[#172B3A] max-w-sm">
                      {alt.message}
                    </td>
                    <td className="text-right font-bold text-rose-700">
                      {alt.reading_value.toFixed(1)}°C
                    </td>
                    <td className="text-right text-[#667085]">
                      {alt.threshold_value.toFixed(1)}°C
                    </td>
                    <td className="text-[#667085] text-xs font-mono">
                      {alt.timestamp ? alt.timestamp.substring(11, 19) : ''}
                    </td>
                    <td>
                      <Badge variant={alt.acknowledged ? 'success' : 'danger'} size="sm">
                        {alt.acknowledged ? 'ACKNOWLEDGED' : 'ACTIVE EXCURSION'}
                      </Badge>
                    </td>
                    <td className="text-right whitespace-nowrap">
                      {!alt.acknowledged ? (
                        <Button
                          variant="primary"
                          size="sm"
                          icon={Check}
                          onClick={() => handleAcknowledgeAlert(alt.id)}
                        >
                          Acknowledge
                        </Button>
                      ) : (
                        <span className="text-[11px] text-[#667085]">
                          Signed by {alt.acknowledged_by || 'Manager'}
                          {alt.acknowledged_at ? ` (${alt.acknowledged_at.substring(11, 16)})` : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default IoTPage;
