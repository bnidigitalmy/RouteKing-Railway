import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, AlertCircle, RefreshCw, Undo2, LogOut, ChevronRight } from 'lucide-react';
import { Parcel } from '../types';
import { cn } from '../lib/utils';

interface FailedDeliveryModalProps {
  parcel: Parcel;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (id: string, reason: string, status: 'failed' | 'retry' | 'return', photoUrl?: string) => Promise<void>;
}

const REASONS = [
  { id: 'tiada_orang', label: 'Tiada Orang di Rumah', status: 'retry' },
  { id: 'alamat_salah', label: 'Alamat Salah / Tak Jumpa', status: 'failed' },
  { id: 'reject', label: 'Pelanggan Reject Parcel', status: 'return' },
  { id: 'no_answer', label: 'Panggilan Tak Dijawab', status: 'retry' },
  { id: 'gate_locked', label: 'Pagar Berkunci', status: 'retry' },
  { id: 'request_delay', label: 'Pelanggan Minta Tangguh', status: 'retry' },
  { id: 'other', label: 'Sebab-sebab Lain', status: 'failed' },
] as const;

export const FailedDeliveryModal = ({ parcel, isOpen, onClose, onConfirm }: FailedDeliveryModalProps) => {
  const [selectedReason, setSelectedReason] = useState<typeof REASONS[number] | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    setIsCapturing(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' },
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setIsCapturing(false);
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        // Higher resolution for capture but scale down for storage
        const videoWidth = videoRef.current.videoWidth;
        const videoHeight = videoRef.current.videoHeight;
        
        // Target max width/height to keep under Firestore 1MB doc limit
        const MAX_DIM = 800;
        let width = videoWidth;
        let height = videoHeight;

        if (width > height) {
          if (width > MAX_DIM) {
            height *= MAX_DIM / width;
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width *= MAX_DIM / height;
            height = MAX_DIM;
          }
        }

        canvasRef.current.width = width;
        canvasRef.current.height = height;
        context.drawImage(videoRef.current, 0, 0, width, height);
        
        // Use 0.7 quality to save space
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.7);
        setPhotoUrl(dataUrl);
        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCapturing(false);
  };

  const handleConfirm = async () => {
    if (!selectedReason) return;
    setIsSaving(true);
    try {
      await onConfirm(parcel.id, selectedReason.label, selectedReason.status, photoUrl || undefined);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-black text-xl text-gray-900 tracking-tight flex items-center gap-2">
              <AlertCircle className="text-red-500" /> Gagal Hantar
            </h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
              Tracking: {parcel.trackingNumber}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Reason Selection */}
          <div className="space-y-3">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Pilih Sebab Kegagalan</p>
            <div className="grid grid-cols-1 gap-2">
              {REASONS.map((reason) => (
                <button
                  key={reason.id}
                  onClick={() => setSelectedReason(reason)}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left",
                    selectedReason?.id === reason.id 
                      ? "border-blue-600 bg-blue-50 text-blue-700 shadow-md translate-x-1" 
                      : "border-gray-100 hover:border-gray-200 text-gray-600"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      reason.status === 'retry' ? "bg-orange-100 text-orange-600" :
                      reason.status === 'return' ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600"
                    )}>
                      {reason.status === 'retry' ? <RefreshCw size={16} /> :
                       reason.status === 'return' ? <LogOut size={16} /> : <AlertCircle size={16} />}
                    </div>
                    <span className="font-black text-sm">{reason.label}</span>
                  </div>
                  <div className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                    reason.status === 'retry' ? "bg-orange-200 text-orange-800" :
                    reason.status === 'return' ? "bg-red-200 text-red-800" : "bg-gray-200 text-gray-800"
                  )}>
                    {reason.status}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Photo Capture */}
          <div className="space-y-3">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Bukti Bergambar (Wajib)</p>
            {!isCapturing && !photoUrl ? (
              <button 
                onClick={startCamera}
                className="w-full aspect-video bg-gray-100 rounded-3xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-3 text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-all group"
              >
                <div className="p-4 bg-white rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
                  <Camera size={32} />
                </div>
                <span className="font-black text-sm">Ambil Foto Bukti</span>
              </button>
            ) : isCapturing ? (
              <div className="relative aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 px-4">
                  <button 
                    onClick={stopCamera}
                    className="p-4 bg-white/20 backdrop-blur-md text-white rounded-2xl hover:bg-white/30 transition-colors"
                  >
                    <Undo2 size={24} />
                  </button>
                  <button 
                    onClick={takePhoto}
                    className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-xl active:scale-90 transition-transform"
                  >
                    <Camera size={32} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl">
                <img src={photoUrl!} className="w-full h-full object-cover" alt="Bukti Gagal" />
                <button 
                  onClick={() => { setPhotoUrl(null); startCamera(); }}
                  className="absolute top-4 right-4 p-2 bg-red-600 text-white rounded-full shadow-lg"
                >
                  <X size={20} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100 sticky bottom-0">
          <button
            onClick={handleConfirm}
            disabled={!selectedReason || !photoUrl || isSaving}
            className={cn(
              "w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2",
              selectedReason && photoUrl
                ? "bg-red-600 text-white shadow-xl shadow-red-200 hover:bg-red-700 active:scale-[0.98]"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            )}
          >
            {isSaving ? (
              <RefreshCw className="animate-spin" size={20} />
            ) : (
              <>Sahkan Kegagalan <ChevronRight size={18} /></>
            )}
          </button>
        </div>
      </motion.div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
