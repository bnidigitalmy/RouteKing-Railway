import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, Upload, Loader2, X, Banknote, MapPin, Hash, CheckCircle, User as UserIcon, Folder, Edit2, Search, RefreshCw, Phone, Zap, ZapOff, Image as ImageIcon } from 'lucide-react';
import { extractParcelInfo } from '../lib/gemini';
import { cn, hapticFeedback } from '../lib/utils';
import { Parcel } from '../types';

// Simple Beep Sound using Web Audio API
let audioCtx: AudioContext | null = null;

const playBeep = () => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.2);
  } catch (e) {
    console.warn("Audio context not supported or blocked:", e);
  }
};

const playErrorSound = () => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    // Play two low beeps for error
    [0, 0.15].forEach((delay) => {
      const oscillator = audioCtx!.createOscillator();
      const gainNode = audioCtx!.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx!.destination);

      oscillator.type = 'square'; // Sharper sound for error
      oscillator.frequency.setValueAtTime(220, audioCtx!.currentTime + delay); // A3 note (low)
      gainNode.gain.setValueAtTime(0, audioCtx!.currentTime + delay);
      gainNode.gain.linearRampToValueAtTime(0.15, audioCtx!.currentTime + delay + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx!.currentTime + delay + 0.12);

      oscillator.start(audioCtx!.currentTime + delay);
      oscillator.stop(audioCtx!.currentTime + delay + 0.12);
    });
  } catch (e) {
    console.warn("Audio context error:", e);
  }
};

interface ScannerProps {
  onScan?: (data: { recipientName?: string; recipientPhone?: string; address: string; trackingNumber: string; isCOD: boolean; codAmount?: number; groupTag?: string }) => Promise<void> | void;
  onMarkScan?: (trackingNumber: string) => Parcel | undefined;
  onClose: () => void;
  mode?: 'scan' | 'mark';
  quota?: {
    current: number;
    limit: number;
  };
}

