import React, { useState, useEffect } from 'react';
import { 
  db, 
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  query, 
  orderBy,
  onSnapshot,
  handleFirestoreError,
  OperationType
} from '../firebase';
import { UserProfile, Parcel } from '../types';
import { 
  Users, 
  ShieldCheck, 
  Search, 
  ArrowLeft, 
  Crown, 
  Clock, 
  Calendar, 
  Package, 
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  MoreVertical,
  Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface AdminDashboardProps {
  onClose: () => void;
}

export function AdminDashboard({ onClose }: AdminDashboardProps) {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Listen to all profiles
    const qProfiles = query(collection(db, 'profiles'), orderBy('riderName', 'asc'));
    const unsubProfiles = onSnapshot(qProfiles, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as UserProfile);
      setProfiles(data);
      setIsLoading(false);
    }, (err) => {
      console.error("Admin Error (Profiles):", err);
      setError("Gagal memuatkan data profil. Pastikan anda mempunyai akses Admin.");
      setIsLoading(false);
    });

    // Fetch some global stats (limited for performance)
    const fetchStats = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'parcels'));
        const data = snapshot.docs.map(doc => doc.data() as Parcel);
        setParcels(data);
      } catch (err) {
        console.error("Admin Error (Stats):", err);
      }
    };
    fetchStats();

    return () => unsubProfiles();
  }, []);

  const toggleProStatus = async (profile: UserProfile) => {
    setUpdatingUid(profile.uid);
    try {
      const newIsPro = !profile.isPro;
      const updateData: any = { isPro: newIsPro };
      
      if (newIsPro) {
        // If giving Pro access, set expiry to 1 year from now
        updateData.expiryDate = Date.now() + (366 * 24 * 60 * 60 * 1000);
        updateData.subscriptionType = 'yearly';
      }

      await updateDoc(doc(db, 'profiles', profile.uid), updateData);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `profiles/${profile.uid}`);
    } finally {
      setUpdatingUid(null);
    }
  };

  const filteredProfiles = profiles.filter(p => 
    p.riderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.email && p.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    p.courierCompany.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    totalUsers: profiles.length,
    proUsers: profiles.filter(p => p.isPro).length,
    totalParcels: parcels.length,
    deliveredParcels: parcels.filter(p => p.status === 'delivered').length
  };

  return (
    <div className="fixed inset-0 bg-gray-50 z-[60] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b px-4 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h1 className="font-black text-xl text-gray-900 tracking-tight flex items-center gap-2">
              <ShieldCheck className="text-blue-600" size={24} />
              Admin Dashboard
            </h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pengurusan Sistem RouteKing</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {error && (
          <div className="bg-red-50 border-2 border-red-100 text-red-600 p-4 rounded-2xl flex items-start gap-3">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <div className="flex-1">
              <p className="text-sm font-bold">Akses Ditolak</p>
              <p className="text-xs opacity-80">{error}</p>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-2xl border-2 border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <Users size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Jumlah Rider</span>
            </div>
            <p className="text-2xl font-black text-gray-900">{stats.totalUsers}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border-2 border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 text-yellow-500 mb-2">
              <Crown size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">User Pro</span>
            </div>
            <p className="text-2xl font-black text-gray-900">{stats.proUsers}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border-2 border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 text-green-600 mb-2">
              <Package size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Total Parcel</span>
            </div>
            <p className="text-2xl font-black text-gray-900">{stats.totalParcels}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border-2 border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 text-purple-600 mb-2">
              <CheckCircle2 size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Selesai</span>
            </div>
            <p className="text-2xl font-black text-gray-900">{stats.deliveredParcels}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text"
            placeholder="Cari rider, email, atau syarikat..."
            className="w-full bg-white border-2 border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:border-blue-500 focus:ring-0 transition-all outline-none shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* User List */}
        <div className="space-y-3">
          <h2 className="text-sm font-black text-gray-500 uppercase tracking-widest px-2">Senarai Pengguna</h2>
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <RefreshCw className="animate-spin text-blue-600" size={32} />
              <p className="text-gray-400 font-bold text-sm">Memuatkan senarai...</p>
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-gray-200">
              <Users size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400 font-bold">Tiada pengguna dijumpai</p>
            </div>
          ) : (
            filteredProfiles.map((profile) => (
              <motion.div 
                layout
                key={profile.uid}
                className="bg-white rounded-2xl p-4 border-2 border-gray-100 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shadow-inner",
                      profile.isPro ? "bg-yellow-50 text-yellow-600" : "bg-gray-50 text-gray-400"
                    )}>
                      {profile.riderName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-black text-gray-900 leading-tight flex items-center gap-2">
                        {profile.riderName}
                        {profile.isPro && <Crown size={14} className="text-yellow-500 fill-current" />}
                      </h3>
                      <p className="text-xs text-gray-500 font-medium">{profile.courierCompany}</p>
                      <p className="text-[10px] text-gray-400 font-mono mt-1">{profile.email || profile.uid.substring(0, 8)}</p>
                    </div>
                  </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={cn(
                        "text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest",
                        profile.isPro ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"
                      )}>
                        {profile.isPro ? 'Pro User' : 'Free Trial'}
                      </span>
                      <div className="flex flex-col items-end gap-1 text-[10px] font-bold text-gray-400">
                        <div className="flex items-center gap-1">
                          <Clock size={10} />
                          <span>{profile.dailyScanCount || 0} (H)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar size={10} />
                          <span>{profile.monthlyScanCount || 0} (B)</span>
                        </div>
                      </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-50">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Mula Trial</p>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
                      <Clock size={12} />
                      {profile.trialStartedAt ? new Date(profile.trialStartedAt).toLocaleDateString('ms-MY') : 'N/A'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Tarikh Luput</p>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
                      <Calendar size={12} />
                      {profile.expiryDate ? new Date(profile.expiryDate).toLocaleDateString('ms-MY') : 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button 
                    onClick={() => toggleProStatus(profile)}
                    disabled={updatingUid === profile.uid}
                    className={cn(
                      "w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                      profile.isPro 
                        ? "bg-red-50 text-red-600 hover:bg-red-100" 
                        : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100"
                    )}
                  >
                    {updatingUid === profile.uid ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : profile.isPro ? (
                      <>
                        <X size={14} />
                        Batalkan Akses Pro
                      </>
                    ) : (
                      <>
                        <Crown size={14} />
                        Berikan Akses Pro
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
