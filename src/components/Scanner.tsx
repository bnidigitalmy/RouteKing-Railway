import React, { useRef, useState, useEffect } from 'react';
import { Camera, Upload, Loader2, X, Banknote, MapPin, Hash, CheckCircle, User as UserIcon, Folder, Edit2, Search, RefreshCw, Phone } from 'lucide-react';
import { extractParcelInfo } from '../lib/gemini';
import { cn } from '../lib/utils';
import { Parcel } from '../types';

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
  const [error, setError] = useState<string | null>(null);
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
        const parcel = onMarkScan(result.trackingNumber);
        if (parcel) {
          setFoundParcel(parcel);
        } else {
          setError(`Parcel dengan tracking ${result.trackingNumber} tidak dijumpai dalam senarai.`);
        }
        setIsScanning(false);
        return;
      }

      setScannedData(result);
      setEditName(sanitize(result.recipientName) || 'Tiada Nama');
      setEditPhone(sanitize(result.recipientPhone));
      setEditAddress(sanitize(result.address));
      setEditTracking(sanitize(result.trackingNumber));
      setEditGroup('');
      setIsCOD(!!result.isCOD);
      setCodAmount(result.codAmount ? String(result.codAmount) : '');
    } catch (err: any) {
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

  const handleSubmit = async () => {
    if (!editAddress || !editTracking) {
      setError("Sila isi alamat dan nombor tracking.");
      return;
    }
    if (isCOD && (!codAmount || isNaN(parseFloat(codAmount)))) {
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
      setError(err?.message || "Gagal simpan parcel.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center sm:p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white sm:rounded-2xl w-full max-w-md min-h-screen sm:min-h-0 overflow-hidden shadow-2xl flex flex-col">
        <div className={cn("p-4 border-b flex items-center justify-between text-white shrink-0", mode === 'mark' ? "bg-purple-600" : "bg-blue-600")}>
          <div className="flex flex-col">
            <h3 className="font-bold text-lg leading-tight">
              {mode === 'mark' ? 'Mod Menanda' : (scannedData ? 'Sahkan Maklumat' : 'Scan Label Parcel')}
            </h3>
            {quota && (
              <span className="text-[10px] font-black opacity-80 uppercase tracking-widest">
                Baki Scan Hari Ini: {quota.limit - quota.current} / {quota.limit}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-black/10 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6 flex-1 overflow-y-auto">
          {isCompressing ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <RefreshCw className="animate-spin text-blue-600" size={48} />
              <p className="text-gray-600 font-medium animate-pulse">Sedang mengecilkan saiz gambar...</p>
            </div>
          ) : isScanning ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="animate-spin text-blue-600" size={48} />
              <p className="text-gray-600 font-medium animate-pulse">Sedang mengecam label (OCR)...</p>
            </div>
          ) : foundParcel ? (
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
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "flex items-center justify-center gap-3 text-white font-bold py-5 px-6 rounded-2xl transition-all active:scale-95 shadow-xl",
                    mode === 'mark' ? "bg-purple-600 hover:bg-purple-700 shadow-purple-200" : "bg-blue-600 hover:bg-blue-700 shadow-blue-200"
                  )}
                >
                  <Camera size={28} />
                  <div className="text-left">
                    <p className="text-lg leading-none">Buka Kamera</p>
                    <p className="text-[10px] opacity-80 font-medium uppercase tracking-wider">Snap Label Sekarang</p>
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

              {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 w-full text-center space-y-2">
                  <p>{error}</p>
                  <p className="text-[10px] text-red-400 font-normal uppercase tracking-widest">
                    Tips: Pastikan gambar terang & jelas
                  </p>
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
