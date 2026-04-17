import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LegalModal } from './LegalModal';
import { 
  MapPin, 
  Zap, 
  ShieldCheck, 
  Smartphone, 
  ArrowRight, 
  CheckCircle2, 
  Package, 
  Navigation,
  Clock,
  TrendingUp,
  AlertTriangle,
  Fuel,
  Moon,
  MessageSquareX,
  XCircle,
  Heart,
  Smile,
  Coins,
  Home,
  Coffee,
  Camera
} from 'lucide-react';

interface LandingPageProps {
  onStart: () => void;
  isLoggingIn: boolean;
  error?: string | null;
  onClearError?: () => void;
  success?: string | null;
  onClearSuccess?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart, isLoggingIn, error, onClearError, success, onClearSuccess }) => {
  const [legalModal, setLegalModal] = useState<{ isOpen: boolean; type: 'privacy' | 'terms' }>({
    isOpen: false,
    type: 'privacy'
  });

  const openLegal = (type: 'privacy' | 'terms') => {
    setLegalModal({ isOpen: true, type });
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Legal Modal */}
      <LegalModal 
        isOpen={legalModal.isOpen} 
        onClose={() => setLegalModal({ ...legalModal, isOpen: false })} 
        type={legalModal.type} 
      />
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img 
              src="/logopwa.png" 
              alt="RouteKing Logo" 
              className="w-10 h-10 rounded-xl object-cover"
              referrerPolicy="no-referrer"
            />
            <span className="text-xl font-black tracking-tighter text-gray-900">RouteKing</span>
          </div>
          <button 
            onClick={onStart}
            disabled={isLoggingIn}
            className="bg-gray-900 text-white px-6 py-2.5 rounded-full font-bold text-sm hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-50"
          >
            {isLoggingIn ? 'Menyambung...' : 'Log Masuk'}
          </button>
        </div>
      </nav>

      {/* Success Message */}
      {success && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] w-full max-w-md px-6">
          <div className="bg-green-50 border-2 border-green-100 text-green-600 p-4 rounded-2xl flex items-start gap-3 shadow-xl animate-in fade-in slide-in-from-top-4">
            <CheckCircle2 className="shrink-0 mt-0.5" size={18} />
            <div className="flex-1">
              <p className="text-sm font-bold">Pembayaran Berjaya</p>
              <p className="text-xs opacity-80">{success}</p>
            </div>
            <button onClick={onClearSuccess} className="text-green-400 hover:text-green-600">
              <XCircle size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] w-full max-w-md px-6">
          <div className="bg-red-50 border-2 border-red-100 text-red-600 p-4 rounded-2xl flex items-start gap-3 shadow-xl animate-in fade-in slide-in-from-top-4">
            <AlertTriangle className="shrink-0 mt-0.5" size={18} />
            <div className="flex-1">
              <p className="text-sm font-bold">Ralat Pembayaran</p>
              <p className="text-xs opacity-80">{error}</p>
            </div>
            <button onClick={onClearError} className="text-red-400 hover:text-red-600">
              <XCircle size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-xs font-black uppercase tracking-widest">
              <Zap size={14} />
              Aplikasi #1 Rider Malaysia
            </div>
            <h1 className="text-5xl lg:text-7xl font-black text-gray-900 leading-[1.1] tracking-tight">
              Hantar Parcel <br />
              <span className="text-blue-600">Lebih Laju,</span> <br />
              Minyak Lebih Jimat.
            </h1>
            <p className="text-xl text-gray-500 leading-relaxed max-w-lg">
              Sertai ratusan rider lain yang dah berjaya <span className="font-bold text-blue-600">tingkatkan komisyen harian</span> serta <span className="font-bold text-yellow-500">jimatkan masa & tenaga</span> setiap hari.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button 
                onClick={onStart}
                disabled={isLoggingIn}
                className="px-8 py-5 bg-blue-600 text-white rounded-2xl font-black text-lg shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-3 group"
              >
                {isLoggingIn ? 'Menyambung...' : 'Mula Sekarang — Percuma'}
                <ArrowRight className="group-hover:translate-x-1 transition-transform" />
              </button>
              <div className="flex items-center gap-3 px-4">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map((i) => (
                    <img 
                      key={i}
                      src={`https://i.pravatar.cc/100?img=${i + 10}`} 
                      alt="User" 
                      className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                  ))}
                </div>
                <div className="text-xs font-bold text-gray-400">
                  <span className="text-gray-900">500+ Rider</span> <br />
                  Telah Menggunakan
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="absolute -inset-10 bg-blue-400/20 rounded-full blur-3xl -z-10 animate-pulse"></div>
            
            {/* iPhone 17 Style Frame */}
            <div className="bg-black rounded-[3rem] p-1.5 shadow-2xl border-[1px] border-white/20 aspect-[9/19.5] max-w-[300px] mx-auto overflow-hidden relative group ring-1 ring-white/10">
              {/* Ultra-thin Bezel Inner */}
              <div className="absolute inset-0 rounded-[2.8rem] border-[6px] border-gray-900 z-30 pointer-events-none"></div>
              
              {/* Dynamic Island (iPhone 17 style - maybe smaller/sleeker) */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-6 bg-black rounded-full z-40 flex items-center justify-center gap-1.5 px-2">
                <div className="w-1.5 h-1.5 bg-blue-500/50 rounded-full animate-pulse"></div>
                <div className="w-8 h-1 bg-white/10 rounded-full"></div>
              </div>
              
              {/* Screen Content */}
              <div className="relative h-full w-full rounded-[2.5rem] overflow-hidden bg-slate-950">
                {/* Map Background Simulation */}
                <div className="absolute inset-0 bg-slate-100">
                  <img 
                    src="https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?q=80&w=1000&auto=format&fit=crop" 
                    alt="Map Background" 
                    className="w-full h-full object-cover opacity-30 grayscale"
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Simulated Route Lines with Numbering */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <motion.path
                      d="M 20 85 L 40 65 L 30 45 L 70 35 L 85 15"
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 2.5, repeat: Infinity }}
                    />
                    
                    {/* Numbered Points */}
                    {[
                      { x: 20, y: 85, n: "1", color: "#2563eb" },
                      { x: 40, y: 65, n: "2", color: "#ef4444" },
                      { x: 30, y: 45, n: "3", color: "#ef4444" },
                      { x: 70, y: 35, n: "4", color: "#ef4444" },
                      { x: 85, y: 15, n: "5", color: "#10b981" }
                    ].map((pt, i) => (
                      <g key={i}>
                        <circle cx={pt.x} cy={pt.y} r="4" fill={pt.color} className="shadow-lg" />
                        <text 
                          x={pt.x} 
                          y={pt.y + 1} 
                          fontSize="5" 
                          fill="white" 
                          textAnchor="middle" 
                          dominantBaseline="middle" 
                          fontWeight="bold"
                          className="font-sans"
                        >
                          {pt.n}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>

                {/* Rider Image Overlay */}
                <img 
                  src="https://images.unsplash.com/photo-1617347454431-f49d7ff5c3b1?q=80&w=1000&auto=format&fit=crop" 
                  alt="Rider on Duty" 
                  className="absolute inset-0 w-full h-full object-cover opacity-50 mix-blend-multiply group-hover:scale-105 transition-transform duration-1000"
                  referrerPolicy="no-referrer"
                />

                {/* UI Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent flex flex-col justify-end p-6 space-y-4 z-20">
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="bg-white/95 backdrop-blur-xl p-4 rounded-3xl border border-white/20 shadow-2xl"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                        <Navigation size={20} />
                      </div>
                      <div>
                        <span className="block text-gray-900 font-black text-sm leading-none">Laluan Terpantas</span>
                        <span className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mt-1">Smart Route AI</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                        <span>5 Destinasi</span>
                        <span>24 MIN</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="h-full bg-blue-600"
                        />
                      </div>
                    </div>
                  </motion.div>

                  <div className="flex gap-2">
                    <div className="flex-1 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                      <div className="text-[8px] text-blue-400 font-bold uppercase mb-1">Status Semasa</div>
                      <div className="text-[10px] text-white font-bold truncate">Menuju ke Point #2</div>
                    </div>
                    <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-200">
                      <MapPin size={20} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-3xl lg:text-5xl font-black text-gray-900 tracking-tight">
              Rider Selalu <span className="text-red-600 underline decoration-red-200 underline-offset-8">Stress</span> Sebab Ini...
            </h2>
            <p className="text-gray-500 font-medium">Kami tahu kerja rider bukan senang. Masalah-masalah ni selalu buat hari anda jadi penat.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <AlertTriangle className="text-red-500" />,
                title: "Pening Susun Alamat",
                desc: "Dah la banyak parcel, nak kena susun satu-satu ikut kawasan pula. Memang makan masa!"
              },
              {
                icon: <Fuel className="text-red-500" />,
                title: "Minyak Cepat Habis",
                desc: "Pusing-pusing tempat sama sebab tersalah susun jalan. Duit minyak habis kat situ je."
              },
              {
                icon: <Moon className="text-red-500" />,
                title: "Balik Rumah Lambat",
                desc: "Patutnya boleh balik awal, tapi sebab route tak betul, sampai malam baru settle."
              },
              {
                icon: <MessageSquareX className="text-red-500" />,
                title: "Customer Marah",
                desc: "Customer tanya kenapa parcel lambat sampai. Stress nak menjawab!"
              }
            ].map((item, idx) => (
              <div key={idx} className="p-8 bg-red-50/50 rounded-[2rem] border border-red-100 flex flex-col items-center text-center space-y-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                  {item.icon}
                </div>
                <h3 className="text-lg font-black text-gray-900">{item.title}</h3>
                <p className="text-sm text-gray-500 font-medium leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 p-8 bg-gray-900 rounded-[2.5rem] text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-transparent opacity-50"></div>
            <div className="relative z-10 space-y-6">
              <h3 className="text-2xl lg:text-3xl font-black text-white">Cukup-cukuplah Stress Macam Tu.</h3>
              <p className="text-gray-400 font-medium max-w-xl mx-auto">
                RouteKing direka khas untuk selesaikan semua masalah di atas. Biar sistem kami yang pening, abang cuma fokus hantar je.
              </p>
              <button 
                onClick={onStart}
                className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-500/20"
              >
                Selesaikan Masalah Saya Sekarang
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits/Outcomes Section (Emotional Trigger) */}
      <section className="py-24 px-6 bg-blue-600 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
            <h2 className="text-3xl lg:text-5xl font-black text-white tracking-tight">
              Bayangkan Hari Anda <span className="text-yellow-400">Selepas</span> Guna RouteKing...
            </h2>
            <p className="text-blue-100 font-medium text-lg">Bukan sekadar app, tapi kawan baik yang bantu anda ubah hidup.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                icon: <Coins className="text-yellow-400" size={32} />,
                title: "Income Melimpah Ruah",
                desc: "Bila route dah efisien, abang boleh hantar lebih banyak parcel dalam masa singkat. Lebih banyak hantaran = Lebih banyak komisyen masuk poket!",
                tag: "Poket Tebal"
              },
              {
                icon: <Home className="text-green-400" size={32} />,
                title: "Balik Awal, Rehat Cukup",
                desc: "Tak perlu lagi hantar parcel sampai malam. Settle kerja pukul 4-5 petang, terus boleh balik main dengan anak-anak atau lepak minum dengan tenang.",
                tag: "Masa Berkualiti"
              },
              {
                icon: <Heart className="text-red-400" size={32} />,
                title: "Kepala Tak Pening, Hati Tenang",
                desc: "Tak perlu lagi gaduh dengan customer atau pening fikir jalan mana dulu. Ikut je arahan sistem, kerja jadi sangat 'smooth' dan tanpa stress.",
                tag: "Mental Health"
              },
              {
                icon: <Smile className="text-blue-400" size={32} />,
                title: "Kerja Jadi Lebih Enjoy",
                desc: "Bila semua dah tersusun, abang akan rasa lebih bersemangat nak keluar kerja. Tak rasa macam beban, tapi rasa macam satu cabaran yang menyeronokkan!",
                tag: "Vibe Positif"
              }
            ].map((item, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ y: -10 }}
                className="p-8 bg-white/10 backdrop-blur-md rounded-[2.5rem] border border-white/20 flex flex-col md:flex-row gap-6 items-start"
              >
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
                  {item.icon}
                </div>
                <div className="space-y-3">
                  <div className="inline-block px-3 py-1 bg-white/20 rounded-full text-[10px] font-black text-white uppercase tracking-widest">
                    {item.tag}
                  </div>
                  <h3 className="text-2xl font-black text-white">{item.title}</h3>
                  <p className="text-blue-100 font-medium leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-20 text-center">
            <div className="inline-flex flex-col items-center p-8 bg-yellow-400 rounded-[3rem] shadow-2xl shadow-yellow-500/40 rotate-1 hover:rotate-0 transition-transform cursor-default">
              <p className="text-blue-900 font-black text-xl lg:text-3xl mb-2 italic">"Dulu balik pukul 9 malam, sekarang pukul 5 dah sampai rumah!"</p>
              <p className="text-blue-800 font-bold text-sm">- Abang Man, Rider SPX (Pengguna Setia)</p>
            </div>
          </div>
        </div>
      </section>

      {/* NEW: PWA Installation Guide (Crucial for TikTok/FB Conversion) */}
      <section className="py-24 px-6 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-xs font-black uppercase tracking-widest">
                <Smartphone size={14} />
                Sangat Ringan & Cepat
              </div>
              <h2 className="text-4xl lg:text-5xl font-black text-gray-900 leading-tight tracking-tight">
                Tak Perlu <span className="text-blue-600">Play Store.</span> <br />
                Tak Makan <span className="text-red-600">Memori Phone.</span>
              </h2>
              <p className="text-xl text-gray-500 font-medium leading-relaxed max-w-lg">
                RouteKing adalah aplikasi <span className="text-blue-600 font-bold">PWA</span>. Folder gambar hantaran tersusun rapi dalam app, galeri phone anda kekal bersih & phone takkan <span className="text-red-600 font-bold italic">lagging</span> lagi!
              </p>
              
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-black shrink-0">1</div>
                  <div>
                    <h4 className="font-black text-gray-900">Tekan Butang Tiga Titik / Share</h4>
                    <p className="text-gray-500 text-sm font-medium">Buka app ini dalam browser Chrome atau Safari di phone anda.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-black shrink-0">2</div>
                  <div>
                    <h4 className="font-black text-gray-900">Pilih 'Add to Home Screen'</h4>
                    <p className="text-gray-500 text-sm font-medium">Cari pilihan ini dalam menu browser anda.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-black shrink-0">3</div>
                  <div>
                    <h4 className="font-black text-gray-900">Siap! Icon Raja Muncul</h4>
                    <p className="text-gray-500 text-sm font-medium">Sekarang anda boleh buka RouteKing terus dari skrin utama macam app biasa!</p>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={onStart}
                  className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-black text-lg hover:bg-blue-600 transition-all active:scale-95 shadow-xl shadow-gray-200"
                >
                  Cuba Sendiri Sekarang
                </button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-20 bg-blue-400/10 rounded-full blur-[100px] -z-10"></div>
              <div className="bg-gray-100 rounded-[3rem] border-4 border-white shadow-2xl relative overflow-hidden group aspect-[4/5] lg:aspect-auto lg:h-[600px]">
                <img 
                  src="https://images.unsplash.com/photo-1605098293544-25f4c32344c8?q=80&w=1000&auto=format&fit=crop" 
                  alt="App Presentation" 
                  className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-1000"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent flex flex-col justify-end p-10">
                  <div className="text-white space-y-4">
                    <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 mb-2">
                      <ShieldCheck size={24} className="text-blue-400" />
                    </div>
                    <p className="text-2xl lg:text-3xl font-black leading-tight tracking-tight">
                      "Dulu gallery penuh gila gambar parcel, sekarang phone dah smooth gila!"
                    </p>
                    <div className="flex items-center gap-2 pt-2">
                      <span className="px-3 py-1 bg-green-500 rounded-full text-[10px] font-black uppercase tracking-widest">
                        Terjamin Selamat
                      </span>
                      <span className="text-sm font-bold opacity-80 italic">100% Secure & Lightweight</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-20 space-y-4">
            <h2 className="text-4xl font-black text-gray-900 tracking-tight">Kenapa Rider Pilih RouteKing?</h2>
            <p className="text-gray-500 font-medium">Kami faham penat lelah rider. Sebab itu kami bina alat yang memudahkan kerja harian anda.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Camera className="text-blue-500" />,
                title: "Scanner AI Laju",
                desc: "Scan label terus dapat Nama, No. Tel, Alamat & Tracking. Tak payah taip manual lagi, jimat masa gila!"
              },
              {
                icon: <Zap className="text-yellow-500" />,
                title: "Optimasi Laluan",
                desc: "Susun 50+ alamat dalam masa kurang 5 saat. Sistem susun ikut jalan paling dekat & jimat minyak."
              },
              {
                icon: <ShieldCheck className="text-green-500" />,
                title: "Pin & Nota Disahkan",
                desc: "Sahkan pin lokasi tepat depan pintu & tambah nota visual (cth: Pagar Merah). Tak sesat lagi!"
              },
              {
                icon: <TrendingUp className="text-purple-500" />,
                title: "Smart Memory",
                desc: "App 'ingat' alamat yang dah pernah hantar. Pin & nota akan keluar automatik untuk hantaran akan datang."
              },
              {
                icon: <Smartphone className="text-orange-500" />,
                title: "WhatsApp Friendly",
                desc: "Hantar mesej auto yang mesra. Siap ada info COD (Cash/QR) supaya customer sedia duit awal."
              },
              {
                icon: <Clock className="text-red-500" />,
                title: "POD & COD Tracker",
                desc: "Ambil gambar bukti hantaran (POD) & pantau jumlah kutipan COD harian anda secara automatik."
              }
            ].map((feature, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ y: -10 }}
                className="p-8 bg-white rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-xl hover:shadow-blue-100/50 transition-all"
              >
                <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-500 leading-relaxed text-sm font-medium">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-3xl lg:text-5xl font-black text-gray-900 tracking-tight">
              Pilih Pelan <span className="text-blue-600">Terbaik</span> Untuk Anda
            </h2>
            <p className="text-gray-500 font-medium">Pelaburan kecil untuk hasil yang besar setiap hari.</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Lite Tier */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 flex flex-col">
              <div className="mb-6">
                <div className="inline-block px-4 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
                  Rider Santai
                </div>
                <h3 className="text-2xl font-black text-gray-900">Lite</h3>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-4xl font-black text-gray-900">RM14.90</span>
                  <span className="text-gray-400 font-bold">/ bulan</span>
                </div>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                {[
                  "80 Scan/Hari",
                  "Optimasi Laluan Basic",
                  "OSM Geocoding Only",
                  "WhatsApp Template",
                  "Simpan Sejarah 7 Hari"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-600 text-sm font-bold">
                    <CheckCircle2 className="text-blue-500 shrink-0" size={18} />
                    {item}
                  </li>
                ))}
              </ul>
              <button 
                onClick={onStart}
                className="w-full py-4 bg-gray-100 text-gray-900 rounded-2xl font-black hover:bg-blue-600 hover:text-white transition-all active:scale-95"
              >
                Mula Sekarang
              </button>
            </div>

            {/* Standard Tier */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border-4 border-blue-600 flex flex-col relative scale-105 z-10">
              <div className="absolute top-0 right-8 -translate-y-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                Paling Popular
              </div>
              <div className="mb-6">
                <div className="inline-block px-4 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
                  Rider Full-Time
                </div>
                <h3 className="text-2xl font-black text-gray-900">Standard</h3>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-4xl font-black text-gray-900">RM29.90</span>
                  <span className="text-gray-400 font-bold">/ bulan</span>
                </div>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                {[
                  "180 Scan/Hari",
                  "Optimasi Laluan Advance",
                  "Google Maps Fallback",
                  "Smart Memory (Auto-Pin)",
                  "Simpan Sejarah 30 Hari",
                  "Sokongan WhatsApp"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-600 text-sm font-bold">
                    <CheckCircle2 className="text-blue-500 shrink-0" size={18} />
                    {item}
                  </li>
                ))}
              </ul>
              <button 
                onClick={onStart}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
              >
                Pilih Standard
              </button>
            </div>

            {/* Ultimate Tier */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 flex flex-col">
              <div className="mb-6">
                <div className="inline-block px-4 py-1 bg-orange-50 text-orange-700 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
                  Rider Ultimate
                </div>
                <h3 className="text-2xl font-black text-gray-900">Ultimate</h3>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-4xl font-black text-gray-900">RM49.90</span>
                  <span className="text-gray-400 font-bold">/ bulan</span>
                </div>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                {[
                  "400 Scan/Hari",
                  "Priority AI Processing",
                  "Unlimited History",
                  "Custom WhatsApp Template",
                  "Priority Support VIP",
                  "Akses Ciri Baru Awal"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-600 text-sm font-bold">
                    <CheckCircle2 className="text-orange-500 shrink-0" size={18} />
                    {item}
                  </li>
                ))}
              </ul>
              <button 
                onClick={onStart}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black hover:bg-blue-600 transition-all active:scale-95"
              >
                Pilih Ultimate
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-3xl mx-auto space-y-10">
          <h2 className="text-4xl lg:text-5xl font-black text-gray-900 tracking-tight">
            Dah Sedia Nak Jadi <br />
            <span className="text-blue-600">Raja Jalanan?</span>
          </h2>
          <p className="text-xl text-gray-500 font-medium">
            Sertai ratusan rider lain yang dah berjaya <span className="font-bold text-blue-600">tingkatkan komisyen harian</span> serta <span className="font-bold text-yellow-500">jimatkan masa & tenaga</span> setiap hari.
          </p>
          <button 
            onClick={onStart}
            disabled={isLoggingIn}
            className="px-12 py-6 bg-gray-900 text-white rounded-2xl font-black text-xl shadow-2xl shadow-gray-200 hover:bg-blue-600 transition-all active:scale-95 inline-flex items-center gap-4"
          >
            {isLoggingIn ? 'Menyambung...' : 'Mula Trial 7 Hari Sekarang'}
            <ArrowRight />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <img 
              src="/logopwa.png" 
              alt="RouteKing Logo" 
              className="w-8 h-8 rounded-lg object-cover"
              referrerPolicy="no-referrer"
            />
            <span className="text-lg font-black tracking-tighter text-gray-900">RouteKing</span>
          </div>
          <p className="text-gray-400 text-sm font-medium">© 2026 RouteKing Malaysia. Hak Cipta Terpelihara.</p>
          <div className="flex gap-6">
            <button 
              onClick={() => openLegal('privacy')}
              className="text-gray-400 hover:text-gray-900 text-sm font-bold transition-colors"
            >
              Privasi
            </button>
            <button 
              onClick={() => openLegal('terms')}
              className="text-gray-400 hover:text-gray-900 text-sm font-bold transition-colors"
            >
              Terma
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
