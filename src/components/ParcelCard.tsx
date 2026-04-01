import React from 'react';
import { MapPin, Navigation, CheckCircle2, Circle, ExternalLink, Banknote, User } from 'lucide-react';
import { Parcel } from '../types';
import { cn } from '../lib/utils';

interface ParcelCardProps {
  key?: string;
  parcel: Parcel;
  onStatusChange: (id: string, status: Parcel['status']) => void;
}

export function ParcelCard({ parcel, onStatusChange }: ParcelCardProps) {
  const openNavigation = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(parcel.address)}`;
    window.open(url, '_blank');
  };

  return (
    <div 
      className={cn(
        "relative bg-white rounded-2xl p-4 shadow-sm border-2 transition-all active:scale-[0.98]",
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
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              {parcel.trackingNumber}
            </p>
            {parcel.status === 'delivered' && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full uppercase">
                <CheckCircle2 size={10} /> Selesai
              </span>
            )}
          </div>
          
          {parcel.recipientName && parcel.recipientName !== 'Tiada Nama' && (
            <p className="text-sm font-bold text-gray-900 mt-2 flex items-center gap-1.5">
              <User size={14} className="text-gray-400" />
              {parcel.recipientName}
            </p>
          )}
          
          <h4 className="font-medium text-gray-600 text-sm mt-1 line-clamp-2 leading-tight">
            {parcel.address}
          </h4>

          {parcel.isCOD && (
            <div className="mt-2 inline-flex items-center gap-1.5 bg-orange-100 text-orange-700 px-2.5 py-1 rounded-md text-xs font-black">
              <Banknote size={14} />
              COD: RM {parcel.codAmount?.toFixed(2)}
            </div>
          )}

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={openNavigation}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-2 px-3 rounded-lg text-xs transition-colors"
            >
              <Navigation size={14} />
              Navigasi
            </button>
            
            {parcel.status !== 'delivered' ? (
              <button
                onClick={() => onStatusChange(parcel.id, 'delivered')}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors shadow-sm"
              >
                <CheckCircle2 size={14} />
                Hantar
              </button>
            ) : (
              <button
                onClick={() => onStatusChange(parcel.id, 'pending')}
                className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-500 font-bold py-2 px-3 rounded-lg text-xs transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
