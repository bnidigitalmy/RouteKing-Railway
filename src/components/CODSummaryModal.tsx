import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Banknote, CheckCircle2, Calendar, Smartphone, Receipt, ArrowRight } from 'lucide-react';
import { Parcel } from '../types';
import { cn } from '../lib/utils';

interface CODSummaryModalProps {
  parcels: Parcel[];
  isOpen: boolean;
  onClose: () => void;
}

export const CODSummaryModal = ({ parcels, isOpen, onClose }: CODSummaryModalProps) => {
  const codParcels = parcels.filter(p => 
    p.status === 'delivered' && 
    p.isCOD && 
    p.codAmount &&
    p.deliveredAt && 
    new Date(p.deliveredAt).toDateString() === new Date().toDateString()
  ).sort((a, b) => (b.deliveredAt || 0) - (a.deliveredAt || 0));

  const totalCollected = codParcels.reduce((sum, p) => sum + (p.codAmount || 0), 0);

  return (
    <AnimatePresence>
      {isOpen && (
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
                  <Banknote className="text-orange-500" /> Ringkasan COD
                </h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                  Kutipan Hari Ini • {new Date().toLocaleDateString('ms-MY', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Total Card */}
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-[2rem] p-8 text-white shadow-xl shadow-orange-200 relative overflow-hidden">
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-2">Total Collected (COD)</p>
                <h2 className="text-4xl font-black tracking-tight leading-none">RM {totalCollected.toFixed(2)}</h2>
                <div className="mt-6 flex items-center gap-2 bg-white/20 w-fit px-3 py-1 rounded-full backdrop-blur-sm">
                  <CheckCircle2 size={14} />
                  <span className="text-[10px] font-black uppercase tracking-wider">{codParcels.length} Parcel COD Selesai</span>
                </div>
              </div>

              {/* Transactions List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Senarai Transaksi</p>
                  <Receipt size={16} className="text-gray-300" />
                </div>
                
                {codParcels.length > 0 ? (
                  <div className="space-y-2">
                    {codParcels.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black text-blue-500 uppercase tracking-tighter mb-0.5">{p.trackingNumber}</p>
                          <h4 className="font-bold text-gray-900 text-sm truncate">{p.recipientName || 'Tiada Nama'}</h4>
                          <p className="text-[10px] text-gray-400 font-bold">
                            {p.deliveredAt && new Date(p.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-sm font-black text-orange-600">RM {p.codAmount?.toFixed(2)}</p>
                          <span className="text-[9px] font-bold text-green-500 bg-green-50 px-1.5 py-0.5 rounded-md uppercase">Paid</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
                    <p className="text-sm font-bold text-gray-400">Tiada kutipan COD hari ini.</p>
                  </div>
                )}
              </div>

              {/* Remittance Info */}
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-2">
                <h4 className="text-[10px] font-black text-blue-800 uppercase tracking-widest flex items-center gap-2">
                  <Smartphone size={14} /> Nota Remittance
                </h4>
                <p className="text-[11px] font-bold text-blue-600 leading-relaxed">
                  Sila pastikan jumlah kutipan dalam tangan sama dengan jumlah di atas sebelum buat serahan duit (remit) ke kaunter Hub.
                </p>
              </div>
            </div>

            <div className="p-6 bg-white border-t border-gray-100 mt-auto">
              <button
                onClick={onClose}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-gray-800 transition-all active:scale-[0.98] shadow-lg shadow-gray-200"
              >
                Tutup Ringkasan
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