export function Scanner({ onScan, onMarkScan, onClose, mode = 'scan', quota }: ScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isContinuous, setIsContinuous] = useState(true); // Default to true for better UX
  const [lastScannedTracking, setLastScannedTracking] = useState<string | null>(null);
  const [lastScannedTime, setLastScannedTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [useLiveCamera, setUseLiveCamera] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  
  // Form states
  const [scannedData, setScannedData] = useState<{recipientName?: string, recipientPhone?: string, address: string, trackingNumber: string, isCOD?: boolean, codAmount?: number} | null>(null);
  const [foundParcel, setFoundParcel] = useState<Parcel | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editTracking, setEditTracking] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [isCOD, setIsCOD] = useState(false);
  const [codAmount, setCodAmount] = useState('');

  const startCamera = async () => {
    try {
      stopCamera(); // Ensure clean start
      const s = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setUseLiveCamera(false); // Fallback to file upload
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const captureFrame = () => {
    if (!videoRef.current) return null;
    
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.7);
  };

  // Start/Stop Camera
  useEffect(() => {
    if (useLiveCamera && !scannedData && !foundParcel) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [useLiveCamera, !!scannedData, !!foundParcel]);

  const compressImage = (base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Max width/height 1000px (optimized for speed vs accuracy)
        const MAX_SIZE = 1000;
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Compress to JPEG with 0.6 quality (smaller payload = faster upload)
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = base64;
    });
  };

  const processImage = async (base64: string) => {
    setIsCompressing(true);
    setError(null);

    try {
      const compressedBase64 = await compressImage(base64);
      setIsCompressing(false);
      setIsScanning(true);
      
      const result = await extractParcelInfo(compressedBase64);
      
      // Sanitize result to avoid "null" or "undefined" strings
      const sanitize = (val: any) => {
        if (val === null || val === undefined || String(val).toLowerCase() === 'null' || String(val).toLowerCase() === 'undefined') {
          return '';
        }
        return String(val).trim();
      };

      if (mode === 'mark' && onMarkScan) {
        // Prevent re-scanning the same tracking number too quickly in mark mode too
        if (result.trackingNumber === lastScannedTracking && Date.now() - lastScannedTime < 3000) {
          setIsScanning(false);
          return;
        }

        const parcel = onMarkScan(result.trackingNumber);
        if (parcel) {
          setFoundParcel(parcel);
          setLastScannedTracking(result.trackingNumber);
          setLastScannedTime(Date.now());
          playBeep();
          hapticFeedback('medium');
        } else {
          setError(`Parcel dengan tracking ${result.trackingNumber} tidak dijumpai dalam senarai.`);
        }
        setIsScanning(false);
        return;
      }

      // If continuous mode is on, auto-submit WITHOUT showing the form
      if (isContinuous && mode === 'scan') {
        // Prevent re-scanning the same tracking number too quickly
        if (result.trackingNumber === lastScannedTracking && Date.now() - lastScannedTime < 5000) {
          setIsScanning(false);
          return;
        }
        const dataToSubmit = {
          recipientName: sanitize(result.recipientName) || 'Tiada Nama',
          recipientPhone: sanitize(result.recipientPhone),
          address: sanitize(result.address),
          trackingNumber: sanitize(result.trackingNumber),
          isCOD: !!result.isCOD,
          codAmount: result.codAmount ? parseFloat(String(result.codAmount)) : undefined,
          groupTag: undefined
        };

        if (dataToSubmit.address && dataToSubmit.trackingNumber) {
          setIsSaving(true);
          try {
            if (onScan) {
              await onScan(dataToSubmit);
              playBeep(); // BEEP!
              hapticFeedback('success');
              setLastScannedTracking(dataToSubmit.trackingNumber);
              setLastScannedTime(Date.now());
              
              // Small delay to show "Auto-Saving" state
              setTimeout(() => {
                setIsSaving(false);
                // In file mode, we trigger click for next. In live mode, we just stay.
                if (!useLiveCamera) {
                  fileInputRef.current?.click();
                }
              }, 800);
            }
          } catch (err: any) {
            playErrorSound(); // Play error sound on duplicate or other save errors
            hapticFeedback('error');
            setError(err?.message || "Gagal simpan parcel.");
            setIsSaving(false);
          }
        } else {
          setError("Maklumat label tidak lengkap. Sila scan semula.");
        }
      } else {
        // Normal mode: Show the form for confirmation
        setScannedData(result);
        setEditName(sanitize(result.recipientName) || 'Tiada Nama');
        setEditPhone(sanitize(result.recipientPhone));
        setEditAddress(sanitize(result.address));
        setEditTracking(sanitize(result.trackingNumber));
        setEditGroup('');
        setIsCOD(!!result.isCOD);
        setCodAmount(result.codAmount ? String(result.codAmount) : '');
        
        if (mode === 'scan') {
          playBeep(); // Still beep when data is ready for confirmation
          hapticFeedback('light');
        }
      }
    } catch (err: any) {
      playErrorSound(); // Play error sound on extraction or duplicate error
      hapticFeedback('error');
      const errMsg = err?.message || "Gagal membaca label.";
      setError(`${errMsg} Pastikan gambar label terang dan jelas.`);
      console.error("Scanner Error:", err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      processImage(base64);
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be scanned again if needed
    event.target.value = '';
  };

  const handleManualCapture = () => {
    const base64 = captureFrame();
    if (base64) {
      processImage(base64);
    }
  };

  const handleSubmit = async () => {
    if (!editAddress || !editTracking) {
      playErrorSound();
      hapticFeedback('error');
      setError("Sila isi alamat dan nombor tracking.");
      return;
    }
    if (isCOD && (!codAmount || isNaN(parseFloat(codAmount)))) {
      playErrorSound();
      hapticFeedback('error');
      setError("Sila masukkan jumlah COD yang sah.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      if (onScan) {
        // Add a small delay for UI feedback
        await onScan({
          recipientName: editName,
          recipientPhone: editPhone,
          address: editAddress,
          trackingNumber: editTracking,
          isCOD,
          codAmount: isCOD ? parseFloat(codAmount) : undefined,
          groupTag: editGroup.trim() || undefined
        });
      }
    } catch (err: any) {
      playErrorSound();
      setError(err?.message || "Gagal simpan parcel.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center sm:p-4 backdrop-blur-md overflow-hidden">
      <div className="bg-white sm:rounded-[2.5rem] w-full max-w-md h-full sm:h-[90vh] overflow-hidden shadow-2xl flex flex-col relative">
        <div className={cn("p-5 border-b flex items-center justify-between text-white shrink-0 z-20 transition-all", mode === 'mark' ? "bg-purple-600" : "bg-blue-600", useLiveCamera && !scannedData && !foundParcel && "absolute top-0 inset-x-0 bg-transparent border-none shadow-none")}>
          <div className="flex flex-col">
            <h3 className="font-bold text-lg leading-tight drop-shadow-md">
              {mode === 'mark' ? 'Mod Menanda' : (scannedData ? 'Sahkan Maklumat' : 'Scan Label Parcel')}
            </h3>
            {quota && !scannedData && !foundParcel && (
              <span className="text-[10px] font-black opacity-90 uppercase tracking-widest drop-shadow-md">
                Baki: {quota.limit - quota.current} / {quota.limit}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {mode === 'scan' && !scannedData && !foundParcel && (
              <button 
                onClick={() => setIsContinuous(!isContinuous)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border-2 backdrop-blur-md shadow-lg",
                  isContinuous 
                    ? "bg-blue-600/80 text-white border-blue-400" 
                    : "bg-black/40 text-white/70 border-white/20"
                )}
              >
                {isContinuous ? '⚡ Laju: ON' : '⚡ Laju: OFF'}
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors drop-shadow-md">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className={cn("flex flex-col flex-1 overflow-y-auto relative", (!useLiveCamera || scannedData || foundParcel) && "p-6 gap-6")}>
          {(isCompressing || isScanning || isSaving) && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/20 backdrop-blur-[2px] animate-in fade-in duration-200">
              <div className="bg-white/90 p-6 rounded-[2rem] shadow-2xl border border-white/20 flex flex-col items-center gap-3 backdrop-blur-md">
                <div className="relative">
                  <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                  <Camera className="absolute inset-0 m-auto text-blue-400 animate-pulse" size={20} />
                </div>
                <div className="text-center">
                  <p className="text-gray-800 font-black text-sm">
                    {isCompressing ? 'Memproses...' : (isSaving ? 'Menyimpan...' : 'Membaca Label...')}
                  </p>
                </div>
                {isContinuous && (isScanning || isSaving) && (
                  <div className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest animate-bounce shadow-lg shadow-blue-500/50">
                    Auto-Saving...
                  </div>
                )}
              </div>
            </div>
          )}

          {foundParcel ? (
            <div className="flex flex-col items-center gap-6 py-4 animate-in zoom-in duration-300">
              <div className="text-center space-y-1">
                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Nombor Stop Anda</p>
                <div className="w-40 h-40 bg-purple-600 text-white rounded-full flex items-center justify-center text-8xl font-black shadow-[0_20px_50px_rgba(147,51,234,0.4)] border-8 border-purple-100">
                  {foundParcel.sequenceNumber}
                </div>
              </div>
              
              <div className="w-full bg-gray-50 p-4 rounded-2xl border-2 border-gray-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400 uppercase">Penerima</span>
                  <span className="text-sm font-black text-gray-800">{foundParcel.recipientName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400 uppercase">Tracking</span>
                  <span className="text-sm font-bold text-purple-600">{foundParcel.trackingNumber}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setFoundParcel(null);
                  fileInputRef.current?.click();
                }}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Camera size={20} />
                Scan Parcel Seterusnya
              </button>
            </div>
          ) : scannedData ? (
            <div className="space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="bg-green-50 p-3 rounded-xl border border-green-100 flex items-center gap-3 mb-2">
                <CheckCircle className="text-green-600" size={20} />
                <p className="text-xs font-bold text-green-800">Label Berjaya Dicam! Sila sahkan.</p>
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                  <Hash size={14} /> Tracking Number
                </label>
                <input 
                  type="text" 
                  value={editTracking}
                  onChange={(e) => setEditTracking(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:border-blue-500 focus:ring-0 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                  <UserIcon size={14} /> Nama Penerima
                </label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Contoh: Ali bin Abu"
                  className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:border-blue-500 focus:ring-0 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                  <Phone size={14} /> No. Phone Penerima
                </label>
                <input 
                  type="text" 
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Contoh: 0123456789"
                  className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:border-blue-500 focus:ring-0 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                  <MapPin size={14} /> Alamat Penghantaran
                </label>
                <textarea 
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  rows={3}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm text-gray-800 focus:border-blue-500 focus:ring-0 outline-none resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                  <Folder size={14} /> Tag Kawasan / Kumpulan (Pilihan)
                </label>
                <input 
                  type="text" 
                  value={editGroup}
                  onChange={(e) => setEditGroup(e.target.value)}
                  placeholder="Contoh: Taman Melati, Beg A"
                  className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:border-blue-500 focus:ring-0 outline-none"
                />
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-gray-700 flex items-center gap-2 cursor-pointer">
                    <Banknote size={18} className={isCOD ? "text-orange-500" : "text-gray-400"} />
                    Parcel COD?
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={isCOD}
                      onChange={(e) => setIsCOD(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                  </label>
                </div>

                {isCOD && (
                  <div className="pt-3 border-t border-gray-200 animate-in slide-in-from-top-2">
                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Jumlah COD (RM)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-500">RM</span>
                      <input 
                        type="number" 
                        step="0.01"
                        value={codAmount}
                        onChange={(e) => setCodAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full border-2 border-orange-200 rounded-xl py-3 pl-10 pr-3 font-black text-orange-600 focus:border-orange-500 focus:ring-0 outline-none bg-orange-50/50"
                      />
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium border border-red-100 w-full text-center">
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl transition-all active:scale-95 shadow-lg mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="animate-spin" size={20} />
                    Menyimpan & Geocoding...
                  </>
                ) : (
                  <>
                    <CheckCircle size={20} />
                    Simpan Parcel
                  </>
                )}
              </button>
            </div>
          ) : (
            <>
              {useLiveCamera ? (
                <div className="relative flex-1 w-full bg-black sm:rounded-3xl overflow-hidden shadow-2xl border-4 border-gray-100 min-h-[500px]">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  
                  {/* Minimal Scanning Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    <div className="w-[90%] h-[70%] border-2 border-white/20 rounded-[2rem] relative">
                      <div className="absolute inset-0 bg-white/5" />
                      {/* Corner Accents */}
                      <div className="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 border-blue-500 rounded-tl-[1.5rem]" />
                      <div className="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 border-blue-500 rounded-tr-[1.5rem]" />
                      <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 border-blue-500 rounded-bl-[1.5rem]" />
                      <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 border-blue-500 rounded-br-[1.5rem]" />
                    </div>
                    <div className="mt-8 flex flex-col items-center gap-2">
                      <p className="text-white font-black text-xs uppercase tracking-[0.3em] bg-blue-600/90 px-6 py-2 rounded-full backdrop-blur-md shadow-xl border border-blue-400/30">
                        Hala Kamera ke Label AWB
                      </p>
                      <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">
                        Pastikan tulisan jelas & terang
                      </p>
                    </div>
                  </div>

                  {/* Camera Controls */}
                  <div className="absolute bottom-10 inset-x-0 px-8 flex items-center justify-between">
                    <button 
                      onClick={() => setUseLiveCamera(false)}
                      className="w-16 h-16 bg-black/50 hover:bg-black/70 text-white rounded-2xl backdrop-blur-md transition-all flex items-center justify-center border border-white/20 shadow-lg"
                    >
                      <ImageIcon size={28} />
                    </button>
                    
                    <button 
                      onClick={handleManualCapture}
                      className="w-28 h-28 bg-white/20 rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all border-4 border-white/40 backdrop-blur-md"
                    >
                      <div className="w-22 h-22 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-xl">
                        <Camera size={44} />
                      </div>
                    </button>

                    <button 
                      onClick={() => setIsContinuous(!isContinuous)}
                      className={cn(
                        "w-16 h-16 rounded-2xl backdrop-blur-md transition-all border-2 flex items-center justify-center shadow-lg",
                        isContinuous ? "bg-blue-600 border-blue-400 text-white shadow-blue-500/50" : "bg-black/50 border-white/20 text-white/70"
                      )}
                    >
                      {isContinuous ? <Zap size={28} /> : <ZapOff size={28} />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className={cn(
                    "w-24 h-24 rounded-full flex items-center justify-center mx-auto",
                    mode === 'mark' ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"
                  )}>
                    {mode === 'mark' ? <Edit2 size={40} /> : <Camera size={40} />}
                  </div>
                  
                  <div className="text-center space-y-2">
                    <h4 className="font-black text-gray-800 text-lg">
                      {mode === 'mark' ? 'Scan & Tulis Nombor' : 'Snap Gambar Label'}
                    </h4>
                    <p className="text-gray-600 text-sm">
                      {mode === 'mark' 
                        ? 'Scan label untuk tahu nombor stop parcel ini. Tulis nombor tu besar-besar kat parcel!' 
                        : 'Snap gambar label AWB (Shopee/Lazada/J&T) untuk ambil alamat secara automatik.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 w-full gap-3">
                    <button
                      onClick={() => setUseLiveCamera(true)}
                      className={cn(
                        "flex items-center justify-center gap-3 text-white font-bold py-5 px-6 rounded-2xl transition-all active:scale-95 shadow-xl",
                        mode === 'mark' ? "bg-purple-600 hover:bg-purple-700 shadow-purple-200" : "bg-blue-600 hover:bg-blue-700 shadow-blue-200"
                      )}
                    >
                      <Camera size={28} />
                      <div className="text-left">
                        <p className="text-lg leading-none">Guna Live Camera</p>
                        <p className="text-[10px] opacity-80 font-medium uppercase tracking-wider">Scan Laju-Laju</p>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => galleryInputRef.current?.click()}
                      className="flex items-center justify-center gap-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-4 px-6 rounded-2xl transition-all active:scale-95"
                    >
                      <Upload size={20} className="text-gray-400" />
                      Pilih dari Galeri
                    </button>
                  </div>
                </div>
              )}

              {isContinuous && lastScannedTracking && (
                <div className="bg-green-50 text-green-700 p-3 rounded-2xl text-xs font-bold border border-green-100 animate-in fade-in slide-in-from-top-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} />
                    <span>Berjaya Simpan: {lastScannedTracking}</span>
                  </div>
                  <span className="text-[10px] bg-green-200 px-2 py-0.5 rounded-full">BEEP!</span>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 w-full text-center space-y-2">
                  <p>{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="absolute w-0 h-0 opacity-0 pointer-events-none"
          ref={fileInputRef}
          onChange={handleFileUpload}
        />
        <input
          type="file"
          accept="image/*"
          className="absolute w-0 h-0 opacity-0 pointer-events-none"
          ref={galleryInputRef}
          onChange={handleFileUpload}
        />
      </div>
    </div>
  );
}
