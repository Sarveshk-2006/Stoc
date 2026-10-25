import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { 
  Send, 
  CheckCheck, 
  ShieldCheck, 
  QrCode,
  Smartphone,
  Phone,
  RefreshCw,
  Languages,
  CheckCircle2
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
  language?: string;
  actionTaken?: string | null;
}

export const WhatsAppPage: React.FC = () => {
  const { addToast } = useAppStore();
  const [activeTab, setActiveTab] = useState<'bridge' | 'meta_cloud'>('bridge');

  // Bridge state
  const [bridgeStatus, setBridgeStatus] = useState<any>(null);
  const [loadingBridge, setLoadingBridge] = useState(false);
  const [pairingPhone, setPairingPhone] = useState('+91 99758 19201');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);

  // Chat simulator state
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_0',
      sender: 'bot',
      text: "🤖 *STOCKPILOT AI Mobile Assistant*\nAuthenticated as: *Elena Rostova* (SUPPLY_CHAIN_MANAGER)\nConnected via: *WhatsApp Linked Device Bridge (Baileys)*\n\nLanguage support: *English*, *हिंदी*, *मराठी*, *Hinglish*, *Minglish*.\n\nAvailable Commands:\n• *STATUS* - Network inventory & warehouse health\n• *STOCK <SKU>* - Check stock levels (e.g. `STOCK PRD-VAX-01`)\n• *ALERTS* - Active IoT cold-chain alerts\n• *TRANSFERS* - Pending inter-warehouse transfers\n• *APPROVE <TRF_ID>* - Approve transfer (Managers only)\n• *HUMAN* - Escalate to Operations Desk",
      time: '10:00 AM',
      language: 'English'
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);

  const loadLogs = useCallback(async () => {
    try {
      const logs = await api.whatsapp.getLogs();
      setWebhookLogs(logs);
    } catch (err: any) {
      console.warn("Could not fetch webhook logs:", err);
    }
  }, []);

  const loadBridgeStatus = useCallback(async () => {
    setLoadingBridge(true);
    try {
      const status = await api.whatsapp.getBridgeStatus();
      setBridgeStatus(status);
      if (status.pairingCode) {
        setPairingCode(status.pairingCode);
      }
    } catch (err: any) {
      console.warn("Could not fetch bridge status:", err);
    } finally {
      setLoadingBridge(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
    loadBridgeStatus();
    const interval = setInterval(loadBridgeStatus, 10000);
    return () => clearInterval(interval);
  }, [loadLogs, loadBridgeStatus]);

  const handlePairPhone = async () => {
    if (!pairingPhone.trim()) return;
    setPairingLoading(true);
    try {
      const res = await api.whatsapp.pairBridge(pairingPhone.trim());
      setPairingCode(res.pairing_code);
      addToast({
        type: 'success',
        title: 'Pairing Code Generated',
        message: `Code: ${res.pairing_code}. Enter in WhatsApp > Linked Devices > Link with phone number.`
      });
      loadBridgeStatus();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Pairing Request Failed', message: err.message });
    } finally {
      setPairingLoading(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const res = await api.whatsapp.simulateChat(text.trim());
      const botMsg: ChatMessage = {
        id: `bot_${Date.now()}`,
        sender: 'bot',
        text: res.reply_text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        language: res.language || 'English',
        actionTaken: res.action_taken
      };
      setMessages(prev => [...prev, botMsg]);
      loadLogs();
    } catch (err: any) {
      addToast({ type: 'error', title: 'WhatsApp query error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Page Header with Tab Controls */}
      <PageHeader
        category="Field Communications & Natural Language Interface"
        title="WhatsApp Bot, Linked Device Bridge & Multilingual NLP"
        subtitle="Connect any mobile SIM via Linked Device QR (Baileys) or Meta Cloud API. Ingests English, Hindi, and Marathi inquiries with real inventory lookups."
        actions={
          <div className="flex items-center gap-1.5 p-1 bg-white border border-[#E5EAF0] rounded-xl shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab('bridge')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'bridge'
                  ? 'bg-[#17324D] text-white shadow-xs'
                  : 'text-[#667085] hover:text-[#172B3A] hover:bg-[#F7F9FC]'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" /> Linked Device Bridge
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('meta_cloud')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'meta_cloud'
                  ? 'bg-[#17324D] text-white shadow-xs'
                  : 'text-[#667085] hover:text-[#172B3A] hover:bg-[#F7F9FC]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Meta Cloud Webhook
            </button>
          </div>
        }
      />

      {activeTab === 'bridge' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Live WhatsApp QR & Pairing Code */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="p-5 space-y-4">
              <CardHeader
                title="Linked Device Status"
                subtitle="Pairing channel for field warehouse personnel."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    icon={RefreshCw}
                    onClick={loadBridgeStatus}
                    disabled={loadingBridge}
                    loading={loadingBridge}
                  >
                    Refresh
                  </Button>
                }
              />

              {/* Status Pill */}
              <div className="p-3 rounded-xl bg-[#F7F9FC] border border-[#E5EAF0] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    bridgeStatus?.status === 'CONNECTED' 
                      ? 'bg-emerald-500' 
                      : bridgeStatus?.qrString
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-slate-400'
                  }`} />
                  <div>
                    <div className="font-semibold text-[#172B3A]">
                      {bridgeStatus?.status === 'CONNECTED' 
                        ? 'ONLINE & LINKED' 
                        : bridgeStatus?.qrString 
                        ? 'QR CODE READY' 
                        : bridgeStatus?.pairingCode 
                        ? 'PAIRING CODE READY'
                        : 'STANDBY / OFFLINE'}
                    </div>
                    <div className="text-[11px] text-[#667085]">
                      {bridgeStatus?.phone 
                        ? `+${bridgeStatus.phone} (${bridgeStatus.name || 'StockPilot Bot'})` 
                        : bridgeStatus?.qrString 
                        ? 'Live QR session ready to scan'
                        : 'Linked Device bridge is in standby mode'}
                    </div>
                  </div>
                </div>

                <Badge variant="teal" size="sm">
                  BAILEYS v2.3
                </Badge>
              </div>

              {/* Live QR Code Box / Active / Standby */}
              {bridgeStatus?.status === 'CONNECTED' ? (
                <div className="flex flex-col items-center justify-center p-6 border border-emerald-200 rounded-xl bg-emerald-50/50 text-center space-y-2.5">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                    WhatsApp Session Active
                  </div>
                  <p className="text-xs text-[#667085] font-mono">
                    Connected phone: +{bridgeStatus.phone}
                  </p>
                </div>
              ) : bridgeStatus?.qrString ? (
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#E5EAF0] rounded-xl bg-white text-center space-y-3">
                  <div className="p-3 bg-white rounded-xl shadow-xs border border-[#E5EAF0]">
                    <QRCodeSVG
                      value={bridgeStatus.qrString}
                      size={170}
                      level="M"
                    />
                  </div>
                  <div className="text-xs font-bold text-[#172B3A] uppercase tracking-wider">
                    Scan with WhatsApp on your Phone
                  </div>
                  <p className="text-xs text-[#667085] max-w-xs">
                    WhatsApp ➔ Settings ➔ <strong>Linked Devices</strong> ➔ <strong>Link a Device</strong>.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#E5EAF0] rounded-xl bg-[#F7F9FC] text-center space-y-2.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-500">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-[#172B3A] uppercase tracking-wider">
                    Bridge in Standby Mode
                  </div>
                  <p className="text-xs text-[#667085] max-w-xs">
                    Start the WhatsApp Web bridge worker or request an 8-digit pairing code below:
                  </p>
                  <code className="text-[11px] bg-white text-teal-800 px-2.5 py-1 rounded font-mono border border-[#E5EAF0]">
                    node scripts/whatsapp-web-bridge.js
                  </code>
                </div>
              )}

              {/* Phone Pairing Code Option */}
              <div className="p-4 rounded-xl bg-[#F7F9FC] border border-[#E5EAF0] space-y-2.5 text-xs">
                <div className="font-semibold text-[#172B3A] flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#0D9488]" />
                  Link with Phone Number Instead (Pairing Code)
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={pairingPhone}
                    onChange={(e) => setPairingPhone(e.target.value)}
                    placeholder="+91 99758 19201"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-[#E5EAF0] text-[#172B3A] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488]"
                  />
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handlePairPhone}
                    disabled={pairingLoading}
                    loading={pairingLoading}
                  >
                    Get Code
                  </Button>
                </div>

                {pairingCode && (
                  <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-center">
                    <span className="text-[10px] text-[#667085] uppercase font-semibold block">8-Digit Pairing Code:</span>
                    <span className="text-base font-bold font-mono tracking-widest text-teal-800">
                      {pairingCode}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right Column: Live WhatsApp Conversation & NLP Engine */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="flex flex-col h-[600px] overflow-hidden">
              {/* Chat Topbar */}
              <div className="p-4 border-b border-[#E5EAF0] flex items-center justify-between bg-[#F7F9FC]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#17324D] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    SP
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#172B3A] flex items-center gap-1.5">
                      StockPilot Logistics Desk
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                    </h3>
                    <div className="text-[11px] text-teal-700 flex items-center gap-1 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0D9488]" />
                      Multi-Lingual Autonomous Bot Online
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white border border-[#E5EAF0] text-[#172B3A] font-medium">
                  <Languages className="w-3.5 h-3.5 text-[#0D9488]" /> EN • HI • MR
                </div>
              </div>

              {/* Messages Body */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#F7F9FC]">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[75%] p-3.5 rounded-2xl text-xs shadow-xs ${
                        m.sender === 'user'
                          ? 'bg-[#0D9488] text-white rounded-tr-none'
                          : 'bg-white text-[#172B3A] rounded-tl-none border border-[#E5EAF0]'
                      }`}
                    >
                      <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
                      <div className="flex items-center justify-end gap-1.5 mt-1.5 text-[10px] opacity-75">
                        {m.language && (
                          <span className={`px-1.5 py-0.2 rounded font-semibold ${m.sender === 'user' ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#172B3A]'}`}>
                            {m.language}
                          </span>
                        )}
                        <span>{m.time}</span>
                        {m.sender === 'user' && <CheckCheck className="w-3 h-3" />}
                      </div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-xs text-[#667085] italic p-2">
                    <span className="w-2 h-2 rounded-full bg-[#0D9488] animate-bounce" />
                    StockPilot NLP Engine formulating authoritative response...
                  </div>
                )}
              </div>

              {/* Quick Multi-Lingual Prompt Pills */}
              <div className="p-2.5 bg-white border-t border-[#E5EAF0] flex items-center gap-1.5 overflow-x-auto text-xs text-[#667085]">
                <span className="text-[10px] uppercase font-bold text-[#667085] shrink-0">Try Asking:</span>
                <button
                  type="button"
                  onClick={() => handleSendMessage('Vaccine ka stock kitna hai?')}
                  className="px-2.5 py-1 rounded-lg bg-[#F7F9FC] border border-[#E5EAF0] hover:border-[#0D9488] hover:bg-teal-50 text-teal-800 shrink-0 font-medium text-[11px] cursor-pointer"
                >
                  🇮🇳 "Vaccine ka stock kitna hai?"
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage('Chicago hub cold room status kay ahe?')}
                  className="px-2.5 py-1 rounded-lg bg-[#F7F9FC] border border-[#E5EAF0] hover:border-[#0D9488] hover:bg-teal-50 text-teal-800 shrink-0 font-medium text-[11px] cursor-pointer"
                >
                  🚩 "Chicago hub cold room status kay ahe?"
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage('ALERTS')}
                  className="px-2.5 py-1 rounded-lg bg-[#F7F9FC] border border-[#E5EAF0] hover:border-[#0D9488] hover:bg-teal-50 text-[#172B3A] shrink-0 font-medium text-[11px] cursor-pointer"
                >
                  ⚡ "ALERTS"
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage('APPROVE TRF-ORD-JFK-101')}
                  className="px-2.5 py-1 rounded-lg bg-[#F7F9FC] border border-[#E5EAF0] hover:border-[#0D9488] hover:bg-teal-50 text-[#172B3A] shrink-0 font-medium text-[11px] cursor-pointer"
                >
                  ✓ "APPROVE TRF-ORD-JFK-101"
                </button>
              </div>

              {/* Chat Input Bar */}
              <div className="p-3 bg-white border-t border-[#E5EAF0] flex items-center gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type WhatsApp message in English, Hindi, or Marathi..."
                  className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-[#F7F9FC] border border-[#E5EAF0] text-[#172B3A] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488]"
                />
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => handleSendMessage()}
                  disabled={loading || !inputText.trim()}
                  icon={Send}
                >
                  Send
                </Button>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        /* Meta Cloud API Webhook Logs & Verification */
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <CardHeader
              title="Meta WhatsApp Cloud API Handshake Credentials"
              subtitle="Official Graph API webhook verification parameters and delivery audit receipts."
              action={<Badge variant="teal">Meta Cloud API</Badge>}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-3.5 rounded-xl bg-[#F7F9FC] border border-[#E5EAF0]">
                <span className="text-[10px] text-[#667085] uppercase font-bold block mb-1">Webhook URL:</span>
                <span className="text-teal-800 font-bold break-all">https://api.stockpilot.ai/api/v1/whatsapp/webhook</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F7F9FC] border border-[#E5EAF0]">
                <span className="text-[10px] text-[#667085] uppercase font-bold block mb-1">Verify Token:</span>
                <span className="text-teal-800 font-bold">stockpilot_wh_verify_secret_2026</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F7F9FC] border border-[#E5EAF0]">
                <span className="text-[10px] text-[#667085] uppercase font-bold block mb-1">Signature Validation:</span>
                <span className="text-[#172B3A] font-bold">HMAC-SHA256 (X-Hub-Signature)</span>
              </div>
            </div>
          </Card>

          {/* Webhook Delivery Logs Table */}
          <Card className="overflow-hidden">
            <CardHeader
              title={`Notification & Webhook Transaction Ledger (${webhookLogs.length})`}
              subtitle="Audit trail of all inbound mobile webhook events and dispatched replies."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  icon={RefreshCw}
                  onClick={loadLogs}
                >
                  Sync Logs
                </Button>
              }
            />

            <div className="overflow-x-auto">
              <table className="table-enterprise">
                <thead>
                  <tr>
                    <th>Correlation ID</th>
                    <th>Phone Number</th>
                    <th>Language</th>
                    <th>Incoming Message</th>
                    <th>Outgoing Reply</th>
                    <th>Delivery Status</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {webhookLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-xs text-[#667085]">
                        No WhatsApp logs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    webhookLogs.slice(0, 10).map((log) => (
                      <tr key={log.id}>
                        <td className="text-teal-800 font-mono text-xs">{log.id}</td>
                        <td className="font-semibold text-[#172B3A]">{log.from_number}</td>
                        <td>
                          <Badge variant="neutral" size="sm">
                            {log.language || 'English'}
                          </Badge>
                        </td>
                        <td className="text-[#172B3A] max-w-[180px] truncate">{log.incoming_text}</td>
                        <td className="text-[#667085] max-w-[220px] truncate">{log.outgoing_reply}</td>
                        <td>
                          <Badge
                            variant={
                              log.delivery_status === 'sent' || log.delivery_status === 'SIMULATED_LOCAL'
                                ? 'teal'
                                : 'navy'
                            }
                            size="sm"
                          >
                            {log.delivery_status || 'DELIVERED'}
                          </Badge>
                        </td>
                        <td className="text-[#667085] text-xs font-mono">
                          {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'Recent'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default WhatsAppPage;
