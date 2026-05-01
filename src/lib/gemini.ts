import { GoogleGenAI, Type } from "@google/genai";
import { db, doc, getDoc, setDoc } from "../firebase";
import { withRetry } from "./utils";

const isDev = import.meta.env.DEV;

function log(...args: unknown[]) {
  if (isDev) console.log(...args);
}

function warn(...args: unknown[]) {
  if (isDev) console.warn(...args);
}

function hashAddress(address: string): string {
  return address.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 100);
}

// Malaysia bounding box for coordinate validation
const MY_BOUNDS = { latMin: 0.8, latMax: 7.5, lngMin: 99.5, lngMax: 119.5 };

function isWithinMalaysia(lat: number, lng: number): boolean {
  return lat >= MY_BOUNDS.latMin && lat <= MY_BOUNDS.latMax &&
         lng >= MY_BOUNDS.lngMin && lng <= MY_BOUNDS.lngMax;
}

export async function extractParcelInfo(base64Image: string) {
  // @ts-ignore — injected by Vite define
  let apiKey = typeof __GEMINI_API_KEY__ !== 'undefined' ? __GEMINI_API_KEY__ : '';

  if (!apiKey || apiKey === 'undefined' || apiKey === 'MY_GEMINI_API_KEY') {
    apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || '';
  }

  if (apiKey) apiKey = apiKey.replace(/['"]/g, '').trim();

  if (!apiKey || apiKey.length < 10) {
    throw new Error(
      `API Key Gemini tidak sah atau belum di-set. Sila masukkan API Key yang betul dalam menu 'Secrets' dengan nama GEMINI_API_KEY.`
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const mimeType = base64Image.split(';')[0].split(':')[1] || 'image/jpeg';
  const base64Data = base64Image.split(',')[1];

  return withRetry(async () => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            {
              text: "Extract from Malaysian AWB: recipientName, recipientPhone, address, trackingNumber, isCOD (bool), codAmount (number). Return JSON only.",
            },
            { inlineData: { data: base64Data, mimeType } },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recipientName: { type: Type.STRING, description: "Recipient's full name" },
              recipientPhone: { type: Type.STRING, description: "Recipient's phone number" },
              address: { type: Type.STRING, description: "Full recipient delivery address" },
              trackingNumber: { type: Type.STRING, description: "Courier tracking number" },
              isCOD: { type: Type.BOOLEAN, description: "True if COD is mentioned" },
              codAmount: { type: Type.NUMBER, description: "The RM amount for COD if applicable" },
            },
            required: ['recipientName', 'address', 'trackingNumber'],
          },
        },
      });

      if (!response.text) throw new Error("Tiada teks dikesan dalam gambar.");
      return JSON.parse(response.text);
    } catch (error: any) {
      if (
        error?.message?.includes('429') ||
        error?.message?.includes('RESOURCE_EXHAUSTED') ||
        error?.message?.includes('quota')
      ) {
        throw new Error(
          "Had penggunaan (Quota) Gemini anda telah tamat atau terlalu laju. Sila tunggu sebentar atau semak baki kredit di Google AI Studio."
        );
      }
      throw error;
    }
  }, { maxRetries: 2, initialDelay: 2000 });
}

export interface GeoResult {
  lat: number;
  lng: number;
  isApproximate?: boolean;
}

// Session-level memory cache (cleared on page reload)
const localGeocache = new Map<string, GeoResult>();

export async function getCoordinates(address: string): Promise<GeoResult> {
  const addressHash = hashAddress(address);

  // 1. Session memory cache
  if (localGeocache.has(addressHash)) {
    log("Geocache (memory):", address);
    return localGeocache.get(addressHash)!;
  }

  // 2. Firestore cache
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

  // 3. OpenStreetMap (free, primary)
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

  // 4. Backend Google Maps proxy (keeps API key server-side)
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

  // 5. Validate coordinates are within Malaysia
  if (result && !isWithinMalaysia(result.lat, result.lng)) {
    warn("Geocoding returned coordinates outside Malaysia bounds — discarding:", result);
    result = null;
  }

  // 6. Fallback: use Kuala Lumpur centre and mark as approximate
  if (!result) {
    warn("All geocoding attempts failed for:", address);
    result = { lat: 3.1390, lng: 101.6869, isApproximate: true };
  }

  // Save to caches (including approximate — user can correct later)
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
