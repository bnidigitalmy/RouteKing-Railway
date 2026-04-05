import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Camera, 
  Navigation, 
  MapPin, 
  ShieldCheck, 
  Truck, 
  Banknote, 
  Search, 
  Edit2, 
  ChevronRight, 
  ChevronLeft,
  BookOpen,
  CheckCircle2,
  Zap
} from 'lucide-react';
import { cn } from '../lib/utils';

interface UserGuideProps {
  onClose: () => void;
}

const steps = [
  {
    title: "Selamat Datang ke RouteKing!",
    description: "Asisten penghantaran pintar yang direka khas untuk memudahkan kerja harian rider. Mari kita lihat fungsi utama app ini.",
    icon: <Zap className="text-yellow-500" size={48} />,
    color: "bg-yellow-50"
  },
  {
    title: "1. Scan Label Parcel",
    description: "Gunakan butang 'SCAN PARCEL' untuk mengimbas label. Sistem AI kami akan mengekstrak Nama, No. Telefon, Alamat, dan No. Tracking secara automatik.",
    icon: <Camera className="text-blue-600" size={48} />,
    color: "bg-blue-50",
    tips: [
      "Pastikan pencahayaan cukup",
      "Halakan kamera tepat pada label",
      "Sistem akan kesan COD secara automatik"
    ]
  },
  {
    title: "2. Susun Laluan (Optimization)",
    description: "Selepas scan semua parcel, tekan 'SUSUN LALUAN'. RouteKing akan menyusun urutan penghantaran dari yang paling dekat ke paling jauh untuk jimat minyak dan masa.",
    icon: <Navigation className="text-green-600" size={48} />,
    color: "bg-green-50",
    tips: [
      "Gunakan 'Tag Kawasan' untuk asingkan ikut folder",
      "Boleh susun semula secara manual jika perlu"
    ]
  },
  {
    title: "3. Mod Navigasi & Map",
    description: "Tekan 'MULA NAVIGASI' untuk masuk ke mod peta. Anda boleh lihat semua stop dalam satu peta dan buka Waze/Google Maps dengan satu klik.",
    icon: <MapPin className="text-red-600" size={48} />,
    color: "bg-red-50",
    tips: [
      "Klik pada pin untuk lihat info parcel",
      "Gunakan butang Waze untuk navigasi pantas"
    ]
  },
  {
    title: "4. Memori Alamat (Smart Memory)",
    description: "Apabila anda mengesahkan (Verify) lokasi rumah atau menambah nota (cth: 'Pagar Merah'), RouteKing akan mengingatinya untuk penghantaran akan datang ke alamat yang sama.",
    icon: <ShieldCheck className="text-purple-600" size={48} />,
    color: "bg-purple-50",
    tips: [
      "Sangat berguna untuk kawasan perumahan baru",
      "Nota adalah peribadi untuk akaun anda sahaja"
    ]
  },
  {
    title: "5. POD & COD",
    description: "Ambil gambar bukti hantaran (POD) terus dalam app. Untuk parcel COD, sistem akan menjejak jumlah kutipan harian anda secara automatik.",
    icon: <Banknote className="text-emerald-600" size={48} />,
    color: "bg-emerald-50",
    tips: [
      "Gambar POD disimpan dalam cloud",
      "Jumlah COD boleh dilihat di dashboard utama"
    ]
  },
  {
    title: "6. Cari Stop & Mod Menanda",
    description: "Gunakan 'Cari Stop' untuk cari parcel dengan cepat. 'Mod Menanda' pula memudahkan anda scan parcel sambil menulis nombor urutan pada kotak.",
    icon: <Search className="text-orange-600" size={48} />,
    color: "bg-orange-50"
  }
];

export const UserGuide: React.FC<UserGuideProps> = ({ onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 leading-none">Panduan Pengguna</h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Tutorial RouteKing</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className={cn(
                "w-24 h-24 rounded-3xl flex items-center justify-center mx-auto shadow-inner",
                steps[currentStep].color
              )}>
                {steps[currentStep].icon}
              </div>

              <div className="text-center space-y-3">
                <h3 className="text-2xl font-black text-gray-900 leading-tight">
                  {steps[currentStep].title}
                </h3>
                <p className="text-gray-600 font-medium leading-relaxed">
                  {steps[currentStep].description}
                </p>
              </div>

              {steps[currentStep].tips && (
                <div className="bg-gray-50 rounded-2xl p-5 space-y-3 border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tips Pro:</p>
                  <ul className="space-y-2">
                    {steps[currentStep].tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm font-bold text-gray-700">
                        <CheckCircle2 className="text-green-500 shrink-0 mt-0.5" size={16} />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div 
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  currentStep === i ? "w-8 bg-blue-600" : "w-2 bg-gray-300"
                )}
              />
            ))}
          </div>

          <div className="flex gap-3">
            {currentStep > 0 && (
              <button
                onClick={prevStep}
                className="p-3 bg-white border-2 border-gray-200 rounded-2xl text-gray-600 hover:bg-gray-100 transition-all active:scale-95"
              >
                <ChevronLeft size={24} />
              </button>
            )}
            <button
              onClick={nextStep}
              className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2"
            >
              {currentStep === steps.length - 1 ? "Mula Sekarang" : "Seterusnya"}
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
