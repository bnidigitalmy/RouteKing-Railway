import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
// Code splitting for large components
const LandingPage = lazy(() => import('./components/LandingPage').then(m => ({ default: m.LandingPage })));
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const Scanner = lazy(() => import('./components/Scanner').then(m => ({ default: m.Scanner })));
const UserGuide = lazy(() => import('./components/UserGuide').then(m => ({ default: m.UserGuide })));
const LegalModal = lazy(() => import('./components/LegalModal').then(m => ({ default: m.LegalModal })));

import { Plus, MapPin, Navigation, Trash2, RefreshCw, Package, ArrowRight, Camera, Search, LayoutGrid, List, Map as MapIcon, Filter, Folder, MoreVertical, LogOut, LogIn, AlertCircle, X, Edit2, User as UserIcon, CheckCircle2, Copy, Share2, ChevronDown, ChevronRight, ShieldCheck, Truck, Settings, Banknote, HelpCircle, Mail, Zap } from 'lucide-react';
import { Parcel, UserProfile } from './types';
import { ParcelCard } from './components/ParcelCard';
import { Stats } from './components/Stats';
import { MapPreview } from './components/MapPreview';
import { NavigationMode } from './components/NavigationMode';
import { FailedDeliveryModal } from './components/FailedDeliveryModal';
import { CODSummaryModal } from './components/CODSummaryModal';
import { HoldButton } from './components/ui/HoldButton';
import { ParcelSkeleton } from './components/ui/Skeleton';
import { optimizeRoute } from './lib/optimizer';
import { getCoordinates } from './lib/gemini';
import { uploadParcelPhoto } from './lib/parcelPhotos';
import { createSubscriptionPayment } from './lib/payments';
import { cn, hapticFeedback } from './lib/utils';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { ConfirmationModal } from './components/ui/ConfirmationModal';
import {
  auth,
  db,
  signInWithGoogle,
  logout,
  collection, 
  doc, 
  setDoc, 
  getDoc,
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

const TIER_LIMITS = {
  free: { daily: 30, monthly: 210 },
  lite: { daily: 80, monthly: 2000 },
  standard: { daily: 180, monthly: 4500 },
  ultimate: { daily: 400, monthly: 10000 }
};

const TRIAL_SCAN_LIMIT = 50;

const MAIN_DOMAIN = 'routeking.my';

export default function App() {
  const isRootDomain = window.location.hostname === MAIN_DOMAIN || window.location.hostname === `www.${MAIN_DOMAIN}`;
  const isAppSubdomain = window.location.hostname.startsWith('app.') || window.location.hostname === 'localhost' || window.location.hostname.includes('ais-dev');
  const isMarketingMode = isRootDomain && !isAppSubdomain;
  
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [isUserGuideOpen, setIsUserGuideOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isNavigationModeOpen, setIsNavigationModeOpen] = useState(false);
  const [navigationFolder, setNavigationFolder] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizingMessage, setOptimizingMessage] = useState('Menyusun laluan...');
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'map'>('list');
  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'delivered' | 'failed' | 'retry' | 'return'>('pending');
  const [filterCOD, setFilterCOD] = useState<boolean>(false);
  const [filterGroup, setFilterGroup] = useState<string>('all');

  // Folder States
  const [folders, setFolders] = useState<{id: string, name: string}[]>([]);
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
  const [isFailedDeliveryModalOpen, setIsFailedDeliveryModalOpen] = useState(false);
  const [isCODSummaryOpen, setIsCODSummaryOpen] = useState(false);
  const [isSusunConfirmOpen, setIsSusunConfirmOpen] = useState(false);
  const [susunTarget, setSusunTarget] = useState<string | null | undefined>(undefined);
  const [parcelForFailure, setParcelForFailure] = useState<Parcel | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [isQuickFindOpen, setIsQuickFindOpen] = useState(false);
  const [quickFindQuery, setQuickFindQuery] = useState('');
  const [legalModal, setLegalModal] = useState<{ isOpen: boolean; type: 'privacy' | 'terms' }>({
    isOpen: false,
    type: 'privacy'
  });
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isTrialExpired, setIsTrialExpired] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showPWAHint, setShowPWAHint] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hasAutoOpenedGuide, setHasAutoOpenedGuide] = useState(false);
  const [riderName, setRiderName] = useState('');
  const [courierCompany, setCourierCompany] = useState('Shopee Express (SPX)');
  const [ratePerParcel, setRatePerParcel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

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
      setPaymentSuccess(true);
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
      setPaymentFailed(true);
      window.history.replaceState({}, document.title, "/");
    } else if (urlParams.get('payment') === 'pending') {
      setError("Pembayaran sedang disahkan. Jika bayaran telah dibuat, akaun akan aktif selepas ToyyibPay mengesahkan transaksi.");
      setIsSubscriptionModalOpen(true);
      window.history.replaceState({}, document.title, "/");
    }

    // Track continuous location
    let watchId: number | null = null;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setStartPoint(prev => {
            // Only update if movement is significant (approx 5-10 meters) to prevent excessive re-renders
            const dist = Math.sqrt(Math.pow(prev.lat - newLoc.lat, 2) + Math.pow(prev.lng - newLoc.lng, 2));
            if (dist > 0.0001) return newLoc;
            return prev;
          });
        },
        (err) => console.warn("Geolocation watch error:", err.message),
        { 
          enableHighAccuracy: true, 
          timeout: 10000, 
          maximumAge: 10000 
        }
      );
    }

    return () => {
      unsubscribe();
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
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
      
      // Efficient unique filtering using a Map
      const uniqueMap = new Map<string, Parcel>();
      parcelData.forEach(p => {
        if (!uniqueMap.has(p.id)) {
          uniqueMap.set(p.id, p);
        }
      });
      const uniqueParcels = Array.from(uniqueMap.values());
      
      setParcels(uniqueParcels);
      setIsLoadingData(false);
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
      const folderData = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        name: doc.data().name as string 
      }));
      
      // Efficient unique filtering
      const folderMap = new Map<string, { id: string; name: string }>();
      folderData.forEach(f => {
        if (!folderMap.has(f.id)) {
          folderMap.set(f.id, f);
        }
      });
      const uniqueFolders = Array.from(folderMap.values());
      
      setFolders(uniqueFolders);
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
        setRatePerParcel(data.ratePerParcel ? String(data.ratePerParcel) : '');
        setIsAdmin(data.role === 'admin');

        // Check subscription status
        const now = Date.now();

        // New: scan-based trial (trialScansUsed is defined)
        const isOnScanTrial = data.trialScansUsed !== undefined;
        const scanTrialActive = isOnScanTrial && (data.trialScansUsed! < TRIAL_SCAN_LIMIT);

        // Legacy: time-based 7-day trial (users created before scan-based trial)
        const legacyTrialActive = !isOnScanTrial && data.trialStartedAt
          ? (now - data.trialStartedAt <= 7 * 24 * 60 * 60 * 1000)
          : false;

        const trialActive = scanTrialActive || legacyTrialActive;
        const subscriptionActive = !!(data.isPro && data.expiryDate && now < data.expiryDate);
        const trialExpired = !trialActive && !subscriptionActive;

        setIsTrialExpired(trialExpired);

        if (!subscriptionActive && (trialExpired || paymentFailed)) {
          setIsSubscriptionModalOpen(true);
        } else if (subscriptionActive) {
          setIsSubscriptionModalOpen(false);
          setPaymentFailed(false);
        }

        // Auto-open User Guide for first-time users
        if (!data.hasSeenOnboarding && !hasAutoOpenedGuide && !isProfileModalOpen) {
          setIsUserGuideOpen(true);
          setHasAutoOpenedGuide(true);
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

  const getAddressHash = (address: string) => {
    return address.toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const handleScan = async (
    data: { recipientName?: string; recipientPhone?: string; address: string; trackingNumber: string; isCOD?: boolean; codAmount?: number; groupTag?: string },
    options?: { keepScannerOpen?: boolean; scanCountOffset?: number }
  ) => {
    if (!user || !profile) return;
    const scanCountOffset = options?.scanCountOffset || 0;

    // Trial scan limit check (scan-based trial users only)
    if (profile.trialScansUsed !== undefined && !profile.isPro) {
      const scansUsed = profile.trialScansUsed + scanCountOffset;
      if (scansUsed >= TRIAL_SCAN_LIMIT) {
        if (!options?.keepScannerOpen) {
          setIsScannerOpen(false);
        }
        setError(`Had scan percubaan telah habis (${scansUsed}/${TRIAL_SCAN_LIMIT}). Langgan RouteKing Pro untuk terus scan!`);
        setIsSubscriptionModalOpen(true);
        return;
      }
    }

    // Quota Check — use Malaysia timezone (UTC+8) so day resets at midnight MYT
    const myt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const today = myt.toISOString().split('T')[0];
    const thisMonth = today.substring(0, 7); // YYYY-MM

    const isNewDay = profile.lastScanResetDate !== today;
    const isNewMonth = profile.lastScanResetMonth !== thisMonth;

    const currentDailyCount = (isNewDay ? 0 : (profile.dailyScanCount || 0)) + scanCountOffset;
    const currentMonthlyCount = (isNewMonth ? 0 : (profile.monthlyScanCount || 0)) + scanCountOffset;

    const tier = profile.subscriptionTier || 'free';
    const dailyLimit = TIER_LIMITS[tier].daily;
    const monthlyLimit = TIER_LIMITS[tier].monthly;

    if (currentDailyCount >= dailyLimit) {
      if (!options?.keepScannerOpen) {
        setIsScannerOpen(false);
      }
      setError(`Had scan harian dicapai (${currentDailyCount}/${dailyLimit}). Sila cuba lagi esok atau upgrade ke Pro.`);
      if (!profile.isPro) setIsSubscriptionModalOpen(true);
      return;
    }

    if (currentMonthlyCount >= monthlyLimit) {
      if (!options?.keepScannerOpen) {
        setIsScannerOpen(false);
      }
      setError(`Had scan bulanan dicapai (${currentMonthlyCount}/${monthlyLimit}). Sila tunggu bulan depan atau upgrade ke Pro.`);
      if (!profile.isPro) setIsSubscriptionModalOpen(true);
      return;
    }

    let coordsResult = await getCoordinates(data.address);
    let coords = { lat: coordsResult.lat, lng: coordsResult.lng };
    if (coordsResult.isApproximate) {
      setError(`Alamat tidak dapat dijumpai secara tepat. Lokasi dianggarkan — sila pinda pin secara manual selepas menambah.`);
    }
    let verifiedNotes = '';
    let isVerified = false;

    // Check for verified address memory
    try {
      const addressHash = getAddressHash(data.address);
      const verifiedRef = doc(db, 'users', user.uid, 'verified_addresses', addressHash);
      const verifiedSnap = await getDoc(verifiedRef);
      if (verifiedSnap.exists()) {
        const vData = verifiedSnap.data();
        coords = { lat: vData.lat, lng: vData.lng };
        verifiedNotes = vData.addressNotes || '';
        isVerified = true;
      }
    } catch (e) {
      console.error("Error checking verified address:", e);
    }
    
    const sanitize = (val: any) => {
      if (val === null || val === undefined || String(val).toLowerCase() === 'null' || String(val).toLowerCase() === 'undefined') {
        return '';
      }
      return String(val).trim();
    };

    const tracking = sanitize(data.trackingNumber);
    if (!tracking) {
      setError("Tracking number tidak dikesan. Sila cuba lagi.");
      return;
    }

    const existing = parcels.find(p => p.trackingNumber === tracking);
    
    if (existing) {
      // Throw error so Scanner can catch and display it
      const errorMsg = `Tracking number ${tracking} sudah ada dalam senarai!`;
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    const parcelId = existing ? existing.id : (typeof crypto.randomUUID === 'function' 
      ? crypto.randomUUID() 
      : Date.now().toString(36) + Math.random().toString(36).substring(2));

    const parcelData: any = {
      id: parcelId,
      recipientName: sanitize(data.recipientName) || 'Tiada Nama',
      recipientPhone: sanitize(data.recipientPhone),
      address: data.address,
      trackingNumber: tracking,
      status: existing ? existing.status : 'pending',
      sequenceNumber: existing ? existing.sequenceNumber : parcels.length + 1,
      lat: coords.lat,
      lng: coords.lng,
      isLocationVerified: isVerified,
      addressNotes: verifiedNotes,
      scannedAt: Date.now(),
      isCOD: !!data.isCOD,
      codAmount: data.codAmount || 0,
      groupTag: data.groupTag || '',
      uid: user.uid
    };

    try {
      await setDoc(doc(db, 'parcels', parcelId), parcelData, { merge: true });
      
      // Update scan counts
      const scanCountUpdate: Record<string, number | string> = {
        dailyScanCount: currentDailyCount + 1,
        lastScanResetDate: today,
        monthlyScanCount: currentMonthlyCount + 1,
        lastScanResetMonth: thisMonth,
      };
      // Increment trial scan counter (scan-based trial only, can never decrease)
      if (profile.trialScansUsed !== undefined && !profile.isPro) {
        scanCountUpdate.trialScansUsed = (profile.trialScansUsed || 0) + scanCountOffset + 1;
      }
      await updateDoc(doc(db, 'profiles', user.uid), scanCountUpdate);

      if (!options?.keepScannerOpen) {
        setIsScannerOpen(false);
      }
      setError(null);
      
      // Success feedback
      hapticFeedback('success');
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
      hapticFeedback('light');
      setIsEditParcelModalOpen(false);
      setEditingParcel(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `parcels/${editingParcel.id}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const markDelivered = useCallback(async (id: string, podPhotoDataUrl?: string) => {
    if (!user) return;
    try {
      const parcelRef = doc(db, 'parcels', id);
      const updateData: any = {
        status: 'delivered',
        deliveredAt: Date.now(),
        failedAt: null,
        failedReason: null,
        failedPhotoUrl: null
      };
      if (podPhotoDataUrl) {
        updateData.podPhotoUrl = await uploadParcelPhoto(user.uid, id, 'pod', podPhotoDataUrl);
      }
      hapticFeedback('success');
      await updateDoc(parcelRef, updateData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `parcels/${id}`);
    }
  }, [user]);

  const markFailed = useCallback(async (id: string, reason: string, status: 'failed' | 'retry' | 'return', failedPhotoDataUrl?: string) => {
    if (!user) return;
    try {
      const parcelRef = doc(db, 'parcels', id);
      const updateData: any = {
        status,
        failedAt: Date.now(),
        failedReason: reason,
        deliveredAt: null,
        podPhotoUrl: null
      };
      if (failedPhotoDataUrl) {
        updateData.failedPhotoUrl = await uploadParcelPhoto(user.uid, id, 'failed', failedPhotoDataUrl);
      }
      hapticFeedback('medium');
      await updateDoc(parcelRef, updateData);
      setIsFailedDeliveryModalOpen(false);
      setParcelForFailure(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `parcels/${id}`);
    }
  }, [user]);

  const [selectedPODParcel, setSelectedPODParcel] = useState<Parcel | null>(null);

  const onStatusChange = useCallback((id: string, status: Parcel['status']) => {
    const p = parcels.find(parcel => parcel.id === id);
    if (!p) return;

    if (status === 'failed') {
      setParcelForFailure(p);
      setIsFailedDeliveryModalOpen(true);
      return;
    }

    const performUpdate = async () => {
      try {
        if (status === 'delivered') {
          await markDelivered(id);
        } else {
          await updateDoc(doc(db, 'parcels', id), { 
            status, 
            deliveredAt: null,
            failedAt: null,
            failedReason: null,
            failedPhotoUrl: null
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `parcels/${id}`);
      }
    };
    performUpdate();
  }, [markDelivered, parcels]);

  const onMoveClick = useCallback((id: string) => {
    setParcelOptionsId(id);
  }, []);

  const onViewPOD = useCallback((parcel: Parcel) => {
    setSelectedPODParcel(parcel);
  }, []);

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
        email: user.email || '',
        riderName: riderName.trim(),
        courierCompany: courierCompany.trim(),
        ratePerParcel: parseFloat(ratePerParcel) || 0
      };

      // Initialize scan-based trial for brand new profiles
      if (!profile) {
        profileData.trialScansUsed = 0;
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

  const handleRealPayment = async (tier: 'lite' | 'standard' | 'ultimate', type: 'monthly' | 'yearly') => {
    if (!user) return;
    setIsSavingProfile(true);
    setError(null);
    setPaymentUrl(null);
    setPaymentFailed(false);
    try {
      const idToken = await user.getIdToken();
      const nextPaymentUrl = await createSubscriptionPayment({
        uid: user.uid,
        email: user.email || '',
        idToken,
        name: riderName || user.displayName,
        phone: profile?.phone || '',
        tier,
        type
      });
      
      setPaymentUrl(nextPaymentUrl);
      // Try to open automatically, but the button will be there as fallback.
      window.open(nextPaymentUrl, '_blank');
    } catch (err: any) {
      console.error("Payment creation failed:", err);
      const msg = err.message || "Gagal memulakan pembayaran";
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
      if (!folders.find(f => f.name === trimmedName)) {
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

  const quickFindResults = React.useMemo(() => {
    if (!quickFindQuery.trim()) return [];
    const query = quickFindQuery.toLowerCase();
    return parcels.filter(p => 
      p.recipientName?.toLowerCase().includes(query) || 
      p.trackingNumber.toLowerCase().includes(query)
    ).slice(0, 3);
  }, [parcels, quickFindQuery]);

  // Memoize folders and their sort order to prevent flickering/re-sorting on every render
  const sortedFolders = React.useMemo(() => {
    const uniqueFoldersByName = folders.filter((f, i, self) => 
      f.name !== 'Tiada Folder' && i === self.findIndex(t => t.name === f.name)
    );
    const allFolders = [{ id: 'system-default-folder', name: 'Tiada Folder' }, ...uniqueFoldersByName];
    
    // Create a copy to sort
    return [...allFolders].sort((a, b) => {
      // Get pending parcels for both folders (from the unfiltered pool for stability)
      const aParcels = parcels.filter(p => (p.folder || 'Tiada Folder') === a.name && p.status !== 'delivered');
      const bParcels = parcels.filter(p => (p.folder || 'Tiada Folder') === b.name && p.status !== 'delivered');
      
      if (aParcels.length === 0) return 1;
      if (bParcels.length === 0) return -1;

      // Find closest parcel in each folder to startPoint
      const aDist = Math.min(...aParcels.map(p => 
        Math.sqrt(Math.pow((p.lat || 0) - startPoint.lat, 2) + Math.pow((p.lng || 0) - startPoint.lng, 2))
      ));
      const bDist = Math.min(...bParcels.map(p => 
        Math.sqrt(Math.pow((p.lat || 0) - startPoint.lat, 2) + Math.pow((p.lng || 0) - startPoint.lng, 2))
      ));

      return aDist - bDist;
    });
  }, [folders, parcels, startPoint]); // Stable dependency on parcels, not filteredParcels

  const LoadingFallback = () => (
    <div className="flex flex-col items-center justify-center p-12 space-y-4">
      <RefreshCw className="text-blue-600 animate-spin" size={32} />
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest animate-pulse">Memuatkan...</p>
    </div>
  );

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="flex flex-col items-center space-y-6 animate-in fade-in duration-700">
          <div className="relative">
            <div className="w-24 h-24 bg-blue-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-blue-200">
              <Truck className="text-white animate-bounce" size={48} />
            </div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-orange-500 rounded-2xl flex items-center justify-center border-4 border-white shadow-lg">
              <RefreshCw className="text-white animate-spin" size={16} />
            </div>
          </div>
          <div className="space-y-3 text-center">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">RouteKing</h2>
            <div className="flex flex-col items-center gap-1">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">Sila Tunggu Sebentar</p>
              <div className="flex justify-center space-x-1 mt-2">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pure Marketing Logic for Root Domain
  if (isMarketingMode) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <LandingPage 
          onStart={() => window.location.href = `https://app.${MAIN_DOMAIN}`} 
          isLoggingIn={false} 
          error={null}
          success={null}
          showMarketing={true}
        />
      </Suspense>
    );
  }

  // Handle domains and subdomains
  const hostname = window.location.hostname;
  const isAppDomain = isAppSubdomain || hostname.includes('.run.app');

  // If we are NOT on the app domain, only show the Landing page with a redirect button
  if (!isAppDomain && hostname !== 'localhost') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <LandingPage 
          onStart={() => window.location.href = `https://app.${hostname}`}
          isLoggingIn={false}
          error={null}
          onClearError={() => {}}
          success={null}
          onClearSuccess={() => {}}
          showMarketing={true}
        />
      </Suspense>
    );
  }

  // App Subdomain Login/Entry
  if (!user) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <LandingPage 
          onStart={handleSignIn} 
          isLoggingIn={isSigningIn} 
          error={error}
          onClearError={() => setError(null)}
          success={paymentSuccess ? "Akaun anda telah berjaya dinaiktaraf!" : null}
          onClearSuccess={() => setPaymentSuccess(false)}
          showMarketing={false} // Only show login UI on app subdomain
        />
      </Suspense>
    );
  }

  const deliveredToday = parcels.filter(p => 
    p.status === 'delivered' && 
    p.deliveredAt && 
    new Date(p.deliveredAt).toDateString() === new Date().toDateString()
  );
  
  const countDeliveredToday = deliveredToday.length;

  const codCollectedToday = deliveredToday
    .filter(p => p.isCOD && p.codAmount)
    .reduce((sum, p) => sum + (p.codAmount || 0), 0);

  const earningsToday = countDeliveredToday * (profile?.ratePerParcel || 0);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
      {/* Header */}
      <header className="bg-blue-600 text-white p-6 pb-12 rounded-b-[40px] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full -mr-20 -mt-20 opacity-50 blur-3xl"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center overflow-hidden p-1">
                <img 
                  src="/logo.png" 
                  alt="RouteKing Logo" 
                  className="w-full h-full object-cover rounded-xl"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight leading-none">RouteKing</h1>
                <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest mt-1">Smart Delivery Assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsQuickFindOpen(true)}
                className="p-2 bg-orange-500 hover:bg-orange-600 rounded-xl transition-all border border-orange-400 shadow-lg flex items-center gap-2"
              >
                <Search size={20} />
                <span className="text-xs font-black uppercase">Cari Stop</span>
              </button>
              {profile?.role === 'admin' && (
                <button 
                  onClick={() => setIsAdminDashboardOpen(true)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/20"
                >
                  <ShieldCheck size={20} />
                </button>
              )}
              <button 
                onClick={() => setIsUserGuideOpen(true)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/20"
                title="Panduan Pengguna"
              >
                <HelpCircle size={20} />
              </button>
              <button 
                onClick={() => setIsProfileModalOpen(true)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/20"
              >
                <Settings size={20} />
              </button>
            </div>
          </div>

          {/* Trial scan warning banner */}
          {profile && !profile.isPro && profile.trialScansUsed !== undefined &&
           profile.trialScansUsed >= 40 && profile.trialScansUsed < TRIAL_SCAN_LIMIT && (
            <button
              onClick={() => setIsSubscriptionModalOpen(true)}
              className="w-full bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-2xl px-4 py-3 flex items-center justify-between transition-all shadow-lg shadow-orange-200"
            >
              <div className="flex items-center gap-2">
                <Zap size={16} className="shrink-0" />
                <span className="text-xs font-black">
                  Tinggal {TRIAL_SCAN_LIMIT - profile.trialScansUsed} scan percubaan sahaja!
                </span>
              </div>
              <span className="text-xs font-black uppercase tracking-wider">Upgrade →</span>
            </button>
          )}

          {/* Earnings & Stats Card */}
          <div className="bg-white rounded-3xl p-5 shadow-2xl border border-blue-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 border border-green-100">
                <Banknote size={32} />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Gaji Hari Ini</p>
                <h2 className="text-2xl font-black text-gray-900 leading-none">RM {earningsToday.toFixed(2)}</h2>
                <p className="text-[10px] font-bold text-green-600 mt-1">
                  {countDeliveredToday} Parcel Selesai
                </p>
              </div>
            </div>
            <button 
              onClick={() => setIsCODSummaryOpen(true)}
              className="text-right hover:bg-gray-50 p-2 rounded-2xl transition-all active:scale-95 border border-transparent hover:border-gray-100"
            >
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">COD Terkumpul</p>
              <h2 className="text-xl font-black text-orange-600 leading-none">
                RM {codCollectedToday.toFixed(2)}
              </h2>
              <p className="text-[9px] font-bold text-blue-500 mt-1 uppercase tracking-tighter">Lihat Butiran</p>
            </button>
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

        <Stats 
          parcels={parcels} 
          isGPSActive={startPoint.lat !== 3.1390 || startPoint.lng !== 101.6869} 
        />

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
                <div className="flex flex-wrap gap-2">
                  {(['all', 'pending', 'delivered', 'failed', 'retry', 'return'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={cn(
                        "flex-1 min-w-[80px] py-2 px-3 rounded-lg text-[10px] font-bold transition-all uppercase tracking-wider",
                        filterStatus === status 
                          ? "bg-blue-600 text-white shadow-md scale-105" 
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      )}
                    >
                      {status === 'all' ? 'Semua' : 
                       status === 'pending' ? 'Hantar' : 
                       status === 'delivered' ? 'Selesai' :
                       status === 'failed' ? 'Gagal' :
                       status === 'retry' ? 'Retry' : 'Return'}
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
                    {uniqueGroups.filter(g => g !== 'all').map(group => (
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
                onClick={() => {
                  setSusunTarget(undefined);
                  setIsSusunConfirmOpen(true);
                }}
                disabled={isOptimizing || parcels.filter(p => p.status === 'pending').length === 0}
                className={cn(
                  "flex-1 py-3 px-4 rounded-2xl font-bold text-sm shadow-md active:scale-95 flex items-center justify-center gap-2",
                  isOptimizing 
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none" 
                    : "bg-blue-600 text-white"
                )}
              >
                {isOptimizing ? <RefreshCw size={18} className="animate-spin" /> : <Navigation size={18} />}
                {isOptimizing ? 'Menyusun...' : 'Susun Laluan'}
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
                {viewMode === 'grid' && <MapIcon size={20} />}
                {viewMode === 'map' && <List size={20} />}
              </button>

              <button
                onClick={confirmClearAll}
                disabled={parcels.length === 0}
                className="p-3 bg-red-50 text-red-600 border-2 border-red-100 rounded-2xl hover:bg-red-100 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed w-12 flex items-center justify-center"
                title="Padam Semua"
              >
                <Trash2 size={20} />
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

            {(() => {
              // If we have a user but data is still loading, show skeletons
              if (user && isLoadingData && !isMarketingMode) {
                return (
                  <div className={cn(
                    "grid gap-3",
                    viewMode === 'grid' ? "grid-cols-2" : "grid-cols-1"
                  )}>
                    {[1, 2, 3, 4, 5, 6].map(i => <ParcelSkeleton key={i} />)}
                  </div>
                );
              }
              
              return sortedFolders.map((folder, folderIdx) => {
                const folderParcels = filteredParcels
                  .filter(p => (p.folder || 'Tiada Folder') === folder.name)
                  .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
                
                if (folder.name === 'Tiada Folder' && folderParcels.length === 0 && folders.some(f => f.name !== 'Tiada Folder')) return null;

                const isCollapsed = collapsedFolders[folder.name] || false;

                return (
                  <div 
                    key={`folder-wrapper-${folder.id}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={async (e) => {
                      e.preventDefault();
                      const parcelId = e.dataTransfer.getData('text/plain');
                      if (parcelId) {
                        try {
                          await updateDoc(doc(db, 'parcels', parcelId), { 
                            folder: folder.name === 'Tiada Folder' ? null : folder.name 
                          });
                        } catch (err) {
                          console.error("Error moving parcel:", err);
                        }
                      }
                    }}
                    className={cn(
                      "rounded-2xl p-3 border-2 transition-colors",
                      folder.name === 'Tiada Folder' ? "bg-transparent border-transparent p-0" : "bg-gray-100/50 border-dashed border-gray-200"
                    )}
                  >
                    <div className={cn("flex items-center justify-between mb-3 px-2", folder.name === 'Tiada Folder' && folderParcels.length === 0 && "hidden")}>
                      <button 
                        onClick={() => setCollapsedFolders(prev => ({ ...prev, [folder.name]: !isCollapsed }))}
                        className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                      >
                        {isCollapsed ? <ChevronRight size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                        <h3 className="font-bold text-gray-700 flex items-center gap-2">
                          {folder.name === 'Tiada Folder' ? <Package size={18} className="text-gray-400" /> : <Folder size={18} className="text-blue-500" />}
                          {folder.name}
                          <span className="bg-gray-200 text-gray-600 text-xs py-0.5 px-2 rounded-full">{folderParcels.length}</span>
                          {folderIdx === 0 && sortedFolders.length > 1 && folderParcels.filter(p => p.status !== 'delivered').length > 0 && (
                            <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 animate-pulse">
                              <Zap size={10} fill="currentColor" /> Terdekat
                            </span>
                          )}
                        </h3>
                      </button>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleStartNavigation(folder.name)} 
                          disabled={folderParcels.filter(p => p.status !== 'delivered').length === 0}
                          className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 hover:bg-green-100 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Navigation size={14} />
                          Mula
                        </button>
                        <button 
                          onClick={() => {
                            setSusunTarget(folder.name);
                            setIsSusunConfirmOpen(true);
                          }}
                          disabled={isOptimizing || folderParcels.filter(p => p.status !== 'delivered').length === 0}
                          className={cn(
                            "flex items-center gap-1 text-[10px] font-black px-2 py-1.5 rounded-lg border flex items-center justify-center gap-1",
                            isOptimizing || folderParcels.filter(p => p.status !== 'delivered').length === 0
                              ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed pointer-events-none"
                              : "text-blue-600 bg-blue-50 border-blue-100 active:scale-95 transition-all"
                          )}
                        >
                          <RefreshCw size={12} className={isOptimizing ? "animate-spin" : ""} />
                          Susun
                        </button>
                        {folder.name !== 'Tiada Folder' && (
                          <button onClick={() => confirmDeleteFolder(folder.name)} className="text-red-400 hover:text-red-600 p-1 ml-1">
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
                        {Array.from(new Map(folderParcels.map(p => [p.id, p])).values()).map(parcel => (
                          <ParcelCard 
                            key={`parcel-card-${parcel.id}`} 
                            parcel={parcel} 
                            profile={profile}
                            onStatusChange={onStatusChange}
                            onMoveClick={() => onMoveClick(parcel.id)}
                            onViewPOD={onViewPOD}
                          />
                        ))}
                        {folderParcels.length === 0 && folder.name !== 'Tiada Folder' && (
                          <div className="col-span-full text-center py-6 text-gray-400 text-sm font-medium border-2 border-dashed border-gray-200 rounded-xl">
                            Tarik parcel ke sini atau guna menu 3-titik
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
            
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
          {isUserGuideOpen && (
            <Suspense fallback={<LoadingFallback />}>
              <UserGuide 
                onClose={() => setIsUserGuideOpen(false)} 
                onComplete={() => {
                  if (user) {
                    updateDoc(doc(db, 'profiles', user.uid), { hasSeenOnboarding: true })
                      .catch(err => console.error("Error updating onboarding status:", err));
                  }
                }}
              />
            </Suspense>
          )}

          {isScannerOpen && (
            <Suspense fallback={<LoadingFallback />}>
              <Scanner 
                onScan={handleScan} 
                onClose={() => setIsScannerOpen(false)} 
                quota={profile ? {
                  current: profile.dailyScanCount || 0,
                  limit: TIER_LIMITS[profile.subscriptionTier || 'free'].daily
                } : undefined}
              />
            </Suspense>
          )}

          {/* Marking Mode Modal */}
          {isMarkingModeOpen && (
            <Suspense fallback={<LoadingFallback />}>
              <Scanner 
                mode="mark"
                onMarkScan={handleMarkingScan}
                onClose={() => setIsMarkingModeOpen(false)} 
                quota={profile ? {
                  current: profile.dailyScanCount || 0,
                  limit: TIER_LIMITS[profile.subscriptionTier || 'free'].daily
                } : undefined}
              />
            </Suspense>
          )}

          {/* Navigation Mode Overlay */}
          {isNavigationModeOpen && (
            <NavigationMode 
              parcels={navigationFolder ? parcels.filter(p => (p.folder || 'Tiada Folder') === navigationFolder) : parcels}
              profile={profile}
              onMarkDelivered={(id, podPhotoUrl) => markDelivered(id, podPhotoUrl)}
              onUpdateParcel={async (id, data) => {
                try {
                  await updateDoc(doc(db, 'parcels', id), data);

                  // If updating location or notes, also update verified_addresses memory
                  if (data.isLocationVerified || data.addressNotes !== undefined) {
                    const parcel = parcels.find(p => p.id === id);
                    if (parcel && user) {
                      const addressHash = getAddressHash(parcel.address);
                      const verifiedRef = doc(db, 'users', user.uid, 'verified_addresses', addressHash);
                      
                      // Get current verified data to merge
                      const verifiedSnap = await getDoc(verifiedRef);
                      const currentVData = verifiedSnap.exists() ? verifiedSnap.data() : {};

                      await setDoc(verifiedRef, {
                        ...currentVData,
                        address: parcel.address,
                        lat: data.lat || parcel.lat || 0,
                        lng: data.lng || parcel.lng || 0,
                        addressNotes: data.addressNotes !== undefined ? data.addressNotes : (currentVData.addressNotes || ''),
                        uid: user.uid,
                        updatedAt: Date.now()
                      }, { merge: true });
                    }
                  }
                } catch (e) {
                  handleFirestoreError(e, OperationType.UPDATE, `parcels/${id}`);
                }
              }}
              onClose={() => setIsNavigationModeOpen(false)}
            />
          )}

          {/* Optimization Loading Overlay */}
          <AnimatePresence>
            {isOptimizing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-blue-600/95 z-[200] flex flex-col items-center justify-center p-8 backdrop-blur-md text-white text-center"
              >
                <div className="relative mb-8">
                  <motion.div
                    animate={{ 
                      scale: [1, 1.2, 1],
                      rotate: [0, 180, 360]
                    }}
                    transition={{ 
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="w-24 h-24 border-4 border-white/30 border-t-white rounded-full"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Navigation size={32} className="text-white animate-pulse" />
                  </div>
                </div>
                
                <h3 className="text-2xl font-black tracking-tight mb-2">Sistem Sedang Berfikir...</h3>
                <p className="text-blue-100 font-bold animate-pulse tracking-wide uppercase text-xs">
                  {optimizingMessage}
                </p>
                
                <div className="mt-12 max-w-xs w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <motion.div 
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ 
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "linear"
                    }}
                    className="w-full h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                  />
                </div>
                
                <p className="mt-8 text-[10px] font-black text-blue-200 uppercase tracking-[0.2em] opacity-50">
                  RouteKing AI Optimizer v1.0
                </p>
              </motion.div>
            )}
          </AnimatePresence>

        <AnimatePresence>
          {/* Failed Delivery Modal */}
          {isFailedDeliveryModalOpen && parcelForFailure && (
            <FailedDeliveryModal 
              parcel={parcelForFailure}
              isOpen={isFailedDeliveryModalOpen}
              onClose={() => {
                setIsFailedDeliveryModalOpen(false);
                setParcelForFailure(null);
              }}
              onConfirm={markFailed}
            />
          )}

          <CODSummaryModal 
            parcels={parcels}
            isOpen={isCODSummaryOpen}
            onClose={() => setIsCODSummaryOpen(false)}
          />

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
                      {folders.filter((f, i, self) => i === self.findIndex(t => t.id === f.id)).map(f => (
                        <button
                          key={`move-to-${f.id}`}
                          onClick={async () => {
                            try {
                              await updateDoc(doc(db, 'parcels', parcelOptionsId), { folder: f.name });
                              setParcelOptionsId(null);
                            } catch (e) { handleFirestoreError(e, OperationType.UPDATE, `parcels/${parcelOptionsId}`); }
                          }}
                          className="p-4 rounded-2xl border-2 border-blue-100 bg-blue-50/50 hover:bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center gap-2 transition-all"
                        >
                          <Folder size={16} className="text-blue-500" /> {f.name}
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

          <ConfirmationModal
            isOpen={!!folderToDelete}
            onClose={() => setFolderToDelete(null)}
            onConfirm={executeDeleteFolder}
            variant="danger"
            title="Padam Folder?"
            description={`Adakah anda pasti mahu memadam folder "${folderToDelete}"? Parcel di dalam akan dikembalikan ke "Tiada Folder".`}
            confirmText="Padam Folder"
            icon={<Folder size={32} />}
          />

          {isClearAllModalOpen && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 animate-in zoom-in-95 shadow-2xl">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="p-4 rounded-full bg-red-50 text-red-500">
                    <Trash2 size={32} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-gray-900 leading-tight">Padam Semua Data?</h3>
                    <p className="text-sm font-medium text-gray-500 px-2">Adakah anda pasti mahu memadam semua data parcel? Tindakan ini tidak boleh diundur.</p>
                  </div>
                  <div className="flex flex-col w-full gap-2 pt-2">
                    <button onClick={executeClearAll} className="w-full py-4 rounded-2xl bg-red-600 text-white font-black text-sm transition-all active:scale-95 shadow-lg">Padam Semua</button>
                    <button onClick={() => setIsClearAllModalOpen(false)} className="w-full py-4 rounded-2xl bg-gray-50 text-gray-400 font-bold text-sm hover:bg-gray-100 transition-all active:scale-95">Batal</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <ConfirmationModal
            isOpen={isSusunConfirmOpen}
            onClose={() => setIsSusunConfirmOpen(false)}
            onConfirm={() => handleOptimize(susunTarget)}
            variant="primary"
            title="Sahkan Susun?"
            description={susunTarget === undefined 
              ? "Sistem akan menyusun laluan untuk SEMUA parcel aktif mengikut kedudukan paling dekat dari Hub." 
              : `Sistem akan menyusun semula parcel dalam folder '${susunTarget}' mengikut turutan jalan yang paling efisien.`}
            confirmText="Ya, Susun Sekarang"
            icon={<Navigation size={32} />}
          />

          <ConfirmationModal
            isOpen={isClearDeliveredModalOpen}
            onClose={() => setIsClearDeliveredModalOpen(false)}
            onConfirm={executeClearDelivered}
            variant="danger"
            title="Padam Sejarah?"
            description="Adakah anda pasti mahu memadam semua sejarah penghantaran yang telah selesai?"
            confirmText="Padam Sejarah"
            icon={<Trash2 size={32} />}
          />

          <ConfirmationModal
            isOpen={!!parcelToDelete}
            onClose={() => setParcelToDelete(null)}
            onConfirm={confirmDeleteParcel}
            variant="danger"
            title="Padam Parcel?"
            description="Adakah anda pasti mahu memadam parcel ini?"
            confirmText="Padam"
            icon={<Trash2 size={32} />}
          />

          {/* Profile Modal */}
          {isProfileModalOpen && (
            <div className="fixed inset-0 bg-black/60 z-50 overflow-y-auto p-4 backdrop-blur-sm flex justify-center items-start sm:items-center py-8">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative overflow-hidden my-auto"
              >
                <div className="absolute top-0 right-0 -mr-12 -mt-12 w-40 h-40 bg-blue-50 rounded-full" />
                
                <div className="relative z-10">
                  <div className="p-8 pb-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-2xl text-gray-900 tracking-tight">Profile Rider</h3>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Konfigurasi Akaun</p>
                    </div>
                    <button onClick={() => setIsProfileModalOpen(false)} className="p-3 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-colors">
                      <X size={20} className="text-gray-500" />
                    </button>
                  </div>

                  <div className="p-8 pt-0 space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Email Pendaftaran</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                          type="email" 
                          value={user?.email || ''} 
                          readOnly
                          className="w-full border-2 border-gray-100 bg-gray-100/50 rounded-2xl py-4 pl-12 pr-4 font-bold text-gray-400 cursor-not-allowed outline-none transition-all"
                        />
                      </div>
                    </div>

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

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Kadar Per Parcel (RM)</label>
                      <div className="relative">
                        <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                          type="number" 
                          step="0.01"
                          value={ratePerParcel}
                          onChange={(e) => setRatePerParcel(e.target.value)}
                          placeholder="Contoh: 1.20"
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
                        {!profile.isPro && profile.trialScansUsed !== undefined && (
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Trial Scan</span>
                              <span className={cn(
                                "text-xs font-black",
                                profile.trialScansUsed >= TRIAL_SCAN_LIMIT ? "text-red-600" :
                                profile.trialScansUsed >= 40 ? "text-orange-500" : "text-blue-600"
                              )}>
                                {profile.trialScansUsed} / {TRIAL_SCAN_LIMIT}
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div
                                className={cn(
                                  "h-1.5 rounded-full transition-all",
                                  profile.trialScansUsed >= TRIAL_SCAN_LIMIT ? "bg-red-500" :
                                  profile.trialScansUsed >= 40 ? "bg-orange-400" : "bg-blue-500"
                                )}
                                style={{ width: `${Math.min(100, (profile.trialScansUsed / TRIAL_SCAN_LIMIT) * 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                        <div className="pt-3 border-t border-gray-100 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Kuota Scan (Harian)</span>
                            <span className={cn(
                              "text-xs font-black",
                              (profile.dailyScanCount || 0) >= TIER_LIMITS[profile.subscriptionTier || 'free'].daily ? "text-red-600" : "text-blue-600"
                            )}>
                              {profile.dailyScanCount || 0} / {TIER_LIMITS[profile.subscriptionTier || 'free'].daily}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Kuota Scan (Bulanan)</span>
                            <span className={cn(
                              "text-xs font-black",
                              (profile.monthlyScanCount || 0) >= TIER_LIMITS[profile.subscriptionTier || 'free'].monthly ? "text-red-600" : "text-blue-600"
                            )}>
                              {profile.monthlyScanCount || 0} / {TIER_LIMITS[profile.subscriptionTier || 'free'].monthly}
                            </span>
                          </div>
                        </div>
                        
                        {!profile.isPro && (
                          <button 
                            onClick={() => {
                              setIsProfileModalOpen(false);
                              setIsSubscriptionModalOpen(true);
                            }}
                            className="w-full mt-4 py-3 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-100 active:scale-95"
                          >
                            <ShieldCheck size={18} />
                            UPGRADE KE PRO SEKARANG
                          </button>
                        )}
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

                    <div className="pt-4 space-y-3 border-t border-gray-100">
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

                      <button 
                        onClick={() => {
                          setIsProfileModalOpen(false);
                          logout();
                        }}
                        className="w-full py-4 text-gray-400 font-bold text-sm hover:text-red-500 transition-colors flex items-center justify-center gap-2"
                      >
                        <LogOut size={16} />
                        Log Keluar Akaun
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
        <Suspense fallback={<div className="fixed inset-0 z-[100] bg-white flex items-center justify-center"><LoadingFallback /></div>}>
          <AdminDashboard onClose={() => setIsAdminDashboardOpen(false)} />
        </Suspense>
      )}

      {/* Legal Modals */}
      {legalModal.isOpen && (
        <Suspense fallback={<LoadingFallback />}>
          <LegalModal 
            type={legalModal.type} 
            onClose={() => setLegalModal({ ...legalModal, isOpen: false })} 
          />
        </Suspense>
      )}

      {/* Payment Success Overlay */}
      <AnimatePresence>
        {paymentSuccess && (
          <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-6 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 text-center space-y-6 shadow-2xl"
            >
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
                <CheckCircle2 size={48} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">Pembayaran Berjaya!</h3>
                <p className="text-gray-500 font-medium">
                  Terima kasih! Akaun anda telah dinaiktaraf ke pelan Pro. Selamat menggunakan RouteKing!
                </p>
              </div>
              <button 
                onClick={() => setPaymentSuccess(false)}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
              >
                Mula Sekarang
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Subscription Modal */}
      {isSubscriptionModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-[100] overflow-y-auto p-4 backdrop-blur-md flex justify-center items-start sm:items-center py-8">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative overflow-hidden my-auto"
          >
            <div className="absolute top-0 right-0 -mr-12 -mt-12 w-40 h-40 bg-blue-50 rounded-full" />
            
            <div className="relative z-10 text-center p-8 space-y-6">
              {(!isTrialExpired || paymentFailed) && !isSavingProfile && (
                <button 
                  onClick={() => {
                    setIsSubscriptionModalOpen(false);
                    setPaymentFailed(false);
                  }}
                  className="absolute top-0 right-0 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={24} />
                </button>
              )}
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
                    <h3 className="font-black text-2xl text-gray-900 tracking-tight">
                      {paymentFailed ? "Pembayaran Tidak Berjaya" : "Had Scan Percubaan Tamat"}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {paymentFailed
                        ? "Maaf, pembayaran anda tidak berjaya atau telah dibatalkan. Sila cuba lagi untuk mengaktifkan akaun Pro anda."
                        : profile?.trialScansUsed !== undefined
                          ? `Anda telah menggunakan kesemua ${TRIAL_SCAN_LIMIT} scan percubaan. Langgan sekarang untuk terus menggunakan RouteKing tanpa had!`
                          : "Tempoh percubaan anda telah tamat. Langgan sekarang untuk terus menggunakan RouteKing."}
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
                    <div className="space-y-3 pt-4 max-h-[60vh] overflow-y-auto px-2">
                      {/* Lite Tier */}
                      <button 
                        disabled={isSavingProfile}
                        className={cn(
                          "w-full p-4 bg-blue-50 rounded-3xl border-2 border-blue-100 text-left relative overflow-hidden group hover:border-blue-300 transition-all disabled:opacity-50",
                          isSavingProfile && "cursor-not-allowed"
                        )} 
                        onClick={() => handleRealPayment('lite', 'monthly')}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-black text-blue-900">Lite</span>
                          <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded-full">80 SCAN/HARI</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-black text-blue-600">RM14.90</span>
                          <span className="text-xs text-blue-400 font-bold">/ bulan</span>
                        </div>
                        <p className="text-[10px] text-blue-400 mt-1 font-bold uppercase tracking-widest">Basic Routing • OSM Only</p>
                      </button>

                      {/* Standard Tier */}
                      <button 
                        disabled={isSavingProfile}
                        className={cn(
                          "w-full p-4 bg-purple-50 rounded-3xl border-2 border-purple-100 text-left relative overflow-hidden group hover:border-purple-300 transition-all disabled:opacity-50",
                          isSavingProfile && "cursor-not-allowed"
                        )} 
                        onClick={() => handleRealPayment('standard', 'monthly')}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-black text-purple-900">Standard</span>
                          <span className="bg-purple-600 text-white text-[10px] font-bold px-2 py-1 rounded-full">180 SCAN/HARI</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-black text-purple-600">RM29.90</span>
                          <span className="text-xs text-purple-400 font-bold">/ bulan</span>
                        </div>
                        <p className="text-[10px] text-purple-400 mt-1 font-bold uppercase tracking-widest">Advanced Routing • Gmaps Fallback</p>
                      </button>

                      {/* Ultimate Tier */}
                      <button 
                        disabled={isSavingProfile}
                        className={cn(
                          "w-full p-4 bg-orange-50 rounded-3xl border-2 border-orange-100 text-left relative overflow-hidden group hover:border-orange-300 transition-all disabled:opacity-50",
                          isSavingProfile && "cursor-not-allowed"
                        )} 
                        onClick={() => handleRealPayment('ultimate', 'monthly')}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-black text-orange-900">Ultimate</span>
                          <span className="bg-orange-600 text-white text-[10px] font-bold px-2 py-1 rounded-full">400 SCAN/HARI</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-black text-orange-600">RM49.90</span>
                          <span className="text-xs text-orange-400 font-bold">/ bulan</span>
                        </div>
                        <p className="text-[10px] text-orange-400 mt-1 font-bold uppercase tracking-widest">Priority Support • Unlimited History</p>
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
      <AnimatePresence>
        {isQuickFindOpen && (
          <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setIsQuickFindOpen(false)}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">Cari Nombor Stop</h3>
                <button onClick={() => setIsQuickFindOpen(false)} className="p-2 bg-gray-100 rounded-full">
                  <X size={20} />
                </button>
              </div>

              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  autoFocus
                  type="text"
                  placeholder="Taip Nama atau Tracking..."
                  value={quickFindQuery}
                  onChange={(e) => setQuickFindQuery(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl py-4 pl-12 pr-4 font-bold text-lg focus:border-orange-500 focus:ring-0 outline-none transition-all"
                />
              </div>

              <div className="space-y-4">
                {(() => {
                  const filtered = quickFindResults.filter((p, i, self) => i === self.findIndex(t => t.id === p.id));
                  if (filtered.length > 0) {
                    return filtered.map(p => (
                      <div key={`quickfind-${p.id}`} className="bg-orange-50 border-2 border-orange-100 rounded-3xl p-6 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">{p.trackingNumber}</p>
                          <h4 className="font-black text-gray-900 text-lg truncate">{p.recipientName}</h4>
                          <p className="text-xs text-gray-500 font-medium truncate">{p.address}</p>
                        </div>
                        <div className="flex flex-col items-center ml-4">
                          <p className="text-[10px] font-black text-orange-500 uppercase mb-1">STOP #</p>
                          <div className="w-20 h-20 bg-orange-500 text-white rounded-2xl flex items-center justify-center text-4xl font-black shadow-lg shadow-orange-200">
                            {p.sequenceNumber}
                          </div>
                        </div>
                      </div>
                    ));
                  }
                  return quickFindQuery ? (
                    <div className="text-center py-12 text-gray-400">
                      <AlertCircle size={48} className="mx-auto mb-3 opacity-20" />
                      <p className="font-bold">Parcel tidak dijumpai.</p>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <p className="text-sm font-medium">Sila masukkan maklumat untuk mencari.</p>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedPODParcel && (selectedPODParcel.podPhotoUrl || selectedPODParcel.failedPhotoUrl) && (
          <div 
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={() => setSelectedPODParcel(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute top-4 right-4 z-10">
                <button 
                  onClick={() => setSelectedPODParcel(null)}
                  className="p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <img 
                src={selectedPODParcel.podPhotoUrl || selectedPODParcel.failedPhotoUrl} 
                alt="Bukti Penghantaran" 
                className={cn(
                  "w-full h-auto max-h-[70vh] object-contain bg-gray-100",
                  selectedPODParcel.status === 'failed' && "sepia-[0.3]"
                )}
                referrerPolicy="no-referrer"
              />
              <div className="p-6 bg-white">
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn(
                    "p-2 rounded-xl",
                    selectedPODParcel.status === 'delivered' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                  )}>
                    {selectedPODParcel.status === 'delivered' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 leading-none">
                      {selectedPODParcel.status === 'delivered' ? 'Bukti Penghantaran' : 'Bukti Kegagalan'}
                    </h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                      {selectedPODParcel.trackingNumber}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 font-medium leading-relaxed">
                  {selectedPODParcel.status === 'delivered' 
                    ? 'Gambar ini disimpan sebagai bukti parcel telah selamat sampai ke tangan penerima.'
                    : `Sebab Gagal: ${selectedPODParcel.failedReason || 'Tidak dinyatakan'}`
                  }
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
