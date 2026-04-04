export interface Parcel {
  id: string;
  trackingNumber: string;
  recipientName?: string;
  recipientPhone?: string;
  address: string;
  status: 'pending' | 'delivered' | 'failed';
  sequenceNumber: number;
  lat?: number;
  lng?: number;
  scannedAt: number;
  deliveredAt?: number;
  isCOD?: boolean;
  codAmount?: number;
  groupTag?: string;
  folder?: string;
  uid: string; // Firebase User ID
}

export interface UserProfile {
  uid: string;
  riderName: string;
  courierCompany: string;
  email?: string;
  role?: 'admin' | 'user';
  isPro?: boolean;
  trialStartedAt?: number;
  expiryDate?: number;
  subscriptionType?: 'monthly' | 'yearly';
  dailyScanCount?: number;
  lastScanResetDate?: string; // ISO date string YYYY-MM-DD
  monthlyScanCount?: number;
  lastScanResetMonth?: string; // ISO date string YYYY-MM
}

export interface OptimizationResult {
  optimizedParcels: Parcel[];
  totalDistance: number;
}
