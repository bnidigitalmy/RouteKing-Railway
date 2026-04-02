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
}

export interface OptimizationResult {
  optimizedParcels: Parcel[];
  totalDistance: number;
}
