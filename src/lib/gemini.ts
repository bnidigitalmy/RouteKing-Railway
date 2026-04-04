import { GoogleGenAI, Type } from "@google/genai";
import { db, doc, getDoc, setDoc, handleFirestoreError, OperationType } from "../firebase";
import { withRetry } from "./utils";

// Helper to create a safe document ID from an address
function hashAddress(address: string): string {
  return address.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 100);
}

export async function extractParcelInfo(base64Image: string) {
  // Use custom global injected by Vite or process.env
  // @ts-ignore
  let apiKey = typeof __GEMINI_API_KEY__ !== 'undefined' ? __GEMINI_API_KEY__ : (process.env.CUSTOM_GEMINI_KEY || process.env.GEMINI_API_KEY);
  
  // Fallback to Vite env if process.env fails
  if (!apiKey || apiKey === "undefined" || apiKey === "MY_GEMINI_API_KEY") {
    apiKey = (import.meta as any).env.VITE_CUSTOM_GEMINI_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY || "";
  }

  // Clean up the key just in case user added quotes or spaces
  if (apiKey) {
    apiKey = apiKey.replace(/['"]/g, '').trim();
  }
  
  // Validasi kunci: Mesti ada, bukan placeholder, dan panjang yang munasabah
  if (!apiKey || apiKey === "undefined" || apiKey === "MY_GEMINI_API_KEY" || apiKey.length < 10) {
    const debugStr = apiKey ? `${apiKey.substring(0, 5)}... (${apiKey.length})` : String(apiKey);
    throw new Error(`API Key Gemini tidak sah atau belum di-set (Nilai: ${debugStr}). Sila pastikan anda telah masukkan API Key yang betul dalam menu 'Secrets' dengan nama GEMINI_API_KEY.`);
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // Extract mime type and data
  const mimeType = base64Image.split(';')[0].split(':')[1] || "image/jpeg";
  const base64Data = base64Image.split(',')[1];

  return withRetry(async () => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: [
          {
            parts: [
              {
                text: "Extract from Malaysian AWB: recipientName, recipientPhone, address, trackingNumber, isCOD (bool), codAmount (number). Return JSON only.",
              },
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType,
                },
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recipientName: {
                type: Type.STRING,
                description: "Recipient's full name"
              },
              recipientPhone: {
                type: Type.STRING,
                description: "Recipient's phone number"
              },
              address: { 
                type: Type.STRING,
                description: "Full recipient delivery address"
              },
              trackingNumber: { 
                type: Type.STRING,
                description: "Courier tracking number"
              },
              isCOD: {
                type: Type.BOOLEAN,
                description: "True if COD is mentioned"
              },
              codAmount: {
                type: Type.NUMBER,
                description: "The RM amount for COD if applicable"
              }
            },
            required: ["recipientName", "address", "trackingNumber"],
          },
        },
      });

      if (!response.text) {
        throw new Error("Tiada teks dikesan dalam gambar.");
      }

      return JSON.parse(response.text);
    } catch (error: any) {
      console.error("Gemini OCR Error:", error);
      
      // Handle Quota Exceeded (429) specifically
      if (error?.message?.includes("429") || error?.message?.includes("RESOURCE_EXHAUSTED") || error?.message?.includes("quota")) {
        throw new Error("Had penggunaan (Quota) Gemini anda telah tamat atau terlalu laju. Sila tunggu sebentar atau semak baki kredit di Google AI Studio.");
      }
      
      throw error;
    }
  }, { maxRetries: 2, initialDelay: 2000 });
}

// Real geocoding using Google Maps Geocoding API with Firestore Caching
export async function getCoordinates(address: string) {
  const addressHash = hashAddress(address);
  
  // 1. Check Firestore Cache first
  try {
    const cacheDoc = await getDoc(doc(db, 'geocache', addressHash));
    if (cacheDoc.exists()) {
      console.log("Using cached coordinates for:", address);
      const data = cacheDoc.data();
      return { lat: data.lat, lng: data.lng };
    }
  } catch (e) {
    console.warn("Geocache read failed:", e);
    // Don't throw here, just continue to geocode
  }

  let result: { lat: number, lng: number } | null = null;

  // 2. Try OpenStreetMap (OSM) first - it's FREE!
  try {
    let cleanAddress = address
      .replace(/No\./gi, '')
      .replace(/Jalan/gi, 'Jln')
      .trim();

    const query = encodeURIComponent(cleanAddress);
    
    result = await withRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=my&limit=1`, {
        signal: controller.signal,
        headers: {
          'Accept-Language': 'ms,en-US;q=0.7,en;q=0.3'
        }
      });
      clearTimeout(timeoutId);
      
      const data = await response.json();

      if (data && data.length > 0) {
        console.log("OSM Geocoding success for:", address);
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
      }
      return null;
    }, { maxRetries: 2, initialDelay: 1500 });
  } catch (error) {
    console.error("OSM Geocoding error:", error);
  }

  // 3. Fallback to Google Maps only if OSM fails and key is available
  if (!result) {
    // Use custom global injected by Vite
    // @ts-ignore
    let googleMapsKey = typeof __GOOGLE_MAPS_API_KEY__ !== 'undefined' ? __GOOGLE_MAPS_API_KEY__ : '';
    
    if (!googleMapsKey || googleMapsKey === "undefined") {
      googleMapsKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || "";
    }

    if (googleMapsKey) {
      try {
        console.log("OSM failed, falling back to Google Maps for:", address);
        const query = encodeURIComponent(address);
        
        result = await withRetry(async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          
          const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${query}&components=country:MY&key=${googleMapsKey}`, {
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          const data = await response.json();

          if (data.status === 'OK' && data.results.length > 0) {
            return {
              lat: data.results[0].geometry.location.lat,
              lng: data.results[0].geometry.location.lng,
            };
          } else if (data.status === 'OVER_QUERY_LIMIT' || data.status === 'REQUEST_DENIED') {
            throw new Error(`Google Maps API error: ${data.status}`);
          } else {
            console.warn("Google Maps Geocoding API error:", data.status, data.error_message);
            return null;
          }
        }, { maxRetries: 2 });
      } catch (error) {
        console.error("Google Maps Geocoding error:", error);
      }
    }
  }

  // Fallback if address not found by any API
  if (!result) {
    console.warn("Address not found by geocoder, using fallback coordinates");
    const baseLat = 3.1390;
    const baseLng = 101.6869;
    result = {
      lat: baseLat + (Math.random() - 0.5) * 0.05,
      lng: baseLng + (Math.random() - 0.5) * 0.05,
    };
  }

  // 2. Save to Firestore Cache for next time
  if (result) {
    try {
      await setDoc(doc(db, 'geocache', addressHash), {
        address,
        lat: result.lat,
        lng: result.lng,
        lastUpdated: Date.now()
      });
    } catch (e) {
      console.warn("Geocache write failed:", e);
      // We don't use handleFirestoreError here to avoid blocking the user
      // but we log it for debugging
    }
  }

  return result;
}
