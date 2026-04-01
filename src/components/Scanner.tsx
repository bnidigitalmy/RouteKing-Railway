import React, { useRef, useState } from 'react';
import { Camera, Upload, Loader2, X, Banknote, MapPin, Hash, CheckCircle, User } from 'lucide-react';
import { extractParcelInfo } from '../lib/gemini';
import { cn } from '../lib/utils';

interface ScannerProps {
  onScan: (data: { recipientName?: string; address: string; trackingNumber: string; isCOD: boolean; codAmount?: number }) => void;
  onClose: () => void;
}

export function Scanner({ onScan, onClose }: ScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [scannedData, setScannedData] = useState<{recipientName?: string, address: string, trackingNumber: string} | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editTracking, setEditTracking] = useState('');
  const [isCOD, setIsCOD] = useState(false);
  const [codAmount, setCodAmount] = useState('');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        try {
          const result = await extractParcelInfo(base64);
          setScannedData(result);
          setEditName(result.recipientName || '');
          setEditAddress(result.address);
          setEditTracking(result.trackingNumber);
          setIsCOD(false);
          setCodAmount('');
        } catch (err: any) {
          const errMsg = err?.message || "Gagal membaca label.";
          setError(`${errMsg} Pastikan gambar label terang dan jelas.`);
          console.error("Scanner Error:", err);
        } finally {
          setIsScanning(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError("Gagal memproses gambar.");
      setIsScanning(false);
    }
  };

  const handleSubmit = () => {
    if (!editAddress || !editTracking) {
      setError("Sila isi alamat dan nombor tracking.");
      return;
    }
    if (isCOD && (!codAmount || isNaN(parseFloat(codAmount)))) {
      setError("Sila masukkan jumlah COD yang sah.");
      return;
    }

    onScan({
      recipientName: editName,
      address: editAddress,
      trackingNumber: editTracking,
      isCOD,
      codAmount: isCOD ? parseFloat(codAmount) : undefined
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl my-auto">
        <div className="p-4 border-b flex items-center justify-between bg-blue-600 text-white">
          <h3 className="font-bold text-lg">{scannedData ? 'Sahkan Maklumat' : 'Scan Label Parcel'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-blue-700 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {isScanning ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="animate-spin text-blue-600" size={48} />
              <p className="text-gray-600 font-medium animate-pulse">Sedang mengecam alamat...</p>
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
                  <User size={14} /> Nama Penerima
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
                  <MapPin size={14} /> Alamat Penghantaran
                </label>
                <textarea 
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  rows={3}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm text-gray-800 focus:border-blue-500 focus:ring-0 outline-none resize-none"
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
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl transition-all active:scale-95 shadow-lg mt-2"
              >
                <CheckCircle size={20} />
                Simpan Parcel
              </button>
            </div>
          ) : (
            <>
              <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mx-auto">
                <Camera size={40} />
              </div>
              
              <div className="text-center space-y-2">
                <p className="text-gray-600">Snap gambar label AWB (Shopee/Lazada/J&T) untuk ambil alamat secara automatik.</p>
              </div>

              <div className="grid grid-cols-1 w-full gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl transition-all active:scale-95 shadow-lg"
                >
                  <Camera size={20} />
                  Ambil Gambar
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-all"
                >
                  <Upload size={20} />
                  Pilih dari Galeri
                </button>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium border border-red-100 w-full text-center">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileUpload}
        />
      </div>
    </div>
  );
}
