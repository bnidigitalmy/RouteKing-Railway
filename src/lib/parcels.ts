import { auth } from "../firebase";
import { Parcel } from "../types";

type CreateScannedParcelInput = Omit<Parcel, 'uid' | 'status' | 'scannedAt'> & {
  status?: Parcel['status'];
  scannedAt?: number;
  uid?: string;
};

export async function createScannedParcel(input: CreateScannedParcelInput): Promise<Parcel> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) {
    throw new Error("Sila log masuk untuk simpan parcel.");
  }

  const response = await fetch('/api/parcels/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(input),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || "Gagal simpan parcel. Sila cuba lagi.");
  }

  if (!data?.parcel) {
    throw new Error("Gagal simpan parcel. Sila cuba lagi.");
  }

  return data.parcel as Parcel;
}
