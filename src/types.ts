export interface Parcel {
  id: string;
  trackingNumber: string;
  recipientName?: string;
  recipientPhone?: string;
  address: string;
  status: 'pending' | 'delivered' | 'failed' | 'retry' | 'return';
  sequenceNumber: number;
  lat?: number;
  lng?: number;
  scannedAt: number;
  deliveredAt?: number;
  failedAt?: number;
  failedReason?: string;
  failedPhotoUrl?: string;
  podPhotoUrl?: string;
  isCOD?: boolean;
  codAmount?: number;
  groupTag?: string;
  folder?: string;
  addressNotes?: string;
  isLocationVerified?: boolean;
  isCustomerPinned?: boolean; // location shared by the recipient via pin link
  uid: string; // Firebase User ID
}

export interface UserProfile {
  uid: string;
  riderName: string;
  courierCompany: string;
  email?: string;
  phone?: string;
  role?: 'admin' | 'user';
  isPro?: boolean;
  ratePerParcel?: number;
  trialStartedAt?: number;
  expiryDate?: number;
  subscriptionType?: 'monthly' | 'yearly';
  subscriptionTier?: 'free' | 'lite' | 'standard' | 'ultimate';
  dailyScanCount?: number;
  lastScanResetDate?: string; // ISO date string YYYY-MM-DD
  monthlyScanCount?: number;
  lastScanResetMonth?: string; // ISO date string YYYY-MM
  trialScansUsed?: number; // scan-based trial counter (new users); undefined = legacy time-based trial
  hasSeenOnboarding?: boolean;
}

export interface OptimizationResult {
  optimizedParcels: Parcel[];
  totalDistance: number;
}

export interface Discount {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  expiryDate?: number;
  usageLimit?: number;
  usageCount: number;
  isActive: boolean;
  createdAt: number;
}
