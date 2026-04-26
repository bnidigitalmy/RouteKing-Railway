import React from 'react';
import { MapPin, Navigation, Package, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { Parcel } from '../types';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface StatsProps {
  parcels: Parcel[];
  isGPSActive?: boolean;
}

export function Stats({ parcels, isGPSActive = false }: StatsProps) {
  const total = parcels.length;
  const delivered = parcels.filter(p => p.status === 'delivered').length;
  const progress = total > 0 ? (delivered / total) * 100 : 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Small GPS Status Row */}
      <div className="flex justify-end">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border",
            isGPSActive 
              ? "bg-green-50 text-green-700 border-green-100 shadow-sm" 
              : "bg-orange-50 text-orange-700 border-orange-100 animate-pulse"
          )}
        >
          <div className={cn(
            "w-2 h-2 rounded-full",
            isGPSActive ? "bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]" : "bg-orange-400"
          )} />
          <MapPin size={10} />
          {isGPSActive ? "Lokasi Aktif" : "Menunggu GPS..."}
        </motion.div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100"
        >
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Package size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">Jumlah</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-gray-900 tracking-tighter">{total}</span>
            <span className="text-xs text-gray-400 font-bold uppercase">Parcel</span>
          </div>
        </motion.div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100"
      >
        <div className="flex items-center gap-2 text-green-600 mb-2">
          <CheckCircle size={18} />
          <span className="text-[10px] font-black uppercase tracking-widest">Selesai</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-black text-gray-900 tracking-tighter">{delivered}</span>
          <span className="text-xs text-gray-400 font-bold uppercase">/{total}</span>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="col-span-2 bg-blue-600 p-6 rounded-[2rem] shadow-xl shadow-blue-100 text-white relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 bg-blue-400/20 rounded-full blur-xl" />
        
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest">Progress Hari Ini</span>
            </div>
            <span className="text-2xl font-black tracking-tighter">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-blue-400/30 rounded-full h-3 overflow-hidden p-0.5">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="bg-white h-full rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"
            />
          </div>
        </div>
      </motion.div>
    </div>
  </div>
  );
}
