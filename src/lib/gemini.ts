import { auth, db, doc, getDoc, setDoc } from "../firebase";
import { withRetry } from "./utils";
import {
  addressRegionMatchesMetadata,
  buildAddressWithRegionHint,
  describeRegionHint,
  fallbackCoordinateForAddress,
  inferAddressRegion,
  isCoordinateCompatibleWithAddress,
  regionMetadataForAddress,
  stateFromText,
} from "./malaysiaGeo";

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
  const regionHint = inferAddressRegion(address);
  const expectedRegion = describeRegionHint(regionHint);

  if (localGeocache.has(addressHash)) {
    const cached = localGeocache.get(addressHash)!;
    if (isCoordinateCompatibleWithAddress(address, cached.lat, cached.lng)) {
      log("Geocache (memory):", address);
      return cached;
    }
    warn(`Geocache (memory) ignored: coordinate does not match ${expectedRegion}`, { address, cached });
    localGeocache.delete(addressHash);
  }

  try {
    const cacheDoc = await getDoc(doc(db, 'geocache', addressHash));
    if (cacheDoc.exists()) {
      log("Geocache (Firestore):", address);
      const data = cacheDoc.data();
      const lat = Number(data.lat);
      const lng = Number(data.lng);
      if (
        isCoordinateCompatibleWithAddress(address, lat, lng) &&
        addressRegionMatchesMetadata(address, data)
      ) {
        const result: GeoResult = { lat, lng };
        localGeocache.set(addressHash, result);
        return result;
      }
      warn(`Geocache ignored: coordinate does not match ${expectedRegion}`, data);
    }
  } catch (e) {
    warn("Geocache read failed:", e);
  }

  let result: GeoResult | null = null;

  try {
    log("Trying backend geocode proxy:", address);
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
      throw new Error("Sila log masuk untuk geocode alamat.");
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const lat = Number(data.lat);
      const lng = Number(data.lng);
      if (isCoordinateCompatibleWithAddress(address, lat, lng)) {
        result = { lat, lng };
        log("Backend geocode proxy success:", address);
      } else {
        warn(`Backend geocode ignored: coordinate does not match ${expectedRegion}`, data);
      }
    } else {
      const data = await response.json().catch(() => null);
      warn("Backend geocoding proxy did not return a usable result:", data || response.status);
    }
  } catch (error) {
    warn("Backend geocoding proxy failed:", error);
  }

  if (!result) {
    try {
      result = await withRetry(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const cleanAddress = buildAddressWithRegionHint(
          address.replace(/No\./gi, '').replace(/Jalan/gi, 'Jln').trim()
        );
        const query = encodeURIComponent(cleanAddress);

        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${query}&countrycodes=my&limit=5`,
          { signal: controller.signal, headers: { 'Accept-Language': 'ms,en-US;q=0.7,en;q=0.3' } }
        );
        clearTimeout(timeoutId);

        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const match = data
            .map((item: any) => ({
              lat: Number(item.lat),
              lng: Number(item.lon),
              postcode: item?.address?.postcode,
              state: stateFromText(String(item?.address?.state || item?.address?.county || '')),
            }))
            .find((item: any) => (
              isCoordinateCompatibleWithAddress(address, item.lat, item.lng) &&
              addressRegionMatchesMetadata(address, item)
            ));

          if (match) {
            log("OSM geocode success:", address);
            return { lat: match.lat, lng: match.lng };
          }

          warn(`OSM geocode ignored: no candidate matched ${expectedRegion}`, data.slice(0, 3));
        }
        return null;
      }, { maxRetries: 2, initialDelay: 1500 });
    } catch (error) {
      warn("OSM geocoding error:", error);
    }
  }

  if (result && !isCoordinateCompatibleWithAddress(address, result.lat, result.lng)) {
    warn(`Geocoding returned coordinates outside expected region ${expectedRegion} - discarding:`, result);
    result = null;
  }

  if (!result) {
    warn(`All geocoding attempts failed for ${expectedRegion}:`, address);
    result = fallbackCoordinateForAddress(address);
  }

  localGeocache.set(addressHash, result);
  try {
    await setDoc(doc(db, 'geocache', addressHash), {
      address,
      lat: result.lat,
      lng: result.lng,
      isApproximate: result.isApproximate || false,
      lastUpdated: Date.now(),
      ...regionMetadataForAddress(address),
    });
  } catch (e) {
    warn("Geocache write failed:", e);
  }

  return result;
}
