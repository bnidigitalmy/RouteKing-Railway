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
  OperationType,
  addDoc,
  deleteDoc
} from '../firebase';
import { UserProfile, Parcel, Discount } from '../types';
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
  Trash2,
  Tag,
  Plus,
  Percent,
  Coins,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface AdminDashboardProps {
  onClose: () => void;
}

type Tab = 'users' | 'discounts';

export function AdminDashboard({ onClose }: AdminDashboardProps) {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [isAddingDiscount, setIsAddingDiscount] = useState(false);

  // New Discount Form State
  const [newDiscount, setNewDiscount] = useState({
    code: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: 0,
    usageLimit: 0,
    expiryDays: 30
  });

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

    // Listen to discounts
    const qDiscounts = query(collection(db, 'discounts'), orderBy('createdAt', 'desc'));
    const unsubDiscounts = onSnapshot(qDiscounts, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Discount));
      setDiscounts(data);
    }, (err) => {
      console.error("Admin Error (Discounts):", err);
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

    return () => {
      unsubProfiles();
      unsubDiscounts();
    };
  }, []);

  const toggleProStatus = async (profile: UserProfile, targetPlan: 'standard' | 'ultimate') => {
    setUpdatingUid(profile.uid);
    try {
      const isCurrentlyThatPlan = profile.subscriptionTier === targetPlan;
      
      const updateData: any = {};
      
      if (isCurrentlyThatPlan) {
        // Remove access
        updateData.isPro = false;
        updateData.subscriptionTier = 'free';
        updateData.expiryDate = null;
      } else {
        // Give access
        updateData.isPro = true;
        updateData.subscriptionTier = targetPlan;
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

  const handleCreateDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDiscount.code || newDiscount.value <= 0) return;

    try {
      const discountData: Omit<Discount, 'id'> = {
        code: newDiscount.code.toUpperCase().trim(),
        type: newDiscount.type,
        value: newDiscount.value,
        usageLimit: newDiscount.usageLimit > 0 ? newDiscount.usageLimit : undefined,
        usageCount: 0,
        isActive: true,
        createdAt: Date.now(),
        expiryDate: Date.now() + (newDiscount.expiryDays * 24 * 60 * 60 * 1000)
      };

      await addDoc(collection(db, 'discounts'), discountData);
      setIsAddingDiscount(false);
      setNewDiscount({
        code: '',
        type: 'percentage',
        value: 0,
        usageLimit: 0,
        expiryDays: 30
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'discounts');
    }
  };

  const toggleDiscountStatus = async (discount: Discount) => {
    try {
      await updateDoc(doc(db, 'discounts', discount.id), {
        isActive: !discount.isActive
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `discounts/${discount.id}`);
    }
  };

  const handleDeleteDiscount = async (id: string) => {
    if (!confirm("Padam kod diskaun ini?")) return;
    try {
      await deleteDoc(doc(db, 'discounts', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `discounts/${id}`);
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

      {/* Tab Switcher */}
      <div className="bg-white px-4 py-2 border-b flex gap-2">
        <button 
          onClick={() => setActiveTab('users')}
          className={cn(
            "flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2",
            activeTab === 'users' ? "bg-blue-600 text-white shadow-lg shadow-blue-100" : "bg-gray-50 text-gray-400"
          )}
        >
          <Users size={16} />
          Rider
        </button>
        <button 
          onClick={() => setActiveTab('discounts')}
          className={cn(
            "flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2",
            activeTab === 'discounts' ? "bg-blue-600 text-white shadow-lg shadow-blue-100" : "bg-gray-50 text-gray-400"
          )}
        >
          <Tag size={16} />
          Diskaun
        </button>
      </div>

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

        {activeTab === 'users' ? (
          <>
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
                            profile.subscriptionTier === 'ultimate' ? "bg-purple-100 text-purple-700" : 
                            profile.isPro ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"
                          )}>
                            {profile.subscriptionTier === 'ultimate' ? 'Ultimate' : profile.isPro ? 'Pro User' : 'Free Trial'}
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

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-50">
                      <button 
                        onClick={() => toggleProStatus(profile, 'standard')}
                        disabled={updatingUid === profile.uid}
                        className={cn(
                          "py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                          profile.isPro && profile.subscriptionTier !== 'ultimate'
                            ? "bg-red-50 text-red-600 hover:bg-red-100" 
                            : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100"
                        )}
                      >
                        {updatingUid === profile.uid ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : profile.isPro && profile.subscriptionTier !== 'ultimate' ? (
                          'Batal Pro'
                        ) : (
                          'Set Pro'
                        )}
                      </button>
                      <button 
                        onClick={() => toggleProStatus(profile, 'ultimate')}
                        disabled={updatingUid === profile.uid}
                        className={cn(
                          "py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                          profile.subscriptionTier === 'ultimate'
                            ? "bg-red-50 text-red-600 hover:bg-red-100" 
                            : "bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-100"
                        )}
                      >
                        {updatingUid === profile.uid ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : profile.subscriptionTier === 'ultimate' ? (
                          'Batal Ult'
                        ) : (
                          'Set Ult'
                        )}
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="space-y-6 pb-20">
            {/* Discount Management */}
            <div className="flex items-center justify-between px-2">
              <h2 className="text-sm font-black text-gray-500 uppercase tracking-widest">Kod Diskaun</h2>
              <button 
                onClick={() => setIsAddingDiscount(!isAddingDiscount)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100"
              >
                {isAddingDiscount ? <X size={14} /> : <Plus size={14} />}
                {isAddingDiscount ? 'Batal' : 'Cipta Kod'}
              </button>
            </div>

            <AnimatePresence>
              {isAddingDiscount && (
                <motion.form 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  onSubmit={handleCreateDiscount}
                  className="bg-white rounded-[2rem] p-6 border-2 border-blue-100 shadow-xl shadow-blue-50 space-y-4 overflow-hidden"
                >
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Kod (Cth: RIDER50)</label>
                    <input 
                      type="text"
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl py-3 px-4 text-sm font-bold uppercase outline-none focus:border-blue-500 transition-all"
                      placeholder="KODDISKAUN"
                      value={newDiscount.code}
                      onChange={(e) => setNewDiscount({ ...newDiscount, code: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Jenis</label>
                      <div className="flex bg-gray-50 p-1 rounded-xl border-2 border-gray-100">
                        <button 
                          type="button"
                          onClick={() => setNewDiscount({ ...newDiscount, type: 'percentage' })}
                          className={cn(
                            "flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1",
                            newDiscount.type === 'percentage' ? "bg-white text-blue-600 shadow-sm" : "text-gray-400"
                          )}
                        >
                          <Percent size={12} />
                          %
                        </button>
                        <button 
                          type="button"
                          onClick={() => setNewDiscount({ ...newDiscount, type: 'fixed' })}
                          className={cn(
                            "flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1",
                            newDiscount.type === 'fixed' ? "bg-white text-blue-600 shadow-sm" : "text-gray-400"
                          )}
                        >
                          <Coins size={12} />
                          RM
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Nilai</label>
                      <input 
                        type="number"
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl py-3 px-4 text-sm font-bold outline-none focus:border-blue-500 transition-all"
                        placeholder="0"
                        value={newDiscount.value}
                        onChange={(e) => setNewDiscount({ ...newDiscount, value: Number(e.target.value) })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Had Guna (0=Tiada)</label>
                      <input 
                        type="number"
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl py-3 px-4 text-sm font-bold outline-none focus:border-blue-500 transition-all"
                        placeholder="0"
                        value={newDiscount.usageLimit}
                        onChange={(e) => setNewDiscount({ ...newDiscount, usageLimit: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Sah (Hari)</label>
                      <input 
                        type="number"
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl py-3 px-4 text-sm font-bold outline-none focus:border-blue-500 transition-all"
                        placeholder="30"
                        value={newDiscount.expiryDays}
                        onChange={(e) => setNewDiscount({ ...newDiscount, expiryDays: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-4 bg-blue-600 text-white rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
                  >
                    Simpan Kod Diskaun
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="space-y-3">
              {discounts.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-gray-200">
                  <Tag size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-400 font-bold">Tiada kod diskaun aktif</p>
                </div>
              ) : (
                discounts.map((discount) => (
                  <div 
                    key={discount.id}
                    className={cn(
                      "bg-white rounded-2xl p-4 border-2 shadow-sm flex items-center justify-between gap-4 transition-all",
                      discount.isActive ? "border-gray-100" : "border-gray-50 opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm shadow-inner",
                        discount.isActive ? "bg-blue-50 text-blue-600" : "bg-gray-50 text-gray-400"
                      )}>
                        {discount.type === 'percentage' ? '%' : 'RM'}
                      </div>
                      <div>
                        <h3 className="font-black text-gray-900 leading-tight flex items-center gap-2">
                          {discount.code}
                          {!discount.isActive && <span className="text-[8px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded uppercase">Inactive</span>}
                        </h3>
                        <p className="text-xs text-gray-500 font-bold">
                          {discount.type === 'percentage' ? `${discount.value}%` : `RM${discount.value}`} OFF
                        </p>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                          Guna: {discount.usageCount}{discount.usageLimit ? `/${discount.usageLimit}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => toggleDiscountStatus(discount)}
                        className={cn(
                          "p-2 rounded-xl transition-all",
                          discount.isActive ? "text-green-500 hover:bg-green-50" : "text-gray-300 hover:bg-gray-50"
                        )}
                      >
                        {discount.isActive ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                      </button>
                      <button 
                        onClick={() => handleDeleteDiscount(discount.id)}
                        className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
