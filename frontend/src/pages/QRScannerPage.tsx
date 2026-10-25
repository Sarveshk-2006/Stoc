import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { Product, InventoryBatch, Warehouse } from '../types';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { 
  QrCode, 
  Search, 
  Printer, 
  ShieldAlert, 
  ArrowDownLeft, 
  ArrowUpRight,
  Barcode,
  RefreshCw,
  ClipboardCheck,
  Camera,
  CameraOff,
  SwitchCamera,
  Upload,
  Volume2,
  VolumeX,
  Download,
  SlidersHorizontal,
  PackagePlus,
  Boxes,
  MapPin,
  Truck,
  Building2,
  History,
  Info,
  Calendar,
  CheckCircle2,
  ThermometerSnowflake
} from 'lucide-react';

export const QRScannerPage: React.FC = () => {
  const { addToast } = useAppStore();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [recentMovements, setRecentMovements] = useState<any[]>([]);

  // Scan modes: 'camera' | 'upload' | 'manual'
  const [scanMode, setScanMode] = useState<'camera' | 'upload' | 'manual'>('camera');
  
  // Real-time camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Video & Scanner references
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);

  // Scan / Resolve state
  const [queryPayload, setQueryPayload] = useState('STOCKPILOT://SKU/PRD-VAX-01/ORG/org_triwiz_01');
  const [resolving, setResolving] = useState(false);
  const [resolvedResult, setResolvedResult] = useState<any>(null);
  const [resolutionError, setResolutionError] = useState<{ code: string; message: string } | null>(null);

  // Label generator view mode: 'batches' | 'products'
  const [labelGeneratorTab, setLabelGeneratorTab] = useState<'batches' | 'products'>('batches');

  // Floor operation modal state
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'RECEIVE' | 'DISPATCH' | 'ADJUST' | 'CYCLE_COUNT' | 'DAMAGE'>('RECEIVE');
  const [actionQty, setActionQty] = useState(50);
  const [actionReason, setActionReason] = useState('Floor workflow execution');
  const [actionDestination, setActionDestination] = useState('dest_boston_01');
  const [actionWarehouseId, setActionWarehouseId] = useState('wh_chicago_01');
  const [actionBatchId, setActionBatchId] = useState('');
  const [actionBin, setActionBin] = useState('BIN-A-01');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Product Registration Modal state
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [registerSubmitting, setRegisterSubmitting] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    sku: '',
    name: '',
    category: 'Biologics',
    description: '',
    unit: 'vials',
    unit_cost: 24.50,
    selling_price: 48.00,
    handling: 'cold_chain' as 'cold_chain' | 'deep_freeze' | 'ambient' | 'hazardous' | 'fragile',
    min_safety_stock: 50,
    reorder_point: 100,
    shelf_life_days: 365,
    initial_warehouse_id: 'wh_chicago_01',
    initial_quantity: 50,
    initial_bin: 'BIN-COLD-01'
  });

  // Audio beep synthesized via Web Audio API (identical to warehouse handheld scanners)
  const playScanBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Audio playback restrictions fallback
    }
  }, [soundEnabled]);

  const loadData = () => {
    api.products.list().then(prods => setProducts(prods)).catch(console.error);
    api.inventory.listBatches().then(b => setBatches(b)).catch(console.error);
    api.inventory.listMovements(10).then(m => setRecentMovements(m)).catch(console.error);
    api.warehouses.list().then(w => {
      setWarehouses(w);
      if (w.length > 0) {
        setActionWarehouseId(prev => prev || w[0].id);
        setNewProductForm(prev => ({
          ...prev,
          initial_warehouse_id: prev.initial_warehouse_id || w[0].id
        }));
      }
    }).catch(console.error);
  };

  const handleResolveCode = useCallback(async (codeToResolve?: string) => {
    const target = (codeToResolve !== undefined ? codeToResolve : queryPayload).trim();
    if (!target) return;
    setResolving(true);
    setResolutionError(null);
    try {
      const data = await api.products.resolveQr(target);
      setResolvedResult(data);
      setResolutionError(null);
      if (data.warehouse_id) setActionWarehouseId(data.warehouse_id);
      if (data.batch_id) setActionBatchId(data.batch_id);
      else if (data.active_batches && data.active_batches.length > 0) {
        setActionBatchId(data.active_batches[0].id);
      }
      addToast({
        type: 'success',
        title: 'Identifier Verified',
        message: `Validated ${data.resolved_type.toUpperCase()}: ${data.product_name || data.product?.name || data.batch?.batch_number}`
      });
    } catch (err: any) {
      setResolvedResult(null);
      setResolutionError({
        code: target,
        message: err.message || 'No product, batch, or transfer found matching QR payload.'
      });
      addToast({ type: 'error', title: 'Resolution Failed', message: err.message });
    } finally {
      setResolving(false);
    }
  }, [queryPayload, addToast]);

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const startDetectionLoop = useCallback(() => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;

      // 1. Native BarcodeDetector acceleration if available (Chrome 88+)
      if ("BarcodeDetector" in window) {
        try {
          const detector = new (window as any).BarcodeDetector({
            formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e"]
          });
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            const raw = barcodes[0].rawValue;
            if (raw !== lastScannedCode) {
              setLastScannedCode(raw);
              setQueryPayload(raw);
              playScanBeep();
              if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
              handleResolveCode(raw);
            }
          }
        } catch {
          // ignore frame detection errors
        }
      }
    }, 350);
  }, [lastScannedCode, handleResolveCode, playScanBeep]);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    setCameraActive(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Webcam access not supported in this browser environment.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
      }

      startDetectionLoop();
    } catch (err: any) {
      console.warn("Camera start failed, falling back to manual entry:", err);
      setCameraError(err.message || "Camera permission denied or camera device unavailable.");
      setCameraActive(false);
    }
  }, [cameraFacing, stopCamera, startDetectionLoop]);

  useEffect(() => {
    loadData();
    const urlCode = searchParams.get('code') || searchParams.get('batch') || searchParams.get('sku') || searchParams.get('id');
    if (urlCode) {
      setQueryPayload(urlCode);
      handleResolveCode(urlCode);
    } else {
      handleResolveCode('STOCKPILOT://SKU/PRD-VAX-01/ORG/org_triwiz_01');
    }
  }, [searchParams, handleResolveCode]);

  // Manage Real-Time Camera lifecycle
  useEffect(() => {
    if (scanMode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [scanMode, cameraFacing, startCamera, stopCamera]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const html5Qr = new Html5Qrcode("hidden-qr-reader");
      const decodedText = await html5Qr.scanFile(file, true);
      playScanBeep();
      setQueryPayload(decodedText);
      setLastScannedCode(decodedText);
      handleResolveCode(decodedText);
      addToast({
        type: 'success',
        title: 'Image Barcode Scanned',
        message: `Extracted: ${decodedText}`
      });
    } catch {
      addToast({
        type: 'error',
        title: 'Image Scan Failed',
        message: 'Could not detect a legible QR or Barcode in the uploaded image.'
      });
    }
  };



  const handleExecuteOperation = async () => {
    if (!resolvedResult) return;
    setSubmittingAction(true);

    const correlationId = `WEB-${actionType}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const productId = resolvedResult.product_id || resolvedResult.product?.id || 'prd_vax_01';
    const warehouseId = actionWarehouseId || resolvedResult.warehouse_id || resolvedResult.batch?.warehouse_id || 'wh_chicago_01';
    const batchId = actionBatchId || resolvedResult.batch_id || resolvedResult.batch?.id || resolvedResult.active_batches?.[0]?.id || 'bat_vax_chi_01';
    const batchNumber = resolvedResult.batch_number || resolvedResult.batch?.batch_number || `LOT-${Date.now().toString().slice(-4)}`;

    try {
      if (actionType === 'RECEIVE') {
        await api.inventory.receiveStock({
          correlation_id: correlationId,
          warehouse_id: warehouseId,
          product_id: productId,
          batch_number: batchNumber,
          supplier_reference: 'Vendor Delivery Direct',
          mfg_date: new Date().toISOString().split('T')[0],
          expiry_date: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
          quantity: actionQty,
          unit_cost: resolvedResult.unit_cost || 22.50,
          storage_bin: actionBin,
        });
      } else if (actionType === 'DISPATCH') {
        await api.inventory.dispatchStock({
          correlation_id: correlationId,
          warehouse_id: warehouseId,
          product_id: productId,
          destination_id: actionDestination,
          quantity: actionQty,
          batch_id: batchId,
          reason: actionReason,
        });
      } else if (actionType === 'ADJUST') {
        if (!batchId) {
          throw new Error("A valid active inventory batch is required to adjust stock quantity.");
        }
        await api.inventory.adjustStock({
          correlation_id: correlationId,
          warehouse_id: warehouseId,
          product_id: productId,
          batch_id: batchId,
          new_quantity: actionQty,
          reason: actionReason || 'Manual inventory reconciliation via QR scanner',
        });
      } else if (actionType === 'CYCLE_COUNT') {
        await api.inventory.cycleCount({
          correlation_id: correlationId,
          warehouse_id: warehouseId,
          product_id: productId,
          batch_id: batchId,
          counted_quantity: actionQty,
          storage_bin: actionBin,
          notes: actionReason,
        });
      } else if (actionType === 'DAMAGE') {
        await api.inventory.reportDamage({
          correlation_id: correlationId,
          warehouse_id: warehouseId,
          product_id: productId,
          batch_id: batchId,
          damaged_quantity: actionQty,
          reason: actionReason,
        });
      }

      addToast({
        type: 'success',
        title: 'Transaction Committed',
        message: `${actionType} of ${actionQty} units committed. Correlation ID: ${correlationId}`
      });
      setActionModalOpen(false);
      loadData();
      handleResolveCode(queryPayload);
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Transaction Rejected',
        message: err.message
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  // Client-side high-resolution PNG download for thermal labels
  const downloadQrCode = (svgId: string, filename: string) => {
    const svg = document.getElementById(svgId);
    if (!svg) {
      addToast({ type: 'error', title: 'Download Error', message: 'QR Code element not found in DOM.' });
      return;
    }
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    img.onload = () => {
      canvas.width = 512;
      canvas.height = 512;
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 512, 512);
        ctx.drawImage(img, 32, 32, 448, 448);
        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = `${filename}.png`;
        downloadLink.href = pngUrl;
        downloadLink.click();
        addToast({
          type: 'success',
          title: 'Label Downloaded',
          message: `Saved high-res PNG: ${filename}.png`
        });
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handlePrintLabels = () => {
    window.print();
  };

  // Product Registration Handler
  const handleRegisterProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductForm.sku.trim() || !newProductForm.name.trim()) {
      addToast({ type: 'error', title: 'Validation Error', message: 'Product SKU and Name are required.' });
      return;
    }

    setRegisterSubmitting(true);
    try {
      const cleanSku = newProductForm.sku.trim().toUpperCase();
      const createdProd = await api.products.create({
        sku: cleanSku,
        name: newProductForm.name.trim(),
        category: newProductForm.category.trim(),
        description: newProductForm.description.trim(),
        unit: newProductForm.unit,
        unit_cost: Number(newProductForm.unit_cost) || 15,
        selling_price: Number(newProductForm.selling_price) || 30,
        handling: newProductForm.handling,
        min_safety_stock: Number(newProductForm.min_safety_stock) || 50,
        reorder_point: Number(newProductForm.reorder_point) || 100,
        shelf_life_days: Number(newProductForm.shelf_life_days) || 365,
        weight_kg: 0.5
      });

      // If initial stock was specified, seed initial batch immediately
      if (newProductForm.initial_quantity > 0) {
        const correlationId = `INIT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const batchNum = `LOT-${cleanSku}-${new Date().getFullYear()}`;
        await api.inventory.receiveStock({
          correlation_id: correlationId,
          warehouse_id: newProductForm.initial_warehouse_id || 'wh_chicago_01',
          product_id: createdProd.id,
          batch_number: batchNum,
          supplier_reference: 'Initial Product Registration Stock',
          mfg_date: new Date().toISOString().split('T')[0],
          expiry_date: new Date(Date.now() + (newProductForm.shelf_life_days || 365) * 86400000).toISOString().split('T')[0],
          quantity: Number(newProductForm.initial_quantity),
          unit_cost: Number(newProductForm.unit_cost) || 15,
          storage_bin: newProductForm.initial_bin || 'BIN-A-01',
        });
      }

      addToast({
        type: 'success',
        title: 'Product Registered',
        message: `Registered ${createdProd.name} (${createdProd.sku}). Authoritative QR code generated.`
      });

      setRegisterModalOpen(false);
      loadData();

      // Automatically inspect the newly registered product
      const targetPayload = createdProd.qr_code_payload || `STOCKPILOT://SKU/${createdProd.sku}/ORG/${createdProd.org_id}`;
      setQueryPayload(targetPayload);
      handleResolveCode(targetPayload);
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Registration Rejected',
        message: err.message
      });
    } finally {
      setRegisterSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden container for image file decoding */}
      <div id="hidden-qr-reader" className="hidden" />

      {/* Embedded Print Styles for Clean Thermal Label Output */}
      <style>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          header, nav, aside, .no-print, .scanner-laser-line, button, input {
            display: none !important;
          }
          .printable-label {
            break-inside: avoid;
            page-break-inside: avoid;
            margin-bottom: 1.5rem;
            border: 2px solid #000 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* Top Page Header */}
      <div className="no-print">
        <PageHeader
          category="Floor Mobility & Barcode Inspection"
          title="QR & Barcode Inventory Tracking Engine"
          subtitle="Live camera video feed with auto-targeting reticle, ultrasonic scan feedback, GS1 / EAN decoding, instant authoritative database resolution, product registration, and ledger updates."
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={soundEnabled ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setSoundEnabled(!soundEnabled)}
                icon={soundEnabled ? <Volume2 className="w-4 h-4 text-[#0D9488]" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
                title="Toggle scanner audio feedback"
              >
                {soundEnabled ? 'Beep On' : 'Muted'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintLabels}
                icon={<Printer className="w-4 h-4 text-[#0D9488]" />}
              >
                Print Labels
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setRegisterModalOpen(true)}
                icon={<PackagePlus className="w-4 h-4" />}
              >
                Register Product
              </Button>
            </div>
          }
        />
      </div>

      {/* Top Split: Live Camera / Scanner Viewport & Resolution Display */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
        
        {/* Real-Time Optical Scanner Viewport */}
        <Card className="lg:col-span-6">
          <CardHeader
            title="Optical Scanner Viewport"
            subtitle="Webcam, uploaded images, and USB scanner gun input"
            badge={
              <Badge variant={cameraActive ? 'teal' : 'neutral'} dot>
                {cameraActive ? 'STREAM ACTIVE' : 'STREAM IDLE'}
              </Badge>
            }
          />
          
          <div className="space-y-4">
            {/* Scanner Mode Switcher */}
            <div className="flex items-center justify-between border-b border-[#E5EAF0] pb-3">
              <div className="flex items-center gap-1 bg-[#F7F9FC] p-1 rounded-xl border border-[#E5EAF0]">
                <button
                  type="button"
                  onClick={() => setScanMode('camera')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                    scanMode === 'camera'
                      ? 'bg-[#0D9488] text-white shadow-xs'
                      : 'text-[#667085] hover:text-[#172B3A]'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" /> Live Camera
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode('upload')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                    scanMode === 'upload'
                      ? 'bg-[#0D9488] text-white shadow-xs'
                      : 'text-[#667085] hover:text-[#172B3A]'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" /> Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode('manual')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                    scanMode === 'manual'
                      ? 'bg-[#0D9488] text-white shadow-xs'
                      : 'text-[#667085] hover:text-[#172B3A]'
                  }`}
                >
                  <Barcode className="w-3.5 h-3.5" /> Gun / Input
                </button>
              </div>

              {scanMode === 'camera' && cameraActive && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCameraFacing(prev => prev === 'environment' ? 'user' : 'environment')}
                    className="p-1.5 rounded-lg bg-[#F7F9FC] border border-[#E5EAF0] text-[#17324D] hover:bg-slate-100 transition-colors"
                    title="Switch Front/Rear Camera"
                  >
                    <SwitchCamera className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 transition-colors"
                    title="Stop Camera Stream"
                  >
                    <CameraOff className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Camera Viewport */}
            {scanMode === 'camera' && (
              <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-video border border-slate-800 shadow-inner flex items-center justify-center">
                {cameraActive ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />

                    {/* Animated Laser Scanning Line */}
                    <div className="scanner-laser-line" />

                    {/* Viewfinder Target Reticle */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-8">
                      <div className="relative w-48 h-48 sm:w-56 sm:h-56">
                        {/* Corner brackets in #0D9488 Teal */}
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#0D9488] rounded-tl-lg" />
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#0D9488] rounded-tr-lg" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#0D9488] rounded-bl-lg" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#0D9488] rounded-br-lg" />
                        
                        {/* Central crosshair */}
                        <div className="absolute inset-0 m-auto w-3 h-3 border border-[#0D9488]/40 rounded-full animate-ping" />
                      </div>
                    </div>

                    {/* Real-Time Status HUD */}
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/75 backdrop-blur-md text-[10px] font-mono text-[#0D9488] flex items-center gap-1.5 border border-[#0D9488]/30">
                      <span className="w-2 h-2 rounded-full bg-[#0D9488] animate-pulse" />
                      LIVE OPTICAL STREAM • {cameraFacing.toUpperCase()}
                    </div>

                    {lastScannedCode && (
                      <div className="absolute bottom-3 inset-x-3 p-2 rounded-xl bg-slate-900/90 backdrop-blur-md border border-[#0D9488]/40 text-[11px] font-mono text-[#0D9488] flex items-center justify-between">
                        <div className="truncate mr-2">
                          <span className="text-slate-400">DETECTED: </span>{lastScannedCode}
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0D9488]/20 text-[#0D9488] font-bold shrink-0">
                          RESOLVED
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center p-6 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div className="text-xs text-slate-300 font-semibold">Camera is currently paused or inactive</div>
                    {cameraError && (
                      <div className="text-[11px] text-rose-400 max-w-sm font-mono mx-auto">
                        {cameraError}
                      </div>
                    )}
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={startCamera}
                    >
                      Activate Optical Camera
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Upload Mode */}
            {scanMode === 'upload' && (
              <div className="p-8 border-2 border-dashed border-[#E5EAF0] rounded-xl text-center space-y-3 bg-[#F7F9FC]">
                <Upload className="w-8 h-8 text-[#0D9488] mx-auto" />
                <div className="text-xs font-bold text-[#172B3A]">
                  Drop QR / Barcode image file or browse from device
                </div>
                <p className="text-[11px] text-[#667085]">
                  Supports PNG, JPG, WEBP, carton packaging photos, and shipping manifests.
                </p>
                <label className="inline-block px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0D9488]/90 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors">
                  <span>Select Image File</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            )}

            {/* Manual Input Mode */}
            {scanMode === 'manual' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-[#172B3A] block mb-1">
                    Identifier String / Handheld Scanner Gun Input
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={queryPayload}
                      onChange={(e) => setQueryPayload(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleResolveCode()}
                      placeholder="e.g. PRD-VAX-01, BN-VX-2026-A1, or STOCKPILOT://SKU/..."
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-[#E5EAF0] text-[#172B3A] font-mono focus:outline-none focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488]/20"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                </div>

                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => handleResolveCode()}
                  disabled={resolving}
                  loading={resolving}
                  icon={<QrCode className="w-4 h-4" />}
                >
                  {resolving ? 'Resolving Identifier...' : 'Resolve Stock Record'}
                </Button>
              </div>
            )}

            {/* Quick Verification Samples */}
            <div className="pt-2 border-t border-[#E5EAF0]">
              <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block mb-2">
                Instant 1-Click Verification Samples:
              </span>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                <button
                  type="button"
                  onClick={() => {
                    const c = 'STOCKPILOT://SKU/PRD-VAX-01/ORG/org_triwiz_01';
                    setQueryPayload(c);
                    playScanBeep();
                    handleResolveCode(c);
                  }}
                  className="p-2 rounded-lg bg-[#F7F9FC] hover:bg-[#0D9488]/10 border border-[#E5EAF0] hover:border-[#0D9488]/40 text-left truncate text-[#0D9488] font-semibold transition-colors"
                >
                  ➔ PRD-VAX-01 (Vaccine SKU)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const c = 'STOCKPILOT://BATCH/BN-VX-2026-A1/WH/wh_chicago_01';
                    setQueryPayload(c);
                    playScanBeep();
                    handleResolveCode(c);
                  }}
                  className="p-2 rounded-lg bg-[#F7F9FC] hover:bg-[#0D9488]/10 border border-[#E5EAF0] hover:border-[#0D9488]/40 text-left truncate text-[#0D9488] font-semibold transition-colors"
                >
                  ➔ Batch BN-VX-2026-A1 (FEFO)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const c = '8901234567891';
                    setQueryPayload(c);
                    playScanBeep();
                    handleResolveCode(c);
                  }}
                  className="p-2 rounded-lg bg-[#F7F9FC] hover:bg-[#0D9488]/10 border border-[#E5EAF0] hover:border-[#0D9488]/40 text-left truncate text-[#0D9488] font-semibold transition-colors"
                >
                  ➔ Barcode: 8901234567891 (EAN)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const c = 'STOCKPILOT://TRANSFER/trf_001_chi_ny';
                    setQueryPayload(c);
                    playScanBeep();
                    handleResolveCode(c);
                  }}
                  className="p-2 rounded-lg bg-[#F7F9FC] hover:bg-[#0D9488]/10 border border-[#E5EAF0] hover:border-[#0D9488]/40 text-left truncate text-[#0D9488] font-semibold transition-colors"
                >
                  ➔ Transfer trf_001_chi_ny
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Resolved Details View / Invalid QR Diagnostic Display */}
        <Card className="lg:col-span-6">
          <CardHeader
            title="Authoritative Inventory Context"
            subtitle="Verified inventory & batch catalog records"
            badge={
              resolvedResult ? (
                <Badge variant="teal" dot>
                  VERIFIED ({resolvedResult.resolved_type?.toUpperCase()})
                </Badge>
              ) : resolutionError ? (
                <Badge variant="danger" dot>
                  RESOLUTION FAILED
                </Badge>
              ) : undefined
            }
          />

          <div className="space-y-4">
            {/* Diagnostic Error State for Invalid / Unrecognized QR */}
            {resolutionError && !resolvedResult && (
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/60 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-rose-100 text-rose-600 shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800">
                      Unrecognized or Invalid QR Identifier
                    </h4>
                    <div className="text-xs text-rose-700 mt-1">
                      {resolutionError.message}
                    </div>
                    <div className="mt-2 p-2 rounded-lg bg-white border border-rose-200 font-mono text-[11px] text-[#172B3A] break-all">
                      <span className="font-bold text-[#667085]">Payload: </span>{resolutionError.code}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-[#667085] space-y-1 pl-1">
                  <div className="font-bold text-[#172B3A]">Diagnostic Troubleshooting:</div>
                  <div>• Verify whether this item belongs to your current organization tenant.</div>
                  <div>• Ensure the barcode format conforms to GS1-128, EAN-13, or StockPilot URI protocols.</div>
                  <div>• If this is a newly received pharma product, you can register it into the catalog immediately.</div>
                </div>

                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setNewProductForm(prev => ({
                        ...prev,
                        sku: resolutionError.code.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20).toUpperCase() || 'NEW-SKU-01',
                        name: `New Scanned Item (${resolutionError.code.slice(0, 12)})`
                      }));
                      setRegisterModalOpen(true);
                    }}
                    icon={<PackagePlus className="w-3.5 h-3.5" />}
                  >
                    Register Product with this Code
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setScanMode('manual');
                      setResolutionError(null);
                    }}
                  >
                    Manual SKU Search
                  </Button>
                </div>
              </div>
            )}

            {/* Idle Placeholder */}
            {!resolvedResult && !resolutionError && (
              <div className="p-12 text-center text-xs text-[#667085] border border-dashed border-[#E5EAF0] rounded-xl space-y-2 bg-[#F7F9FC]">
                <QrCode className="w-8 h-8 mx-auto text-slate-300" />
                <div>Point camera at a pharmaceutical barcode or click a demo payload above to inspect records and trigger floor ledger operations.</div>
              </div>
            )}

            {/* Validated Product / Batch / Transfer View */}
            {resolvedResult && (
              <div className="space-y-4 text-xs">
                {/* Product Header Card with Integrated QR Code */}
                <div className="p-4 rounded-xl bg-[#F7F9FC] border border-[#E5EAF0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-[#0D9488] text-sm">
                        {resolvedResult.sku || resolvedResult.product?.sku || 'SKU'}
                      </span>
                      <Badge variant="navy">
                        {resolvedResult.handling || resolvedResult.product?.handling || 'STANDARD'}
                      </Badge>
                      {resolvedResult.batch_number && (
                        <Badge variant="teal">
                          BATCH #{resolvedResult.batch_number}
                        </Badge>
                      )}
                    </div>
                    <h4 className="text-base font-bold text-[#172B3A] mt-1">
                      {resolvedResult.product_name || resolvedResult.product?.name || 'Item'}
                    </h4>
                    <div className="text-[11px] text-[#667085]">
                      {resolvedResult.storage_bin && `Storage Bin: ${resolvedResult.storage_bin} • `}
                      {resolvedResult.expiry_date && `Expiry: ${resolvedResult.expiry_date} • `}
                      Category: {resolvedResult.category || resolvedResult.product?.category || 'Biologics'}
                    </div>
                    <div className="text-[11px] font-mono text-[#667085]">
                      Warehouse: {resolvedResult.warehouse_id || actionWarehouseId} • Cost: ${resolvedResult.unit_cost ?? 20} / {resolvedResult.unit || 'unit'}
                    </div>
                  </div>

                  {/* Right side: Stock and QR Thumbnail with Download */}
                  <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
                    <div className="text-right">
                      <div className="text-[10px] text-[#667085] uppercase font-bold">Available Stock</div>
                      <div className="text-2xl font-black text-[#0D9488] font-mono-num">
                        {resolvedResult.total_available ?? resolvedResult.current_stock ?? 0}
                      </div>
                      <div className="text-[10px] text-[#667085]">{resolvedResult.unit || 'units'} on hand</div>
                    </div>

                    <div className="p-2 bg-white rounded-xl border border-[#E5EAF0] shadow-xs flex flex-col items-center">
                      <QRCodeSVG
                        id="active-resolved-qr"
                        value={resolvedResult.product?.qr_code_payload || queryPayload}
                        size={56}
                        level="M"
                      />
                      <button
                        type="button"
                        onClick={() => downloadQrCode('active-resolved-qr', `QR_${resolvedResult.sku || 'ITEM'}`)}
                        className="text-[9px] font-bold text-[#0D9488] hover:underline mt-1 flex items-center gap-0.5"
                        title="Download PNG"
                      >
                        <Download className="w-2.5 h-2.5" /> PNG
                      </button>
                    </div>
                  </div>
                </div>

                {/* 5 Real-Time Operations Buttons (Receive, Dispatch, Adjust, Count, Damage) */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setActionType('RECEIVE');
                      setActionModalOpen(true);
                    }}
                    icon={<ArrowDownLeft className="w-3.5 h-3.5" />}
                  >
                    Receive
                  </Button>
                  <Button
                    variant="navy"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setActionType('DISPATCH');
                      setActionModalOpen(true);
                    }}
                    icon={<ArrowUpRight className="w-3.5 h-3.5 text-[#0D9488]" />}
                  >
                    Dispatch
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full text-[#0D9488]"
                    onClick={() => {
                      setActionType('ADJUST');
                      setActionQty(resolvedResult.total_available ?? resolvedResult.current_stock ?? 50);
                      setActionReason('Physical inventory audit adjustment');
                      setActionModalOpen(true);
                    }}
                    icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
                  >
                    Adjust
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setActionType('CYCLE_COUNT');
                      setActionQty(resolvedResult.total_available ?? resolvedResult.current_stock ?? 50);
                      setActionModalOpen(true);
                    }}
                    icon={<ClipboardCheck className="w-3.5 h-3.5" />}
                  >
                    Count
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setActionType('DAMAGE');
                      setActionQty(1);
                      setActionReason('Inspection breakage report');
                      setActionModalOpen(true);
                    }}
                    icon={<ShieldAlert className="w-3.5 h-3.5" />}
                  >
                    Damage
                  </Button>
                </div>

                {/* Active Batches Breakdown */}
                {resolvedResult.active_batches && resolvedResult.active_batches.length > 0 && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[#172B3A] mb-2 flex items-center justify-between">
                      <span>Active Batches in Network ({resolvedResult.active_batches.length})</span>
                      <span className="text-[10px] text-[#667085] font-normal">FEFO Auto-Sorted</span>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {resolvedResult.active_batches.map((b: any) => (
                        <div
                          key={b.id}
                          className="p-3 rounded-xl border border-[#E5EAF0] bg-white flex items-center justify-between hover:border-[#0D9488]/40 transition-colors"
                        >
                          <div>
                            <span className="font-mono font-bold text-[#0D9488]">{b.batch_number}</span>
                            <span className="text-[#667085] ml-2 text-xs">({b.supplier_reference || 'Standard Lot'})</span>
                            <div className="text-[10px] text-[#667085] mt-0.5">
                              Bin: {b.storage_bin} • Expiry: {b.expiry_date}
                            </div>
                          </div>
                          <div className="text-right font-mono-num flex items-center gap-2">
                            <div>
                              <span className="font-bold text-[#172B3A]">{b.quantity} units</span>
                              <div className="text-[10px] text-[#0D9488] font-bold">ACTIVE</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setActionBatchId(b.id);
                                setActionWarehouseId(b.warehouse_id);
                                setActionType('ADJUST');
                                setActionQty(b.quantity);
                                setActionModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-[#F7F9FC] hover:bg-[#0D9488]/15 text-[#0D9488] transition-colors"
                              title="Adjust this batch"
                            >
                              <SlidersHorizontal className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Product Description & Clinical Handling Specification */}
                <div className="p-4 rounded-xl border border-[#E5EAF0] bg-white space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#172B3A]">
                    <Info className="w-4 h-4 text-[#0D9488]" />
                    Product Description & Handling Specifications
                  </div>
                  <p className="text-xs text-[#172B3A] leading-relaxed">
                    {resolvedResult.description || resolvedResult.product?.description || 'Clinical biopharmaceutical product certified for continuous temperature-monitored distribution.'}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#E5EAF0] text-[11px] font-mono">
                    <div className="p-2 rounded-lg bg-[#F7F9FC]">
                      <span className="text-[#667085] block text-[10px]">CATEGORY</span>
                      <span className="font-bold text-[#172B3A]">{resolvedResult.category || resolvedResult.product?.category || 'Biologics'}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-[#F7F9FC]">
                      <span className="text-[#667085] block text-[10px]">STORAGE TEMP</span>
                      <span className="font-bold text-[#0D9488]">
                        {resolvedResult.handling === 'cold_chain' ? '2.0°C – 8.0°C (Reefer)' : '15°C – 25°C (Ambient)'}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-[#F7F9FC]">
                      <span className="text-[#667085] block text-[10px]">UNIT SPEC</span>
                      <span className="font-bold text-[#172B3A]">${resolvedResult.unit_cost ?? 22.50} / {resolvedResult.unit || 'vial'}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-[#F7F9FC]">
                      <span className="text-[#667085] block text-[10px]">COMPLIANCE</span>
                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> GxP Certified
                      </span>
                    </div>
                  </div>
                </div>

                {/* Source Warehouse Origin & Destination Logistics Network */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Origin Source */}
                  <div className="p-4 rounded-xl border border-[#E5EAF0] bg-[#F7F9FC] space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#172B3A]">
                      <Building2 className="w-4 h-4 text-[#0D9488]" />
                      Source Origin Warehouse
                    </div>
                    <div>
                      <div className="font-bold text-sm text-[#172B3A]">
                        {resolvedResult.source_warehouse?.name || resolvedResult.warehouse?.name || 'Kolhapur Central Pharma Hub (KL-001)'}
                      </div>
                      <div className="text-[11px] text-[#667085] mt-0.5">
                        {resolvedResult.source_warehouse?.address || 'Plot 42, Shiroli MIDC, Kolhapur, Maharashtra 416122'}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="teal" size="sm">
                          Code: {resolvedResult.source_warehouse?.code || resolvedResult.warehouse_id || 'KL-001'}
                        </Badge>
                        <Badge variant="success" size="sm">
                          {resolvedResult.source_warehouse?.is_operational ? 'OPERATIONAL' : 'ONLINE'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Connected Destination Hubs */}
                  <div className="p-4 rounded-xl border border-[#E5EAF0] bg-[#F7F9FC] space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#172B3A]">
                      <Truck className="w-4 h-4 text-[#0D9488]" />
                      Authorized Destination Network
                    </div>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {(resolvedResult.destinations && resolvedResult.destinations.length > 0 ? resolvedResult.destinations : [
                        { id: 'dst_1', name: 'CPR Trauma & General Hospital', city: 'Kolhapur Central', type: 'Tertiary Hospital' },
                        { id: 'dst_2', name: 'Aster Aadhar Super Specialty Center', city: 'Sasane Nagar', type: 'Super Specialty' },
                        { id: 'dst_3', name: 'D.Y. Patil Medical College Hospital', city: 'Kadamwadi', type: 'Medical Center' }
                      ]).map((dst: any, i: number) => (
                        <div key={dst.id || i} className="p-2 rounded-lg bg-white border border-[#E5EAF0] flex items-center justify-between text-[11px]">
                          <div>
                            <span className="font-semibold text-[#172B3A]">{dst.name}</span>
                            <span className="text-[#667085] text-[10px] ml-1.5">({dst.city})</span>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 font-mono font-medium">
                            {dst.type || 'Clinical Center'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Chain-of-Custody Transaction & Movement History */}
                <div className="p-4 rounded-xl border border-[#E5EAF0] bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#172B3A]">
                      <History className="w-4 h-4 text-[#0D9488]" />
                      Immutable Chain-of-Custody Movement History
                    </div>
                    <span className="text-[10px] font-mono text-[#667085]">
                      SHA-256 Hash Chained
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="table-enterprise w-full text-left text-xs">
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>Action Type</th>
                          <th className="text-right">Quantity Delta</th>
                          <th className="text-right">Balance</th>
                          <th>Signatory / Actor</th>
                          <th>Audit Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(!resolvedResult.history || resolvedResult.history.length === 0) ? (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-xs text-[#667085]">
                              No prior movements recorded for this item. Initial stock receipt active.
                            </td>
                          </tr>
                        ) : (
                          resolvedResult.history.slice(0, 8).map((m: any, idx: number) => (
                            <tr key={m.id || idx}>
                              <td className="font-mono text-[11px] text-[#667085] whitespace-nowrap">
                                {m.timestamp ? m.timestamp.substring(0, 19).replace('T', ' ') : '2026-10-25 10:00'}
                              </td>
                              <td>
                                <Badge
                                  variant={
                                    m.movement_type === 'receipt'
                                      ? 'teal'
                                      : m.movement_type === 'dispatch'
                                      ? 'navy'
                                      : 'neutral'
                                  }
                                  size="sm"
                                >
                                  {m.movement_type?.toUpperCase() || 'MUTATION'}
                                </Badge>
                              </td>
                              <td className={`text-right font-bold font-mono text-xs ${m.quantity_changed > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                                {m.quantity_changed > 0 ? `+${m.quantity_changed}` : m.quantity_changed}
                              </td>
                              <td className="text-right font-semibold font-mono text-xs text-[#172B3A]">
                                {m.balance_after ?? m.quantity ?? 100}
                              </td>
                              <td className="text-xs text-[#172B3A]">{m.actor_name || 'System Operator'}</td>
                              <td className="text-xs text-[#667085] max-w-xs truncate">{m.reason || 'Floor replenishment'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Transfer Details Card if Resolved Type is Transfer */}
                {resolvedResult.resolved_type === 'transfer' && resolvedResult.transfer && (
                  <div className="p-3 rounded-xl border border-[#E5EAF0] bg-[#F7F9FC] space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[#172B3A]">Transfer Cargo Manifest:</span>
                      <Badge variant="teal">{resolvedResult.status}</Badge>
                    </div>
                    <div className="text-[11px] text-[#667085]">
                      From: {resolvedResult.source_warehouse?.name || 'Origin'} ➔ To: {resolvedResult.target_warehouse?.name || 'Destination'}
                    </div>
                    <div className="text-[10px] text-[#667085]">
                      Cargo: {resolvedResult.items?.map((i: any) => `${i.product_name} (${i.quantity} units)`).join(', ')}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Movement Audit Log for Floor Actions */}
      <Card className="no-print">
        <CardHeader
          title="Authoritative Floor Movement Audit Trail"
          subtitle="Real-time ACID transaction ledger synced movements"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              icon={<RefreshCw className="w-3.5 h-3.5 text-[#0D9488]" />}
            >
              Refresh Ledger
            </Button>
          }
        />

        <div className="overflow-x-auto">
          <table className="table-enterprise w-full text-left text-xs">
            <thead>
              <tr>
                <th className="py-2.5 px-3">Transaction ID</th>
                <th className="py-2.5 px-3">Action Type</th>
                <th className="py-2.5 px-3">Product / Batch</th>
                <th className="py-2.5 px-3">Route / Location</th>
                <th className="py-2.5 px-3">Quantity Delta</th>
                <th className="py-2.5 px-3">Actor</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAF0] font-mono text-[11px]">
              {recentMovements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[#667085] font-sans">
                    No recent inventory movements recorded.
                  </td>
                </tr>
              ) : (
                recentMovements.slice(0, 6).map((m: any) => (
                  <tr key={m.id} className="hover:bg-[#F7F9FC]">
                    <td className="py-2.5 px-3 text-[#0D9488] font-bold truncate max-w-[120px]">{m.id}</td>
                    <td className="py-2.5 px-3 uppercase font-bold text-[#172B3A]">{m.movement_type}</td>
                    <td className="py-2.5 px-3 text-[#172B3A]">{m.product_sku || m.product_name}</td>
                    <td className="py-2.5 px-3 text-[#667085]">{m.source_name} ➔ {m.destination_name}</td>
                    <td className={`py-2.5 px-3 font-bold ${m.quantity_changed > 0 ? 'text-[#0D9488]' : 'text-rose-600'}`}>
                      {m.quantity_changed > 0 ? `+${m.quantity_changed}` : m.quantity_changed} {m.unit}
                    </td>
                    <td className="py-2.5 px-3 text-[#667085]">{m.actor_name || 'Operator'}</td>
                    <td className="py-2.5 px-3">
                      <Badge variant="teal">
                        {m.resulting_status || 'COMMITTED'}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Batch & Product QR Generator Panel (Print & Download Ready) */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5EAF0] pb-4 no-print">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#172B3A]">
              Printable Pallet & Batch QR Label Generator
            </h3>
            <p className="text-[11px] text-[#667085] mt-0.5">
              Generates high-contrast printable thermal pallet labels with encoded GS1 / StockPilot batch and product identifiers.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#F7F9FC] rounded-xl border border-[#E5EAF0]">
            <button
              onClick={() => setLabelGeneratorTab('batches')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                labelGeneratorTab === 'batches'
                  ? 'bg-white text-[#172B3A] shadow-xs border border-[#E5EAF0]'
                  : 'text-[#667085] hover:text-[#172B3A]'
              }`}
            >
              Batch Pallet Labels ({batches.length})
            </button>
            <button
              onClick={() => setLabelGeneratorTab('products')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                labelGeneratorTab === 'products'
                  ? 'bg-white text-[#172B3A] shadow-xs border border-[#E5EAF0]'
                  : 'text-[#667085] hover:text-[#172B3A]'
              }`}
            >
              Product Catalog Codes ({products.length})
            </button>
          </div>
        </div>

        <div className="pt-4">
          {/* Tab 1: Batch Pallet Labels */}
          {labelGeneratorTab === 'batches' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {batches.map((b) => {
                const svgId = `batch-qr-${b.id}`;
                const qrValue = `${window.location.origin}/scanner?code=${encodeURIComponent(b.batch_number)}`;
                return (
                  <div
                    key={b.id}
                    className="printable-label p-5 rounded-2xl border-2 border-slate-900 bg-white text-slate-950 flex flex-col justify-between shadow-sm"
                  >
                    <div>
                      <div className="flex justify-between items-start border-b-2 border-slate-950 pb-2 mb-3">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-[#0D9488]">STOCKPILOT AI</span>
                          <h4 className="text-sm font-black tracking-tight">{b.product_name}</h4>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-[#17324D] text-white rounded">
                          {b.storage_bin}
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="p-2 border border-slate-300 rounded-xl bg-white shadow-xs shrink-0">
                          <QRCodeSVG
                            id={svgId}
                            value={qrValue}
                            size={88}
                            level="M"
                          />
                        </div>
                        <div className="space-y-1 text-[11px] font-mono">
                          <div><span className="font-bold text-slate-600">LOT:</span> {b.batch_number}</div>
                          <div><span className="font-bold text-slate-600">QTY:</span> {b.quantity} units</div>
                          <div><span className="font-bold text-slate-600">EXP:</span> {b.expiry_date}</div>
                          <div><span className="font-bold text-slate-600">REF:</span> {b.supplier_reference}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-2 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between items-center">
                      <span>Pallet Tag • <span className="font-mono font-bold text-[#0D9488]">FEFO MONITORED</span></span>
                      
                      <div className="flex items-center gap-1.5 no-print">
                        <button
                          type="button"
                          onClick={() => downloadQrCode(svgId, `Pallet_${b.batch_number}`)}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-[#0D9488]/15 text-[#0D9488] font-bold text-[10px] flex items-center gap-1 transition-colors"
                          title="Download PNG QR Label"
                        >
                          <Download className="w-3 h-3" /> PNG
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setQueryPayload(qrValue);
                            playScanBeep();
                            handleResolveCode(qrValue);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="px-2 py-1 rounded bg-[#17324D] hover:bg-[#17324D]/90 text-white font-bold text-[10px] flex items-center gap-1 transition-colors"
                          title="Scan this batch into inspector"
                        >
                          <QrCode className="w-3 h-3" /> Scan
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Tab 2: Product Catalog Labels */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((p) => {
                const svgId = `prod-qr-${p.id}`;
                const qrValue = `${window.location.origin}/scanner?code=${encodeURIComponent(p.sku)}`;
                return (
                  <div
                    key={p.id}
                    className="printable-label p-5 rounded-2xl border-2 border-slate-900 bg-white text-slate-950 flex flex-col justify-between shadow-sm"
                  >
                    <div>
                      <div className="flex justify-between items-start border-b-2 border-slate-950 pb-2 mb-3">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-[#0D9488]">STOCKPILOT AI</span>
                          <h4 className="text-sm font-black tracking-tight">{p.name}</h4>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-[#17324D] text-white rounded uppercase">
                          {p.handling}
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="p-2 border border-slate-300 rounded-xl bg-white shadow-xs shrink-0">
                          <QRCodeSVG
                            id={svgId}
                            value={qrValue}
                            size={88}
                            level="M"
                          />
                        </div>
                        <div className="space-y-1 text-[11px] font-mono">
                          <div><span className="font-bold text-slate-600">SKU:</span> {p.sku}</div>
                          <div><span className="font-bold text-slate-600">CAT:</span> {p.category}</div>
                          <div><span className="font-bold text-slate-600">BARCODE:</span> {p.barcode || '8901234567891'}</div>
                          <div><span className="font-bold text-slate-600">SHELF:</span> {p.shelf_life_days} days</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-2 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between items-center">
                      <span>Catalog Label • <span className="font-mono text-[#0D9488] font-bold">VALIDATED SKU</span></span>
                      
                      <div className="flex items-center gap-1.5 no-print">
                        <button
                          type="button"
                          onClick={() => downloadQrCode(svgId, `Product_${p.sku}`)}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-[#0D9488]/15 text-[#0D9488] font-bold text-[10px] flex items-center gap-1 transition-colors"
                          title="Download PNG QR Label"
                        >
                          <Download className="w-3 h-3" /> PNG
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setQueryPayload(qrValue);
                            playScanBeep();
                            handleResolveCode(qrValue);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="px-2 py-1 rounded bg-[#17324D] hover:bg-[#17324D]/90 text-white font-bold text-[10px] flex items-center gap-1 transition-colors"
                          title="Scan this product into inspector"
                        >
                          <QrCode className="w-3 h-3" /> Scan
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Floor Action Execution Modal (Receive, Dispatch, Adjust, Cycle Count, Damage) */}
      {actionModalOpen && resolvedResult && (
        <div className="fixed inset-0 z-50 bg-[#172B3A]/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
          <div className="w-full max-w-md rounded-2xl border border-[#E5EAF0] bg-white p-6 text-[#172B3A] space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E5EAF0] pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-[#172B3A]">
                <ClipboardCheck className="w-4 h-4 text-[#0D9488]" />
                Commit Floor Action: {actionType}
              </h3>
              <button
                type="button"
                onClick={() => setActionModalOpen(false)}
                className="text-[#667085] hover:text-[#172B3A] transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#F7F9FC] border border-[#E5EAF0] text-xs space-y-1">
              <div className="font-bold text-[#172B3A] text-sm">
                {resolvedResult.product_name || resolvedResult.product?.name} ({resolvedResult.sku || resolvedResult.product?.sku})
              </div>
              <div className="text-[11px] text-[#667085] font-mono">
                Facility: {actionWarehouseId} • Current Available: {resolvedResult.total_available ?? resolvedResult.current_stock ?? 0} {resolvedResult.unit || 'units'}
              </div>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              <div>
                <label className="block text-[#172B3A] font-bold mb-1">
                  {actionType === 'CYCLE_COUNT' ? 'Counted Physical Stock' : actionType === 'ADJUST' ? 'New Target Stock Quantity' : 'Quantity Units'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={actionQty}
                  onChange={(e) => setActionQty(parseInt(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl bg-[#F7F9FC] border border-[#E5EAF0] text-[#172B3A] font-mono focus:outline-none focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488]/20"
                />
              </div>

              {actionType === 'DISPATCH' && (
                <div>
                  <label className="block text-[#172B3A] font-bold mb-1">Destination Facility</label>
                  <select
                    value={actionDestination}
                    onChange={(e) => setActionDestination(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[#F7F9FC] border border-[#E5EAF0] text-[#172B3A] focus:outline-none focus:border-[#0D9488]"
                  >
                    <option value="dest_boston_01">Boston General Hospital (Level 1 Trauma)</option>
                    <option value="dest_metro_icu_02">Metropolitan Clinic ICU</option>
                    <option value="dest_mayo_pharma_03">Mayo Regional Dispensary</option>
                  </select>
                </div>
              )}

              {actionType === 'RECEIVE' && (
                <div>
                  <label className="block text-[#172B3A] font-bold mb-1">Storage Bay / Bin</label>
                  <input
                    type="text"
                    value={actionBin}
                    onChange={(e) => setActionBin(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[#F7F9FC] border border-[#E5EAF0] text-[#172B3A] font-mono focus:outline-none focus:border-[#0D9488]"
                  />
                </div>
              )}

              <div>
                <label className="block text-[#172B3A] font-bold mb-1">Reason / Operator Notes</label>
                <input
                  type="text"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="e.g. Scanned pallet receipt at loading dock 4"
                  className="w-full p-2.5 rounded-xl bg-[#F7F9FC] border border-[#E5EAF0] text-[#172B3A] focus:outline-none focus:border-[#0D9488]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5EAF0]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActionModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleExecuteOperation}
                disabled={submittingAction || (actionType !== 'ADJUST' && actionQty <= 0)}
                loading={submittingAction}
              >
                {submittingAction ? 'Committing Transaction...' : `Confirm ${actionType}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Product Registration Modal */}
      {registerModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#172B3A]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="w-full max-w-lg rounded-2xl border border-[#E5EAF0] bg-white p-6 text-[#172B3A] space-y-4 shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-[#E5EAF0] pb-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-[#172B3A]">
                  <PackagePlus className="w-4 h-4 text-[#0D9488]" />
                  Register New Product & Generate QR Code
                </h3>
                <p className="text-[11px] text-[#667085] mt-0.5">
                  Provisions product into organization registry with auto-generated barcode and QR identifier.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRegisterModalOpen(false)}
                className="text-[#667085] hover:text-[#172B3A] transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterProduct} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#172B3A] font-bold mb-1">Product SKU *</label>
                  <input
                    type="text"
                    required
                    value={newProductForm.sku}
                    onChange={(e) => setNewProductForm({ ...newProductForm, sku: e.target.value.toUpperCase() })}
                    placeholder="e.g. PRD-INSULIN-01"
                    className="w-full p-2 rounded-xl bg-[#F7F9FC] border border-[#E5EAF0] font-mono text-[#172B3A] uppercase focus:outline-none focus:border-[#0D9488]"
                  />
                </div>
                <div>
                  <label className="block text-[#172B3A] font-bold mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={newProductForm.name}
                    onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
                    placeholder="e.g. Recombinant Human Insulin 100IU"
                    className="w-full p-2 rounded-xl bg-[#F7F9FC] border border-[#E5EAF0] text-[#172B3A] focus:outline-none focus:border-[#0D9488]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#172B3A] font-bold mb-1">Category</label>
                  <select
                    value={newProductForm.category}
                    onChange={(e) => setNewProductForm({ ...newProductForm, category: e.target.value })}
                    className="w-full p-2 rounded-xl bg-[#F7F9FC] border border-[#E5EAF0] text-[#172B3A] focus:outline-none focus:border-[#0D9488]"
                  >
                    <option value="Biologics">Biologics / Vaccines</option>
                    <option value="Antibiotics">Antibiotics</option>
                    <option value="Cardiovascular">Cardiovascular</option>
                    <option value="Critical Care">Critical Care / ICU</option>
                    <option value="Medical Supplies">Medical Supplies</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#172B3A] font-bold mb-1">Handling Protocol</label>
                  <select
                    value={newProductForm.handling}
                    onChange={(e) => setNewProductForm({ ...newProductForm, handling: e.target.value as any })}
                    className="w-full p-2 rounded-xl bg-[#F7F9FC] border border-[#E5EAF0] text-[#172B3A] focus:outline-none focus:border-[#0D9488]"
                  >
                    <option value="cold_chain">Cold Chain (2°C - 8°C)</option>
                    <option value="deep_freeze">Deep Freeze (-20°C)</option>
                    <option value="ambient">Ambient (15°C - 25°C)</option>
                    <option value="hazardous">Hazardous / Bio-Hazard</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#172B3A] font-bold mb-1">Unit Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newProductForm.unit_cost}
                    onChange={(e) => setNewProductForm({ ...newProductForm, unit_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 rounded-xl bg-[#F7F9FC] border border-[#E5EAF0] font-mono text-[#172B3A] focus:outline-none focus:border-[#0D9488]"
                  />
                </div>
                <div>
                  <label className="block text-[#172B3A] font-bold mb-1">Selling Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newProductForm.selling_price}
                    onChange={(e) => setNewProductForm({ ...newProductForm, selling_price: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 rounded-xl bg-[#F7F9FC] border border-[#E5EAF0] font-mono text-[#172B3A] focus:outline-none focus:border-[#0D9488]"
                  />
                </div>
                <div>
                  <label className="block text-[#172B3A] font-bold mb-1">Shelf Life (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={newProductForm.shelf_life_days}
                    onChange={(e) => setNewProductForm({ ...newProductForm, shelf_life_days: parseInt(e.target.value) || 365 })}
                    className="w-full p-2 rounded-xl bg-[#F7F9FC] border border-[#E5EAF0] font-mono text-[#172B3A] focus:outline-none focus:border-[#0D9488]"
                  />
                </div>
              </div>

              {/* Initial Inventory Provisioning */}
              <div className="p-3 rounded-xl bg-[#0D9488]/10 border border-[#0D9488]/20 space-y-2 mt-2">
                <div className="text-[11px] font-bold text-[#172B3A] flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-[#0D9488]" />
                  Initial Inventory & Pallet Provisioning (Optional)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-[#667085] font-bold mb-0.5">Warehouse</label>
                    <select
                      value={newProductForm.initial_warehouse_id}
                      onChange={(e) => setNewProductForm({ ...newProductForm, initial_warehouse_id: e.target.value })}
                      className="w-full p-1.5 text-xs rounded-lg bg-white border border-[#E5EAF0] text-[#172B3A]"
                    >
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#667085] font-bold mb-0.5">Initial Quantity</label>
                    <input
                      type="number"
                      min="0"
                      value={newProductForm.initial_quantity}
                      onChange={(e) => setNewProductForm({ ...newProductForm, initial_quantity: parseInt(e.target.value) || 0 })}
                      className="w-full p-1.5 text-xs rounded-lg bg-white border border-[#E5EAF0] font-mono text-[#172B3A]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#667085] font-bold mb-0.5">Initial Bin</label>
                    <input
                      type="text"
                      value={newProductForm.initial_bin}
                      onChange={(e) => setNewProductForm({ ...newProductForm, initial_bin: e.target.value })}
                      className="w-full p-1.5 text-xs rounded-lg bg-white border border-[#E5EAF0] font-mono text-[#172B3A]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5EAF0]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRegisterModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={registerSubmitting}
                  loading={registerSubmitting}
                  icon={<PackagePlus className="w-4 h-4" />}
                >
                  {registerSubmitting ? 'Registering...' : 'Register & Generate QR'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QRScannerPage;
