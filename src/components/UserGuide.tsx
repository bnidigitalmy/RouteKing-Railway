import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Camera, 
  Navigation, 
  MapPin, 
  ShieldCheck, 
  Banknote, 
  Search, 
  ChevronRight, 
  ChevronLeft,
  BookOpen,
  CheckCircle2,
  Zap,
  LayoutGrid,
  Phone,
  MessageCircle,
  Flag,
  Truck
} from 'lucide-react';
import { cn } from '../lib/utils';

interface UserGuideProps {
  onClose: () => void;
  onComplete?: () => void;
}

const steps = [
  {
    phase: "MULA",
    title: "Selamat Datang, Raja Jalanan! 👑",
    description: "RouteKing adalah asisten pintar untuk rider kurier. Kami tolong anda jimat masa, jimat minyak, dan paling penting—jimat tenaga!",
    icon: <Zap className="text-yellow-500" size={48} />,
    color: "bg-yellow-50",
    visual: (
      <div className="relative w-full h-32 bg-gray-900 rounded-3xl overflow-hidden flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-blue-600/20 animate-pulse"></div>
        <div className="text-center z-10">
          <p className="text-white font-black text-xl italic tracking-tighter">RouteKing</p>
          <div className="flex gap-1 justify-center mt-2">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="w-1.5 h-1.5 bg-yellow-400 rounded-full"></div>)}
          </div>
        </div>
      </div>
    )
  },
  {
    phase: "SCAN",
    title: "1. Scan & Biar AI Bekerja 📸",
    description: "Tak payah taip alamat. Tekan 'SCAN PARCEL', halakan kamera ke label (AWB). Gemini AI akan extract info customer & kesan COD automatik.",
    icon: <Camera className="text-blue-600" size={48} />,
    color: "bg-blue-50",
    visual: (
      <div className="relative w-full h-32 bg-slate-100 rounded-3xl overflow-hidden border-2 border-dashed border-blue-200 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-[120px] h-16 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col p-2 space-y-1">
          <div className="w-8 h-1.5 bg-gray-200 rounded"></div>
          <div className="w-full h-1 bg-gray-100 rounded"></div>
          <div className="w-1/2 h-1 bg-gray-100 rounded"></div>
          <div className="mt-auto w-full h-1 bg-blue-600 rounded"></div>
        </div>
        <motion.div 
          animate={{ y: [0, 40, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-x-0 h-0.5 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)]"
        ></motion.div>
      </div>
    ),
    tips: [
      "Pencahayaan cukup = Scan laju",
      "Kesan COD (Cash/QR) secara automatik",
      "Boleh taip manual kalau sticker rosak"
    ]
  },
  {
    phase: "SUSUN",
    title: "2. Susun Laluan 'Smart' ⚡",
    description: "Dah habis scan? Tekan 'SUSUN LALUAN'. Sistem akan kira jalan paling pendek supaya anda tak perlu pusing taman yang sama 2 kali.",
    icon: <Navigation className="text-emerald-600" size={48} />,
    color: "bg-emerald-50",
    visual: (
      <div className="w-full h-32 bg-gray-50 rounded-3xl p-4 flex flex-col justify-center space-y-2">
        {[2, 1, 3].map((n, i) => (
          <motion.div 
            key={i}
            layout
            initial={false}
            animate={{ y: i === 0 ? 0 : 0 }} // Simplified for layout effect
            className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-100"
          >
            <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center text-[10px] text-white font-black">{n}</div>
            <div className="flex-1 h-3 bg-gray-100 rounded"></div>
          </motion.div>
        ))}
      </div>
    ),
    tips: [
      "Fungsi 'Tag Kawasan' untuk asing parcel",
      "Automasi laluan jimatkan 1-2 jam sehari",
      "Boleh 'Drag & Drop' kalau nak susun sendiri"
    ]
  },
  {
    phase: "HANTAR",
    title: "3. Navigasi & Hubungi 📍",
    description: "Masuk 'MOD NAVIGASI'. Klik pin alamat, terus boleh buka Waze atau tekan butang WhatsApp/Call customer tanpa perlu simpan nombor.",
    icon: <MapPin className="text-red-600" size={48} />,
    color: "bg-red-50",
    visual: (
      <div className="w-full h-32 bg-blue-50 rounded-3xl p-4 relative overflow-hidden flex items-center justify-around">
        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 bg-green-500 rounded-2xl flex items-center justify-center text-white"><MessageCircle size={20} /></div>
          <p className="text-[8px] font-black text-gray-400">WHATSAPP</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 bg-blue-500 rounded-2xl flex items-center justify-center text-white"><Phone size={20} /></div>
          <p className="text-[8px] font-black text-gray-400">CALL</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 bg-orange-500 rounded-2xl flex items-center justify-center text-white"><Navigation size={20} /></div>
          <p className="text-[8px] font-black text-gray-400">WAZE</p>
        </div>
      </div>
    ),
    tips: [
      "Mesra WhatsApp (Tak payah save number)",
      "Sekali klik terus ke Waze/Maps",
      "Status 'Delivery' auto-update"
    ]
  },
  {
    phase: "BUKTI",
    title: "4. POD & Memori Pintar 🧠",
    description: "Ambil gambar hantaran (POD). Kalau anda tanda lokasi 'Verify' atau tambah nota (cth: 'Pagar Merah'), app akan ingat alamat tu selamanya!",
    icon: <ShieldCheck className="text-purple-600" size={48} />,
    color: "bg-purple-50",
    visual: (
      <div className="w-full h-32 bg-purple-50 rounded-3xl p-4 flex items-center justify-center gap-4">
        <div className="w-20 h-20 bg-white rounded-2xl border-2 border-purple-200 flex flex-col items-center justify-center p-2 relative">
          <Flag className="text-purple-500" size={24} />
          <div className="absolute top-1 right-1"><CheckCircle2 size={12} className="text-green-500" /></div>
          <p className="text-[8px] font-black mt-2 text-center text-gray-900">ALAMAT DISAHKAN</p>
        </div>
        <div className="flex-1 space-y-2">
          <div className="h-2 bg-purple-200 rounded w-full"></div>
          <div className="h-2 bg-purple-100 rounded w-2/3"></div>
          <div className="h-4 bg-purple-500 rounded-lg w-full flex items-center justify-center">
            <p className="text-[8px] text-white font-black italic tracking-widest text-center px-2">"Pagar Hijau, Sebelah Surau"</p>
          </div>
        </div>
      </div>
    ),
    tips: [
      "Nota 'Smart' picit ingatan anda",
      "Sangat padu untuk alamat yang pening",
      "Bukti POD tersusun ikut folder & tarikh"
    ]
  },
  {
    phase: "GO!",
    title: "Sedia Untuk Jadi Raja? 🚀",
    description: "RouteKing adalah kawan sejati anda di jalanan. Gunakan sepenuhnya untuk tingkatkan income dan balik awal setiap hari!",
    icon: <Truck className="text-blue-600" size={48} />,
    color: "bg-blue-50",
    visual: (
      <div className="w-full h-32 flex flex-col items-center justify-center space-y-4">
        <motion.div 
          animate={{ x: [-100, 100], opacity: [0, 1, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        >
          <Truck size={48} className="text-blue-600" />
        </motion.div>
        <p className="text-blue-600 font-black text-xs uppercase tracking-[0.2em] animate-pulse">Memulakan Tugas...</p>
      </div>
    )
  }
];

export const UserGuide: React.FC<UserGuideProps> = ({ onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      if (onComplete) onComplete();
      onClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        className="bg-white w-full max-w-md rounded-[3rem] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] flex flex-col max-h-[92vh] border border-white/20"
      >
        {/* Header - Simple & Clean */}
        <div className="px-8 pt-8 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gray-50 px-3 py-1 rounded-full text-[10px] font-black text-gray-400 uppercase tracking-widest border border-gray-100 italic">
              RouteKing Academy
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 bg-gray-50 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Visual Showcase (The Hero of the Step) */}
        <div className="px-8 py-2">
          <div className="relative group">
            <div className="absolute inset-x-4 -bottom-4 h-8 bg-gray-100/50 rounded-[2rem] blur-xl -z-10 group-hover:scale-110 transition-transform"></div>
            {steps[currentStep].visual}
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Fasa: {steps[currentStep].phase}</span>
                <h3 className="text-3xl font-black text-gray-900 leading-none tracking-tight italic">
                  {steps[currentStep].title}
                </h3>
                <p className="text-gray-500 font-bold text-sm leading-relaxed">
                  {steps[currentStep].description}
                </p>
              </div>

              {steps[currentStep].tips && (
                <div className="grid grid-cols-1 gap-2">
                  {steps[currentStep].tips.map((tip, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-3 bg-gray-50/80 p-3 rounded-2xl border border-gray-100"
                    >
                      <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center shadow-sm text-green-500">
                        <CheckCircle2 size={14} />
                      </div>
                      <span className="text-xs font-black text-gray-700 tracking-tight">{tip}</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation - Oversized & Modern */}
        <div className="p-8 space-y-6">
          <div className="flex justify-center gap-2">
            {steps.map((_, i) => (
              <div 
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-500",
                  currentStep === i ? "w-10 bg-blue-600" : "w-2 bg-gray-200"
                )}
              />
            ))}
          </div>

          <div className="flex gap-4">
            {currentStep > 0 && (
              <button
                onClick={prevStep}
                className="w-16 h-16 bg-white border-2 border-gray-100 rounded-[2rem] flex items-center justify-center text-gray-400 hover:border-blue-200 hover:text-blue-600 transition-all active:scale-90"
              >
                <ChevronLeft size={24} />
              </button>
            )}
            <button
              onClick={nextStep}
              className="flex-1 h-16 bg-blue-600 text-white rounded-[2rem] font-black text-lg shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              <span>{currentStep === steps.length - 1 ? "MULA KERJA" : "TERUSKAN"}</span>
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

