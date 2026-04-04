import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { LandingPage } from './components/LandingPage';
import { AdminDashboard } from './components/AdminDashboard';
import { Plus, MapPin, Navigation, Trash2, RefreshCw, Package, ArrowRight, Camera, Search, LayoutGrid, List, Map, Filter, Folder, MoreVertical, LogOut, LogIn, AlertCircle, X, Edit2, User as UserIcon, CheckCircle2, Copy, Share2, ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';
import { Parcel, UserProfile } from './types';
import { Scanner } from './components/Scanner';
import { LegalModal } from './components/LegalModal';
import { ParcelCard } from './components/ParcelCard';
import { Stats } from './components/Stats';
import { MapPreview } from './components/MapPreview';
import { NavigationMode } from './components/NavigationMode';
import { optimizeRoute } from './lib/optimizer';
import { getCoordinates } from './lib/gemini';
import { cn } from './lib/utils';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { 
  auth, 
  db, 
  signInWithGoogle, 
  logout, 
  collection, 
  doc, 
  setDoc, 
  getDocs,
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot, 
  onAuthStateChanged,
  orderBy, 
  limit,
  handleFirestoreError,
  OperationType,
  User 
} from './firebase';

const FREE_DAILY_LIMIT = 50;
const PRO_DAILY_LIMIT = 300;
const FREE_MONTHLY_LIMIT = 500;
const PRO_MONTHLY_LIMIT = 5000;

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isNavigationModeOpen, setIsNavigationModeOpen] = useState(false);
  const [navigationFolder, setNavigationFolder] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizingMessage, setOptimizingMessage] = useState('Menyusun laluan...');
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'map'>('list');
  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'delivered'>('pending');
  const [filterCOD, setFilterCOD] = useState<boolean>(false);
  const [filterGroup, setFilterGroup] = useState<string>('all');

  // Folder States
  const [folders, setFolders] = useState<string[]>([]);
  const [parcelOptionsId, setParcelOptionsId] = useState<string | null>(null);
  
  // Modal States
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isEditParcelModalOpen, setIsEditParcelModalOpen] = useState(false);
  const [editingParcel, setEditingParcel] = useState<Parcel | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [parcelToDelete, setParcelToDelete] = useState<string | null>(null);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isClearDeliveredModalOpen, setIsClearDeliveredModalOpen] = useState(false);
  const [isMarkingModeOpen, setIsMarkingModeOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [legalModal, setLegalModal] = useState<{ isOpen: boolean; type: 'privacy' | 'terms' }>({
    isOpen: false,
    type: 'privacy'
  });
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showPWAHint, setShowPWAHint] = useState(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [riderName, setRiderName] = useState('');
  const [courierCompany, setCourierCompany] = useState('Shopee Express (SPX)');
  const [error, setError] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  // Default start point (Hub)
  const [startPoint, setStartPoint] = useState({ lat: 3.1390, lng: 101.6869 });

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && !riderName) {
        setRiderName(currentUser.displayName || '');
      }
      setIsAuthLoading(false);
    });

    // Check for iOS PWA Standalone mode
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    if (isIOS && !isStandalone) {
      setShowPWAHint(true);
    }

    // Check for payment status in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.5 }
      });
      // Clear the query param
      window.history.replaceState({}, document.title, "/");
    } else if (urlParams.get('payment') === 'failed') {
      setError("Pembayaran tidak berjaya atau telah dibatalkan. Sila cuba lagi.");
      setIsSubscriptionModalOpen(true);
      window.history.replaceState({}, document.title, "/");
    }

    // Get current location on mount
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setStartPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.log("Using default hub location"),
        { timeout: 5000 }
      );
    }

    return () => unsubscribe();
  }, []);

  // Firestore Listeners
  useEffect(() => {
    if (!user) {
      setParcels([]);
      setFolders([]);
      return;
    }

    // Listen to Parcels
    const qParcels = query(
      collection(db, 'parcels'), 
      where('uid', '==', user.uid),
      orderBy('sequenceNumber', 'asc'),
      limit(500)
    );
    const unsubParcels = onSnapshot(qParcels, (snapshot) => {
      const parcelData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Parcel));
      setParcels(parcelData);
    }, (error) => {
      console.error("Firestore Error (Parcels):", error);
    });

    // Listen to Folders
    const qFolders = query(
      collection(db, 'folders'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'asc')
    );
    const unsubFolders = onSnapshot(qFolders, (snapshot) => {
      const folderData = snapshot.docs.map(doc => doc.data().name as string);
      setFolders(folderData);
    }, (error) => {
      console.error("Firestore Error (Folders):", error);
    });

    // Listen to Profile
    const unsubProfile = onSnapshot(doc(db, 'profiles', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as UserProfile;
        setProfile(data);
        setRiderName(data.riderName);
        setCourierCompany(data.courierCompany);
        setIsAdmin(data.role === 'admin' || user.email === 'bnidigital.my@gmail.com');

        // Check subscription status
        const now = Date.now();
        const trialDays = 7;
        const trialMs = trialDays * 24 * 60 * 60 * 1000;
        
        // If trialStartedAt is missing (old user), initialize it
        if (!data.trialStartedAt) {
          updateDoc(doc(db, 'profiles', user.uid), { 
            trialStartedAt: now,
            isPro: data.isPro || false 
          });
          return;
        }

        const testers = ['syabanizainon83@gmail.com', 'bniresources2@gmail.com'];
        const isTester = testers.includes(user.email || '');
        const trialExpired = (now - data.trialStartedAt > trialMs) || isTester;
        const subscriptionActive = data.isPro && data.expiryDate && now < data.expiryDate;
        
        if (!subscriptionActive && trialExpired) {
          setIsSubscriptionModalOpen(true);
        } else {
          setIsSubscriptionModalOpen(false);
        }
      } else {
        // New user - prompt for profile setup
        setIsProfileModalOpen(true);
      }
    }, (error) => {
      console.error("Firestore Error (Profile):", error);
    });

    return () => {
      unsubParcels();
      unsubFolders();
      unsubProfile();
    };
  }, [user]);

  const handleScan = async (data: { recipientName?: string; recipientPhone?: string; address: string; trackingNumber: string; isCOD?: boolean; codAmount?: number; groupTag?: string }) => {
    if (!user || !profile) return;

    // Quota Check
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.substring(0, 7); // YYYY-MM

    const isNewDay = profile.lastScanResetDate !== today;
    const isNewMonth = profile.lastScanResetMonth !== thisMonth;

    const currentDailyCount = isNewDay ? 0 : (profile.dailyScanCount || 0);
    const currentMonthlyCount = isNewMonth ? 0 : (profile.monthlyScanCount || 0);

    const dailyLimit = profile.isPro ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;
    const monthlyLimit = profile.isPro ? PRO_MONTHLY_LIMIT : FREE_MONTHLY_LIMIT;

    if (currentDailyCount >= dailyLimit) {
      setIsScannerOpen(false);
      setError(`Had scan harian dicapai (${currentDailyCount}/${dailyLimit}). Sila cuba lagi esok atau upgrade ke Pro.`);
      if (!profile.isPro) setIsSubscriptionModalOpen(true);
      return;
    }

    if (currentMonthlyCount >= monthlyLimit) {
      setIsScannerOpen(false);
      setError(`Had scan bulanan dicapai (${currentMonthlyCount}/${monthlyLimit}). Sila tunggu bulan depan atau upgrade ke Pro.`);
      if (!profile.isPro) setIsSubscriptionModalOpen(true);
      return;
    }

    const coords = await getCoordinates(data.address);
    
    const sanitize = (val: any) => {
      if (val === null || val === undefined || String(val).toLowerCase() === 'null' || String(val).toLowerCase() === 'undefined') {
        return '';
      }
      return String(val).trim();
    };

    const tracking = sanitize(data.trackingNumber);
    const existing = parcels.find(p => p.trackingNumber === tracking);
    if (existing) {
      // Instead of window.confirm which might hang in iframe, we use a simple check
      // If the user really wants to avoid duplicates, they can delete the old one
      // For now, let's just allow it but maybe we can add a flag later
      console.log(`Tracking ${tracking} already exists at Stop #${existing.sequenceNumber}`);
    }

    const parcelId = typeof crypto.randomUUID === 'function' 
      ? crypto.randomUUID() 
      : Date.now().toString(36) + Math.random().toString(36).substring(2);
    const newParcel: any = {
      id: parcelId,
      recipientName: sanitize(data.recipientName) || 'Tiada Nama',
      recipientPhone: sanitize(data.recipientPhone),
      address: data.address,
      trackingNumber: tracking,
      status: 'pending',
      sequenceNumber: parcels.length + 1,
      lat: coords.lat,
      lng: coords.lng,
      scannedAt: Date.now(),
      isCOD: !!data.isCOD,
      codAmount: data.codAmount || 0,
      groupTag: data.groupTag || '',
      uid: user.uid
    };

    try {
      await setDoc(doc(db, 'parcels', parcelId), newParcel);
      
      // Update scan count
      await updateDoc(doc(db, 'profiles', user.uid), {
        dailyScanCount: currentDailyCount + 1,
        lastScanResetDate: today,
        monthlyScanCount: currentMonthlyCount + 1,
        lastScanResetMonth: thisMonth
      });

      setIsScannerOpen(false);
      setError(null);
      
      // Success feedback
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#2563eb', '#10b981', '#f59e0b']
      });
    } catch (e: any) {
      setError(e.message || "Gagal simpan parcel. Sila cuba lagi.");
      handleFirestoreError(e, OperationType.WRITE, `parcels/${parcelId}`);
    }
  };

  const handleDeleteParcel = async (id: string) => {
    if (!user) return;
    setParcelToDelete(id);
    setParcelOptionsId(null);
  };

  const confirmDeleteParcel = async () => {
    if (!user || !parcelToDelete) return;
    
    try {
      await deleteDoc(doc(db, 'parcels', parcelToDelete));
      setParcelToDelete(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `parcels/${parcelToDelete}`);
    }
  };

  const handleEditParcel = (parcel: Parcel) => {
    setEditingParcel(parcel);
    setIsEditParcelModalOpen(true);
    setParcelOptionsId(null);
  };

  const submitEditParcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParcel || !user) return;

    setIsSavingEdit(true);
    try {
      await updateDoc(doc(db, 'parcels', editingParcel.id), {
        recipientName: editingParcel.recipientName,
        recipientPhone: editingParcel.recipientPhone,
        address: editingParcel.address,
        trackingNumber: editingParcel.trackingNumber,
        isCOD: editingParcel.isCOD,
        codAmount: editingParcel.codAmount,
        groupTag: editingParcel.groupTag
      });
      setIsEditParcelModalOpen(false);
      setEditingParcel(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `parcels/${editingParcel.id}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleStatusChange = async (id: string, status: Parcel['status']) => {
    try {
      const updateData: any = { status };
      if (status === 'delivered') {
        updateData.deliveredAt = Date.now();
      } else {
        updateData.deliveredAt = null; // Reset if moved back to pending
      }
      await updateDoc(doc(db, 'parcels', id), updateData);
      
      if (status === 'delivered') {
        const remaining = parcels.filter(p => p.id !== id && p.status !== 'delivered').length;
        if (remaining === 0) {
          confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.6 },
            colors: ['#10b981', '#3b82f6']
          });
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `parcels/${id}`);
    }
  };

  const getCurrentLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(startPoint);
        return;
      }

      // Manual timeout to prevent hanging on some devices (especially iOS PWA)
      const timeoutId = setTimeout(() => {
        console.warn("Geolocation manual timeout reached");
        resolve(startPoint);
      }, 10000);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timeoutId);
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setStartPoint(loc);
          resolve(loc);
        },
        (err) => {
          clearTimeout(timeoutId);
          console.warn("Geolocation error or denied:", err.message);
          resolve(startPoint);
        },
        { 
          timeout: 8000, 
          enableHighAccuracy: true,
          maximumAge: 60000 // Accept a cached position up to 1 minute old
        }
      );
    });
  };

  const handleOptimize = useCallback(async (targetFolder?: string) => {
    if (!user) return;
    setIsOptimizing(true);
    setOptimizingMessage('Mencari lokasi anda...');
    
    // Small delay to ensure the loading overlay is rendered on iOS
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      const currentPos = await getCurrentLocation();
      setOptimizingMessage('Menganalisis alamat parcel...');
      
      let optimizedParcels: Parcel[] = [];
      let parcelsToUpdate: Parcel[] = [];

      if (typeof targetFolder === 'string') {
        const folderPending = parcels.filter(p => p.status !== 'delivered' && (p.folder || 'Tiada Folder') === targetFolder);
        if (folderPending.length > 0) {
          setOptimizingMessage(`Menyusun ${folderPending.length} parcel...`);
          const optimized = await optimizeRoute(folderPending, currentPos);
          const seqNumbers = folderPending.map(p => p.sequenceNumber).sort((a, b) => a - b);
          parcelsToUpdate = optimized.map((p, i) => ({ ...p, sequenceNumber: seqNumbers[i] }));
        }
      } else {
        const pendingParcels = parcels.filter(p => p.status !== 'delivered');
        const deliveredParcels = parcels.filter(p => p.status === 'delivered');
        
        if (pendingParcels.length > 0) {
          setOptimizingMessage(`Menyusun ${pendingParcels.length} parcel...`);
          const optimized = await optimizeRoute(pendingParcels, currentPos);
          const allSorted = [...optimized, ...deliveredParcels];
          parcelsToUpdate = allSorted.map((p, i) => ({ ...p, sequenceNumber: i + 1 }));
        }
      }

      if (parcelsToUpdate.length > 0) {
        setOptimizingMessage('Mengemaskini urutan...');
        // Update in Firestore
        const promises = parcelsToUpdate.map(p => 
          updateDoc(doc(db, 'parcels', p.id), { sequenceNumber: p.sequenceNumber })
        );
        await Promise.all(promises);
        
        // Switch to map view to show the result visually
        setViewMode('map');
      }

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

    } catch (error) {
      console.error("Optimization failed:", error);
      setError("Gagal menyusun laluan. Sila cuba lagi.");
    } finally {
      setIsOptimizing(false);
      setOptimizingMessage('Menyusun laluan...');
    }
  }, [parcels, user]);

  const handleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Sign in error:", err);
      // Ignore cancelled popup request as it's usually user-initiated or a double-click
      if (err.code !== 'auth/cancelled-popup-request') {
        setError(`Ralat log masuk: ${err.message}`);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!riderName.trim()) {
      setError("Sila masukkan nama rider.");
      return;
    }
    
    setIsSavingProfile(true);
    setError(null);
    
    try {
      const profileData: any = {
        uid: user.uid,
        riderName: riderName.trim(),
        courierCompany: courierCompany.trim()
      };

      // Initialize trial for brand new profiles
      if (!profile) {
        profileData.trialStartedAt = Date.now();
        profileData.isPro = false;
      }

      await setDoc(doc(db, 'profiles', user.uid), profileData, { merge: true });
      
      // Trigger success feedback
      setSaveSuccess(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      // Close modal after a short delay to show success state
      window.setTimeout(() => {
        setIsProfileModalOpen(false);
        setSaveSuccess(false);
        setIsSavingProfile(false);
      }, 700);
    } catch (e) {
      setIsSavingProfile(false);
      const errorMessage = e instanceof Error ? e.message : "Gagal menyimpan profile.";
      setError(errorMessage);
      console.error("Profile Save Error:", e);
    }
  };

  const handleRealPayment = async (type: 'monthly' | 'yearly') => {
    if (!user) return;
    setIsSavingProfile(true);
    setError(null);
    setPaymentUrl(null);
    try {
      const response = await axios.post('/api/payment/create', {
        uid: user.uid,
        email: user.email,
        name: riderName || user.displayName,
        type: type
      });
      
      if (response.data.paymentUrl) {
        setPaymentUrl(response.data.paymentUrl);
        // Try to open automatically, but the button will be there as fallback
        window.open(response.data.paymentUrl, '_blank');
      } else {
        throw new Error("Payment URL not found");
      }
    } catch (err: any) {
      console.error("Payment creation failed:", err);
      const msg = err.response?.data?.error || err.message || "Gagal memulakan pembayaran";
      setError(`Ralat: ${msg}. Sila pastikan kunci API ToyyibPay telah dikonfigurasi di Settings.`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleStartNavigation = (folder?: string) => {
    setNavigationFolder(folder || null);
    setIsNavigationModeOpen(true);
  };

  const handleMarkingScan = (trackingNumber: string) => {
    const found = parcels.find(p => 
      p.trackingNumber.toLowerCase().includes(trackingNumber.toLowerCase()) ||
      trackingNumber.toLowerCase().includes(p.trackingNumber.toLowerCase())
    );
    return found;
  };

  const confirmClearAll = () => {
    setIsClearAllModalOpen(true);
  };

  const executeClearAll = async () => {
    if (!user) return;
    try {
      const promises = parcels.map(p => deleteDoc(doc(db, 'parcels', p.id)));
      await Promise.all(promises);
      setIsClearAllModalOpen(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'parcels');
    }
  };

  const executeClearDelivered = async () => {
    if (!user) return;
    try {
      const deliveredParcels = parcels.filter(p => p.status === 'delivered');
      const promises = deliveredParcels.map(p => deleteDoc(doc(db, 'parcels', p.id)));
      await Promise.all(promises);
      setIsClearDeliveredModalOpen(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'parcels/delivered');
    }
  };

  const openCreateFolderModal = () => {
    setNewFolderName('');
    setIsCreateFolderModalOpen(true);
  };

  const submitCreateFolder = async () => {
    if (!user) return;
    if (newFolderName && newFolderName.trim() !== '') {
      const trimmedName = newFolderName.trim();
      if (!folders.includes(trimmedName)) {
        const folderId = crypto.randomUUID();
        try {
          await setDoc(doc(db, 'folders', folderId), {
            name: trimmedName,
            uid: user.uid,
            createdAt: Date.now()
          });
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `folders/${folderId}`);
        }
      }
    }
    setIsCreateFolderModalOpen(false);
  };

  const confirmDeleteFolder = (folderName: string) => {
    setFolderToDelete(folderName);
  };

  const executeDeleteFolder = async () => {
    if (!user || !folderToDelete) return;
    try {
      // 1. Find folder doc to delete
      const q = query(collection(db, 'folders'), where('uid', '==', user.uid), where('name', '==', folderToDelete));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
      
      // 2. Update parcels in that folder
      const updatePromises = parcels
        .filter(p => p.folder === folderToDelete)
        .map(p => updateDoc(doc(db, 'parcels', p.id), { folder: null }));

      await Promise.all([...deletePromises, ...updatePromises]);
      setFolderToDelete(null);
    } catch (e) {
      console.error("Error deleting folder:", e);
    }
  };

  // Get unique groups for filter dropdown
  const uniqueGroups = React.useMemo(() => 
    Array.from(new Set(parcels.map(p => p.groupTag).filter(Boolean))) as string[],
    [parcels]
  );

  // Apply filters
  const filteredParcels = React.useMemo(() => {
    return parcels.filter(p => {
      // Search query
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        p.address.toLowerCase().includes(searchLower) ||
        p.trackingNumber.toLowerCase().includes(searchLower) ||
        (p.recipientName && p.recipientName.toLowerCase().includes(searchLower)) ||
        (p.groupTag && p.groupTag.toLowerCase().includes(searchLower));

      // Status filter
      const matchesStatus = filterStatus === 'all' ? true : p.status === filterStatus;
      
      // COD filter
      const matchesCOD = filterCOD ? p.isCOD === true : true;
      
      // Group filter
      const matchesGroup = filterGroup === 'all' ? true : p.groupTag === filterGroup;

      return matchesSearch && matchesStatus && matchesCOD && matchesGroup;
    });
  }, [parcels, searchQuery, filterStatus, filterCOD, filterGroup]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="animate-spin text-blue-600" size={40} />
          <p className="text-gray-500 font-bold animate-pulse">Memuatkan RouteKing...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage onStart={handleSignIn} isLoggingIn={isSigningIn} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* iOS PWA Hint */}
      <AnimatePresence>
        {showPWAHint && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-4 left-4 right-4 z-[100] bg-blue-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-blue-400"
          >
            <div className="bg-white/20 p-2 rounded-xl">
              <Share2 size={24} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-black leading-tight">Guna RouteKing Macam App!</p>
              <p className="text-[10px] opacity-90 font-medium">Klik butang <span className="font-bold">Share</span> dan pilih <span className="font-bold">"Add to Home Screen"</span> untuk pengalaman terbaik.</p>
            </div>
            <button 
              onClick={() => setShowPWAHint(false)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Optimization Loading Overlay */}
      <AnimatePresence>
        {isOptimizing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 max-w-xs w-full text-center space-y-6 shadow-2xl"
            >
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 border-4 border-blue-100 rounded-full" />
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent"
                />
                <div className="absolute inset-0 flex items-center justify-center text-blue-600">
                  <Navigation size={32} className="animate-pulse" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-black text-gray-900 tracking-tight">Menyusun Laluan</h3>
                <p className="text-gray-500 font-medium animate-pulse">{optimizingMessage}</p>
              </div>
              
              <div className="pt-4">
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 15, ease: "linear" }}
                    className="h-full bg-blue-600"
                  />
                </div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-3">Sila tunggu sebentar...</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legal Modal */}
      <LegalModal 
        isOpen={legalModal.isOpen} 
        onClose={() => setLegalModal({ ...legalModal, isOpen: false })} 
        type={legalModal.type} 
      />
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-30 px-4 py-4 shadow-sm">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
              <Navigation size={20} className="fill-current" />
            </div>
            <div>
              <h1 className="font-black text-xl text-gray-900 tracking-tight leading-none">RouteKing</h1>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">Courier Edition</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2">
            <button 
              onClick={confirmClearAll}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              title="Padam Semua"
            >
              <Trash2 size={20} />
            </button>
            {user && (
              <>
                <button 
                  onClick={() => setIsProfileModalOpen(true)}
                  className="p-2 text-gray-400 hover:text-blue-600 transition-colors flex items-center gap-1.5"
                  title="Profile Rider"
                >
                  <UserIcon size={20} />
                  <span className="hidden sm:inline text-[10px] font-black uppercase tracking-tighter max-w-[60px] truncate">{riderName || 'Setup'}</span>
                </button>
                <button 
                  onClick={logout}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        {error && (
          <div className="bg-red-50 border-2 border-red-100 text-red-600 p-4 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <div className="flex-1">
              <p className="text-sm font-bold">Ralat Berlaku</p>
              <p className="text-xs opacity-80">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <X size={18} />
            </button>
          </div>
        )}

        <Stats parcels={parcels} />

            {/* Search & Actions */}
            <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text"
                placeholder="Cari nama, tracking, tag..."
                className="w-full bg-white border-2 border-gray-100 rounded-2xl py-3 pl-10 pr-4 text-sm font-medium focus:border-blue-500 focus:ring-0 transition-all outline-none shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "p-3 border-2 rounded-2xl transition-all shadow-sm flex items-center justify-center w-12",
                showFilters || filterStatus !== 'all' || filterCOD || filterGroup !== 'all'
                  ? "bg-blue-50 border-blue-200 text-blue-600" 
                  : "bg-white border-gray-100 text-gray-500 hover:bg-gray-50"
              )}
            >
              <Filter size={20} />
            </button>
          </div>

          {/* Expandable Filters Panel */}
          {showFilters && (
            <div className="bg-white p-4 rounded-2xl border-2 border-gray-100 shadow-sm space-y-4 animate-in slide-in-from-top-2">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Status Parcel</label>
                <div className="flex gap-2">
                  {(['all', 'pending', 'delivered'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all",
                        filterStatus === status 
                          ? "bg-blue-600 text-white shadow-md" 
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {status === 'all' ? 'Semua' : status === 'pending' ? 'Belum Hantar' : 'Selesai'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Jenis Parcel</label>
                <button
                  onClick={() => setFilterCOD(!filterCOD)}
                  className={cn(
                    "w-full py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
                    filterCOD 
                      ? "bg-orange-500 text-white shadow-md" 
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  COD Sahaja
                </button>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <button
                  onClick={() => setIsMarkingModeOpen(true)}
                  className="w-full py-3 px-3 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 bg-purple-600 text-white shadow-lg active:scale-95"
                >
                  <Edit2 size={18} />
                  MOD MENANDA (SCAN & TULIS NO.)
                </button>
              </div>

              {uniqueGroups.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                    <Folder size={12} /> Tag Kawasan
                  </label>
                  <select
                    value={filterGroup}
                    onChange={(e) => setFilterGroup(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-lg py-2 px-3 text-sm font-bold text-gray-700 focus:border-blue-500 outline-none"
                  >
                    <option value="all">Semua Kawasan</option>
                    {uniqueGroups.map(group => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={() => handleOptimize()}
                disabled={isOptimizing || parcels.length === 0}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-sm transition-all shadow-md active:scale-95",
                  isOptimizing 
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                    : "bg-blue-600 text-white hover:bg-blue-700"
                )}
              >
                {isOptimizing ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    Menyusun...
                  </>
                ) : (
                  <>
                    <RefreshCw size={18} />
                    Susun Semua (Global)
                  </>
                )}
              </button>
              
              <button
                onClick={() => {
                  if (viewMode === 'list') setViewMode('grid');
                  else if (viewMode === 'grid') setViewMode('map');
                  else setViewMode('list');
                }}
                className="p-3 bg-white border-2 border-gray-100 rounded-2xl text-gray-500 hover:bg-gray-50 transition-all shadow-sm flex items-center justify-center w-12"
                title="Tukar Paparan"
              >
                {viewMode === 'list' && <LayoutGrid size={20} />}
                {viewMode === 'grid' && <Map size={20} />}
                {viewMode === 'map' && <List size={20} />}
              </button>
            </div>

            {parcels.filter(p => p.status === 'pending').length > 0 && (
              <button
                onClick={() => handleStartNavigation()}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-black py-4 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 text-lg"
              >
                <Navigation size={24} />
                MULA SEMUA (GLOBAL) ({parcels.filter(p => p.status === 'pending').length} STOP)
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="max-w-md mx-auto mb-6">
          <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
            <button 
              onClick={() => setFilterStatus('pending')}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2",
                filterStatus === 'pending' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Package size={14} />
              Aktif ({parcels.filter(p => p.status === 'pending').length})
            </button>
            <button 
              onClick={() => setFilterStatus('delivered')}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2",
                filterStatus === 'delivered' ? "bg-white text-green-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <CheckCircle2 size={14} />
              Sejarah ({parcels.filter(p => p.status === 'delivered').length})
            </button>
          </div>

          {filterStatus === 'delivered' && parcels.filter(p => p.status === 'delivered').length > 0 && (
            <button 
              onClick={() => setIsClearDeliveredModalOpen(true)}
              className="w-full py-2 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2 mb-4 border border-red-100 border-dashed"
            >
              <Trash2 size={12} /> Padam Semua Sejarah
            </button>
          )}
        </div>

        {viewMode === 'map' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">Peta Laluan</h2>
              <button 
                onClick={() => setViewMode('list')}
                className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <List size={14} /> Kembali ke Senarai
              </button>
            </div>
            <MapPreview parcels={filteredParcels} startPoint={startPoint} />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between mt-2">
              <h2 className="font-bold text-gray-800">Senarai Parcel</h2>
              <button 
                onClick={openCreateFolderModal} 
                className="flex items-center gap-1 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={16} /> Tambah Folder
              </button>
            </div>

            {['Tiada Folder', ...folders].map(folder => {
              const folderParcels = filteredParcels
                .filter(p => (p.folder || 'Tiada Folder') === folder)
                .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
              
              if (folder === 'Tiada Folder' && folderParcels.length === 0 && folders.length > 0) return null;

              const isCollapsed = collapsedFolders[folder] || false;

              return (
                <div 
                  key={folder}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const parcelId = e.dataTransfer.getData('text/plain');
                    if (parcelId) {
                      try {
                        await updateDoc(doc(db, 'parcels', parcelId), { 
                          folder: folder === 'Tiada Folder' ? null : folder 
                        });
                      } catch (err) {
                        console.error("Error moving parcel:", err);
                      }
                    }
                  }}
                  className={cn(
                    "rounded-2xl p-3 border-2 transition-colors",
                    folder === 'Tiada Folder' ? "bg-transparent border-transparent p-0" : "bg-gray-100/50 border-dashed border-gray-200"
                  )}
                >
                  <div className={cn("flex items-center justify-between mb-3 px-2", folder === 'Tiada Folder' && folderParcels.length === 0 && "hidden")}>
                    <button 
                      onClick={() => setCollapsedFolders(prev => ({ ...prev, [folder]: !isCollapsed }))}
                      className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                    >
                      {isCollapsed ? <ChevronRight size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                      <h3 className="font-bold text-gray-700 flex items-center gap-2">
                        {folder === 'Tiada Folder' ? <Package size={18} className="text-gray-400" /> : <Folder size={18} className="text-blue-500" />}
                        {folder}
                        <span className="bg-gray-200 text-gray-600 text-xs py-0.5 px-2 rounded-full">{folderParcels.length}</span>
                      </h3>
                    </button>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleStartNavigation(folder)} 
                        disabled={folderParcels.filter(p => p.status !== 'delivered').length === 0}
                        className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 hover:bg-green-100 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Navigation size={14} />
                        Mula
                      </button>
                      <button 
                        onClick={() => handleOptimize(folder)} 
                        disabled={isOptimizing || folderParcels.filter(p => p.status !== 'delivered').length === 0}
                        className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <RefreshCw size={14} className={isOptimizing ? "animate-spin" : ""} />
                        Susun
                      </button>
                      {folder !== 'Tiada Folder' && (
                        <button onClick={() => confirmDeleteFolder(folder)} className="text-red-400 hover:text-red-600 p-1 ml-1">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {!isCollapsed && (
                    <div className={cn(
                      "grid gap-3 animate-in fade-in slide-in-from-top-1 duration-200",
                      viewMode === 'grid' ? "grid-cols-2" : "grid-cols-1"
                    )}>
                      {folderParcels.map(parcel => (
                        <ParcelCard 
                          key={parcel.id} 
                          parcel={parcel} 
                          profile={profile}
                          onStatusChange={handleStatusChange}
                          onMoveClick={() => setParcelOptionsId(parcel.id)}
                        />
                      ))}
                      {folderParcels.length === 0 && folder !== 'Tiada Folder' && (
                        <div className="col-span-full text-center py-6 text-gray-400 text-sm font-medium border-2 border-dashed border-gray-200 rounded-xl">
                          Tarik parcel ke sini atau guna menu 3-titik
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            
            {filteredParcels.length === 0 && folders.length === 0 && (
              <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-4">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                  <Package size={40} />
                </div>
                <p className="font-bold text-sm">Tiada parcel dijumpai.</p>
              </div>
            )}
          </div>
        )}

          {/* Floating Action Button */}
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.9 }}
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center gap-3 bg-blue-600 text-white font-black py-5 px-10 rounded-full shadow-[0_20px_50px_rgba(37,99,235,0.3)] border-4 border-white transition-all group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-700 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <Camera size={28} className="relative z-10 group-hover:rotate-12 transition-transform" />
              <span className="text-xl relative z-10 tracking-tight">SCAN PARCEL</span>
              
              {/* Pulse effect */}
              <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-20 pointer-events-none" />
            </motion.button>
          </div>

          {/* Scanner Modal */}
          {isScannerOpen && (
            <Scanner 
              onScan={handleScan} 
              onClose={() => setIsScannerOpen(false)} 
              quota={profile ? {
                current: profile.dailyScanCount || 0,
                limit: profile.isPro ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT
              } : undefined}
            />
          )}

          {/* Marking Mode Modal */}
          {isMarkingModeOpen && (
            <Scanner 
              mode="mark"
              onMarkScan={handleMarkingScan}
              onClose={() => setIsMarkingModeOpen(false)} 
              quota={profile ? {
                current: profile.dailyScanCount || 0,
                limit: profile.isPro ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT
              } : undefined}
            />
          )}

          {/* Navigation Mode Overlay */}
          {isNavigationModeOpen && (
            <NavigationMode 
              parcels={navigationFolder ? parcels.filter(p => (p.folder || 'Tiada Folder') === navigationFolder) : parcels}
              profile={profile}
              onMarkDelivered={(id) => handleStatusChange(id, 'delivered')}
              onClose={() => setIsNavigationModeOpen(false)}
            />
          )}

        <AnimatePresence>
          {/* Parcel Options Modal */}
          {parcelOptionsId && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center backdrop-blur-sm" onClick={() => setParcelOptionsId(null)}>
              <motion.div 
                key="parcel-options"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-3xl p-8 shadow-2xl" 
                onClick={e => e.stopPropagation()}
              >
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 sm:hidden" />
                
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="font-black text-2xl text-gray-900 tracking-tight">Pilihan Parcel</h3>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                      {parcels.find(p => p.id === parcelOptionsId)?.trackingNumber}
                    </p>
                  </div>
                  <button onClick={() => setParcelOptionsId(null)} className="p-3 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-colors">
                    <X size={20} className="text-gray-500" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        const p = parcels.find(p => p.id === parcelOptionsId);
                        if (p) handleEditParcel(p);
                      }}
                      className="flex items-center gap-3 p-4 rounded-2xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all active:scale-95"
                    >
                      <div className="bg-white p-2 rounded-xl shadow-sm">
                        <Edit2 size={18} />
                      </div>
                      <span className="font-black text-xs uppercase">Edit</span>
                    </button>

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(parcels.find(p => p.id === parcelOptionsId)?.trackingNumber || '');
                        setParcelOptionsId(null);
                      }}
                      className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50 text-gray-700 hover:bg-gray-100 transition-all active:scale-95"
                    >
                      <div className="bg-white p-2 rounded-xl shadow-sm">
                        <Copy size={18} />
                      </div>
                      <span className="font-black text-xs uppercase">Salin</span>
                    </button>

                    <button
                      onClick={async () => {
                        const p = parcels.find(p => p.id === parcelOptionsId);
                        if (p && navigator.share) {
                          try {
                            await navigator.share({
                              title: `Parcel ${p.trackingNumber}`,
                              text: `Status: ${p.status === 'delivered' ? 'Selesai' : 'Dalam Penghantaran'}\nTracking: ${p.trackingNumber}\nAlamat: ${p.address}`,
                              url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`
                            });
                          } catch (e) { console.error(e); }
                        }
                        setParcelOptionsId(null);
                      }}
                      className="flex items-center gap-3 p-4 rounded-2xl bg-purple-50 text-purple-700 hover:bg-purple-100 transition-all active:scale-95"
                    >
                      <div className="bg-white p-2 rounded-xl shadow-sm">
                        <Share2 size={18} />
                      </div>
                      <span className="font-black text-xs uppercase">Share</span>
                    </button>

                    <button
                      onClick={() => handleDeleteParcel(parcelOptionsId)}
                      className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 text-red-600 hover:bg-red-100 transition-all active:scale-95"
                    >
                      <div className="bg-white p-2 rounded-xl shadow-sm">
                        <Trash2 size={18} />
                      </div>
                      <span className="font-black text-xs uppercase">Padam</span>
                    </button>
                  </div>

                  <div className="pt-6 border-t border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 px-2">Pindah ke Folder</p>
                    <div className="grid grid-cols-2 gap-3 max-h-[30vh] overflow-y-auto p-1">
                      <button
                        onClick={async () => {
                          try {
                            await updateDoc(doc(db, 'parcels', parcelOptionsId), { folder: null });
                            setParcelOptionsId(null);
                          } catch (e) { handleFirestoreError(e, OperationType.UPDATE, `parcels/${parcelOptionsId}`); }
                        }}
                        className="p-4 rounded-2xl border-2 border-gray-100 hover:border-gray-200 text-gray-600 font-bold text-xs flex items-center justify-center gap-2 transition-all"
                      >
                        <Folder size={16} className="text-gray-400" /> Tiada
                      </button>
                      {folders.map(f => (
                        <button
                          key={f}
                          onClick={async () => {
                            try {
                              await updateDoc(doc(db, 'parcels', parcelOptionsId), { folder: f });
                              setParcelOptionsId(null);
                            } catch (e) { handleFirestoreError(e, OperationType.UPDATE, `parcels/${parcelOptionsId}`); }
                          }}
                          className="p-4 rounded-2xl border-2 border-blue-100 bg-blue-50/50 hover:bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center gap-2 transition-all"
                        >
                          <Folder size={16} className="text-blue-500" /> {f}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

          {/* Edit Parcel Modal */}
          {isEditParcelModalOpen && editingParcel && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95">
                <div className="bg-blue-600 p-4 flex items-center justify-between text-white">
                  <h3 className="font-bold text-lg">Edit Maklumat Parcel</h3>
                  <button onClick={() => setIsEditParcelModalOpen(false)} className="p-1 hover:bg-black/10 rounded-full">
                    <X size={24} />
                  </button>
                </div>
                <form onSubmit={submitEditParcel} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Tracking Number</label>
                    <input 
                      type="text" 
                      value={editingParcel.trackingNumber}
                      onChange={(e) => setEditingParcel({...editingParcel, trackingNumber: e.target.value})}
                      className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Nama Penerima</label>
                    <input 
                      type="text" 
                      value={editingParcel.recipientName}
                      onChange={(e) => setEditingParcel({...editingParcel, recipientName: e.target.value})}
                      className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">No. Phone</label>
                    <input 
                      type="text" 
                      value={editingParcel.recipientPhone || ''}
                      onChange={(e) => setEditingParcel({...editingParcel, recipientPhone: e.target.value})}
                      className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Alamat</label>
                    <textarea 
                      value={editingParcel.address}
                      onChange={(e) => setEditingParcel({...editingParcel, address: e.target.value})}
                      rows={3}
                      className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm text-gray-800 focus:border-blue-500 outline-none resize-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Tag Kawasan</label>
                    <input 
                      type="text" 
                      value={editingParcel.groupTag || ''}
                      onChange={(e) => setEditingParcel({...editingParcel, groupTag: e.target.value})}
                      className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border-2 border-gray-100">
                    <label className="font-bold text-gray-700">Parcel COD?</label>
                    <input 
                      type="checkbox" 
                      checked={editingParcel.isCOD}
                      onChange={(e) => setEditingParcel({...editingParcel, isCOD: e.target.checked})}
                      className="w-6 h-6 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                  {editingParcel.isCOD && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Jumlah COD (RM)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={editingParcel.codAmount || ''}
                        onChange={(e) => setEditingParcel({...editingParcel, codAmount: parseFloat(e.target.value)})}
                        className="w-full border-2 border-orange-200 rounded-xl p-3 font-bold text-orange-600 focus:border-orange-500 outline-none"
                      />
                    </div>
                  )}
                  <div className="flex gap-3 pt-4">
                    <button 
                      type="button"
                      onClick={() => setIsEditParcelModalOpen(false)}
                      className="flex-1 py-4 bg-gray-100 text-gray-700 font-bold rounded-xl"
                    >
                      Batal
                    </button>
                    <button 
                      type="submit"
                      disabled={isSavingEdit}
                      className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSavingEdit ? (
                        <>
                          <RefreshCw className="animate-spin" size={20} />
                          Simpan...
                        </>
                      ) : (
                        'Simpan Perubahan'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Custom Modals */}
          {isCreateFolderModalOpen && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white w-full max-w-sm rounded-2xl p-6 animate-in zoom-in-95 shadow-2xl">
                <h3 className="font-bold text-lg mb-4 text-gray-800">Tambah Folder Baru</h3>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Cth: Taman Melati, Guni A"
                  className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:border-blue-500 focus:ring-0 outline-none mb-6"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && submitCreateFolder()}
                />
                <div className="flex gap-3">
                  <button onClick={() => setIsCreateFolderModalOpen(false)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors">Batal</button>
                  <button onClick={submitCreateFolder} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors">Simpan</button>
                </div>
              </div>
            </div>
          )}

          {folderToDelete && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white w-full max-w-sm rounded-2xl p-6 animate-in zoom-in-95 shadow-2xl">
                <h3 className="font-bold text-lg mb-2 text-gray-800">Padam Folder?</h3>
                <p className="text-gray-600 text-sm mb-6">Adakah anda pasti mahu memadam folder "{folderToDelete}"? Parcel di dalam akan dikembalikan ke "Tiada Folder".</p>
                <div className="flex gap-3">
                  <button onClick={() => setFolderToDelete(null)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors">Batal</button>
                  <button onClick={executeDeleteFolder} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors">Padam</button>
                </div>
              </div>
            </div>
          )}

          {isClearAllModalOpen && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white w-full max-w-sm rounded-2xl p-6 animate-in zoom-in-95 shadow-2xl">
                <h3 className="font-bold text-lg mb-2 text-gray-800">Padam Semua Data?</h3>
                <p className="text-gray-600 text-sm mb-6">Adakah anda pasti mahu memadam semua data parcel? Tindakan ini tidak boleh diundur.</p>
                <div className="flex gap-3">
                  <button onClick={() => setIsClearAllModalOpen(false)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors">Batal</button>
                  <button onClick={executeClearAll} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors">Padam Semua</button>
                </div>
              </div>
            </div>
          )}

          {isClearDeliveredModalOpen && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white w-full max-w-sm rounded-2xl p-6 animate-in zoom-in-95 shadow-2xl">
                <h3 className="font-bold text-lg mb-2 text-gray-800">Padam Sejarah?</h3>
                <p className="text-gray-600 text-sm mb-6">Adakah anda pasti mahu memadam semua sejarah penghantaran yang telah selesai?</p>
                <div className="flex gap-3">
                  <button onClick={() => setIsClearDeliveredModalOpen(false)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors">Batal</button>
                  <button onClick={executeClearDelivered} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors">Padam Sejarah</button>
                </div>
              </div>
            </div>
          )}

          {parcelToDelete && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white w-full max-w-sm rounded-2xl p-6 animate-in zoom-in-95 shadow-2xl">
                <h3 className="font-bold text-lg mb-2 text-gray-800">Padam Parcel?</h3>
                <p className="text-gray-600 text-sm mb-6">Adakah anda pasti mahu memadam parcel ini?</p>
                <div className="flex gap-3">
                  <button onClick={() => setParcelToDelete(null)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors">Batal</button>
                  <button onClick={confirmDeleteParcel} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors">Padam</button>
                </div>
              </div>
            </div>
          )}

          {/* Profile Modal */}
          {isProfileModalOpen && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 -mr-12 -mt-12 w-40 h-40 bg-blue-50 rounded-full" />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="font-black text-2xl text-gray-900 tracking-tight">Profile Rider</h3>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Konfigurasi Akaun</p>
                    </div>
                    <button onClick={() => setIsProfileModalOpen(false)} className="p-3 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-colors">
                      <X size={20} className="text-gray-500" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Nama Rider</label>
                      <div className="relative">
                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                          type="text" 
                          value={riderName}
                          onChange={(e) => setRiderName(e.target.value)}
                          placeholder="Masukkan nama anda"
                          className="w-full border-2 border-gray-100 bg-gray-50/50 rounded-2xl py-4 pl-12 pr-4 font-bold text-gray-800 focus:border-blue-500 focus:bg-white outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Syarikat Kurier</label>
                      <div className="relative">
                        <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                          type="text" 
                          value={courierCompany}
                          onChange={(e) => setCourierCompany(e.target.value)}
                          placeholder="Contoh: Shopee Express (SPX)"
                          className="w-full border-2 border-gray-100 bg-gray-50/50 rounded-2xl py-4 pl-12 pr-4 font-bold text-gray-800 focus:border-blue-500 focus:bg-white outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="p-5 bg-blue-50 rounded-[1.5rem] border border-blue-100">
                      <p className="text-xs text-blue-700 leading-relaxed font-medium">
                        <strong>Nota:</strong> Maklumat ini akan digunakan dalam mesej WhatsApp automatik kepada pelanggan untuk nampak lebih profesional.
                      </p>
                    </div>

                    {profile && (
                      <div className="p-5 bg-gray-50 rounded-[1.5rem] border border-gray-100 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status Akaun</span>
                          {profile.isPro ? (
                            <span className="bg-green-100 text-green-700 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter">PRO ACTIVE</span>
                          ) : (
                            <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter">FREE TRIAL</span>
                          )}
                        </div>
                        {profile.expiryDate && (
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tamat Pada</span>
                            <span className="text-xs font-bold text-gray-700">{new Date(profile.expiryDate).toLocaleDateString('ms-MY')}</span>
                          </div>
                        )}
                        {!profile.isPro && profile.trialStartedAt && (
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Trial Tamat</span>
                            <span className="text-xs font-bold text-gray-700">
                              {new Date(profile.trialStartedAt + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('ms-MY')}
                            </span>
                          </div>
                        )}
                        <div className="pt-3 border-t border-gray-100 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Kuota Scan (Harian)</span>
                            <span className={cn(
                              "text-xs font-black",
                              (profile.dailyScanCount || 0) >= (profile.isPro ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT) ? "text-red-600" : "text-blue-600"
                            )}>
                              {profile.dailyScanCount || 0} / {profile.isPro ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Kuota Scan (Bulanan)</span>
                            <span className={cn(
                              "text-xs font-black",
                              (profile.monthlyScanCount || 0) >= (profile.isPro ? PRO_MONTHLY_LIMIT : FREE_MONTHLY_LIMIT) ? "text-red-600" : "text-blue-600"
                            )}>
                              {profile.monthlyScanCount || 0} / {profile.isPro ? PRO_MONTHLY_LIMIT : FREE_MONTHLY_LIMIT}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {isAdmin && (
                      <button 
                        onClick={() => {
                          setIsProfileModalOpen(false);
                          setIsAdminDashboardOpen(true);
                        }}
                        className="w-full py-4 bg-blue-50 hover:bg-blue-100 text-blue-600 font-black rounded-2xl transition-all flex items-center justify-center gap-2 border-2 border-blue-100 shadow-sm mb-4"
                      >
                        <ShieldCheck size={20} />
                        Buka Admin Dashboard
                      </button>
                    )}

                    <button 
                      onClick={handleSaveProfile}
                      disabled={isSavingProfile || saveSuccess}
                      className={cn(
                        "w-full py-5 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg",
                        saveSuccess ? "bg-green-600 shadow-green-100" : "bg-blue-600 hover:bg-blue-700 shadow-blue-100"
                      )}
                    >
                      {isSavingProfile ? (
                        <>
                          <RefreshCw className="animate-spin" size={24} />
                          Menyimpan...
                        </>
                      ) : saveSuccess ? (
                        <>
                          <CheckCircle2 size={24} />
                          Berjaya!
                        </>
                      ) : (
                        'Simpan Profile'
                      )}
                    </button>

                    <div className="flex justify-center gap-4 pt-4 border-t border-gray-100">
                      <button 
                        onClick={() => setLegalModal({ isOpen: true, type: 'privacy' })}
                        className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-blue-600 transition-colors"
                      >
                        Dasar Privasi
                      </button>
                      <button 
                        onClick={() => setLegalModal({ isOpen: true, type: 'terms' })}
                        className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-blue-600 transition-colors"
                      >
                        Terma & Syarat
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
      </main>

      {/* Bottom Nav Hint */}
      <div className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur-md border-t py-2 px-4 flex justify-center pointer-events-none">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          RouteKing v1.0 • Built for Drivers
        </p>
      </div>

      {/* Admin Dashboard */}
      {isAdminDashboardOpen && (
        <AdminDashboard onClose={() => setIsAdminDashboardOpen(false)} />
      )}

      {/* Subscription Modal */}
      {isSubscriptionModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mr-12 -mt-12 w-40 h-40 bg-blue-50 rounded-full" />
            
            <div className="relative z-10 text-center space-y-6">
              {isSavingProfile ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-4">
                  <RefreshCw className="animate-spin text-blue-600" size={48} />
                  <p className="font-bold text-gray-600">Menghubungi ToyyibPay...</p>
                  <p className="text-xs text-gray-400">Sila tunggu sebentar sementara kami menyediakan invois anda.</p>
                </div>
              ) : (
                <>
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-blue-600">
                    <AlertCircle size={40} />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-black text-2xl text-gray-900 tracking-tight">Masa Percubaan Tamat</h3>
                    <p className="text-gray-600 leading-relaxed">
                      Tempoh percubaan 7 hari anda telah tamat. Langgan sekarang untuk terus menggunakan RouteKing.
                    </p>
                  </div>

                  {error && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold">
                      <AlertCircle size={18} />
                      <p>{error}</p>
                    </div>
                  )}

                  {paymentUrl ? (
                    <div className="space-y-4 py-6">
                      <div className="p-6 bg-green-50 border-2 border-green-100 rounded-[2rem] text-center space-y-3">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
                          <CheckCircle2 size={32} />
                        </div>
                        <p className="font-bold text-green-800">Invois Sedia!</p>
                        <p className="text-xs text-green-600">Sila klik butang di bawah untuk ke portal pembayaran ToyyibPay.</p>
                      </div>
                      <a 
                        href={paymentUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-100 flex items-center justify-center gap-3 text-lg transition-all active:scale-95"
                      >
                        Bayar Sekarang
                        <ArrowRight size={24} />
                      </a>
                      <button 
                        onClick={() => {
                          setPaymentUrl(null);
                          setError(null);
                        }}
                        className="w-full py-2 text-gray-400 font-bold text-xs hover:text-gray-600"
                      >
                        Pilih Pakej Lain
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-4">
                      <button 
                        disabled={isSavingProfile}
                        className={cn(
                          "w-full p-6 bg-blue-50 rounded-3xl border-2 border-blue-100 text-left relative overflow-hidden group hover:border-blue-300 transition-all disabled:opacity-50",
                          isSavingProfile && "cursor-not-allowed"
                        )} 
                        onClick={() => handleRealPayment('monthly')}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-black text-blue-900">Bulanan</span>
                          <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded-full">POPULAR</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-blue-600">RM9.90</span>
                          <span className="text-xs text-blue-400 font-bold">/ bulan</span>
                        </div>
                        <p className="text-[10px] text-blue-400 mt-2 font-bold uppercase tracking-widest">Akses Penuh • Tanpa Had</p>
                        {isSavingProfile && (
                          <div className="absolute inset-0 bg-blue-50/50 flex items-center justify-center">
                            <RefreshCw className="animate-spin text-blue-600" size={24} />
                          </div>
                        )}
                      </button>

                      <button 
                        disabled={isSavingProfile}
                        className={cn(
                          "w-full p-6 bg-gray-50 rounded-3xl border-2 border-gray-100 text-left relative overflow-hidden group hover:border-blue-200 transition-all disabled:opacity-50",
                          isSavingProfile && "cursor-not-allowed"
                        )} 
                        onClick={() => handleRealPayment('yearly')}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-black text-gray-900">Tahunan</span>
                          <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">JIMAT RM30</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-gray-800">RM89.00</span>
                          <span className="text-xs text-gray-400 font-bold">/ tahun</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-widest">Akses Penuh • 12 Bulan</p>
                        {isSavingProfile && (
                          <div className="absolute inset-0 bg-gray-50/50 flex items-center justify-center">
                            <RefreshCw className="animate-spin text-gray-600" size={24} />
                          </div>
                        )}
                      </button>
                    </div>
                  )}

                  <div className="pt-4">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-4">Pilih Kaedah Pembayaran</p>
                    <div className="flex justify-center gap-6 items-center bg-white/50 p-4 rounded-2xl border border-gray-100">
                      <img 
                        src="https://toyyibpay.com/assets/img/logo.png" 
                        alt="ToyyibPay" 
                        className="h-6 object-contain" 
                        referrerPolicy="no-referrer" 
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://placehold.co/120x40?text=ToyyibPay';
                        }}
                      />
                      <div className="w-px h-6 bg-gray-200"></div>
                      <img 
                        src="https://www.paynet.my/images/fpx-logo.png" 
                        alt="FPX" 
                        className="h-6 object-contain" 
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://placehold.co/80x40?text=FPX';
                        }}
                      />
                    </div>
                  </div>

                  <button 
                    onClick={logout}
                    className="w-full py-4 text-gray-400 font-bold text-sm hover:text-gray-600 transition-colors"
                  >
                    Log Keluar
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
