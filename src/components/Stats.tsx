import React from 'react';
import { MapPin, Navigation, Package, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { Parcel } from '../types';

interface StatsProps {
  parcels: Parcel[];
}

export function Stats({ parcels }: StatsProps) {
  const total = parcels.length;
  const delivered = parcels.filter(p => p.status === 'delivered').length;
  const pending = total - delivered;
  const progress = total > 0 ? (delivered / total) * 100 : 0;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50">
        <div className="flex items-center gap-2 text-blue-600 mb-2">
          <Package size={18} />
          <span className="text-xs font-bold uppercase tracking-wider">Jumlah</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black text-gray-900">{total}</span>
          <span className="text-xs text-gray-400 font-medium">Parcel</span>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50">
        <div className="flex items-center gap-2 text-green-600 mb-2">
          <CheckCircle size={18} />
          <span className="text-xs font-bold uppercase tracking-wider">Selesai</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black text-gray-900">{delivered}</span>
          <span className="text-xs text-gray-400 font-medium">/{total}</span>
        </div>
      </div>

      <div className="col-span-2 bg-blue-600 p-4 rounded-2xl shadow-lg text-white">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Progress Hari Ini</span>
          </div>
          <span className="text-lg font-black">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-blue-400/30 rounded-full h-2.5 overflow-hidden">
          <div 
            className="bg-white h-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
