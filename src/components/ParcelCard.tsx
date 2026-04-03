import React from 'react';
import { MapPin, Navigation, CheckCircle2, Circle, ExternalLink, Banknote, User as UserIcon, Folder, MoreVertical, Phone, MessageSquare, Copy } from 'lucide-react';
import { Parcel, UserProfile } from '../types';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface ParcelCardProps {
  key?: string;
  parcel: Parcel;
  profile?: UserProfile | null;
  onStatusChange: (id: string, status: Parcel['status']) => void;
  onMoveClick?: () => void;
}

export function ParcelCard({ parcel, profile, onStatusChange, onMoveClick }: ParcelCardProps) {
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

    const riderInfo = profile?.riderName ? `${profile.riderName} (${profile.courierCompany || 'SPX'})` : 'rider Shopee Express (SPX)';
    const message = encodeURIComponent(`Hai, saya ${riderInfo}. Parcel anda (${parcel.trackingNumber}) akan sampai dalam 10 minit! Sila sedia ya. Terima kasih.`);
    const url = `https://wa.me/${phone}?text=${message}`;
    window.open(url, '_blank');
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', parcel.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={cn(
        "relative bg-white rounded-2xl p-4 shadow-sm border-2 transition-all active:scale-[0.98] cursor-grab active:cursor-grabbing",
        parcel.status === 'delivered' ? "border-green-100 bg-green-50/30" : "border-gray-50"
      )}
    >
      <div className="flex gap-4">
        {/* Sequence Number Badge */}
        <div className={cn(
          "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shadow-inner",
          parcel.status === 'delivered' 
            ? "bg-green-500 text-white" 
            : "bg-blue-600 text-white"
        )}>
          {parcel.sequenceNumber}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {parcel.trackingNumber}
              </p>
              <button 
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
              {onMoveClick && (
                <button 
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
            {parcel.recipientPhone && (
              <div className="col-span-2 flex gap-2 mb-1">
                <button 
                  onClick={makeCall}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-black py-2.5 rounded-xl text-xs transition-all active:scale-95"
                >
                  <Phone size={14} /> Call
                </button>
                <button 
                  onClick={sendWhatsApp}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 font-black py-2.5 rounded-xl text-xs transition-all active:scale-95"
                >
                  <MessageSquare size={14} /> WhatsApp
                </button>
              </div>
            )}
            
            <button
              onClick={openNavigation}
              className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black py-3 rounded-xl text-xs transition-all active:scale-95"
            >
              <Navigation size={14} />
              Navigasi
            </button>
            
            {parcel.status !== 'delivered' ? (
              <button
                onClick={() => onStatusChange(parcel.id, 'delivered')}
                className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-black py-3 rounded-xl text-xs transition-all active:scale-95 shadow-md shadow-green-100"
              >
                <CheckCircle2 size={14} />
                Hantar
              </button>
            ) : (
              <button
                onClick={() => onStatusChange(parcel.id, 'pending')}
                className="flex items-center justify-center gap-2 bg-white border-2 border-gray-100 text-gray-400 font-black py-3 rounded-xl text-xs transition-all active:scale-95"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
