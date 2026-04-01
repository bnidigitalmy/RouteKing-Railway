export interface Parcel {
  id: string;
  trackingNumber: string;
  recipientName?: string;
  address: string;
  status: 'pending' | 'delivered' | 'failed';
  sequenceNumber: number;
  lat?: number;
  lng?: number;
  scannedAt: number;
  isCOD?: boolean;
  codAmount?: number;
}

export interface OptimizationResult {
  optimizedParcels: Parcel[];
  totalDistance: number;
}
