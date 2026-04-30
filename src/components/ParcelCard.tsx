import React, { memo } from 'react';
import { MapPin, Navigation, CheckCircle2, Circle, ExternalLink, Banknote, User as UserIcon, Folder, MoreVertical, Phone, MessageSquare, Copy, Image as ImageIcon, X, Edit2, RefreshCw, AlertCircle, Package } from 'lucide-react';
import { Parcel, UserProfile } from '../types';
import { cn, getGoogleMapsLetter } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { ConfirmationModal } from './ui/ConfirmationModal';
import { useState } from 'react';

interface ParcelCardProps {
  parcel: Parcel;
  profile?: UserProfile | null;
  onStatusChange: (id: string, status: Parcel['status']) => void;
  onMoveClick?: () => void;
  onViewPOD?: (parcel: Parcel) => void;
}

export const ParcelCard = memo(function ParcelCard({ parcel, profile, onStatusChange, onMoveClick, onViewPOD }: ParcelCardProps) {
  const [showHantarConfirm, setShowHantarConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const openNavigation = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(parcel.address)}`;
    window.open(url, '_blank');
  };

  const makeCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!parcel.recipientPhone) return;
    window.location.href = `tel:${parcel.recipientPhone}`;
  };

  const sendWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!parcel.recipientPhone) return;
    
    // Clean phone number (remove non-digits)
    let phone = parcel.recipientPhone.replace(/\D/g, '');
    
    // Ensure it starts with 60 (Malaysia)
    if (phone.startsWith('0')) {
      phone = '6' + phone;
    } else if (!phone.startsWith('60')) {
      phone = '60' + phone;
    }

    const courierName = profile?.courierCompany || 'SPX Express';
    const tracking = parcel.trackingNumber;
    
    let messageText = `Hai! Saya rider ${courierName}. Parcel anda [${tracking}] akan sampai dalam 10-15 minit! 📦\n\n`;
    
    if (parcel.isCOD && parcel.codAmount) {
      messageText += `Ini adalah parcel COD (RM${parcel.codAmount.toFixed(2)}). Boleh bayar guna Cash atau QR DuitNow ya. 💵\n\n`;
    }
    
    messageText += `Sila sedia ya. Terima kasih! 🙏`;
    
    const message = encodeURIComponent(messageText);
    const url = `https://wa.me/${phone}?text=${message}`;
    window.open(url, '_blank');
  };

  const openWaze = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = parcel.lat && parcel.lng 
      ? `https://waze.com/ul?ll=${parcel.lat},${parcel.lng}&navigate=yes`
      : `https://waze.com/ul?q=${encodeURIComponent(parcel.address)}&navigate=yes`;
    window.open(url, '_blank');
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="relative"
    >
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', parcel.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        className={cn(
          "relative bg-white rounded-2xl p-4 shadow-sm border-2 transition-all active:scale-[0.98] cursor-grab active:cursor-grabbing",
          parcel.status === 'delivered' ? "border-green-100 bg-green-50/30" : 
          parcel.status === 'failed' ? "border-red-100 bg-red-50/30" : 
          parcel.status === 'retry' ? "border-orange-100 bg-orange-50/30" :
          parcel.status === 'return' ? "border-gray-200 bg-gray-50/50 grayscale" :
          "border-gray-50"
        )}
      >
      {parcel.status === 'return' && (
        <div className="absolute top-2 right-2 z-10">
          <span className="bg-gray-800 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">RETURN TO HUB</span>
        </div>
      )}
      <div className="flex gap-4">
        {/* Sequence Number Badge */}
        <div className={cn(
          "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center flex-col shadow-inner",
          parcel.status === 'delivered' 
            ? "bg-green-500 text-white" 
            : "bg-blue-600 text-white"
        )}>
          <span className="font-black text-xl leading-none">{parcel.sequenceNumber}</span>
          <span className="text-[10px] font-bold opacity-80 leading-none mt-0.5">({getGoogleMapsLetter(parcel.sequenceNumber)})</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {parcel.trackingNumber}
                </p>
                <button 
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(parcel.trackingNumber);
                  }}
                  className="p-1 text-gray-300 hover:text-blue-500 transition-colors"
                  title="Salin No. Tracking"
                >
                  <Copy size={12} />
                </button>
              </div>
              <p className="text-[9px] font-bold text-gray-300 uppercase tracking-tighter">
                Scan: {new Date(parcel.scannedAt).toLocaleDateString('ms-MY', { day: '2-digit', month: 'short' })} • {new Date(parcel.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {parcel.status === 'delivered' && (
                <div className="flex flex-col items-end">
                  <span className="flex items-center gap-1 text-[10px] font-black text-green-600 bg-green-100 px-2 py-0.5 rounded-full uppercase">
                    <CheckCircle2 size={10} /> Selesai
                  </span>
                  {parcel.deliveredAt && (
                    <span className="text-[9px] font-bold text-gray-400 mt-0.5">
                      {new Date(parcel.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              )}
              {parcel.status === 'failed' && (
                <div className="flex flex-col items-end">
                  <span className="flex items-center gap-1 text-[10px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded-full uppercase">
                    <X size={10} /> Gagal
                  </span>
                  {parcel.failedAt && (
                    <span className="text-[9px] font-bold text-gray-400 mt-0.5">
                      {new Date(parcel.failedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              )}
              {parcel.status === 'retry' && (
                <div className="flex flex-col items-end">
                  <span className="flex items-center gap-1 text-[10px] font-black text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full uppercase">
                    <RefreshCw size={10} className="animate-spin-slow" /> Retry
                  </span>
                </div>
              )}
              {onMoveClick && (
                <button 
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onMoveClick(); }}
                  className="p-2 -mr-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-full transition-colors"
                >
                  <MoreVertical size={20} />
                </button>
              )}
            </div>
          </div>
          
          {parcel.recipientName && parcel.recipientName !== 'Tiada Nama' && (
            <div className="flex items-center justify-between mt-1">
              <p className="text-sm font-black text-gray-900 flex items-center gap-1.5 truncate">
                <UserIcon size={14} className="text-gray-400" />
                {parcel.recipientName}
              </p>
            </div>
          )}
          
          <h4 className="font-bold text-gray-600 text-sm mt-1 line-clamp-2 leading-tight">
            {parcel.address}
          </h4>

          {parcel.isLocationVerified && (
            <div className="mt-1 flex items-center gap-1 text-[10px] font-black text-blue-600 uppercase tracking-widest">
              <CheckCircle2 size={10} /> Pin Disahkan
            </div>
          )}

          {parcel.addressNotes && (
            <div className="mt-2 bg-yellow-50 border border-yellow-100 p-2 rounded-lg text-[11px] font-bold text-yellow-800 flex items-start gap-2">
              <Edit2 size={12} className="mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2">{parcel.addressNotes}</span>
            </div>
          )}

          {parcel.status === 'failed' && parcel.failedReason && (
            <div className="mt-2 bg-red-50 border border-red-100 p-3 rounded-xl text-xs font-bold text-red-700 flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>Gagal: {parcel.failedReason}</span>
              </div>
              {parcel.failedPhotoUrl && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewPOD?.(parcel); // Reuse onViewPOD for failed photo
                  }}
                  className="flex items-center gap-1.5 text-[10px] text-red-500 hover:text-red-700 underline"
                >
                  <ImageIcon size={12} /> Lihat Bukti Gagal
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-2">
            {parcel.isCOD && (
              <div className="inline-flex items-center gap-1.5 bg-orange-100 text-orange-700 px-2.5 py-1 rounded-md text-[10px] font-black">
                <Banknote size={12} />
                COD: RM {parcel.codAmount?.toFixed(2)}
              </div>
            )}
            
            {parcel.groupTag && (
              <div className="inline-flex items-center gap-1.5 bg-purple-100 text-purple-700 px-2.5 py-1 rounded-md text-[10px] font-black">
                <Folder size={12} />
                {parcel.groupTag}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            {parcel.status === 'delivered' && parcel.podPhotoUrl && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onViewPOD?.(parcel); }}
                className="col-span-2 flex items-center justify-center gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-black py-2.5 rounded-xl text-xs transition-all active:scale-95 mb-1 border border-purple-100"
              >
                <ImageIcon size={14} /> Lihat Gambar POD
              </button>
            )}
            
            {parcel.recipientPhone && (
              <div className="col-span-2 flex gap-2 mb-1">
                <button 
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={makeCall}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-black py-2.5 rounded-xl text-xs transition-all active:scale-95"
                >
                  <Phone size={14} /> Call
                </button>
                <button 
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={sendWhatsApp}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 font-black py-2.5 rounded-xl text-xs transition-all active:scale-95"
                >
                  <MessageSquare size={14} /> WhatsApp
                </button>
              </div>
            )}
            
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={openNavigation}
              className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black py-3 rounded-xl text-xs transition-all active:scale-95"
            >
              <Navigation size={14} />
              G-Maps
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={openWaze}
              className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black py-3 rounded-xl text-xs transition-all active:scale-95"
            >
              <Navigation size={14} className="rotate-90" />
              Waze
            </button>
            
            {parcel.status !== 'delivered' ? (
              <div className="col-span-2 flex gap-2">
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onStatusChange(parcel.id, 'failed'); }}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 font-black py-3 rounded-xl text-xs transition-all active:scale-95 border border-red-100"
                >
                  <X size={14} />
                  Gagal
                </button>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setShowHantarConfirm(true); }}
                  className="flex-[2] flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-black py-3 rounded-xl text-xs shadow-md shadow-green-100 transition-all active:scale-95"
                >
                  <CheckCircle2 size={14} />
                  Hantar
                </button>
              </div>
            ) : (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setShowResetConfirm(true); }}
                className="w-full flex items-center justify-center gap-2 bg-white border-2 border-gray-100 text-gray-400 font-black py-3 rounded-xl text-xs transition-all active:scale-95"
              >
                <RefreshCw size={14} />
                Reset
              </button>
            )}
          </div>
        </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showHantarConfirm}
        onClose={() => setShowHantarConfirm(false)}
        onConfirm={() => onStatusChange(parcel.id, 'delivered')}
        title="Sahkan Hantar?"
        description={`Adakah anda pasti parcel untuk ${parcel.recipientName || 'penerima ini'} telah berjaya dihantar?`}
        confirmText="Ya, Selesai"
        variant="success"
        icon={<CheckCircle2 size={32} />}
      />

      <ConfirmationModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={() => onStatusChange(parcel.id, 'pending')}
        title="Reset Status?"
        description="Adakah anda pasti mahu kembalikan status parcel ini kepada 'Aktif'?"
        confirmText="Ya, Reset"
        variant="warning"
        icon={<RefreshCw size={32} />}
      />
    </motion.div>
  );
});
