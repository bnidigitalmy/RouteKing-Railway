import { auth, db, doc, getDoc, setDoc } from "../firebase";
import { withRetry } from "./utils";

const isDev = import.meta.env.DEV;
const GEMINI_QUOTA_ERROR_CODE = 'GEMINI_QUOTA_OR_RATE_LIMIT';
const GEMINI_QUOTA_ERROR_MESSAGE =
  "Had penggunaan (Quota) Gemini anda telah tamat atau terlalu laju. Sila tunggu sebentar atau semak baki kredit di Google AI Studio.";

type ApiError = Error & {
  status?: number;
  code?: string;
};

function log(...args: unknown[]) {
  if (isDev) console.log(...args);
}

function warn(...args: unknown[]) {
  if (isDev) console.warn(...args);
}

function hashAddress(address: string): string {
  return address.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 100);
}

const MY_BOUNDS = { latMin: 0.8, latMax: 7.5, lngMin: 99.5, lngMax: 119.5 };

function isWithinMalaysia(lat: number, lng: number): boolean {
  return lat >= MY_BOUNDS.latMin && lat <= MY_BOUNDS.latMax &&
         lng >= MY_BOUNDS.lngMin && lng <= MY_BOUNDS.lngMax;
}

function createApiError(message: string, status?: number, code?: string): ApiError {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.code = code;
  return error;
}

export function isGeminiQuotaError(error: any): boolean {
  const message = String(error?.message || '').toLowerCase();
  return error?.status === 429 ||
         error?.code === GEMINI_QUOTA_ERROR_CODE ||
         message.includes('429') ||
         message.includes('resource_exhausted') ||
         message.includes('quota') ||
         message.includes('kuota') ||
         message.includes('rate limit') ||
         message.includes('terlalu laju');
}

export async function extractParcelInfo(base64Image: string) {
  return withRetry(async () => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error("Sila log masuk untuk menggunakan Gemini OCR.");
      }

      const response = await fetch('/api/ocr/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ image: base64Image }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw createApiError(
          data?.error || "Gagal membaca label melalui Gemini OCR.",
          response.status,
          data?.code
        );
      }
      return data;
    } catch (error: any) {
      if (isGeminiQuotaError(error)) {
        throw createApiError(GEMINI_QUOTA_ERROR_MESSAGE, 429, GEMINI_QUOTA_ERROR_CODE);
      }
      throw error;
    }
  }, {
    maxRetries: 2,
    initialDelay: 2000,
    retryOn: (error: any) => {
      if (isGeminiQuotaError(error)) return false;

      const status = error?.status || error?.response?.status;
      const message = String(error?.message || '').toLowerCase();

      return (typeof status === 'number' && status >= 500) ||
             message.includes('fetch') ||
             message.includes('aborted') ||
             message.includes('network');
    },
  });
}

export interface GeoResult {
  lat: number;
  lng: number;
  isApproximate?: boolean;
}

const localGeocache = new Map<string, GeoResult>();

export async function getCoordinates(address: string): Promise<GeoResult> {
  const addressHash = hashAddress(address);

  if (localGeocache.has(addressHash)) {
    log("Geocache (memory):", address);
    return localGeocache.get(addressHash)!;
  }

  try {
    const cacheDoc = await getDoc(doc(db, 'geocache', addressHash));
    if (cacheDoc.exists()) {
      log("Geocache (Firestore):", address);
      const data = cacheDoc.data();
      const result: GeoResult = { lat: data.lat, lng: data.lng };
      localGeocache.set(addressHash, result);
      return result;
    }
  } catch (e) {
    warn("Geocache read failed:", e);
  }

  let result: GeoResult | null = null;

  try {
    const cleanAddress = address.replace(/No\./gi, '').replace(/Jalan/gi, 'Jln').trim();
    const query = encodeURIComponent(cleanAddress);

    result = await withRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=my&limit=1`,
        { signal: controller.signal, headers: { 'Accept-Language': 'ms,en-US;q=0.7,en;q=0.3' } }
      );
      clearTimeout(timeoutId);

      const data = await response.json();
      if (data?.length > 0) {
        log("OSM geocode success:", address);
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
      return null;
    }, { maxRetries: 2, initialDelay: 1500 });
  } catch (error) {
    warn("OSM geocoding error:", error);
  }

  if (!result) {
    try {
      log("OSM failed, trying backend geocode proxy:", address);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.lat && data.lng) {
          result = { lat: data.lat, lng: data.lng };
          log("Backend geocode proxy success:", address);
        }
      }
    } catch (error) {
      warn("Backend geocoding proxy failed:", error);
    }
  }

  if (result && !isWithinMalaysia(result.lat, result.lng)) {
    warn("Geocoding returned coordinates outside Malaysia bounds - discarding:", result);
    result = null;
  }

  if (!result) {
    warn("All geocoding attempts failed for:", address);
    result = { lat: 3.1390, lng: 101.6869, isApproximate: true };
  }

  localGeocache.set(addressHash, result);
  try {
    await setDoc(doc(db, 'geocache', addressHash), {
      address,
      lat: result.lat,
      lng: result.lng,
      isApproximate: result.isApproximate || false,
      lastUpdated: Date.now(),
    });
  } catch (e) {
    warn("Geocache write failed:", e);
  }

  return result;
}
