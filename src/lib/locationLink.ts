import { auth } from "../firebase";

/**
 * Asks the server for a signed, shareable "pin your location" link for a parcel.
 * The rider sends this link to the recipient over WhatsApp; when the recipient
 * opens it and shares their GPS location, the parcel pin updates automatically.
 *
 * Returns null when the user is signed out, the parcel is not theirs, or the
 * feature is not configured on the server (no LOCATION_TOKEN_SECRET).
 */
export async function getPinLocationLink(parcelId: string): Promise<string | null> {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return null;

    const res = await fetch('/api/parcel/location-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ parcelId }),
    });

    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.url ?? null;
  } catch {
    return null;
  }
}
